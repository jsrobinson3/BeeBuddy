"""Photo integration tests.

Requires the API and MinIO to be running (e.g. via docker compose up).
Tests the authenticated multipart upload / download flow with presigned URLs.
"""

import uuid

from httpx import AsyncClient

PREFIX = "/api/v1"

TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
    b"\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00"
    b"\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:8]}@beebuddy.dev"


async def register(client: AsyncClient, email: str | None = None, password: str = "secret123"):
    return await client.post(f"{PREFIX}/auth/register", json={
        "name": "Test Beekeeper",
        "email": email or unique_email(),
        "password": password,
    })


async def get_tokens(client: AsyncClient, email: str | None = None):
    email = email or unique_email()
    resp = await register(client, email)
    body = resp.json()
    return body["access_token"], body["refresh_token"], email


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def setup_inspection(client: AsyncClient, headers: dict) -> tuple[str, str, str]:
    """Create an apiary, hive, and inspection. Return (apiary_id, hive_id, inspection_id)."""
    resp = await client.post(
        f"{PREFIX}/apiaries",
        headers=headers,
        json={"name": "Test Apiary"},
    )
    assert resp.status_code == 201, f"Apiary creation failed: {resp.text}"
    apiary_id = resp.json()["id"]

    resp = await client.post(
        f"{PREFIX}/hives",
        headers=headers,
        json={"apiary_id": apiary_id, "name": "Test Hive"},
    )
    assert resp.status_code == 201, f"Hive creation failed: {resp.text}"
    hive_id = resp.json()["id"]

    resp = await client.post(
        f"{PREFIX}/inspections",
        headers=headers,
        json={"hive_id": hive_id},
    )
    assert resp.status_code == 201, f"Inspection creation failed: {resp.text}"
    inspection_id = resp.json()["id"]

    return apiary_id, hive_id, inspection_id


async def upload_photo(
    client: AsyncClient, headers: dict, inspection_id: str, caption: str | None = None
) -> dict:
    """Upload a tiny PNG to an inspection and return the response body."""
    files = {"file": ("test.png", TINY_PNG, "image/png")}
    data = {"caption": caption} if caption else {}
    resp = await client.post(
        f"{PREFIX}/inspections/{inspection_id}/photos",
        headers=headers,
        files=files,
        data=data,
    )
    assert resp.status_code == 201, f"Upload failed: {resp.text}"
    return resp.json()


class TestUploadPhoto:
    async def test_upload_returns_photo_record_with_presigned_url(self, client: AsyncClient):
        token, _, _ = await get_tokens(client)
        headers = auth(token)
        _, _, inspection_id = await setup_inspection(client, headers)

        body = await upload_photo(client, headers, inspection_id, caption="Frame 3")
        assert body["inspection_id"] == inspection_id
        assert body["s3_key"].endswith(".png")
        assert body["caption"] == "Frame 3"
        assert "id" in body
        assert body["url"] is not None
        assert "X-Amz-Signature" in body["url"]

    async def test_upload_rejects_invalid_ext(self, client: AsyncClient):
        token, _, _ = await get_tokens(client)
        headers = auth(token)
        _, _, inspection_id = await setup_inspection(client, headers)

        files = {"file": ("malware.exe", b"\x00" * 10, "application/octet-stream")}
        resp = await client.post(
            f"{PREFIX}/inspections/{inspection_id}/photos",
            headers=headers,
            files=files,
        )
        assert resp.status_code == 422

    async def test_upload_404_for_missing_inspection(self, client: AsyncClient):
        token, _, _ = await get_tokens(client)
        headers = auth(token)

        files = {"file": ("test.png", TINY_PNG, "image/png")}
        resp = await client.post(
            f"{PREFIX}/inspections/{uuid.uuid4()}/photos",
            headers=headers,
            files=files,
        )
        assert resp.status_code == 404


class TestListAndDownloadPhotos:
    async def test_list_photos_includes_presigned_urls(self, client: AsyncClient):
        token, _, _ = await get_tokens(client)
        headers = auth(token)
        _, _, inspection_id = await setup_inspection(client, headers)

        await upload_photo(client, headers, inspection_id)

        resp = await client.get(
            f"{PREFIX}/inspections/{inspection_id}/photos",
            headers=headers,
        )
        assert resp.status_code == 200
        photos = resp.json()
        assert len(photos) == 1
        assert photos[0]["url"] is not None
        assert "X-Amz-Signature" in photos[0]["url"]

    async def test_download_photo_with_bearer(self, client: AsyncClient):
        token, _, _ = await get_tokens(client)
        headers = auth(token)
        _, _, inspection_id = await setup_inspection(client, headers)

        photo = await upload_photo(client, headers, inspection_id)

        resp = await client.get(
            f"{PREFIX}/photos/{photo['id']}/file",
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/png"
        assert resp.content == TINY_PNG

    async def test_download_photo_rejects_token_query_param(self, client: AsyncClient):
        """?token= query param is no longer accepted — clients must use presigned URLs."""
        token, _, _ = await get_tokens(client)
        headers = auth(token)
        _, _, inspection_id = await setup_inspection(client, headers)

        photo = await upload_photo(client, headers, inspection_id)

        # No auth header, only ?token= query param — should be rejected
        resp = await client.get(
            f"{PREFIX}/photos/{photo['id']}/file?token={token}",
        )
        assert resp.status_code == 401


class TestDeletePhoto:
    async def test_delete_photo(self, client: AsyncClient):
        token, _, _ = await get_tokens(client)
        headers = auth(token)
        _, _, inspection_id = await setup_inspection(client, headers)

        photo = await upload_photo(client, headers, inspection_id)

        resp = await client.delete(
            f"{PREFIX}/inspections/{inspection_id}/photos/{photo['id']}",
            headers=headers,
        )
        assert resp.status_code == 204

        # Verify empty list
        resp = await client.get(
            f"{PREFIX}/inspections/{inspection_id}/photos",
            headers=headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 0


class TestPhotosInInspectionResponse:
    async def test_photos_included_in_inspection_response_with_urls(self, client: AsyncClient):
        token, _, _ = await get_tokens(client)
        headers = auth(token)
        _, _, inspection_id = await setup_inspection(client, headers)

        await upload_photo(client, headers, inspection_id)

        resp = await client.get(
            f"{PREFIX}/inspections/{inspection_id}",
            headers=headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert "photos" in body
        assert len(body["photos"]) >= 1
        assert body["photos"][0]["url"] is not None
        assert "X-Amz-Signature" in body["photos"][0]["url"]


class TestNoAuth:
    async def test_upload_no_auth_returns_401(self, client: AsyncClient):
        files = {"file": ("test.png", TINY_PNG, "image/png")}
        resp = await client.post(
            f"{PREFIX}/inspections/{uuid.uuid4()}/photos",
            files=files,
        )
        assert resp.status_code == 401

    async def test_download_no_auth_returns_401(self, client: AsyncClient):
        resp = await client.get(
            f"{PREFIX}/photos/{uuid.uuid4()}/file",
        )
        assert resp.status_code == 401
