"""Unit tests for app.auth.verified — email-verified user dependency.

Tests verify that get_verified_user allows verified users through and
blocks unverified users with a 403 Forbidden response.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.auth.verified import get_verified_user

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_user(email_verified: bool = True) -> MagicMock:
    """Return a mock User with the given email_verified status."""
    user = MagicMock()
    user.email_verified = email_verified
    user.id = "user-123"
    user.email = "test@example.com"
    return user


# ---------------------------------------------------------------------------
# get_verified_user
# ---------------------------------------------------------------------------


class TestGetVerifiedUser:
    """Tests for the get_verified_user dependency."""

    async def test_allows_verified_user(self):
        """A user with email_verified=True passes through."""
        user = _mock_user(email_verified=True)
        result = await get_verified_user(current_user=user)
        assert result is user

    async def test_blocks_unverified_user_with_403(self):
        """A user with email_verified=False raises 403."""
        user = _mock_user(email_verified=False)
        with pytest.raises(HTTPException) as exc_info:
            await get_verified_user(current_user=user)

        assert exc_info.value.status_code == 403

    async def test_error_message_mentions_email_verification(self):
        """The 403 error detail mentions email verification."""
        user = _mock_user(email_verified=False)
        with pytest.raises(HTTPException) as exc_info:
            await get_verified_user(current_user=user)

        detail = exc_info.value.detail.lower()
        assert "email" in detail
        assert "verif" in detail

    async def test_returns_same_user_object(self):
        """The returned user is the exact same object that was passed in."""
        user = _mock_user(email_verified=True)
        result = await get_verified_user(current_user=user)
        assert result is user
        assert result.id == "user-123"
