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
from app.services._llm_utils import _split_system
from app.services.guardrails import guardrail_pipeline
from app.services.token_usage import record_chat_usage
from app.services.tool_executor import ColdStartError as ToolColdStartError
from app.services.tool_executor import ContextOverflowError

logger = logging.getLogger(__name__)
settings = get_settings()

# Shared HTTP client for LLM streaming (avoids per-request TLS handshake)
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    """Return a shared httpx.AsyncClient, creating one if needed."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=120)
    return _http_client

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

App capabilities:
- Your tools let you access the beekeeper's data. Some app features (weather \
forecasts, offline sync, task scheduling) exist in the app but aren't \
accessible through your tools yet — acknowledge them if asked, but don't \
pretend you can access their data.
- Never suggest or recommend app features that don't exist. If unsure \
whether a feature exists, be honest rather than guessing.
- When answering questions about the user's data, always use your tools to \
look up the real answer. Never answer user-data questions from memory or \
training data — your tools are the source of truth for their data.

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


def _pending_action_event(action) -> dict:
    """Build an SSE-ready pending action event dict."""
    return {
        "pending_action": {
            "id": str(action.id),
            "actionType": action.action_type,
            "resourceType": action.resource_type,
            "summary": action.summary,
            "payload": action.payload,
            "expiresAt": action.expires_at.isoformat(),
        }
    }


async def _yield_tool_response(
    final_text: str, db: AsyncSession | None = None,
) -> AsyncGenerator[str, None]:
    """Yield a tool-augmented response as SSE chunks (no [DONE] — caller sends it)."""
    yield f"data: {json.dumps({'status': 'fetching_data'})}\n\n"

    if db:
        for action_id in _extract_pending_ids(final_text):
            action = await pending_action_service.get_action(db, UUID(action_id))
            if action:
                yield f"data: {json.dumps(_pending_action_event(action))}\n\n"

    clean_text = _strip_pending_markers(final_text)
    for i in range(0, len(clean_text), 80):
        yield f"data: {json.dumps({'content': clean_text[i:i + 80]})}\n\n"


async def _yield_streaming_response(
    messages: list[dict], usage_out: dict | None = None,
) -> AsyncGenerator[str, None]:
    """Stream LLM response with cold-start retry logic."""
    sent_waking = False
    for attempt in range(len(_COLD_START_DELAYS) + 1):
        try:
            async for chunk in _stream_llm(messages, usage_out):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            break
        except ContextOverflowError:
            yield _context_overflow_event()
            return
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


def _context_overflow_event() -> str:
    """Build an SSE event for context overflow errors."""
    err = {
        "error": "conversation_too_long",
        "message": "This conversation is too long for Buddy. "
        "Please start a new chat.",
    }
    return f"data: {json.dumps(err)}\n\n"


def _conv_id_event(conversation_id: UUID) -> str:
    """Build the conversation_id SSE event."""
    return f"data: {json.dumps({'conversation_id': str(conversation_id)})}\n\n"


def _build_chat_messages(request: ChatRequest, system: str) -> list[dict]:
    """Build the LLM message list from a chat request."""
    messages = [{"role": "system", "content": system}]
    messages.extend(
        {"role": m.role, "content": m.content}
        for m in request.messages
        if m.role in ("user", "assistant")
    )
    return messages


async def _yield_canned_response(
    message: str,
) -> AsyncGenerator[str, None]:
    """Yield a blocked/canned response as SSE chunks."""
    for i in range(0, len(message), 80):
        yield f"data: {json.dumps({'content': message[i:i + 80]})}\n\n"


async def _handle_tool_path(
    db: AsyncSession, user: User, request: ChatRequest,
    messages: list[dict], user_msg: str,
) -> AsyncGenerator[str, None]:
    """Phase 1: tool-augmented path with output guard."""
    final_text, tool_msgs, tool_usage = await tool_executor.try_tool_path(
        messages, db, user.id,
    )
    if final_text is None:
        return

    # --- Output guard (can log/flag before emission) ---
    await guardrail_pipeline.check_output(final_text, user_msg)

    async for chunk in _yield_tool_response(final_text, db):
        yield chunk
    conv = await _save_conversation(
        db, user.id, request, final_text, tool_msgs,
    )
    await record_chat_usage(
        db, user.id, conv.id, tool_usage,
        settings.effective_tool_provider,
        settings.effective_tool_model, "tool_chat",
    )
    yield _conv_id_event(conv.id)
    yield "data: [DONE]\n\n"


async def _handle_streaming_path(
    db: AsyncSession, user: User, request: ChatRequest,
    messages: list[dict], user_msg: str,
) -> AsyncGenerator[str, None]:
    """Phase 2: streaming path with post-stream audit."""
    usage_out: dict = {}
    full_response: list[str] = []
    async for chunk in _yield_streaming_response(messages, usage_out):
        yield chunk
        if '"content"' in chunk:
            try:
                data = json.loads(chunk[6:].strip())
                full_response.append(data.get("content", ""))
            except (json.JSONDecodeError, IndexError):
                pass

    response_text = "".join(full_response)

    # --- Audit guard (post-stream, log-only) ---
    guardrail_pipeline.audit(response_text, user_msg, user.id)

    conv = await _save_conversation(db, user.id, request, response_text)
    await record_chat_usage(
        db, user.id, conv.id, usage_out,
        settings.llm_provider, settings.llm_model, "stream_chat",
    )
    yield _conv_id_event(conv.id)
    yield "data: [DONE]\n\n"


async def stream_chat(
    db: AsyncSession,
    user: User,
    request: ChatRequest,
) -> AsyncGenerator[str, None]:
    """Stream a chat response with guardrails pipeline."""
    user_msg = request.messages[-1].content if request.messages else ""

    # --- Input guard (saves an LLM call for blocked messages) ---
    input_result = guardrail_pipeline.check_input(user_msg)
    if not input_result.allowed:
        async for chunk in _yield_canned_response(input_result.canned_response):
            yield chunk
        yield "data: [DONE]\n\n"
        return

    context = await ag_data_service.build_context_block()
    system = SYSTEM_PROMPT_TEMPLATE.format(context=context) + TOOL_SYSTEM_ADDENDUM
    messages = _build_chat_messages(request, system)

    # Phase 1: Try tool-augmented path
    try:
        async for chunk in _handle_tool_path(
            db, user, request, messages, user_msg,
        ):
            yield chunk
            if '"conversation_id"' in chunk:
                return
    except ContextOverflowError:
        logger.warning("Context overflow in tool path")
        yield _context_overflow_event()
        yield "data: [DONE]\n\n"
        return
    except ToolColdStartError:
        logger.info("Tool path 503, falling back to streaming")
    except Exception:
        logger.exception("Tool path failed, falling back to streaming")

    # Phase 2: Streaming path
    async for chunk in _handle_streaming_path(
        db, user, request, messages, user_msg,
    ):
        yield chunk


async def _stream_llm(
    messages: list[dict], usage_out: dict | None = None,
) -> AsyncGenerator[str, None]:
    """Stream tokens from the configured LLM provider."""
    if settings.llm_provider == LLMProvider.ANTHROPIC:
        async for chunk in _stream_anthropic(messages, usage_out):
            yield chunk
    else:
        async for chunk in _stream_openai_compat(messages, usage_out):
            yield chunk


# ---------------------------------------------------------------------------
# OpenAI-compatible path (Ollama, OpenAI, HF Inference Endpoints)
# ---------------------------------------------------------------------------


async def _check_streaming_status(response: httpx.Response) -> None:
    """Check streaming response status, raising on errors."""
    if response.status_code == 503:
        raise ColdStartError()
    if response.status_code >= 400:
        body = (await response.aread()).decode(errors="replace")[:500]
        logger.error("Streaming LLM error %s: %s", response.status_code, body)
        if "exceed" in body and "context" in body:
            raise ContextOverflowError("Conversation exceeds context window.")
        raise httpx.HTTPStatusError(
            f"HTTP {response.status_code}",
            request=response.request,
            response=response,
        )


async def _stream_openai_compat(
    messages: list[dict],
    usage_out: dict | None = None,
) -> AsyncGenerator[str, None]:
    """Stream tokens from an OpenAI-compatible /v1/chat/completions endpoint."""
    body: dict = {
        "model": settings.llm_model,
        "messages": messages,
        "stream": True,
        "temperature": 0.7,
        "stream_options": {"include_usage": True},
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
    url = f"{settings.llm_base_url}/chat/completions"

    client = _get_http_client()
    response = await client.send(
        client.build_request("POST", url, json=body, headers=headers),
        stream=True,
    )
    try:
        await _check_streaming_status(response)
        async for line in response.aiter_lines():
            content = _parse_openai_sse(line, usage_out)
            if content is None:
                break
            if content:
                yield content
    finally:
        await response.aclose()


def _parse_openai_sse(
    line: str, usage_out: dict | None = None,
) -> str | None:
    """Parse a single SSE line and return the content token, or None for [DONE]."""
    if not line.startswith("data: "):
        return ""
    data = line[6:]
    if data == "[DONE]":
        return None
    parsed = json.loads(data)
    # Capture usage from final chunk (stream_options: include_usage)
    if usage_out is not None and parsed.get("usage"):
        raw = parsed["usage"]
        usage_out["input_tokens"] = raw.get("prompt_tokens", 0)
        usage_out["output_tokens"] = raw.get("completion_tokens", 0)
        usage_out["total_tokens"] = raw.get("total_tokens", 0)
    choices = parsed.get("choices", [])
    if not choices:
        return ""
    delta = choices[0].get("delta", {})
    # llama.cpp sends {"content": null} in the first chunk — don't confuse
    # with our None sentinel (which means [DONE]).
    content = delta.get("content")
    return content if content is not None else ""


# ---------------------------------------------------------------------------
# Anthropic Messages API path
# ---------------------------------------------------------------------------

ANTHROPIC_VERSION = "2023-06-01"


async def _stream_anthropic(
    messages: list[dict],
    usage_out: dict | None = None,
) -> AsyncGenerator[str, None]:
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

    client = _get_http_client()
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
            text = _parse_anthropic_sse(line, usage_out)
            if text is None:
                break
            if text:
                yield text
    finally:
        await response.aclose()


def _parse_anthropic_sse(
    line: str, usage_out: dict | None = None,
) -> str | None:
    """Parse an Anthropic SSE line. Returns text, empty string to skip, or None to stop."""
    if not line.startswith("data: "):
        return ""
    parsed = json.loads(line[6:])
    event_type = parsed.get("type")
    if event_type == "message_start" and usage_out is not None:
        msg_usage = parsed.get("message", {}).get("usage", {})
        usage_out["input_tokens"] = msg_usage.get("input_tokens", 0)
        return ""
    if event_type == "content_block_delta":
        return parsed.get("delta", {}).get("text", "")
    if event_type == "message_delta":
        if usage_out is not None:
            delta_usage = parsed.get("usage", {})
            out = delta_usage.get("output_tokens", 0)
            usage_out["output_tokens"] = out
            usage_out["total_tokens"] = usage_out.get("input_tokens", 0) + out
        return ""
    if event_type == "message_stop":
        return None
    return ""



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
