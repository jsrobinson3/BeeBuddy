# Endpoint Cold-Start Mitigation

BeeBuddy's fine-tuned model (`beebuddy-bee`) is served via a HuggingFace
Inference Endpoint with **scale-to-zero** enabled. When idle, the endpoint
shuts down to save costs. Waking up takes ~5 minutes, creating a poor
experience for the first user after a period of inactivity.

This document covers three layered strategies to eliminate or mask the
cold-start pain.

---

## Strategy 1: Configurable Fallback LLM (Haiku Bridge)

When the HF endpoint returns a 503 (scaled to zero), the app automatically:

1. Fires a background wake request to start the endpoint
2. Emits a `{"status": "waking_up"}` SSE event to the client
3. Retries the **entire flow** (tool path + streaming) using a configurable
   fallback LLM

The fallback LLM gets the full system prompt (Buddy personality + tool
addendum) and **full MCP tool access** — it can query apiaries, hives,
inspections, etc. exactly like Buddy.

### Client integration

The mobile app should watch for the `waking_up` status event and display a
banner like *"Buddy is waking up — Haiku is filling in..."*. The response
content streams normally; only the `source` changes.

### Configuration

```env
# Provider (any supported: anthropic, openai, ollama, huggingface)
HF_FALLBACK_PROVIDER=anthropic

# Model name for the fallback provider
HF_FALLBACK_MODEL=claude-haiku-4-5-20251001
```

The fallback provider's API key and base URL are resolved automatically from
the existing provider config (e.g., `ANTHROPIC_API_KEY` for Anthropic,
`OPENAI_API_KEY` for OpenAI).

---

## Strategy 2: Celery Beat Keepalive

The existing Celery Beat task `hf_warmup_keepalive` sends periodic pings to
prevent scale-to-zero during business hours.

### Configuration

```env
HF_WARMUP_KEEPALIVE_ENABLED=true     # Enable periodic pings
HF_WARMUP_KEEPALIVE_INTERVAL=240     # Seconds between pings (default: 4 min)
```

The task automatically skips pings outside **Mon-Fri 8am-10pm US/Eastern**
to avoid unnecessary costs on nights and weekends.

---

## Strategy 3: Wake-up Utility & CLI

A standalone CLI script for operations use — checking status, triggering
wake-ups, and manual keep-warm pings.

### CLI usage

```bash
cd apps/api

# Check current endpoint status
uv run python scripts/run_endpoint.py status

# Wake endpoint and wait until ready
uv run python scripts/run_endpoint.py wake --wait --timeout 360

# Send a lightweight keep-warm ping
uv run python scripts/run_endpoint.py ping
```

**Required environment variable:** `HF_TOKEN`

**Optional overrides:**
- `HF_ENDPOINT_NAMESPACE` (default: `jsrobinson3`)
- `HF_ENDPOINT_NAME` (default: `beebuddy-bee-gguf-jjo`)

### Programmatic usage

```python
from app.services.endpoint import (
    get_endpoint_status,
    wake_endpoint,
    wait_until_ready,
    query_with_fallback,
)

# Check status
status = get_endpoint_status(namespace="jsrobinson3", name="beebuddy-bee-gguf-jjo", hf_token="...")

# Wake and wait
await wake_endpoint(hf_token="...")
ready = await wait_until_ready(hf_token="...", timeout=360)

# Query with automatic fallback
result = await query_with_fallback(
    "How do I check for varroa mites?",
    hf_token="...",
    fallback_api_key="sk-ant-...",
)
# result["source"] is "buddy" or "fallback"
```

---

## Architecture

```
User request
    │
    ▼
stream_chat()
    │
    ├── Phase 1: Tool path (HF endpoint)
    │       │
    │       ├── Success → stream response
    │       │
    │       └── ColdStartError (503) ──┐
    │                                  │
    │   ┌──────────────────────────────┘
    │   │
    │   ├── Fire background wake request
    │   ├── Emit {"status": "waking_up"} SSE event
    │   │
    │   ├── Phase 1 retry: Tool path (fallback LLM)
    │   │       └── Full MCP tool access
    │   │
    │   └── Phase 2 retry: Streaming (fallback LLM)
    │
    └── Phase 2: Streaming path (HF endpoint)
            │
            ├── Success → stream response
            │
            └── ColdStartError (503) → fallback streaming
```

---

## Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `HF_ENDPOINT_NAMESPACE` | `jsrobinson3` | HuggingFace namespace |
| `HF_ENDPOINT_NAME` | `beebuddy-bee-gguf-jjo` | Endpoint name |
| `HF_WAKE_TIMEOUT_SECONDS` | `360` | Max wait for endpoint ready |
| `HF_POLL_INTERVAL_SECONDS` | `5` | Seconds between status polls |
| `HF_FALLBACK_PROVIDER` | `anthropic` | Fallback LLM provider |
| `HF_FALLBACK_MODEL` | `claude-haiku-4-5-20251001` | Fallback model |
| `HF_WARMUP_KEEPALIVE_ENABLED` | `false` | Enable Celery Beat pings |
| `HF_WARMUP_KEEPALIVE_INTERVAL` | `240` | Seconds between pings |
| `HF_WARMUP_COOLDOWN_SECONDS` | `300` | Redis cooldown between warmups |
