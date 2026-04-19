"""External webhook receivers."""

import hashlib
import hmac
import logging

import httpx
from fastapi import APIRouter, Header, HTTPException, Request, status

from app.config import get_settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
log = logging.getLogger(__name__)

WORKFLOW_FILE = "mobile-sentry-upload.yml"
WORKFLOW_REF = "main"


@router.post("/eas-build", status_code=status.HTTP_202_ACCEPTED)
async def eas_build_webhook(
    request: Request,
    expo_signature: str = Header(..., alias="expo-signature"),
):
    """Relay finished EAS builds to GitHub repository_dispatch.

    EAS sends HMAC-SHA1-signed JSON for every build state change. We verify
    the signature, filter for finished iOS builds, and POST a dispatch event
    so the mobile-sentry-upload.yml workflow can pick up the dSYMs.
    """
    settings = get_settings()
    if not settings.eas_webhook_secret or not settings.github_dispatch_token:
        raise HTTPException(503, "EAS webhook relay not configured")

    body = await request.body()
    if not _verify_signature(body, expo_signature, settings.eas_webhook_secret):
        raise HTTPException(401, "Invalid signature")

    payload = await request.json()
    skip_reason = _skip_reason(payload)
    if skip_reason:
        return {"skipped": True, "reason": skip_reason}

    await _dispatch_to_github(payload, settings)
    log.info(
        "Triggered %s for build %s (build %s)",
        WORKFLOW_FILE, payload["id"], payload.get("appBuildVersion"),
    )
    return {"dispatched": True, "build_id": payload["id"]}


def _skip_reason(payload: dict) -> str | None:
    """Return a human-readable reason to skip, or None if we should dispatch."""
    if payload.get("status") != "finished" or payload.get("platform") != "ios":
        return f"status={payload.get('status')} platform={payload.get('platform')}"
    if not (payload.get("artifacts") or {}).get("buildArtifactsUrl"):
        log.warning("EAS build %s finished without buildArtifactsUrl", payload.get("id"))
        return "no buildArtifactsUrl"
    return None


async def _dispatch_to_github(payload: dict, settings) -> None:
    dispatch_payload = {
        "ref": WORKFLOW_REF,
        "inputs": {
            "build_id": payload["id"],
            "platform": payload["platform"],
            "app_version": payload.get("appVersion", ""),
            "build_number": str(payload.get("appBuildVersion", "")),
            "artifacts_url": payload["artifacts"]["buildArtifactsUrl"],
        },
    }
    url = (
        f"https://api.github.com/repos/{settings.github_dispatch_repo}"
        f"/actions/workflows/{WORKFLOW_FILE}/dispatches"
    )
    headers = {
        "Authorization": f"Bearer {settings.github_dispatch_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=dispatch_payload, headers=headers)
    if resp.status_code >= 300:
        log.error("GitHub dispatch failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(502, f"GitHub dispatch returned {resp.status_code}")


def _verify_signature(body: bytes, header_value: str, secret: str) -> bool:
    """Verify EAS webhook HMAC-SHA1 signature.

    EAS sends `expo-signature: sha1=<hex>`.
    """
    if not header_value.startswith("sha1="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha1).hexdigest()
    return hmac.compare_digest(expected, header_value[len("sha1="):])
