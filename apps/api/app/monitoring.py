"""Centralized Sentry initialization for API and Celery workers."""

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings


def _is_celery_transient_retry(event: dict) -> bool:
    """Drop Celery's broker connection-retry log records.

    Celery logs ERROR-level "Cannot connect... Trying again in N seconds"
    while it is still retrying, which the logging integration forwards to
    Sentry. The message is by definition self-recovering — if the retry
    eventually fails for good, Celery emits a separate terminal error.
    """
    logger_name = event.get("logger") or ""
    if not logger_name.startswith("celery.worker.consumer"):
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
    """Strip cookies and filter transient infra retry noise."""
    if _is_celery_transient_retry(event):
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
