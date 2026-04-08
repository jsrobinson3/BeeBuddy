"""Centralized Sentry initialization for API and Celery workers."""

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings


def _scrub_headers(headers):
    """Remove sensitive headers (cookies, auth) from request data."""
    _sensitive = {"cookie", "authorization"}
    if isinstance(headers, dict):
        for key in list(headers):
            if key.lower() in _sensitive:
                del headers[key]
    elif isinstance(headers, list):
        headers[:] = [
            pair for pair in headers if pair[0].lower() not in _sensitive
        ]


def _before_send(event, hint):
    """Strip sensitive headers from Sentry error events."""
    if "request" in event:
        req = event["request"]
        req.pop("cookies", None)
        _scrub_headers(req.get("headers", {}))
    return event


def _before_send_transaction(event, hint):
    """Strip sensitive headers from Sentry transaction/performance events."""
    if "request" in event:
        req = event["request"]
        req.pop("cookies", None)
        _scrub_headers(req.get("headers", {}))
    return event


def init_sentry() -> None:
    """Initialize Sentry SDK if a DSN is configured."""
    settings = get_settings()
    if not settings.sentry_dsn:
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=settings.sentry_traces_sample_rate,
        environment=settings.sentry_environment,
        send_default_pii=False,
        enable_tracing=True,
        before_send=_before_send,
        before_send_transaction=_before_send_transaction,
        integrations=[
            FastApiIntegration(),
            StarletteIntegration(),
            CeleryIntegration(),
        ],
    )
