"""Tests for Sentry before_send filter."""

from app.monitoring import _before_send


class TestBeforeSendCookieStripping:
    def test_strips_cookies_dict_from_request(self):
        event = {"request": {"cookies": {"session": "abc"}, "url": "/x"}}
        result = _before_send(event, {})
        assert "cookies" not in result["request"]

    def test_strips_cookie_header_case_insensitive(self):
        event = {
            "request": {
                "headers": {"cookie": "x=1", "Cookie": "y=2", "X-Other": "ok"},
            },
        }
        result = _before_send(event, {})
        assert "cookie" not in result["request"]["headers"]
        assert "Cookie" not in result["request"]["headers"]
        assert result["request"]["headers"]["X-Other"] == "ok"

    def test_no_request_section_is_noop(self):
        event = {"message": "boom"}
        assert _before_send(event, {}) == {"message": "boom"}


class TestBeforeSendCeleryReconnectFilter:
    def test_drops_celery_consumer_reconnect_retry(self):
        event = {
            "logger": "celery.worker.consumer.consumer",
            "logentry": {
                "message": (
                    "consumer: Cannot connect to redis://redis:6379/0: "
                    "Error 111 connecting to redis:6379. Connection refused..\n"
                    "Trying again in 2.00 seconds... (1/100)"
                ),
            },
            "level": "error",
        }
        assert _before_send(event, {}) is None

    def test_drops_when_message_is_top_level_string(self):
        event = {
            "logger": "celery.worker.consumer.consumer",
            "message": "Cannot connect to redis://x. Trying again in 4s...",
        }
        assert _before_send(event, {}) is None

    def test_keeps_other_celery_consumer_errors(self):
        event = {
            "logger": "celery.worker.consumer.consumer",
            "logentry": {"message": "Unrecoverable error: KeyError"},
            "level": "error",
        }
        assert _before_send(event, {}) is event

    def test_keeps_non_celery_connection_errors(self):
        event = {
            "logger": "app.redis_utils",
            "logentry": {
                "message": "Cannot connect to redis://. Trying again in 1s...",
            },
        }
        assert _before_send(event, {}) is event

    def test_keeps_celery_consumer_log_without_retry_phrase(self):
        event = {
            "logger": "celery.worker.consumer.consumer",
            "logentry": {"message": "Cannot connect to redis"},
        }
        assert _before_send(event, {}) is event
