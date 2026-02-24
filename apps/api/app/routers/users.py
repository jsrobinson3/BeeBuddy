"""User management endpoints."""

import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.cookies import clear_auth_cookies
from app.auth.dependencies import get_current_user
from app.auth.jwt import decode_token
from app.auth.password import verify_password
from app.db.session import get_db
from app.models.apiary import Apiary
from app.models.user import User
from app.schemas.account import CancelDeletionRequest, DeleteAccountRequest
from app.schemas.apiary import ApiaryResponse
from app.schemas.event import EventResponse
from app.schemas.harvest import HarvestResponse
from app.schemas.hive import HiveResponse
from app.schemas.inspection import InspectionResponse
from app.schemas.queen import QueenResponse
from app.schemas.task import TaskResponse
from app.schemas.treatment import TreatmentResponse
from app.schemas.user import UserResponse, UserUpdate
from app.services import auth_service, user_service
from app.tasks import hard_delete_user, send_email_task

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's profile."""
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return current_user
    return await user_service.update_user(db, current_user, updates)


@router.patch("/me/preferences", response_model=UserResponse)
async def update_preferences(
    prefs: dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Merge keys into the current user's preferences."""
    return await user_service.update_preferences(db, current_user, prefs)


def _schedule_hard_delete(user: User, delete_data: bool) -> dict:
    """Schedule the hard-delete Celery task and return updated prefs."""
    prefs = user.preferences or {}
    prefs["_delete_data"] = delete_data
    try:
        task_result = hard_delete_user.apply_async(
            args=[str(user.id)], countdown=30 * 86400,
        )
        prefs["_deletion_task_id"] = task_result.id
    except Exception:
        logger.warning("Could not schedule hard-delete task (Celery unavailable)")
    return prefs


def _send_deletion_email(user: User) -> None:
    """Send the deletion confirmation email (best-effort)."""
    try:
        cancel_token = auth_service.create_account_deletion_token(user.id)
        send_email_task.delay(
            user.email,
            "Your account is scheduled for deletion",
            "account_deletion.html",
            {"token": cancel_token, "name": user.name or "Beekeeper"},
        )
    except Exception:
        logger.warning("Could not send deletion email (Celery unavailable)")


@router.delete("/me", status_code=200)
async def delete_me(
    data: DeleteAccountRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete the current user's account (GDPR). Requires password."""
    if current_user.password_hash is None:
        raise HTTPException(
            status_code=400, detail="OAuth-only accounts cannot delete via password",
        )
    if not verify_password(data.password, current_user.password_hash):
        raise HTTPException(status_code=403, detail="Incorrect password")

    current_user.deleted_at = datetime.now(UTC)
    current_user.password_changed_at = datetime.now(UTC)
    current_user.preferences = _schedule_hard_delete(current_user, data.delete_data)
    await db.commit()

    _send_deletion_email(current_user)
    clear_auth_cookies(response)
    return {"detail": "Account scheduled for deletion. Check your email for a cancellation link."}


@router.post("/me/cancel-deletion", status_code=200)
async def cancel_deletion(
    data: CancelDeletionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Cancel a pending account deletion using the token from the deletion email."""
    try:
        payload = decode_token(data.token)
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid or expired cancellation token")
    if payload.get("type") != "cancel_deletion":
        raise HTTPException(status_code=400, detail="Invalid token type")
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(status_code=400, detail="Invalid token")

    user = await db.get(User, UUID(user_id_str))
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.deleted_at is None:
        return {"detail": "Account is not pending deletion"}

    # Restore the account
    user.deleted_at = None

    # Try to revoke the scheduled hard-delete task
    prefs = user.preferences or {}
    deletion_task_id = prefs.pop("_deletion_task_id", None)
    if deletion_task_id:
        try:
            from app.tasks import celery_app
            celery_app.control.revoke(deletion_task_id)
        except Exception:
            logger.warning("Could not revoke hard-delete task %s", deletion_task_id)
    user.preferences = prefs

    await db.commit()
    await db.refresh(user)
    return {"detail": "Account deletion cancelled", "email": user.email}


def _serialize_hive(hive) -> dict:
    """Serialize a hive and its children for the data export."""
    data = HiveResponse.model_validate(hive).model_dump(mode="json")
    data["queen"] = (
        QueenResponse.model_validate(hive.queen).model_dump(mode="json")
        if hive.queen and hive.queen.deleted_at is None
        else None
    )
    for key, schema, items in [
        ("inspections", InspectionResponse, hive.inspections),
        ("treatments", TreatmentResponse, hive.treatments),
        ("harvests", HarvestResponse, hive.harvests),
        ("events", EventResponse, hive.events),
    ]:
        data[key] = [
            schema.model_validate(i).model_dump(mode="json")
            for i in items if i.deleted_at is None
        ]
    return data


async def _load_apiaries(db: AsyncSession, user_id: UUID) -> list:
    """Load all user apiaries with eager-loaded hive hierarchy."""
    from app.models.hive import Hive
    stmt = (
        select(Apiary)
        .where(Apiary.user_id == user_id, Apiary.deleted_at.is_(None))
        .options(
            selectinload(Apiary.hives).options(
                selectinload(Hive.queen),
                selectinload(Hive.inspections),
                selectinload(Hive.treatments),
                selectinload(Hive.harvests),
                selectinload(Hive.events),
            ),
        )
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/me/data-export", status_code=200)
async def data_export(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export all user data as JSON (GDPR Article 20 -- data portability).

    TODO: For large accounts this should be converted to a background
    Celery task that writes to S3 and emails a download link.
    """
    apiaries = await _load_apiaries(db, current_user.id)

    export: dict[str, Any] = {
        "user": UserResponse.model_validate(current_user).model_dump(mode="json"),
        "apiaries": [],
    }
    for apiary in apiaries:
        apiary_data = ApiaryResponse.model_validate(apiary).model_dump(mode="json")
        apiary_data["hives"] = [
            _serialize_hive(h) for h in apiary.hives if h.deleted_at is None
        ]
        export["apiaries"].append(apiary_data)

    from app.models.task import Task
    task_stmt = select(Task).where(
        Task.user_id == current_user.id, Task.deleted_at.is_(None),
    )
    tasks = (await db.execute(task_stmt)).scalars().all()
    export["tasks"] = [
        TaskResponse.model_validate(t).model_dump(mode="json") for t in tasks
    ]

    import json
    content = json.dumps(export, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": "attachment; filename=beebuddy-export.json",
            "X-Export-Size": str(len(content)),
        },
    )
