"""Centralized Sentry initialization for API and Celery workers."""

import sentry_sdk
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.config import get_settings


def _is_kombu_on_readable_keyerror(event) -> bool:
    """Detect the benign kombu/redis `on_readable` KeyError race.

    Kombu's Redis transport occasionally raises ``KeyError`` in
    ``on_readable`` when epoll signals a file descriptor that has already
    been dropped from ``_fd_to_chan`` by connection cleanup. The worker
    recovers on its own; the noise just clutters Sentry.
    """
    for exc in (event.get("exception") or {}).get("values") or ():
        if exc.get("type") != "KeyError":
            continue
        frames = (exc.get("stacktrace") or {}).get("frames") or ()
        if not frames:
            continue
        top = frames[-1]
        filename = top.get("filename") or top.get("abs_path") or ""
        if top.get("function") == "on_readable" and "kombu/transport/redis" in filename:
            return True
    return False


def _is_celery_broker_reconnect(event) -> bool:
    """Celery's consumer logs each broker reconnect attempt at ERROR even
    though it retries automatically (up to 100 times by default). Those
    log lines flood Sentry whenever redis is briefly unavailable.
    """
    if event.get("logger", "") != "celery.worker.consumer.consumer":
        return False
    message = (event.get("logentry") or {}).get("message") or event.get("message") or ""
    return "Cannot connect to" in message and "Trying again in" in message


def _is_sqlalchemy_pool_cancelled_error(event) -> bool:
    """Drop the benign SQLAlchemy async-pool CancelledError disconnect race.

    When a client aborts an in-flight request, Starlette's BaseHTTPMiddleware
    propagates anyio's cancel scope through the pool's connection cleanup.
    SQLAlchemy's ``terminate`` awaits a graceful close that is then cancelled,
    and the pool logger emits ERROR "Exception terminating connection ...".
    The pool recovers on its own — the response has already been sent — so
    the noise adds nothing actionable.
    """
    if not event.get("logger", "").startswith("sqlalchemy.pool"):
        return False
    for exc in (event.get("exception") or {}).get("values") or ():
        if exc.get("type") == "CancelledError":
            return True
    return False


def _before_send(event, hint):
    """Strip cookies and drop known-benign broker races before sending."""
    if _is_kombu_on_readable_keyerror(event):
        return None
    if _is_celery_broker_reconnect(event):
        return None
    if _is_sqlalchemy_pool_cancelled_error(event):
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
