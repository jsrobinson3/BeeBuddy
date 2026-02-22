"""Shared test fixtures."""

import pytest
from httpx import AsyncClient

BASE_URL = "http://localhost:8000"


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
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return client, headers
