"""Database session management."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.redis_utils import database_connect_args

settings = get_settings()

_connect_args = database_connect_args()

engine = create_async_engine(
    settings.database_url,
    echo=False,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=30,
    pool_recycle=3600,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


@asynccontextmanager
async def task_session() -> AsyncGenerator[AsyncSession, None]:
    """Async session for Celery tasks — uses a short-lived engine.

    ``asyncio.run()`` creates a new event loop per call, so the module-level
    ``engine`` (whose pool is bound to the import-time loop) causes
    "Future attached to a different loop" errors.  This context manager
    creates a **disposable** engine+session scoped to the current loop and
    disposes it on exit, preventing both loop-mismatch and connection-leak
    issues.
    """
    task_engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_pre_ping=True,
        pool_size=2,
        max_overflow=1,
        pool_timeout=30,
        pool_recycle=1800,
        connect_args=_connect_args,
    )
    task_session_factory = async_sessionmaker(
        task_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    try:
        async with task_session_factory() as session:
            yield session
    finally:
        await task_engine.dispose()
