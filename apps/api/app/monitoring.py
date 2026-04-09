"""Centralized Sentry initialization for API and Celery workers."""

import importlib.metadata

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.redis import RedisIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings

_RELEASE = f"beebuddy-api@{importlib.metadata.version('beebuddy-api')}"


def _scrub_request(event, hint):
    """Strip cookies and auth headers from Sentry events to avoid leaking secrets."""
    if "request" in event:
        req = event["request"]
        req.pop("cookies", None)
        headers = req.get("headers", {})
        if isinstance(headers, dict):
            headers.pop("cookie", None)
            headers.pop("Cookie", None)
            headers.pop("authorization", None)
            headers.pop("Authorization", None)
    return event


def init_sentry() -> None:
    """Initialize Sentry SDK if a DSN is configured."""
    settings = get_settings()
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        release=_RELEASE,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.sentry_environment,
        send_default_pii=False,
        enable_tracing=True,
        before_send=_scrub_request,
        before_send_transaction=_scrub_request,
        integrations=[
            FastApiIntegration(),
            StarletteIntegration(),
            CeleryIntegration(),
            SqlalchemyIntegration(),
            RedisIntegration(),
        ],
    )
