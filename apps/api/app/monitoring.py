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


def _before_send(event, hint):
    """Strip cookies and drop known-benign broker races before sending."""
    if _is_kombu_on_readable_keyerror(event):
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
