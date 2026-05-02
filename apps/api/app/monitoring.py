"""Centralized Sentry initialization for API and Celery workers."""

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings


def _is_transient_celery_broker_retry(event) -> bool:
    """Detect Celery's auto-retrying broker connection log lines.

    Celery is configured with ``broker_connection_retry_on_startup = True`` and
    retries up to 100 times. The first ERROR-level log fires before retries
    succeed, so each transient blip surfaces as a Sentry issue even though the
    consumer recovers on its own. If retries genuinely exhaust, a separate
    fatal log/exception will still reach Sentry.
    """
    if event.get("logger") != "celery.worker.consumer.consumer":
        return False
    logentry = event.get("logentry") or {}
    message = (
        logentry.get("formatted")
        or logentry.get("message")
        or event.get("message")
        or ""
    )
    return "Trying again in" in message


def _before_send(event, hint):
    """Strip cookies and drop transient Celery broker retries."""
    if _is_transient_celery_broker_retry(event):
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
