"""Unit tests for app.auth.permissions — accepted-share lookup + logging.

Regression coverage for Sentry issue BEEBUDDY-BACKEND-13: the share_status
enum-binding bug caused ``Share.status == ShareStatus.ACCEPTED`` filters to
silently match nothing, so users with a genuinely accepted share were denied
access with no exception and nothing visible in Sentry. ``_get_accepted_share``
now logs an error whenever that exact pattern recurs (a share row that IS
accepted, but wasn't returned by the status-filtered query).
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.auth.permissions import _get_accepted_share
from app.models.share import ShareStatus


def _make_db(*, accepted_result, all_shares):
    """Build a mock AsyncSession whose db.execute() calls, in order, return:
    1. the accepted-share query result (scalar_one_or_none() -> accepted_result)
    2. the any-share diagnostic query result (scalars().all() -> all_shares)
    """
    accepted_query_result = MagicMock()
    accepted_query_result.scalar_one_or_none = MagicMock(return_value=accepted_result)

    any_share_result = MagicMock()
    any_share_result.scalars.return_value.all = MagicMock(return_value=all_shares)

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[accepted_query_result, any_share_result])
    return db


def _make_share(status: ShareStatus) -> MagicMock:
    share = MagicMock()
    share.id = uuid4()
    share.status = status
    return share


class TestGetAcceptedShare:
    async def test_returns_share_without_diagnostic_query(self):
        """The common case: an accepted share is found directly — no need
        for the second diagnostic query at all."""
        accepted_share = _make_share(ShareStatus.ACCEPTED)
        db = AsyncMock()
        db.execute = AsyncMock(return_value=MagicMock(
            scalar_one_or_none=MagicMock(return_value=accepted_share),
        ))

        result = await _get_accepted_share(db, uuid4(), apiary_id=uuid4())

        assert result is accepted_share
        assert db.execute.call_count == 1

    async def test_no_share_at_all_does_not_log(self, caplog):
        """No share exists for this user+resource — expected 404, no noise."""
        caplog.set_level("ERROR", logger="app.auth.permissions")
        db = _make_db(accepted_result=None, all_shares=[])

        result = await _get_accepted_share(db, uuid4(), apiary_id=uuid4())

        assert result is None
        assert caplog.records == []

    async def test_pending_share_does_not_log(self, caplog):
        """A share exists but is genuinely pending — expected denial, no noise."""
        caplog.set_level("ERROR", logger="app.auth.permissions")
        pending_share = _make_share(ShareStatus.PENDING)
        db = _make_db(accepted_result=None, all_shares=[pending_share])

        result = await _get_accepted_share(db, uuid4(), apiary_id=uuid4())

        assert result is None
        assert caplog.records == []

    async def test_accepted_share_missed_by_filter_logs_error(self, caplog):
        """The regression case: a row IS accepted but the filtered query
        missed it — this must be logged so it's visible in Sentry."""
        caplog.set_level("ERROR", logger="app.auth.permissions")
        accepted_share = _make_share(ShareStatus.ACCEPTED)
        db = _make_db(accepted_result=None, all_shares=[accepted_share])

        result = await _get_accepted_share(db, uuid4(), apiary_id=uuid4())

        assert result is None
        assert len(caplog.records) == 1
        assert caplog.records[0].levelname == "ERROR"
        assert str(accepted_share.id) in caplog.records[0].getMessage()
