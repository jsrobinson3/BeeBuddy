"""Unit tests for app.services.email_service error handling.

Covers how ``send_email_sync`` classifies SendGrid HTTP responses:
retryable 5xx/408/425/429 re-raise, quota-exhaustion 401s log at WARNING,
and other non-retryable 4xx responses stay at ERROR.
"""

import logging
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services.email_service import (
    _is_sendgrid_quota_exhausted,
    send_email_sync,
)


class TestIsSendgridQuotaExhausted:
    def test_401_with_quota_message_matches(self):
        body = '{"errors":[{"message":"Maximum credits exceeded","field":null,"help":null}]}'
        assert _is_sendgrid_quota_exhausted(401, body) is True

    def test_401_with_other_message_does_not_match(self):
        assert _is_sendgrid_quota_exhausted(401, '{"errors":[{"message":"Bad API key"}]}') is False

    def test_other_4xx_with_quota_message_does_not_match(self):
        # Only 401 is treated as quota — a different status for the same text
        # is a different failure mode.
        body = '{"errors":[{"message":"Maximum credits exceeded"}]}'
        assert _is_sendgrid_quota_exhausted(403, body) is False
        assert _is_sendgrid_quota_exhausted(400, body) is False

    def test_500_does_not_match(self):
        assert _is_sendgrid_quota_exhausted(500, "boom") is False


def _mock_settings(**overrides):
    base = {
        "email_suppress": False,
        "sendgrid_api_key": "SG.test-key",
        "email_from_address": "noreply@example.com",
        "email_from_name": "BeeBuddy",
    }
    base.update(overrides)
    m = MagicMock()
    for k, v in base.items():
        setattr(m, k, v)
    return m


def _httpx_response(status: int, text: str) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        content=text.encode("utf-8"),
        request=httpx.Request("POST", "https://api.sendgrid.com/v3/mail/send"),
    )


class TestSendEmailSyncErrorClassification:
    def test_quota_exhausted_logs_warning_and_swallows(self, caplog):
        resp = _httpx_response(
            401,
            '{"errors":[{"message":"Maximum credits exceeded","field":null,"help":null}]}',
        )
        with patch("app.services.email_service.get_settings", return_value=_mock_settings()), \
             patch("app.services.email_service.httpx.post", return_value=resp), \
             caplog.at_level(logging.WARNING, logger="app.services.email_service"):
            # Must not raise — quota exhaustion is non-retryable.
            send_email_sync("beekeeper@example.com", "Verify your email", "<p>hi</p>")

        records = [r for r in caplog.records if r.name == "app.services.email_service"]
        assert len(records) == 1
        assert records[0].levelno == logging.WARNING
        assert "quota exhausted" in records[0].getMessage().lower()
        assert "top up credits" in records[0].getMessage().lower()

    def test_other_4xx_still_logs_error(self, caplog):
        resp = _httpx_response(400, '{"errors":[{"message":"Bad request"}]}')
        with patch("app.services.email_service.get_settings", return_value=_mock_settings()), \
             patch("app.services.email_service.httpx.post", return_value=resp), \
             caplog.at_level(logging.ERROR, logger="app.services.email_service"):
            send_email_sync("beekeeper@example.com", "Verify your email", "<p>hi</p>")

        errors = [r for r in caplog.records
                  if r.name == "app.services.email_service" and r.levelno == logging.ERROR]
        assert len(errors) == 1
        assert "Non-retryable SendGrid error 400" in errors[0].getMessage()

    def test_401_without_quota_message_still_logs_error(self, caplog):
        # A real auth failure (e.g. rotated or revoked key) is an actionable
        # bug and must stay at ERROR so it reaches Sentry.
        resp = _httpx_response(
            401, '{"errors":[{"message":"Permission denied"}]}',
        )
        with patch("app.services.email_service.get_settings", return_value=_mock_settings()), \
             patch("app.services.email_service.httpx.post", return_value=resp), \
             caplog.at_level(logging.ERROR, logger="app.services.email_service"):
            send_email_sync("beekeeper@example.com", "Verify your email", "<p>hi</p>")

        errors = [r for r in caplog.records
                  if r.name == "app.services.email_service" and r.levelno == logging.ERROR]
        assert len(errors) == 1
        assert "Non-retryable SendGrid error 401" in errors[0].getMessage()

    def test_5xx_reraises_for_celery_retry(self):
        resp = _httpx_response(503, "service unavailable")
        with patch("app.services.email_service.get_settings", return_value=_mock_settings()), \
             patch("app.services.email_service.httpx.post", return_value=resp):
            with pytest.raises(httpx.HTTPStatusError):
                send_email_sync("beekeeper@example.com", "Verify your email", "<p>hi</p>")

    def test_429_reraises_for_celery_retry(self):
        resp = _httpx_response(429, "too many requests")
        with patch("app.services.email_service.get_settings", return_value=_mock_settings()), \
             patch("app.services.email_service.httpx.post", return_value=resp):
            with pytest.raises(httpx.HTTPStatusError):
                send_email_sync("beekeeper@example.com", "Verify your email", "<p>hi</p>")
