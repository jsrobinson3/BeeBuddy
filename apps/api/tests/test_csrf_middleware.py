"""Unit tests for the pure-ASGI ``CSRFMiddleware``.

The integration tests in ``test_auth.py::TestCSRF`` need a live server;
these run against Starlette's ``TestClient`` so the behaviour stays covered
by ``uv run pytest`` alone.

The middleware was reworked from ``BaseHTTPMiddleware`` to pure ASGI to
avoid the anyio-task-group cancellation cascade that surfaced as
``CancelledError`` in Sentry BEEBUDDY-BACKEND-1J.
"""

from starlette.applications import Starlette
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from app.middleware.csrf import CSRFMiddleware


async def _ok(_request):
    return PlainTextResponse("ok")


async def _echo(request):
    return JSONResponse({"body": (await request.body()).decode()})


def _client() -> TestClient:
    app = Starlette(routes=[
        Route("/hi", _ok, methods=["GET", "POST"]),
        Route("/echo", _echo, methods=["POST"]),
        Route("/api/v1/auth/login", _ok, methods=["POST"]),
    ])
    app.add_middleware(CSRFMiddleware)
    return TestClient(app)


class TestCSRFMiddleware:
    def test_get_allowed_without_header(self):
        assert _client().get("/hi").status_code == 200

    def test_post_without_cookie_or_bearer_allowed(self):
        assert _client().post("/hi", content=b"x").status_code == 200

    def test_post_with_cookie_and_no_header_blocked(self):
        resp = _client().post("/hi", cookies={"access_token": "t"}, content=b"x")
        assert resp.status_code == 403
        assert resp.json() == {"detail": "CSRF validation failed"}

    def test_post_with_cookie_and_header_allowed(self):
        resp = _client().post(
            "/echo",
            cookies={"access_token": "t"},
            headers={"X-Requested-With": "BeeBuddy"},
            content=b"payload",
        )
        assert resp.status_code == 200
        # Body must reach the downstream handler intact — the middleware
        # inspects headers only and never consumes the receive stream.
        assert resp.json() == {"body": "payload"}

    def test_bearer_skips_csrf(self):
        resp = _client().post(
            "/hi",
            cookies={"access_token": "t"},
            headers={"Authorization": "Bearer abc"},
            content=b"x",
        )
        assert resp.status_code == 200

    def test_auth_endpoint_exempt_with_stale_cookie(self):
        resp = _client().post(
            "/api/v1/auth/login", cookies={"access_token": "stale"}, content=b"x",
        )
        assert resp.status_code == 200
