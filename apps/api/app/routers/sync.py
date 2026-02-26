"""WatermelonDB sync endpoints — pull and push."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.sync import SyncPullRequest, SyncPullResponse, SyncPushRequest
from app.services import cadence_service, sync_service

router = APIRouter(prefix="/sync")


@router.post("/pull", response_model=SyncPullResponse)
@limiter.limit("30/minute")
async def sync_pull(
    request: Request,
    body: SyncPullRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all changes since `last_pulled_at` for the current user.

    WatermelonDB calls this with the timestamp from the last successful
    pull.  On first sync, `last_pulled_at` is null/0.
    """
    result = await sync_service.pull_changes(
        db, user_id=current_user.id, last_pulled_at_ms=body.last_pulled_at
    )
    return result


@router.post("/push", status_code=200)
@limiter.limit("20/minute")
async def sync_push(
    request: Request,
    body: SyncPushRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Apply client-side changes to the server.

    Server-wins conflict resolution: if the server record has been
    modified since `last_pulled_at`, the client's changes are discarded.
    """
    raw_changes = {
        table: {
            "created": tc.created,
            "updated": tc.updated,
            "deleted": tc.deleted,
        }
        for table, tc in body.changes.items()
    }
    await sync_service.push_changes(
        db,
        user_id=current_user.id,
        changes=raw_changes,
        last_pulled_at_ms=body.last_pulled_at,
    )

    # When hives are pushed, ensure cadences + tasks are generated
    # so they're available on the next sync pull.
    # WatermelonDB uses sendCreatedAsUpdated so new hives arrive in "updated".
    hive_changes = raw_changes.get("hives", {})
    if hive_changes.get("created") or hive_changes.get("updated"):
        hemisphere = await cadence_service.resolve_hemisphere(db, current_user)
        await cadence_service.initialize_cadences(
            db, user_id=current_user.id, hemisphere=hemisphere,
        )
        await cadence_service.ensure_hive_cadences(
            db, user_id=current_user.id, hemisphere=hemisphere,
        )
        await cadence_service.generate_due_tasks(
            db, user_id=current_user.id, hemisphere=hemisphere,
        )

    return {"ok": True}
