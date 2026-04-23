"""Tests for the Celery async DB task runner.

The runner exists to dispose the SQLAlchemy async engine inside the same
event loop that ``asyncio.run`` will tear down, so asyncpg's loop-bound
connections are closed cleanly. Without it, Celery tasks that use the
module-level engine emit ``RuntimeError: Event loop is closed`` and leak
server-side connections.
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _engine_mock(dispose_mock):
    engine = MagicMock()
    engine.dispose = dispose_mock
    return engine


def test_run_async_db_task_disposes_engine_after_success():
    """Engine.dispose() must be awaited in the same loop as the coroutine."""
    from app.tasks import _run_async_db_task

    captured_loop = {}

    async def coro():
        captured_loop["coro"] = asyncio.get_running_loop()

    async def _dispose():
        loop = asyncio.get_running_loop()
        captured_loop["dispose"] = loop
        captured_loop["dispose_loop_closed"] = loop.is_closed()

    dispose_mock = AsyncMock(side_effect=_dispose)

    with patch("app.db.session.engine", _engine_mock(dispose_mock)):
        _run_async_db_task(coro)

    dispose_mock.assert_awaited_once()
    assert captured_loop["coro"] is captured_loop["dispose"]
    # The whole point: dispose runs on the same live loop, before teardown.
    assert captured_loop["dispose_loop_closed"] is False


def test_run_async_db_task_disposes_engine_when_coro_raises():
    """Even when the wrapped coroutine raises, the engine must be disposed."""
    from app.tasks import _run_async_db_task

    async def coro():
        raise RuntimeError("boom")

    dispose_mock = AsyncMock()

    with patch("app.db.session.engine", _engine_mock(dispose_mock)):
        with pytest.raises(RuntimeError, match="boom"):
            _run_async_db_task(coro)

    dispose_mock.assert_awaited_once()


def test_run_async_db_task_propagates_dispose_failure():
    """If dispose itself fails, the error should surface (not be swallowed)."""
    from app.tasks import _run_async_db_task

    async def coro():
        return None

    dispose_mock = AsyncMock(side_effect=RuntimeError("dispose failed"))

    with patch("app.db.session.engine", _engine_mock(dispose_mock)):
        with pytest.raises(RuntimeError, match="dispose failed"):
            _run_async_db_task(coro)
