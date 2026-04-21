"""Async DB session factory scoped to a single Celery task invocation.

Celery tasks call ``asyncio.run()`` per invocation, which spins up a fresh
event loop each time. The module-level async engine in ``app.db.session``
binds its connection pool to whichever loop first used it, so later tasks
see ``RuntimeError: Future attached to a different loop`` and leak
connections until PostgreSQL rejects new ones with ``too many clients``.

Each call to :func:`task_sessionmaker` creates a short-lived engine with
``NullPool`` (no cross-loop connection reuse) and disposes it on exit, so
every connection is opened and closed within the same event loop.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.redis_utils import database_connect_args


@asynccontextmanager
async def task_sessionmaker() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Yield a task-scoped ``async_sessionmaker`` and dispose the engine on exit."""
    settings = get_settings()
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        poolclass=NullPool,
        connect_args=database_connect_args(),
    )
    try:
        yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    finally:
        await engine.dispose()
