"""Unit tests for app.services.admin_service — dashboard stats, UserWithCounts,
mass-assignment allowlists, and redirect URI validation.

Tests mock the database session to verify query logic and security guards.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import ValidationError

from app.schemas.admin import OAuth2ClientCreate, OAuth2ClientUpdate
from app.services.admin_service import (
    OAUTH_CLIENT_ALLOWED_FIELDS,
    USER_ADMIN_ALLOWED_FIELDS,
    UserWithCounts,
    get_dashboard_stats,
    update_oauth_client,
    update_user_admin,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db(scalars=None):
    """Return a mock AsyncSession.

    *scalars*: list of values returned by sequential scalar_one() calls.
    """
    db = AsyncMock()
    result = MagicMock()

    if scalars is not None:
        result.scalar_one = MagicMock(side_effect=scalars)

    db.execute = AsyncMock(return_value=result)
    return db


def _fake_user(**overrides):
    user = MagicMock()
    user.id = overrides.get("id", uuid.uuid4())
    user.name = overrides.get("name", "Test User")
    user.email = overrides.get("email", "test@example.com")
    user.deleted_at = overrides.get("deleted_at", None)
    user.last_login_at = overrides.get("last_login_at", None)
    user.created_at = overrides.get("created_at", datetime.now(UTC))
    return user


# ---------------------------------------------------------------------------
# UserWithCounts
# ---------------------------------------------------------------------------


class TestUserWithCounts:
    def test_stores_all_count_fields(self):
        user = _fake_user()
        uwc = UserWithCounts(
            user=user, apiary_count=3, hive_count=7,
            total_ai_tokens=15000, ai_requests_30d=42,
        )
        assert uwc.apiary_count == 3
        assert uwc.hive_count == 7
        assert uwc.total_ai_tokens == 15000
        assert uwc.ai_requests_30d == 42

    def test_defaults_count_fields_to_zero(self):
        user = _fake_user()
        uwc = UserWithCounts(user=user)
        assert uwc.apiary_count == 0
        assert uwc.hive_count == 0
        assert uwc.total_ai_tokens == 0
        assert uwc.ai_requests_30d == 0

    def test_forwards_user_attributes(self):
        user = _fake_user(name="Alice", email="alice@example.com")
        uwc = UserWithCounts(user=user, apiary_count=1, hive_count=2)
        assert uwc.name == "Alice"
        assert uwc.email == "alice@example.com"
        assert uwc.id == user.id

    def test_raises_attribute_error_for_unknown(self):
        class SimpleUser:
            id = "u1"
        uwc = UserWithCounts(user=SimpleUser())
        with pytest.raises(AttributeError):
            _ = uwc.nonexistent_attribute


# ---------------------------------------------------------------------------
# get_dashboard_stats
# ---------------------------------------------------------------------------


class TestGetDashboardStats:
    async def test_returns_all_stat_keys(self):
        """Dashboard stats include AI token usage fields."""
        # 11 sequential queries
        db = _make_db(scalars=[
            10, 5, 20, 100, 15, 3, 8, 6, 50000, 25, 120,
        ])

        stats = await get_dashboard_stats(db)

        assert stats["total_users"] == 10
        assert stats["total_ai_tokens"] == 50000
        assert stats["ai_requests_7d"] == 25
        assert stats["ai_requests_30d"] == 120

    async def test_all_expected_keys_present(self):
        db = _make_db(scalars=[0] * 11)
        stats = await get_dashboard_stats(db)
        expected = {
            "total_users", "total_apiaries", "total_hives",
            "total_inspections", "total_conversations",
            "new_users_7d", "new_users_30d", "active_users_7d",
            "total_ai_tokens", "ai_requests_7d", "ai_requests_30d",
        }
        assert set(stats.keys()) == expected


# ---------------------------------------------------------------------------
# Mass-assignment allowlists (W1)
# ---------------------------------------------------------------------------


class TestSetAttrAllowlists:
    async def test_update_user_ignores_disallowed_fields(self):
        user = _fake_user()
        db = AsyncMock()
        data = {"is_admin": True, "email": "hacked@evil.com", "name": "Evil"}
        await update_user_admin(db, user, data)
        # is_admin is allowed
        assert user.is_admin is True
        # email and name are NOT in the allowlist — should remain unchanged
        assert user.email == "test@example.com"
        assert user.name == "Test User"

    async def test_update_oauth_client_ignores_disallowed_fields(self):
        client = MagicMock()
        client.name = "Original"
        client.client_id = "orig-id"
        db = AsyncMock()
        data = {"name": "Updated", "client_id": "hacked-id"}
        await update_oauth_client(db, client, data)
        assert client.name == "Updated"
        # client_id is NOT in the allowlist
        assert client.client_id == "orig-id"

    def test_user_allowlist_only_safe_fields(self):
        assert USER_ADMIN_ALLOWED_FIELDS == {"is_admin", "email_verified"}

    def test_oauth_allowlist_only_safe_fields(self):
        assert OAUTH_CLIENT_ALLOWED_FIELDS == {"name", "redirect_uris", "is_active"}


# ---------------------------------------------------------------------------
# Redirect URI validation (W2)
# ---------------------------------------------------------------------------


class TestRedirectUriValidation:
    def test_https_uris_accepted(self):
        obj = OAuth2ClientCreate(
            client_id="test", name="Test",
            redirect_uris=["https://example.com/callback"],
        )
        assert obj.redirect_uris == ["https://example.com/callback"]

    def test_http_localhost_accepted(self):
        obj = OAuth2ClientCreate(
            client_id="test", name="Test",
            redirect_uris=["http://localhost:3000/callback"],
        )
        assert obj.redirect_uris == ["http://localhost:3000/callback"]

    def test_http_127_accepted(self):
        obj = OAuth2ClientCreate(
            client_id="test", name="Test",
            redirect_uris=["http://127.0.0.1:8080/cb"],
        )
        assert obj.redirect_uris == ["http://127.0.0.1:8080/cb"]

    def test_plain_http_rejected(self):
        with pytest.raises(ValidationError, match="https://"):
            OAuth2ClientCreate(
                client_id="test", name="Test",
                redirect_uris=["http://evil.com/callback"],
            )

    def test_ftp_rejected(self):
        with pytest.raises(ValidationError, match="https://"):
            OAuth2ClientCreate(
                client_id="test", name="Test",
                redirect_uris=["ftp://example.com/callback"],
            )

    def test_update_validates_too(self):
        with pytest.raises(ValidationError, match="https://"):
            OAuth2ClientUpdate(redirect_uris=["http://evil.com/callback"])

    def test_update_none_is_fine(self):
        obj = OAuth2ClientUpdate(redirect_uris=None)
        assert obj.redirect_uris is None
