"""CSRF protection middleware for cookie-based auth.

Only enforced when an access_token cookie is present on a mutating request.
Bearer-only requests skip CSRF (tokens aren't auto-sent by browsers).

Implemented as a pure ASGI middleware rather than a
``starlette.middleware.base.BaseHTTPMiddleware`` subclass: the base class
wraps the downstream app in an anyio task group, so a client disconnect
mid-stream (e.g. the ``/ai/chat`` SSE endpoint) cancels that group and
cascades a ``CancelledError`` into asyncpg's connection teardown
(Sentry BEEBUDDY-BACKEND-1J).
"""

from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "BeeBuddy"

# Auth endpoints create/destroy sessions — they don't act on an existing
# authenticated session, so CSRF protection is unnecessary and can cause
# false positives when stale cookies linger after logout.
CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
    "/api/v1/auth/logout",
    "/api/v1/auth/oauth/google",
    "/api/v1/auth/oauth/apple",
    # Token-based endpoints use out-of-band email tokens to prove intent,
    # not an existing authenticated session.
    "/api/v1/auth/verify-email",
    "/api/v1/auth/resend-verification",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    # OAuth2 token endpoint uses code_verifier (PKCE) to prove intent,
    # not an existing authenticated session.
    "/api/v1/oauth2/token",
}


def _requires_csrf(request: Request) -> bool:
    """True when the request is a mutating cookie-auth request missing the CSRF header."""
    if request.method not in MUTATING_METHODS:
        return False
    if request.url.path in CSRF_EXEMPT_PATHS:
        return False
    # Bearer tokens prove intent (explicitly added by code, not auto-sent by
    # browsers), so CSRF is unnecessary.  This also prevents false positives on
    # React Native where cookies may ride along with Bearer requests.
    if request.headers.get("authorization", "").lower().startswith("bearer "):
        return False
    if not request.cookies.get("access_token"):
        return False
    return request.headers.get(CSRF_HEADER) != CSRF_VALUE


class CSRFMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        # A Starlette Request built from scope alone parses headers/cookies
        # lazily and never touches ``receive``, so we can inspect the request
        # without consuming the body the downstream app needs.
        if _requires_csrf(Request(scope)):
            response = JSONResponse(
                status_code=403, content={"detail": "CSRF validation failed"},
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)
