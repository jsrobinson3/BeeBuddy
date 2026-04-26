"""Database session factory for Celery workers.

Uses ``NullPool`` so each task opens a fresh connection that is fully closed
when the session ends. Celery tasks in this codebase run their async bodies
via ``asyncio.run()``, which creates a new event loop per invocation — a
pooled engine ends up caching connections bound to prior loops and triggers
``RuntimeError: ... got Future ... attached to a different loop`` on
``pool_pre_ping`` and ``RuntimeError: Event loop is closed`` during pool
termination. Disabling pooling keeps each connection's lifecycle inside a
single loop.

Addresses Sentry BEEBUDDY-BACKEND-7, -1B, -1C, -T, -S, -W, -V, -Y.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.redis_utils import database_connect_args

_settings = get_settings()

celery_engine = create_async_engine(
    _settings.database_url,
    echo=False,
    poolclass=NullPool,
    connect_args=database_connect_args(),
)

CeleryAsyncSessionLocal = async_sessionmaker(
    celery_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
