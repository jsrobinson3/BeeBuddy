"""Tool executor — orchestrates MCP tool calls with LLM providers.

Converts MCP tool schemas to provider-specific formats, runs non-streaming
LLM calls with tools attached, and executes tool calls in a loop (max rounds).
"""

import json
import logging
from dataclasses import dataclass
from uuid import UUID

import httpx
from fastmcp import Client
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import LLMProvider, get_settings
from app.services.mcp_tools import create_mcp_server

logger = logging.getLogger(__name__)
settings = get_settings()

MAX_TOOL_ROUNDS = 3
ANTHROPIC_VERSION = "2023-06-01"


@dataclass
class ToolCall:
    """A parsed tool call from an LLM response."""

    id: str
    name: str
    arguments: dict


async def _execute_tool_call(
    client: Client,
    tc: ToolCall,
    augmented: list[dict],
    tool_messages: list[dict],
    provider: LLMProvider,
) -> None:
    """Execute a single tool call and append results to message lists."""
    try:
        result = await client.call_tool(tc.name, tc.arguments)
        result_text = _extract_mcp_result(result)
    except Exception:
        logger.exception("Tool %s failed", tc.name)
        result_text = json.dumps({"error": f"Tool {tc.name} failed"})

    augmented.append(_build_tool_result_msg(tc, result_text, provider))
    tool_messages.append({
        "role": "tool_call",
        "name": tc.name,
        "content": json.dumps(tc.arguments),
        "tool_call_id": tc.id,
    })
    tool_messages.append({
        "role": "tool_result",
        "name": tc.name,
        "content": result_text,
        "tool_call_id": tc.id,
    })


async def _run_tool_loop(
    client: Client,
    messages: list[dict],
    llm_tools: list[dict],
    provider: LLMProvider,
    initial_response: dict,
    initial_tool_calls: list[ToolCall],
) -> tuple[str, list[dict]]:
    """Run the tool call → LLM loop for up to MAX_TOOL_ROUNDS."""
    tool_messages: list[dict] = []
    augmented = list(messages)
    response = initial_response
    tool_calls = initial_tool_calls

    for _round in range(MAX_TOOL_ROUNDS):
        augmented.append(_build_assistant_msg(response, provider))

        for tc in tool_calls:
            await _execute_tool_call(client, tc, augmented, tool_messages, provider)

        response = await _call_llm_with_tools(augmented, llm_tools, provider)
        tool_calls = _extract_tool_calls(response, provider)

        if not tool_calls:
            return _extract_text(response, provider), tool_messages

    return _extract_text(response, provider), tool_messages


async def try_tool_path(
    messages: list[dict],
    db: AsyncSession,
    user_id: UUID,
) -> tuple[str | None, list[dict]]:
    """Attempt tool-augmented response.

    Returns (final_text, tool_messages) if tools were used,
    or (None, []) if no tools were needed (caller should fall through to streaming).
    """
    server = create_mcp_server(db, user_id)
    async with Client(server) as client:
        mcp_tools = await client.list_tools()
        if not mcp_tools:
            return None, []

        provider = settings.effective_tool_provider
        llm_tools = _convert_tools(mcp_tools, provider)

        response = await _call_llm_with_tools(messages, llm_tools, provider)
        tool_calls = _extract_tool_calls(response, provider)

        if not tool_calls:
            return None, []

        text, tool_msgs = await _run_tool_loop(
            client, messages, llm_tools, provider, response, tool_calls,
        )
        return text, tool_msgs


# ---------------------------------------------------------------------------
# MCP → LLM tool schema conversion
# ---------------------------------------------------------------------------


def _convert_tools(mcp_tools, provider: LLMProvider) -> list[dict]:
    """Convert MCP tool schemas to provider-specific format."""
    if provider == LLMProvider.ANTHROPIC:
        return [_mcp_to_anthropic(t) for t in mcp_tools]
    return [_mcp_to_openai(t) for t in mcp_tools]


def _mcp_to_openai(tool) -> dict:
    """Convert MCP tool to OpenAI function-calling format."""
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description or "",
            "parameters": tool.inputSchema or {"type": "object", "properties": {}},
        },
    }


def _mcp_to_anthropic(tool) -> dict:
    """Convert MCP tool to Anthropic tool format."""
    return {
        "name": tool.name,
        "description": tool.description or "",
        "input_schema": tool.inputSchema or {"type": "object", "properties": {}},
    }


# ---------------------------------------------------------------------------
# Non-streaming LLM calls
# ---------------------------------------------------------------------------


async def _call_llm_with_tools(
    messages: list[dict],
    tools: list[dict],
    provider: LLMProvider,
) -> dict:
    """Make a non-streaming LLM call with tools attached."""
    if provider == LLMProvider.ANTHROPIC:
        return await _call_anthropic(messages, tools)
    return await _call_openai_compat(messages, tools)


async def _call_openai_compat(messages: list[dict], tools: list[dict]) -> dict:
    """Non-streaming call to OpenAI-compatible endpoint with tools."""
    body: dict = {
        "model": settings.effective_tool_model,
        "messages": messages,
        "tools": tools,
        "stream": False,
    }
    headers = {"Authorization": f"Bearer {settings.llm_tool_api_key}"}
    url = f"{settings.llm_tool_base_url}/chat/completions"

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()


async def _call_anthropic(messages: list[dict], tools: list[dict]) -> dict:
    """Non-streaming call to Anthropic Messages API with tools."""
    system, chat = _split_system(messages)
    body: dict = {
        "model": settings.effective_tool_model,
        "max_tokens": 4096,
        "system": system,
        "messages": chat,
        "tools": tools,
    }
    headers = {
        "x-api-key": settings.llm_tool_api_key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
    }
    url = f"{settings.llm_tool_base_url}/messages"

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(url, json=body, headers=headers)
        resp.raise_for_status()
        return resp.json()


def _split_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """Separate system message from chat messages for Anthropic."""
    system = ""
    chat: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        else:
            chat.append(m)
    return system, chat


# ---------------------------------------------------------------------------
# Tool call extraction (provider-specific)
# ---------------------------------------------------------------------------


def _extract_tool_calls(response: dict, provider: LLMProvider) -> list[ToolCall]:
    """Extract tool calls from an LLM response."""
    if provider == LLMProvider.ANTHROPIC:
        return _extract_anthropic_tool_calls(response)
    return _extract_openai_tool_calls(response)


def _extract_openai_tool_calls(response: dict) -> list[ToolCall]:
    """Extract tool calls from OpenAI-format response."""
    choice = response.get("choices", [{}])[0]
    message = choice.get("message", {})
    raw_calls = message.get("tool_calls", [])
    calls = []
    for tc in raw_calls:
        fn = tc.get("function", {})
        args_str = fn.get("arguments", "{}")
        try:
            args = json.loads(args_str)
        except json.JSONDecodeError:
            args = {}
        calls.append(ToolCall(id=tc.get("id", ""), name=fn.get("name", ""), arguments=args))
    return calls


def _extract_anthropic_tool_calls(response: dict) -> list[ToolCall]:
    """Extract tool calls from Anthropic-format response."""
    content = response.get("content", [])
    calls = []
    for block in content:
        if block.get("type") == "tool_use":
            calls.append(ToolCall(
                id=block.get("id", ""),
                name=block.get("name", ""),
                arguments=block.get("input", {}),
            ))
    return calls


# ---------------------------------------------------------------------------
# Response message builders (provider-specific)
# ---------------------------------------------------------------------------


def _build_assistant_msg(response: dict, provider: LLMProvider) -> dict:
    """Build the assistant message (with tool_calls) for the conversation."""
    if provider == LLMProvider.ANTHROPIC:
        return {"role": "assistant", "content": response.get("content", [])}
    choice = response.get("choices", [{}])[0]
    return {"role": "assistant", **choice.get("message", {})}


def _build_tool_result_msg(tc: ToolCall, result_text: str, provider: LLMProvider) -> dict:
    """Build a tool result message for the conversation."""
    if provider == LLMProvider.ANTHROPIC:
        return {
            "role": "user",
            "content": [{"type": "tool_result", "tool_use_id": tc.id, "content": result_text}],
        }
    return {"role": "tool", "tool_call_id": tc.id, "content": result_text}


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------


def _extract_text(response: dict, provider: LLMProvider) -> str:
    """Extract the final text content from an LLM response."""
    if provider == LLMProvider.ANTHROPIC:
        content = response.get("content", [])
        parts = [b.get("text", "") for b in content if b.get("type") == "text"]
        return "".join(parts)
    choice = response.get("choices", [{}])[0]
    return choice.get("message", {}).get("content", "")


def _extract_mcp_result(result) -> str:
    """Extract text from an MCP CallToolResult."""
    if hasattr(result, "content") and result.content:
        parts = []
        for item in result.content:
            if hasattr(item, "text"):
                parts.append(item.text)
            else:
                parts.append(str(item))
        return "\n".join(parts)
    return str(result)
