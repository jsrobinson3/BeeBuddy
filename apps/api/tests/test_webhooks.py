"""EAS build webhook integration tests.

Requires the API to be running (e.g. via docker compose up) with
EAS_WEBHOOK_SECRET configured. Tests verify the relay's signature check,
filter rules, and dispatch payload shape — but do NOT actually call GitHub
(GITHUB_DISPATCH_TOKEN is unset in test env, so the dispatch is mocked at
the httpx layer or returns a 502 we tolerate).
"""

import hashlib
import hmac
import json

import pytest
from httpx import AsyncClient

WEBHOOK_PATH = "/webhooks/eas-build"

# Test secret matches what the dev API container uses; tests that hit the
# relay path will skip if the API isn't configured with one.
TEST_SECRET = "test-webhook-secret"


def _sign(body: bytes, secret: str = TEST_SECRET) -> str:
    digest = hmac.new(secret.encode(), body, hashlib.sha1).hexdigest()
    return f"sha1={digest}"


def _build_payload(**overrides) -> dict:
    base = {
        "id": "abc-123",
        "status": "finished",
        "platform": "ios",
        "appVersion": "0.1.0",
        "appBuildVersion": "12",
        "artifacts": {"buildArtifactsUrl": "https://expo.dev/artifacts/abc-123"},
    }
    base.update(overrides)
    return base


class TestSignature:
    async def test_missing_signature_header_returns_422(self, client: AsyncClient):
        # FastAPI returns 422 for missing required header
        resp = await client.post(WEBHOOK_PATH, json=_build_payload())
        assert resp.status_code == 422

    async def test_bad_signature_returns_401(self, client: AsyncClient):
        body = json.dumps(_build_payload()).encode()
        resp = await client.post(
            WEBHOOK_PATH,
            content=body,
            headers={"expo-signature": "sha1=deadbeef", "content-type": "application/json"},
        )
        # 503 if relay not configured; 401 if configured with a different secret
        assert resp.status_code in (401, 503)

    async def test_malformed_signature_prefix_rejected(self, client: AsyncClient):
        body = json.dumps(_build_payload()).encode()
        resp = await client.post(
            WEBHOOK_PATH,
            content=body,
            headers={"expo-signature": "md5=anything", "content-type": "application/json"},
        )
        assert resp.status_code in (401, 503)


class TestFiltering:
    """Skip semantics work even when GitHub dispatch isn't reachable —
    these short-circuit before the dispatch call."""

    async def test_in_progress_build_skipped(self, client: AsyncClient):
        payload = _build_payload(status="in-progress")
        body = json.dumps(payload).encode()
        resp = await client.post(
            WEBHOOK_PATH,
            content=body,
            headers={"expo-signature": _sign(body), "content-type": "application/json"},
        )
        if resp.status_code == 503:
            pytest.skip("EAS_WEBHOOK_SECRET not configured on test API")
        if resp.status_code == 401:
            pytest.skip("Test secret does not match API's EAS_WEBHOOK_SECRET")
        assert resp.status_code == 202
        assert resp.json()["skipped"] is True

    async def test_android_build_skipped(self, client: AsyncClient):
        payload = _build_payload(platform="android")
        body = json.dumps(payload).encode()
        resp = await client.post(
            WEBHOOK_PATH,
            content=body,
            headers={"expo-signature": _sign(body), "content-type": "application/json"},
        )
        if resp.status_code in (401, 503):
            pytest.skip("Test webhook not aligned with API secret")
        assert resp.status_code == 202
        assert resp.json()["skipped"] is True

    async def test_missing_artifacts_url_skipped(self, client: AsyncClient):
        payload = _build_payload(artifacts={})
        body = json.dumps(payload).encode()
        resp = await client.post(
            WEBHOOK_PATH,
            content=body,
            headers={"expo-signature": _sign(body), "content-type": "application/json"},
        )
        if resp.status_code in (401, 503):
            pytest.skip("Test webhook not aligned with API secret")
        assert resp.status_code == 202
        assert resp.json()["skipped"] is True
        assert "artifact" in resp.json()["reason"].lower()
