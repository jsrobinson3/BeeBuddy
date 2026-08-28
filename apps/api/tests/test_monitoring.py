"""Tests for the Sentry `_before_send` hook."""

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


def _kombu_keyerror_event() -> dict:
    return {
        "exception": {
            "values": [
                {
                    "type": "KeyError",
                    "value": "9",
                    "stacktrace": {
                        "frames": [
                            {
                                "filename": "celery/worker/worker.py",
                                "function": "start",
                            },
                            {
                                "filename": "kombu/transport/redis.py",
                                "function": "on_readable",
                            },
                        ]
                    },
                }
            ]
        }
    }


def test_before_send_drops_kombu_on_readable_keyerror():
    assert _before_send(_kombu_keyerror_event(), {}) is None


def test_before_send_keeps_unrelated_keyerror():
    event = {
        "exception": {
            "values": [
                {
                    "type": "KeyError",
                    "value": "user_id",
                    "stacktrace": {
                        "frames": [
                            {
                                "filename": "app/services/dashboard.py",
                                "function": "load",
                            }
                        ]
                    },
                }
            ]
        }
    }
    assert _before_send(event, {}) is event


def test_before_send_strips_cookies():
    event = {
        "request": {
            "cookies": {"session": "secret"},
            "headers": {"Cookie": "session=secret", "User-Agent": "curl"},
        }
    }
    result = _before_send(event, {})
    assert result is event
    assert "cookies" not in result["request"]
    assert "Cookie" not in result["request"]["headers"]
    assert result["request"]["headers"]["User-Agent"] == "curl"


def test_before_send_handles_event_without_exception():
    event = {"message": "hello", "level": "info"}
    assert _before_send(event, {}) is event


def _sqlalchemy_pool_cancelled_event() -> dict:
    return {
        "logger": "sqlalchemy.pool.impl.AsyncAdaptedQueuePool",
        "level": "error",
        "exception": {
            "values": [
                {
                    "type": "CancelledError",
                    "value": "Cancelled via cancel scope",
                    "stacktrace": {
                        "frames": [
                            {
                                "filename": "sqlalchemy/pool/base.py",
                                "function": "_close_connection",
                            },
                            {
                                "filename": "sqlalchemy/connectors/asyncio.py",
                                "function": "terminate",
                            },
                        ]
                    },
                }
            ]
        },
    }


def test_before_send_drops_sqlalchemy_pool_cancelled_error():
    assert _before_send(_sqlalchemy_pool_cancelled_event(), {}) is None


def test_before_send_keeps_sqlalchemy_pool_non_cancelled_error():
    event = {
        "logger": "sqlalchemy.pool.impl.AsyncAdaptedQueuePool",
        "level": "error",
        "exception": {
            "values": [
                {
                    "type": "OperationalError",
                    "value": "connection refused",
                    "stacktrace": {"frames": []},
                }
            ]
        },
    }
    assert _before_send(event, {}) is event


def test_before_send_keeps_cancelled_error_outside_sqlalchemy_pool():
    event = {
        "logger": "app.services.ai_service",
        "level": "error",
        "exception": {
            "values": [
                {
                    "type": "CancelledError",
                    "value": "cancelled",
                    "stacktrace": {"frames": []},
                }
            ]
        },
    }
    assert _before_send(event, {}) is event
