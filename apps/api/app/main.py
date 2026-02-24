"""BeeBuddy API - FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.middleware.csrf import CSRFMiddleware
from app.routers import (
    apiaries,
    auth,
    cadences,
    events,
    harvests,
    health,
    hives,
    inspections,
    photos,
    queens,
    sync,
    tasks,
    treatments,
    users,
)
from app.services import s3_service

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    await s3_service.ensure_bucket_exists()
    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    description="AI-powered beekeeping management platform",
    version="0.1.0",
    lifespan=lifespan,
)

# CSRF middleware (added first so it becomes the inner layer)
app.add_middleware(CSRFMiddleware)

# CORS middleware (added second so it becomes the outermost layer — ensures all
# responses, including CSRF 403s, carry the correct Access-Control-* headers)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate-limit exceeded handler (slowapi)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(apiaries.router, prefix=settings.api_v1_prefix, tags=["apiaries"])
app.include_router(hives.router, prefix=settings.api_v1_prefix, tags=["hives"])
app.include_router(inspections.router, prefix=settings.api_v1_prefix, tags=["inspections"])
app.include_router(photos.router, prefix=settings.api_v1_prefix, tags=["photos"])
app.include_router(auth.router, prefix=settings.api_v1_prefix, tags=["auth"])
app.include_router(users.router, prefix=settings.api_v1_prefix, tags=["users"])
app.include_router(queens.router, prefix=settings.api_v1_prefix, tags=["queens"])
app.include_router(treatments.router, prefix=settings.api_v1_prefix, tags=["treatments"])
app.include_router(harvests.router, prefix=settings.api_v1_prefix, tags=["harvests"])
app.include_router(events.router, prefix=settings.api_v1_prefix, tags=["events"])
app.include_router(tasks.router, prefix=settings.api_v1_prefix, tags=["tasks"])
app.include_router(cadences.router, prefix=settings.api_v1_prefix, tags=["cadences"])
app.include_router(sync.router, prefix=settings.api_v1_prefix, tags=["sync"])
