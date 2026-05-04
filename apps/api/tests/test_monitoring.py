"""Unit tests for Sentry before_send filtering."""

from app.monitoring import _before_send


class TestBeforeSendCookieScrubbing:
    def test_strips_cookies_field_from_request(self):
        event = {
            "request": {
                "cookies": {"session": "secret"},
                "headers": {"Cookie": "session=secret", "User-Agent": "ua"},
            }
        }
        result = _before_send(event, {})
        assert result is not None
        assert "cookies" not in result["request"]
        assert "Cookie" not in result["request"]["headers"]
        assert "cookie" not in result["request"]["headers"]
        assert result["request"]["headers"]["User-Agent"] == "ua"

    def test_passthrough_event_with_no_request(self):
        event = {"message": "hello"}
        assert _before_send(event, {}) is event


class TestCeleryReconnectFiltering:
    def test_drops_consumer_cannot_connect_event(self):
        event = {
            "logger": "celery.worker.consumer.consumer",
            "logentry": {
                "message": (
                    "consumer: Cannot connect to redis://redis:6379/0: "
                    "Connection refused.. Trying again in 2.00 seconds... (1/100)"
                )
            },
            "level": "error",
        }
        assert _before_send(event, {}) is None

    def test_drops_message_field_variant(self):
        event = {
            "logger": "celery.worker.consumer",
            "message": "consumer: Connection to broker lost. Trying again in 4 seconds...",
            "level": "error",
        }
        assert _before_send(event, {}) is None

    def test_keeps_unrelated_logger(self):
        event = {
            "logger": "app.routers.hives",
            "logentry": {"message": "Cannot connect to upstream service"},
            "level": "error",
        }
        assert _before_send(event, {}) is event

    def test_keeps_celery_logger_with_real_error(self):
        event = {
            "logger": "celery.worker.consumer.consumer",
            "logentry": {"message": "Task raised unexpected: ValueError('bad input')"},
            "level": "error",
        }
        assert _before_send(event, {}) is event
