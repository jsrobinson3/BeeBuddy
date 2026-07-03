"""Tests for the Sentry `_before_send` hook."""

from app.monitoring import _before_send


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
