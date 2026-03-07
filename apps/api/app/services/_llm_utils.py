"""Shared LLM utilities used by multiple service modules."""


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
