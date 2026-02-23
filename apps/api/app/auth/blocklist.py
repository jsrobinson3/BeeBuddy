"""Token blocklist backed by Redis / Valkey.

On logout we record the current timestamp for the user.  Any token whose
``iat`` (issued-at) claim is older than that timestamp is considered revoked.
The key auto-expires after the refresh-token TTL so Redis doesn't accumulate
stale entries.
"""

import logging
from datetime import UTC, datetime

from app.config import get_settings
from app.redis import get_redis

logger = logging.getLogger(__name__)

_KEY_PREFIX = "logout:"


async def blocklist_user_tokens(user_id: str) -> None:
    """Invalidate every token issued before *now* for the given user."""
    settings = get_settings()
    ttl = settings.refresh_token_expire_days * 86400
    now = str(datetime.now(UTC).timestamp())
    r = get_redis()
    await r.set(f"{_KEY_PREFIX}{user_id}", now, ex=ttl)


async def is_token_blocklisted(user_id: str, token_iat: float | None) -> bool:
    """Return True if the token was issued before the user's last logout."""
    if token_iat is None:
        return False
    try:
        r = get_redis()
        val = await r.get(f"{_KEY_PREFIX}{user_id}")
        if val is None:
            return False
        return token_iat < float(val)
    except Exception:
        # Redis down — fail open so users aren't locked out.
        logger.warning("Redis unavailable for blocklist check", exc_info=True)
        return False
