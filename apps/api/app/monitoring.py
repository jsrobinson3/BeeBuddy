"""Centralized Sentry initialization for API and Celery workers."""

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings

# Celery loggers that emit transient broker/backend reconnect noise. These are
# auto-retried by Celery itself, so they aren't actionable as Sentry issues.
_CELERY_TRANSIENT_LOGGERS = {
    "celery.worker.consumer.consumer",
    "celery.worker.consumer",
    "celery.redirected",
}
_CELERY_TRANSIENT_PHRASES = (
    "Trying again in",
    "Cannot connect to",
    "consumer: Connection to broker lost",
)


def _is_transient_celery_reconnect(event: dict) -> bool:
    logger = event.get("logger") or ""
    if logger not in _CELERY_TRANSIENT_LOGGERS:
        return False
    message = event.get("logentry", {}).get("message") or event.get("message") or ""
    return any(phrase in message for phrase in _CELERY_TRANSIENT_PHRASES)


def _before_send(event, hint):
    """Strip cookies and drop Celery reconnect noise from Sentry events."""
    if _is_transient_celery_reconnect(event):
        return None
    if "request" in event:
        req = event["request"]
        req.pop("cookies", None)
        headers = req.get("headers", {})
        if isinstance(headers, dict):
            headers.pop("cookie", None)
            headers.pop("Cookie", None)
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
        integrations=[
            FastApiIntegration(),
            StarletteIntegration(),
            CeleryIntegration(),
        ],
    )
