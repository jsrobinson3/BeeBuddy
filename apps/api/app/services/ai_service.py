"""AI chat service — provider-agnostic LLM integration.

Supported providers (via LLM_PROVIDER env var):
  - ollama        Local dev (OpenAI-compatible API)
  - openai        OpenAI API
  - anthropic     Anthropic Messages API
  - huggingface   HF Inference Endpoints (TGI, OpenAI-compatible)
  - bedrock       AWS Bedrock (planned)
"""

import asyncio
import json
import logging
import re
from collections.abc import AsyncGenerator
from uuid import UUID

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import LLMProvider, get_settings
from app.models.ai_conversation import AIConversation
from app.models.user import User
from app.schemas.ai import ChatRequest
from app.services import ag_data_service, pending_action_service, tool_executor

logger = logging.getLogger(__name__)
settings = get_settings()

SYSTEM_PROMPT_TEMPLATE = """You are Buddy, a beekeeping assistant built into \
the BeeBuddy app. You combine real expertise with an approachable tone — think \
experienced mentor at the bee yard, not textbook or chatbot.

Personality:
- Warm and direct. No corporate filler ("It's important to note…"), but don't \
strip personality either.
- Confident when the science is clear; honest when it's debated or regional.
- Say "I'm not sure" when you genuinely are, and suggest a local extension \
service or bee club for hands-on help.

Depth:
- Lead with a clear answer, then give the *why* — beekeepers learn faster when \
they understand the reasoning, not just the action.
- For simple questions, keep it brief. For treatment decisions, disease ID, \
seasonal management, or anything where mistakes are costly, give thorough \
guidance with reasoning.
- Use bullet points for steps and lists. Use short paragraphs for explanations.

Safety:
- Never recommend anything that could harm bees, pollinators, or contaminate \
hive products.
- For chemical treatments, always mention withdrawal periods and label compliance.

{context}"""

TOOL_SYSTEM_ADDENDUM = """

You have access to tools that can query the beekeeper's actual data — their apiaries, \
hives, inspections, harvests, treatments, queens, events, and tasks. When the user asks \
about their own data (e.g. "how many hives do I have?", "when was my last inspection?", \
"how much honey did I harvest this year?"), use the appropriate tool to look up the real \
answer. For general beekeeping knowledge questions, answer from your training data without \
using tools.

You also have tools that can create, update, and delete records. When the user asks you \
to create or modify data, use the appropriate write tool. Write tools don't execute \
immediately — they prepare a pending action that the user must confirm in the app. \
Always explain what you're proposing and let them know they'll need to confirm."""


class ColdStartError(Exception):
    """Raised when an inference endpoint is scaled to zero (503)."""


# Retry delays for cold-start endpoints (scale-to-zero). ~120s total.
_COLD_START_DELAYS = [5, 5, 10, 10, 15, 15, 20, 20, 20]


_PENDING_RE = re.compile(r'\[PENDING:([0-9a-f-]{36})\]')


def _extract_pending_ids(text: str) -> list[str]:
    """Extract pending action UUIDs from [PENDING:uuid] markers."""
    return _PENDING_RE.findall(text)


def _strip_pending_markers(text: str) -> str:
    """Remove [PENDING:uuid] markers from text."""
    return _PENDING_RE.sub('', text).strip()


async def _yield_tool_response(
    final_text: str, db: AsyncSession | None = None,
) -> AsyncGenerator[str, None]:
    """Yield a tool-augmented response as SSE chunks (no [DONE] — caller sends it)."""
    yield f"data: {json.dumps({'status': 'fetching_data'})}\n\n"

    # Extract and emit pending action events
    if db:
        for action_id in _extract_pending_ids(final_text):
            action = await pending_action_service.get_action(
                db, UUID(action_id),
            )
            if action:
                event = {
                    "pending_action": {
                        "id": str(action.id),
                        "actionType": action.action_type,
                        "resourceType": action.resource_type,
                        "summary": action.summary,
                        "payload": action.payload,
                        "expiresAt": action.expires_at.isoformat(),
                    }
                }
                yield f"data: {json.dumps(event)}\n\n"

    # Strip markers from displayed text
    clean_text = _strip_pending_markers(final_text)
    for i in range(0, len(clean_text), 80):
        yield f"data: {json.dumps({'content': clean_text[i:i + 80]})}\n\n"


async def _yield_streaming_response(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream LLM response with cold-start retry logic. Yields (sse_chunk, token) pairs."""
    sent_waking = False
    for attempt in range(len(_COLD_START_DELAYS) + 1):
        try:
            async for chunk in _stream_llm(messages):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            break
        except ColdStartError:
            if not sent_waking:
                yield f"data: {json.dumps({'status': 'waking_up'})}\n\n"
                sent_waking = True
            if attempt >= len(_COLD_START_DELAYS):
                msg = "Service is still starting up. Please try again shortly."
                yield f"data: {json.dumps({'error': msg})}\n\n"
                return
            delay = _COLD_START_DELAYS[attempt]
            logger.info("Endpoint cold-starting, retry %d in %ds", attempt + 1, delay)
            await asyncio.sleep(delay)


async def stream_chat(
    db: AsyncSession,
    user: User,
    request: ChatRequest,
) -> AsyncGenerator[str, None]:
    """Stream a chat response, trying tool path first then falling back to streaming."""
    context = await ag_data_service.build_context_block()
    system = SYSTEM_PROMPT_TEMPLATE.format(context=context) + TOOL_SYSTEM_ADDENDUM

    messages = [{"role": "system", "content": system}]
    messages.extend(
        {"role": m.role, "content": m.content}
        for m in request.messages
        if m.role in ("user", "assistant")
    )

    # Phase 1: Try tool-augmented path (non-streaming)
    try:
        final_text, tool_msgs = await tool_executor.try_tool_path(messages, db, user.id)
        if final_text is not None:
            async for chunk in _yield_tool_response(final_text, db):
                yield chunk
            conv = await _save_conversation(db, user.id, request, final_text, tool_msgs)
            yield f"data: {json.dumps({'conversation_id': str(conv.id)})}\n\n"
            yield "data: [DONE]\n\n"
            return
    except Exception:
        logger.exception("Tool path failed, falling back to streaming")

    # Phase 2: Streaming path with cold-start retry
    full_response: list[str] = []
    async for chunk in _yield_streaming_response(messages):
        yield chunk
        if '"content"' in chunk:
            try:
                data = json.loads(chunk[6:].strip())
                full_response.append(data.get("content", ""))
            except (json.JSONDecodeError, IndexError):
                pass

    conv = await _save_conversation(db, user.id, request, "".join(full_response))
    yield f"data: {json.dumps({'conversation_id': str(conv.id)})}\n\n"
    yield "data: [DONE]\n\n"


async def _stream_llm(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream tokens from the configured LLM provider."""
    if settings.llm_provider == LLMProvider.ANTHROPIC:
        async for chunk in _stream_anthropic(messages):
            yield chunk
    else:
        async for chunk in _stream_openai_compat(messages):
            yield chunk


# ---------------------------------------------------------------------------
# OpenAI-compatible path (Ollama, OpenAI, HF Inference Endpoints)
# ---------------------------------------------------------------------------


async def _stream_openai_compat(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream tokens from an OpenAI-compatible /v1/chat/completions endpoint."""
    body = {
        "model": settings.llm_model,
        "messages": messages,
        "stream": True,
        "temperature": 0.7,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    url = f"{settings.llm_base_url}/chat/completions"

    client = httpx.AsyncClient(timeout=120)
    response = await client.send(
        client.build_request("POST", url, json=body, headers=headers),
        stream=True,
    )
    try:
        if response.status_code == 503:
            raise ColdStartError()
        async for line in response.aiter_lines():
            content = _parse_openai_sse(line)
            if content is None:
                break
            if content:
                yield content
    finally:
        await response.aclose()
        await client.aclose()


def _parse_openai_sse(line: str) -> str | None:
    """Parse a single SSE line and return the content token, or None for [DONE]."""
    if not line.startswith("data: "):
        return ""
    data = line[6:]
    if data == "[DONE]":
        return None
    parsed = json.loads(data)
    delta = parsed["choices"][0].get("delta", {})
    return delta.get("content", "")


# ---------------------------------------------------------------------------
# Anthropic Messages API path
# ---------------------------------------------------------------------------

ANTHROPIC_VERSION = "2023-06-01"


def _split_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """Separate system message from chat messages for Anthropic API."""
    system = ""
    chat: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            chat.append(m)
    return system, chat


async def _stream_anthropic(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream tokens from the Anthropic Messages API."""
    system, chat = _split_system(messages)
    body = {
        "model": settings.llm_model,
        "max_tokens": 4096,
        "system": system,
        "messages": chat,
        "stream": True,
        "temperature": 0.7,
    }
    headers = {
        "x-api-key": settings.llm_api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    url = f"{settings.llm_base_url}/messages"

    client = httpx.AsyncClient(timeout=120)
    response = await client.send(
        client.build_request("POST", url, json=body, headers=headers),
        stream=True,
    )
    try:
        if response.status_code == 503:
            raise ColdStartError()
        if response.status_code != 200:
            body_text = await response.aread()
            logger.error("Anthropic API error %s: %s", response.status_code, body_text[:500])
            yield f"[Error: LLM returned status {response.status_code}]"
            return
        async for line in response.aiter_lines():
            text = _parse_anthropic_sse(line)
            if text is None:
                break
            if text:
                yield text
    finally:
        await response.aclose()
        await client.aclose()


def _parse_anthropic_sse(line: str) -> str | None:
    """Parse an Anthropic SSE line. Returns text, empty string to skip, or None to stop."""
    if not line.startswith("data: "):
        return ""
    parsed = json.loads(line[6:])
    if parsed.get("type") == "content_block_delta":
        return parsed.get("delta", {}).get("text", "")
    if parsed.get("type") == "message_stop":
        return None
    return ""


# ---------------------------------------------------------------------------
# Non-streaming summary generation
# ---------------------------------------------------------------------------


async def generate_summary(
    observations: dict | None,
    weather: dict | None,
    notes: str | None,
) -> str:
    """Generate a text summary of an inspection (non-streaming)."""
    prompt = "Summarize this hive inspection concisely:\n"
    if observations:
        prompt += f"Observations: {json.dumps(observations)}\n"
    if weather:
        prompt += f"Weather: {json.dumps(weather)}\n"
    if notes:
        prompt += f"Notes: {notes}\n"

    messages = [
        {"role": "system", "content": "You are a beekeeping assistant. Summarize concisely."},
        {"role": "user", "content": prompt},
    ]

    if settings.llm_provider == LLMProvider.ANTHROPIC:
        return await _generate_anthropic(messages)
    return await _generate_openai_compat(messages)


async def _generate_openai_compat(messages: list[dict]) -> str:
    """Non-streaming completion via OpenAI-compatible endpoint."""
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.llm_base_url}/chat/completions",
            json={"model": settings.llm_model, "messages": messages, "stream": False},
            headers={"Authorization": f"Bearer {settings.llm_api_key}"},
        )
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"]


async def _generate_anthropic(messages: list[dict]) -> str:
    """Non-streaming completion via Anthropic Messages API."""
    system, chat = _split_system(messages)
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.llm_base_url}/messages",
            json={
                "model": settings.llm_model,
                "max_tokens": 1024,
                "system": system,
                "messages": chat,
            },
            headers={
                "x-api-key": settings.llm_api_key,
                "anthropic-version": ANTHROPIC_VERSION,
                "content-type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()
    return data["content"][0]["text"]


async def _save_conversation(
    db: AsyncSession,
    user_id: UUID,
    request: ChatRequest,
    assistant_response: str,
    tool_messages: list[dict] | None = None,
) -> AIConversation:
    """Persist conversation to the database."""
    if request.conversation_id:
        conv = await db.get(AIConversation, request.conversation_id)
    else:
        conv = None

    if conv and conv.user_id == user_id:
        # Existing conversation: only append the NEW messages (the latest
        # user message + any tool messages + assistant response).  The client
        # sends the full history for the LLM context window, but the DB
        # already has prior messages — appending all of them would duplicate.
        new_messages: list[dict] = []
        if request.messages:
            last_user = request.messages[-1]
            new_messages.append({"role": last_user.role, "content": last_user.content})
        if tool_messages:
            new_messages.extend(tool_messages)
        new_messages.append({"role": "assistant", "content": assistant_response})
        conv.messages = conv.messages + new_messages
    else:
        # New conversation: store the full history
        all_messages = [{"role": m.role, "content": m.content} for m in request.messages]
        if tool_messages:
            all_messages.extend(tool_messages)
        all_messages.append({"role": "assistant", "content": assistant_response})
        conv = AIConversation(
            user_id=user_id,
            hive_id=request.hive_id,
            messages=all_messages,
            title=request.messages[0].content[:100] if request.messages else None,
        )
        db.add(conv)

    await db.commit()
    await db.refresh(conv)
    return conv


async def get_conversations(
    db: AsyncSession, user_id: UUID
) -> list[AIConversation]:
    """List all conversations for a user."""
    result = await db.execute(
        select(AIConversation)
        .where(AIConversation.user_id == user_id)
        .where(AIConversation.deleted_at.is_(None))
        .order_by(AIConversation.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_conversation(
    db: AsyncSession, conversation_id: UUID, user_id: UUID
) -> AIConversation | None:
    """Get a specific conversation, enforcing ownership."""
    result = await db.execute(
        select(AIConversation)
        .where(AIConversation.id == conversation_id)
        .where(AIConversation.user_id == user_id)
        .where(AIConversation.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def delete_conversation(
    db: AsyncSession, conversation_id: UUID, user_id: UUID
) -> bool:
    """Soft-delete a conversation, enforcing ownership."""
    conv = await get_conversation(db, conversation_id, user_id)
    if not conv:
        return False
    conv.deleted_at = func.now()
    await db.commit()
    return True
