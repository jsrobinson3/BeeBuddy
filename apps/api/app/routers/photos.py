"""Photo management endpoints.

Uploads go through the API; photo URLs are short-lived S3 presigned URLs
returned in PhotoResponse.  The streaming endpoint remains for web/direct
access but requires Bearer header or cookie auth (no query-param tokens).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from app.auth.dependencies import get_current_user
from app.auth.jwt import decode_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.photo import PhotoResponse
from app.services import inspection_service, photo_service, s3_service

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "heic", "webp"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/webp",
}
MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20 MB

router = APIRouter()


@router.post(
    "/inspections/{inspection_id}/photos",
    response_model=PhotoResponse,
    status_code=201,
)
async def upload_photo(
    inspection_id: UUID,
    file: UploadFile = File(...),
    caption: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a photo and attach it to an inspection."""
    inspection = await inspection_service.get_inspection(db, inspection_id, current_user.id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    # Validate file type
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"File type not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    # Enforce file size limit
    if file.size is not None and file.size > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB.",
        )

    content_type = file.content_type or "application/octet-stream"
    s3_key = s3_service.generate_key(str(current_user.id), str(inspection_id), ext)
    await s3_service.upload_fileobj(s3_key, file.file, content_type)

    photo = await photo_service.create_photo(
        db,
        {
            "inspection_id": inspection_id,
            "s3_key": s3_key,
            "caption": caption,
        },
    )
    resp = PhotoResponse.model_validate(photo)
    photo_service.attach_presigned_url(resp)
    return resp


@router.get(
    "/inspections/{inspection_id}/photos",
    response_model=list[PhotoResponse],
)
async def list_photos(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List photos for an inspection."""
    inspection = await inspection_service.get_inspection(db, inspection_id, current_user.id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    photos = await photo_service.get_photos_for_inspection(db, inspection_id)
    return photo_service.attach_presigned_urls(
        [PhotoResponse.model_validate(p) for p in photos]
    )


@router.get("/photos/{photo_id}/file")
async def download_photo(
    photo_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Download a photo file.

    Accepts auth via Bearer header or cookie. Query-param tokens are no
    longer accepted — use presigned URLs from PhotoResponse instead.
    """
    resolved_token = None
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        resolved_token = auth_header[7:]
    if not resolved_token:
        resolved_token = request.cookies.get("access_token")
    if not resolved_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Validate token and extract user id
    try:
        payload = decode_token(resolved_token)
        user_id_str: str | None = payload.get("sub")
        token_type: str | None = payload.get("type")
        if user_id_str is None or token_type != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Ownership check: verify user owns the photo via inspection -> hive -> apiary
    user_id = UUID(user_id_str)
    photo = await photo_service.get_photo_for_user(db, photo_id, user_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    # Stream the S3 object instead of buffering the whole file in memory
    content_type = await s3_service.get_object_content_type(photo.s3_key)
    return StreamingResponse(
        s3_service.stream_object(photo.s3_key),
        media_type=content_type,
    )


@router.delete(
    "/inspections/{inspection_id}/photos/{photo_id}",
    status_code=204,
)
async def delete_photo(
    inspection_id: UUID,
    photo_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a photo from S3 and the database."""
    inspection = await inspection_service.get_inspection(db, inspection_id, current_user.id)
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    photo = await photo_service.get_photo(db, photo_id)
    if not photo or photo.inspection_id != inspection_id:
        raise HTTPException(status_code=404, detail="Photo not found")
    await s3_service.delete_object(photo.s3_key)
    await photo_service.delete_photo(db, photo)
