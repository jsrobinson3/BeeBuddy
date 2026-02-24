"""WatermelonDB sync endpoints — pull and push."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.sync import SyncPullRequest, SyncPullResponse, SyncPushRequest
from app.services import sync_service

router = APIRouter(prefix="/sync")


@router.post("/pull", response_model=SyncPullResponse)
async def sync_pull(
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
async def sync_push(
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
    return {"ok": True}
