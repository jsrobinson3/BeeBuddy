"""Health endpoint integration tests.

Requires the API to be running (e.g. via docker compose up).
"""

from httpx import AsyncClient

PREFIX = ""


class TestLiveness:
    async def test_health_returns_200(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"
        assert "version" in body


class TestReadiness:
    async def test_ready_includes_worker_field(self, client: AsyncClient):
        resp = await client.get(f"{PREFIX}/health/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert "postgres" in body
        assert "redis" in body
        assert "worker" in body
        assert body["worker"] in ("ok", "no_heartbeat", "error")
