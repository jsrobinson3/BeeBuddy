"""Unit tests for app.services.admin_service — dashboard stats and user counts.

Tests mock the database session to verify that dashboard stats and user
detail queries include AI token usage fields.
"""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

from app.services.admin_service import (
    _attach_counts,
    get_dashboard_stats,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db(scalars=None, rows=None):
    """Return a mock AsyncSession.

    *scalars*: list of values returned by sequential scalar_one() calls.
    *rows*: list of Row tuples returned by .all() (for list queries).
    """
    db = AsyncMock()
    result = MagicMock()

    if scalars is not None:
        result.scalar_one = MagicMock(side_effect=scalars)
    if rows is not None:
        result.all = MagicMock(return_value=rows)
        result.one_or_none = MagicMock(
            return_value=rows[0] if rows else None
        )

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
# _attach_counts
# ---------------------------------------------------------------------------


class TestAttachCounts:
    def test_attaches_all_fields(self):
        user = _fake_user()
        result = _attach_counts(user, 3, 7, 15000, 42)
        assert result.apiary_count == 3
        assert result.hive_count == 7
        assert result.total_ai_tokens == 15000
        assert result.ai_requests_30d == 42

    def test_defaults_token_fields_to_zero(self):
        user = _fake_user()
        result = _attach_counts(user, 1, 2)
        assert result.total_ai_tokens == 0
        assert result.ai_requests_30d == 0

    def test_none_values_become_zero(self):
        user = _fake_user()
        result = _attach_counts(user, None, None, None, None)
        assert result.apiary_count == 0
        assert result.hive_count == 0
        assert result.total_ai_tokens == 0
        assert result.ai_requests_30d == 0


# ---------------------------------------------------------------------------
# get_dashboard_stats
# ---------------------------------------------------------------------------


class TestGetDashboardStats:
    async def test_returns_all_stat_keys(self):
        """Dashboard stats include AI token usage fields."""
        # 8 original _count calls + 1 _sum_tokens + 2 _count_requests = 11
        db = _make_db(scalars=[
            10,  # total_users
            5,   # total_apiaries
            20,  # total_hives
            100, # total_inspections
            15,  # total_conversations
            3,   # new_users_7d
            8,   # new_users_30d
            6,   # active_users_7d
            50000,  # total_ai_tokens
            25,  # ai_requests_7d
            120, # ai_requests_30d
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
