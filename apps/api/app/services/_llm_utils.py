"""Shared LLM utilities used by multiple service modules."""


def _split_system(messages: list[dict]) -> tuple[str, list[dict]]:
    """Separate system message from chat messages for Anthropic API.

    Filters out internal roles (tool_call, tool_result) that are not valid
    Anthropic message roles.
    """
    system = ""
    chat: list[dict] = []
    for m in messages:
        if m["role"] == "system":
            system = m["content"]
        elif m["role"] in ("user", "assistant"):
            chat.append(m)
    return system, chat
