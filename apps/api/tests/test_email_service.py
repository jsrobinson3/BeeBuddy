"""Unit tests for the SendGrid email send error handling.

These tests verify that:
- Permanent 4xx failures are swallowed (Celery retry would never succeed) and
  logged at warning level so they don't flood Sentry as exception events.
- Transient failures (5xx, 429, network errors) are re-raised so the Celery
  task can retry with backoff.
"""

import importlib.util
import os
import pathlib
import sys
from unittest.mock import MagicMock, patch

import httpx
import pytest

# Provide minimum env so app.config.Settings() can construct if it's ever called.
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://x:y@localhost/db")

# Load app.services.email_service without triggering app/services/__init__.py
# (which transitively pulls in DB-bound modules unrelated to this unit test).
_API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(_API_ROOT))
_email_path = _API_ROOT / "app" / "services" / "email_service.py"
_spec = importlib.util.spec_from_file_location(
    "app_email_service_under_test", _email_path
)
email_service = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(email_service)


def _response(status: int, body: str = "") -> httpx.Response:
    return httpx.Response(
        status_code=status,
        request=httpx.Request("POST", email_service.SENDGRID_API_URL),
        content=body.encode(),
    )


@pytest.fixture(autouse=True)
def _configured_sendgrid():
    """Pretend SendGrid is configured and not suppressed."""
    settings = MagicMock()
    settings.email_suppress = False
    settings.sendgrid_api_key = "SG.test"
    settings.email_from_address = "noreply@beebuddy.dev"
    settings.email_from_name = "BeeBuddy"
    with patch.object(email_service, "get_settings", return_value=settings):
        yield


def test_send_email_sync_swallows_401(caplog):
    with patch.object(email_service.httpx, "post", return_value=_response(401, "bad key")):
        with caplog.at_level("WARNING", logger="app.services.email_service"):
            email_service.send_email_sync("u@example.com", "s", "<b/>")

    # No exception bubbled up — Celery will not retry.
    assert any(
        "not retrying" in r.getMessage() and r.levelname == "WARNING"
        for r in caplog.records
    ), caplog.text


def test_send_email_sync_reraises_500(caplog):
    with patch.object(email_service.httpx, "post", return_value=_response(503, "down")):
        with caplog.at_level("WARNING", logger="app.services.email_service"):
            with pytest.raises(httpx.HTTPStatusError):
                email_service.send_email_sync("u@example.com", "s", "<b/>")

    assert any("will retry" in r.getMessage() for r in caplog.records), caplog.text


def test_send_email_sync_reraises_429(caplog):
    with patch.object(email_service.httpx, "post", return_value=_response(429, "slow down")):
        with caplog.at_level("WARNING", logger="app.services.email_service"):
            with pytest.raises(httpx.HTTPStatusError):
                email_service.send_email_sync("u@example.com", "s", "<b/>")


def test_send_email_sync_reraises_network_error(caplog):
    with patch.object(
        email_service.httpx,
        "post",
        side_effect=httpx.ConnectError("boom"),
    ):
        with caplog.at_level("WARNING", logger="app.services.email_service"):
            with pytest.raises(httpx.ConnectError):
                email_service.send_email_sync("u@example.com", "s", "<b/>")

    assert any(
        "network error" in r.getMessage().lower() for r in caplog.records
    ), caplog.text


def test_send_email_sync_success_does_not_log_warning(caplog):
    with patch.object(email_service.httpx, "post", return_value=_response(202)):
        with caplog.at_level("WARNING", logger="app.services.email_service"):
            email_service.send_email_sync("u@example.com", "s", "<b/>")

    assert not [r for r in caplog.records if r.levelname == "WARNING"]


def test_is_permanent_failure_classification():
    assert email_service._is_permanent_failure(
        httpx.HTTPStatusError("x", request=MagicMock(), response=_response(401))
    )
    assert email_service._is_permanent_failure(
        httpx.HTTPStatusError("x", request=MagicMock(), response=_response(403))
    )
    assert not email_service._is_permanent_failure(
        httpx.HTTPStatusError("x", request=MagicMock(), response=_response(429))
    )
    assert not email_service._is_permanent_failure(
        httpx.HTTPStatusError("x", request=MagicMock(), response=_response(500))
    )
    assert not email_service._is_permanent_failure(httpx.ConnectError("x"))
