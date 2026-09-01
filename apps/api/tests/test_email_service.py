"""Unit tests for ``email_service.send_email_sync`` error handling."""

from unittest.mock import patch

import httpx
import pytest

from app.services import email_service


def _configure_settings():
    """Force the module through the SendGrid code path."""
    settings = email_service.get_settings()
    return patch.multiple(
        settings, email_suppress=False, sendgrid_api_key="sg.test",
    )


def _fake_response(status: int, body: str) -> httpx.Response:
    resp = httpx.Response(status, text=body)
    resp.request = httpx.Request("POST", email_service.SENDGRID_API_URL)
    return resp


class TestQuotaExhaustion:
    """SendGrid returns quota exhaustion as 401 with a specific body; that's
    an operational condition, not a code bug, and must not spam Sentry
    (see BEEBUDDY-BACKEND-1H).
    """

    def test_maximum_credits_exceeded_logs_warning_not_error(self):
        body = '{"errors":[{"message":"Maximum credits exceeded"}]}'
        with _configure_settings(), \
             patch("app.services.email_service.httpx.post",
                   return_value=_fake_response(401, body)), \
             patch.object(email_service.logger, "warning") as warn, \
             patch.object(email_service.logger, "error") as err:
            email_service.send_email_sync("a@b.c", "Verify", "<p>hi</p>")
        assert warn.called
        assert not err.called
        assert "quota exhausted" in warn.call_args.args[0].lower()

    def test_generic_401_still_logs_error(self):
        with _configure_settings(), \
             patch("app.services.email_service.httpx.post",
                   return_value=_fake_response(401, "unauthorized")), \
             patch.object(email_service.logger, "error") as err:
            email_service.send_email_sync("a@b.c", "Verify", "<p>hi</p>")
        assert err.called

    def test_400_bad_payload_logs_error(self):
        body = '{"errors":[{"message":"invalid to.email"}]}'
        with _configure_settings(), \
             patch("app.services.email_service.httpx.post",
                   return_value=_fake_response(400, body)), \
             patch.object(email_service.logger, "error") as err:
            email_service.send_email_sync("a@b.c", "Verify", "<p>hi</p>")
        assert err.called

    def test_500_still_raises_for_celery_retry(self):
        with _configure_settings(), \
             patch("app.services.email_service.httpx.post",
                   return_value=_fake_response(500, "oops")):
            with pytest.raises(httpx.HTTPStatusError):
                email_service.send_email_sync("a@b.c", "Verify", "<p>hi</p>")


class TestQuotaHintMatcher:
    def test_matches_common_phrasings(self):
        for body in (
            '{"errors":[{"message":"Maximum credits exceeded"}]}',
            "credits exceeded",
            "Quota Exceeded for account",
            "over your daily sending limit",
        ):
            assert email_service._is_quota_exhausted(body), body

    def test_does_not_match_unrelated_errors(self):
        for body in (
            "unauthorized",
            '{"errors":[{"message":"invalid to.email"}]}',
            "",
        ):
            assert not email_service._is_quota_exhausted(body), body
