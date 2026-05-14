"""Centralized Sentry initialization for API and Celery workers."""

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings


def _is_celery_broker_reconnect(event) -> bool:
    """Celery's consumer logs each broker reconnect attempt at ERROR even
    though it retries automatically (up to 100 times by default). Those
    log lines flood Sentry whenever redis is briefly unavailable.
    """
    if event.get("logger", "") != "celery.worker.consumer.consumer":
        return False
    message = (event.get("logentry") or {}).get("message") or event.get("message") or ""
    return "Cannot connect to" in message and "Trying again in" in message


def _before_send(event, hint):
    """Strip cookies from Sentry events and drop transient broker-retry noise."""
    if _is_celery_broker_reconnect(event):
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
