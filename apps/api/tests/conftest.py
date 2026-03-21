"""Shared test fixtures."""

import json
from pathlib import Path

import pytest
from httpx import AsyncClient

BASE_URL = "http://localhost:8000"

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_jsonl(filename: str) -> list[dict]:
    """Load a JSONL fixture file and return a list of dicts.

    Args:
        filename: Relative path under tests/fixtures/
            (e.g. "guardrails/beekeeping_adversarial.jsonl").

    Returns:
        List of parsed JSON objects, one per line.
    """
    filepath = FIXTURES_DIR / filename
    if not filepath.exists():
        pytest.skip(f"Fixture not found: {filepath}")
    records = []
    with open(filepath, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(json.loads(line))
    return records


@pytest.fixture
async def client() -> AsyncClient:
    """Async HTTP client pointed at the running API."""
    async with AsyncClient(base_url=BASE_URL) as ac:
        yield ac


@pytest.fixture
async def auth_client(client: AsyncClient) -> tuple[AsyncClient, dict]:
    """Client + headers for an authenticated user (registers a unique user each test)."""
    import uuid

    email = f"test-{uuid.uuid4().hex[:8]}@beebuddy.dev"
    resp = await client.post("/api/v1/auth/register", json={
        "name": "Test Beekeeper",
        "email": email,
        "password": "secret123",
    })
    assert resp.status_code == 201, f"Setup failed: {resp.text}"
    token = resp.json()["accessToken"]
    headers = {"Authorization": f"Bearer {token}"}
    return client, headers
