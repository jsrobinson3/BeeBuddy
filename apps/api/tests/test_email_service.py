"""Unit tests for email_service error handling.

Specifically guards the change that SendGrid 4xx responses are logged at
WARNING (no Sentry exception event) while 5xx / network errors continue to
be captured as exceptions.
"""

import logging

import httpx
import pytest

from app.services import email_service


def _make_status_error(status: int, body: str) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", email_service.SENDGRID_API_URL)
    response = httpx.Response(status_code=status, request=request, content=body.encode())
    return httpx.HTTPStatusError(f"HTTP {status}", request=request, response=response)


def test_sendgrid_401_logs_warning_with_body(caplog):
    err = _make_status_error(401, '{"errors":[{"message":"Permission denied"}]}')

    with caplog.at_level(logging.DEBUG, logger="app.services.email_service"):
        email_service._log_sendgrid_error(err, "user@example.com", "Verify your email")

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    exceptions = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(warnings) == 1
    assert exceptions == []
    msg = warnings[0].getMessage()
    assert "401" in msg
    assert "user@example.com" in msg
    assert "Permission denied" in msg


def test_sendgrid_403_logs_warning(caplog):
    err = _make_status_error(403, '{"errors":[{"message":"From address not verified"}]}')

    with caplog.at_level(logging.DEBUG, logger="app.services.email_service"):
        email_service._log_sendgrid_error(err, "user@example.com", "Invite")

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    exceptions = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(warnings) == 1
    assert exceptions == []
    assert "From address not verified" in warnings[0].getMessage()


def test_sendgrid_5xx_logs_exception(caplog):
    err = _make_status_error(503, "Service Unavailable")

    with caplog.at_level(logging.DEBUG, logger="app.services.email_service"):
        try:
            raise err
        except httpx.HTTPStatusError as e:
            email_service._log_sendgrid_error(e, "user@example.com", "Subj")

    errors = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(errors) == 1
    assert errors[0].exc_info is not None, "5xx should attach the active exception"
    assert "503" in errors[0].getMessage()


def test_send_email_sync_suppresses_when_configured(monkeypatch, caplog):
    """email_suppress short-circuits before any HTTP call."""
    settings = email_service.get_settings()
    monkeypatch.setattr(settings, "email_suppress", True, raising=False)

    def fail_post(*_a, **_kw):
        pytest.fail("httpx.post must not be called when email_suppress=True")

    monkeypatch.setattr(httpx, "post", fail_post)

    with caplog.at_level(logging.INFO, logger="app.services.email_service"):
        email_service.send_email_sync("u@example.com", "Subj", "<b>hi</b>")

    assert any("suppressed" in r.getMessage() for r in caplog.records)


def test_send_email_sync_routes_4xx_to_warning(monkeypatch, caplog):
    """End-to-end: SendGrid 401 from send_email_sync becomes a single warning."""
    settings = email_service.get_settings()
    monkeypatch.setattr(settings, "email_suppress", False, raising=False)
    monkeypatch.setattr(settings, "sendgrid_api_key", "fake-key", raising=False)

    request = httpx.Request("POST", email_service.SENDGRID_API_URL)
    response = httpx.Response(401, request=request, content=b'{"errors":[{"message":"Bad key"}]}')

    def fake_post(*_a, **_kw):
        return response

    monkeypatch.setattr(httpx, "post", fake_post)

    with caplog.at_level(logging.DEBUG, logger="app.services.email_service"):
        email_service.send_email_sync("u@example.com", "Verify", "<b>hi</b>")

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    errors = [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert len(warnings) == 1
    assert errors == []
    assert "Bad key" in warnings[0].getMessage()
