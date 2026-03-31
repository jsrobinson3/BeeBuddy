# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "httpx",
#   "huggingface-hub",
#   "typer",
# ]
# ///
"""CLI for managing the BeeBuddy HF Inference Endpoint.

Usage (standalone — no FastAPI app dependency):

    uv run scripts/run_endpoint.py status
    uv run scripts/run_endpoint.py wake --wait
    uv run scripts/run_endpoint.py ping

Environment variables:
    HF_TOKEN                  (required) HuggingFace API token
    HF_ENDPOINT_NAMESPACE     (default: jsrobinson3)
    HF_ENDPOINT_NAME          (default: beebuddy-bee-gguf-jjo)
"""

from __future__ import annotations

import os
import time

import httpx
import typer
from huggingface_hub import HfApi

app = typer.Typer(help="Manage BeeBuddy HF Inference Endpoint.")

_NAMESPACE = os.environ.get("HF_ENDPOINT_NAMESPACE", "jsrobinson3")
_ENDPOINT = os.environ.get("HF_ENDPOINT_NAME", "beebuddy-bee-gguf-jjo")


def _get_token() -> str:
    token = os.environ.get("HF_TOKEN")
    if not token:
        typer.echo("Error: HF_TOKEN environment variable is required.", err=True)
        raise typer.Exit(1)
    return token


def _get_endpoint():
    api = HfApi(token=_get_token())
    return api.get_inference_endpoint(_ENDPOINT, namespace=_NAMESPACE)


@app.command()
def status():
    """Print the current endpoint status."""
    ep = _get_endpoint()
    typer.echo(f"Endpoint: {_NAMESPACE}/{_ENDPOINT}")
    typer.echo(f"Status:   {ep.status}")
    if hasattr(ep, "url") and ep.url:
        typer.echo(f"URL:      {ep.url}")


@app.command()
def wake(
    wait: bool = typer.Option(False, "--wait", help="Poll until endpoint is running."),
    timeout: int = typer.Option(360, "--timeout", help="Max seconds to wait."),
    poll_interval: int = typer.Option(5, "--poll-interval", help="Seconds between polls."),
):
    """Trigger endpoint wake-up (and optionally wait until ready)."""
    ep = _get_endpoint()
    typer.echo(f"Current status: {ep.status}")

    if ep.status == "running":
        typer.echo("Endpoint is already running.")
        return

    # Send a lightweight request to trigger scale-up
    token = _get_token()
    url = f"{ep.url}/v1/chat/completions" if ep.url else None
    if url:
        try:
            resp = httpx.post(
                url,
                json={
                    "model": "tgi",
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 1,
                    "stream": False,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            typer.echo(f"Wake request returned {resp.status_code}")
        except httpx.TimeoutException:
            typer.echo("Wake request timed out (expected for cold start)")
    else:
        typer.echo("No endpoint URL available yet — endpoint may be initializing.")

    if not wait:
        return

    typer.echo(f"Waiting up to {timeout}s for endpoint to be ready...")
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        ep = _get_endpoint()
        if ep.status == "running":
            typer.echo("Endpoint is running!")
            return
        typer.echo(f"  Status: {ep.status} — retrying in {poll_interval}s")
        time.sleep(poll_interval)

    typer.echo("Timeout — endpoint did not reach 'running' status.", err=True)
    raise typer.Exit(1)


@app.command()
def ping():
    """Send a lightweight request to keep the endpoint warm.

    Designed to be called by a scheduler (Celery Beat, cron, etc.).
    Exit code 0 on success or expected cold-start, 1 on unexpected error.
    """
    ep = _get_endpoint()
    if ep.status == "running" and ep.url:
        token = _get_token()
        try:
            resp = httpx.post(
                f"{ep.url}/v1/chat/completions",
                json={
                    "model": "tgi",
                    "messages": [{"role": "user", "content": "hi"}],
                    "max_tokens": 1,
                    "stream": False,
                },
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            typer.echo(f"Ping: {resp.status_code}")
        except httpx.TimeoutException:
            typer.echo("Ping timed out (may be cold-starting)")
    else:
        typer.echo(f"Endpoint status: {ep.status} — skipping ping")


if __name__ == "__main__":
    app()
