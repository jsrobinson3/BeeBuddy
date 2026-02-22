"""CSRF protection middleware for cookie-based auth.

Only enforced when an access_token cookie is present on a mutating request.
Bearer-only requests skip CSRF (tokens aren't auto-sent by browsers).
"""

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "BeeBuddy"


def _requires_csrf(request: Request) -> bool:
    """True when the request is a mutating cookie-auth request missing the CSRF header."""
    if request.method not in MUTATING_METHODS:
        return False
    # Bearer tokens prove intent (explicitly added by code, not auto-sent by
    # browsers), so CSRF is unnecessary.  This also prevents false positives on
    # React Native where cookies may ride along with Bearer requests.
    if request.headers.get("authorization", "").lower().startswith("bearer "):
        return False
    if not request.cookies.get("access_token"):
        return False
    return request.headers.get(CSRF_HEADER) != CSRF_VALUE


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if _requires_csrf(request):
            return JSONResponse(status_code=403, content={"detail": "CSRF validation failed"})
        return await call_next(request)
