"""Unit tests for PKCE verification logic (no network / DB required)."""

import base64
import hashlib
import secrets

from app.routers.oauth2_server import _verify_pkce


class TestPKCEVerification:
    def test_valid_verifier_matches_challenge(self):
        verifier = secrets.token_urlsafe(48)
        digest = hashlib.sha256(verifier.encode("ascii")).digest()
        challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

        assert _verify_pkce(verifier, challenge) is True

    def test_wrong_verifier_does_not_match(self):
        verifier = secrets.token_urlsafe(48)
        digest = hashlib.sha256(verifier.encode("ascii")).digest()
        challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

        assert _verify_pkce("wrong-verifier", challenge) is False

    def test_rfc7636_test_vector(self):
        """Verify against the RFC 7636 Appendix B test vector."""
        verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
        expected_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

        assert _verify_pkce(verifier, expected_challenge) is True

    def test_different_verifiers_produce_different_challenges(self):
        v1 = secrets.token_urlsafe(48)
        v2 = secrets.token_urlsafe(48)

        d1 = hashlib.sha256(v1.encode("ascii")).digest()
        c1 = base64.urlsafe_b64encode(d1).rstrip(b"=").decode("ascii")

        assert _verify_pkce(v2, c1) is False
