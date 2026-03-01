"""Unit tests for OAuth2 redirect URI matching logic."""

from app.routers.oauth2_server import _redirect_uri_matches


class TestRedirectUriMatches:
    def test_exact_match(self):
        assert _redirect_uri_matches(
            "http://localhost/callback", "http://localhost/callback"
        )

    def test_exact_match_with_port(self):
        assert _redirect_uri_matches(
            "http://localhost:3000/callback", "http://localhost:3000/callback"
        )

    def test_localhost_any_port_matches(self):
        assert _redirect_uri_matches(
            "http://localhost/callback", "http://localhost:49152/callback"
        )

    def test_localhost_high_port_matches(self):
        assert _redirect_uri_matches(
            "http://localhost/callback", "http://localhost:65535/callback"
        )

    def test_different_path_rejected(self):
        assert not _redirect_uri_matches(
            "http://localhost/callback", "http://localhost/steal"
        )

    def test_different_scheme_rejected(self):
        assert not _redirect_uri_matches(
            "http://localhost/callback", "https://localhost/callback"
        )

    def test_external_host_rejected(self):
        assert not _redirect_uri_matches(
            "http://localhost/callback", "http://evil.example.com/callback"
        )

    def test_non_localhost_requires_exact(self):
        assert not _redirect_uri_matches(
            "https://app.example.com/callback",
            "https://app.example.com:8080/callback",
        )

    def test_non_localhost_exact_match(self):
        assert _redirect_uri_matches(
            "https://app.example.com/callback",
            "https://app.example.com/callback",
        )

    def test_attacker_subdomain_rejected(self):
        assert not _redirect_uri_matches(
            "https://app.example.com/callback",
            "https://evil.app.example.com/callback",
        )
