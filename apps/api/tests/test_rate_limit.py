"""Unit tests for app.rate_limit — user/IP rate limiting key extraction.

Tests verify that _get_user_or_ip extracts user IDs from JWTs for
per-user rate limiting, and falls back to client IP when no valid
token is present.
"""

from unittest.mock import MagicMock, patch

from app.rate_limit import _get_user_or_ip

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_request(
    auth_header: str | None = None,
    cookie_token: str | None = None,
) -> MagicMock:
    """Return a mock Starlette Request with headers and cookies."""
    request = MagicMock()
    headers = {}
    if auth_header is not None:
        headers["authorization"] = auth_header
    request.headers = headers

    cookies = {}
    if cookie_token is not None:
        cookies["access_token"] = cookie_token
    request.cookies = cookies

    return request


# ---------------------------------------------------------------------------
# _get_user_or_ip
# ---------------------------------------------------------------------------


class TestGetUserOrIp:
    """Tests for the rate limit key extraction function."""

    @patch("app.rate_limit.get_remote_address", return_value="192.168.1.1")
    @patch("app.rate_limit.decode_token")
    def test_extracts_user_from_bearer_token(self, mock_decode, _mock_ip):
        """Valid Bearer token returns user:<id> key."""
        mock_decode.return_value = {"sub": "user-abc-123", "type": "access"}
        request = _mock_request(auth_header="Bearer valid-token")

        result = _get_user_or_ip(request)

        assert result == "user:user-abc-123"
        mock_decode.assert_called_once_with("valid-token")

    @patch("app.rate_limit.get_remote_address", return_value="192.168.1.1")
    @patch("app.rate_limit.decode_token")
    def test_extracts_user_from_cookie(self, mock_decode, _mock_ip):
        """Valid access_token cookie returns user:<id> key."""
        mock_decode.return_value = {"sub": "user-cookie-456", "type": "access"}
        request = _mock_request(cookie_token="cookie-token")

        result = _get_user_or_ip(request)

        assert result == "user:user-cookie-456"
        mock_decode.assert_called_once_with("cookie-token")

    @patch("app.rate_limit.get_remote_address", return_value="10.0.0.1")
    def test_falls_back_to_ip_when_no_token(self, _mock_ip):
        """No Bearer header and no cookie falls back to IP address."""
        request = _mock_request()

        result = _get_user_or_ip(request)

        assert result == "10.0.0.1"

    @patch("app.rate_limit.get_remote_address", return_value="10.0.0.1")
    @patch("app.auth.jwt.decode_token", side_effect=Exception("Invalid token"))
    def test_falls_back_to_ip_on_decode_error(self, _mock_decode, _mock_ip):
        """If token decoding fails, falls back to IP address."""
        request = _mock_request(auth_header="Bearer bad-token")

        result = _get_user_or_ip(request)

        assert result == "10.0.0.1"

    @patch("app.rate_limit.get_remote_address", return_value="10.0.0.1")
    @patch("app.rate_limit.decode_token")
    def test_rejects_refresh_token_type(self, mock_decode, _mock_ip):
        """A refresh token (type != access) falls back to IP."""
        mock_decode.return_value = {"sub": "user-123", "type": "refresh"}
        request = _mock_request(auth_header="Bearer refresh-token")

        result = _get_user_or_ip(request)

        assert result == "10.0.0.1"

    @patch("app.rate_limit.get_remote_address", return_value="10.0.0.1")
    @patch("app.rate_limit.decode_token")
    def test_rejects_token_without_sub(self, mock_decode, _mock_ip):
        """A token with no sub claim falls back to IP."""
        mock_decode.return_value = {"type": "access"}
        request = _mock_request(auth_header="Bearer no-sub-token")

        result = _get_user_or_ip(request)

        assert result == "10.0.0.1"

    @patch("app.rate_limit.get_remote_address", return_value="10.0.0.1")
    def test_bearer_prefix_stripped_correctly(self, _mock_ip):
        """Authorization header without 'Bearer ' prefix is not treated as token."""
        request = _mock_request(auth_header="Basic dXNlcjpwYXNz")

        result = _get_user_or_ip(request)

        assert result == "10.0.0.1"

    @patch("app.rate_limit.get_remote_address", return_value="10.0.0.1")
    @patch("app.rate_limit.decode_token")
    def test_prefers_bearer_over_cookie(self, mock_decode, _mock_ip):
        """Bearer header takes precedence when both header and cookie are present."""
        mock_decode.return_value = {"sub": "user-bearer", "type": "access"}
        request = _mock_request(
            auth_header="Bearer bearer-token",
            cookie_token="cookie-token",
        )

        result = _get_user_or_ip(request)

        assert result == "user:user-bearer"
        mock_decode.assert_called_once_with("bearer-token")
