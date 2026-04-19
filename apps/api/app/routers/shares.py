"""Share management endpoints — invitations, acceptance, role changes."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user
from app.auth.permissions import (
    Permission,
    check_apiary_permission,
    check_hive_permission,
    require_permission,
)
from app.db.session import get_db
from app.models.share import ShareStatus
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.share import ShareCreate, ShareResponse, ShareUpdate
from app.services import share_service

router = APIRouter(prefix="/shares")


@router.post("", response_model=ShareResponse, status_code=201)
@limiter.limit("20/minute")
async def create_share(
    request: Request,
    data: ShareCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a share invitation."""
    try:
        share = await share_service.create_share(
            db,
            owner_id=current_user.id,
            email=data.email,
            role=data.role,
            apiary_id=data.apiary_id,
            hive_id=data.hive_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return share_service.to_share_response(share)


@router.get("", response_model=list[ShareResponse])
async def list_shares(
    direction: str | None = Query(None, pattern="^(incoming|outgoing)$"),
    status: ShareStatus | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List shares for the current user (incoming, outgoing, or both)."""
    shares = await share_service.list_user_shares(
        db, user_id=current_user.id, direction=direction, status=status,
    )
    return [share_service.to_share_response(s) for s in shares]


@router.get("/asset", response_model=list[ShareResponse])
async def list_asset_shares(
    apiary_id: UUID | None = Query(None),
    hive_id: UUID | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all shares for a specific apiary or hive. Requires viewer+ access."""
    if apiary_id:
        perm = await check_apiary_permission(db, apiary_id, current_user.id)
        require_permission(perm, Permission.VIEWER, "Apiary not found")
    elif hive_id:
        perm = await check_hive_permission(db, hive_id, current_user.id)
        require_permission(perm, Permission.VIEWER, "Hive not found")
    else:
        raise HTTPException(status_code=400, detail="Provide apiary_id or hive_id")
    try:
        shares = await share_service.list_asset_shares(
            db, user_id=current_user.id, apiary_id=apiary_id, hive_id=hive_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return [share_service.to_share_response(s) for s in shares]


@router.post("/{share_id}/accept", response_model=ShareResponse)
async def accept_share(
    share_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a pending share invitation."""
    try:
        share = await share_service.accept_share(db, share_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return share_service.to_share_response(share)


@router.post("/{share_id}/decline", response_model=ShareResponse)
async def decline_share(
    share_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Decline a pending share invitation."""
    try:
        share = await share_service.decline_share(db, share_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return share_service.to_share_response(share)


@router.patch("/{share_id}", response_model=ShareResponse)
async def update_share_role(
    share_id: UUID,
    data: ShareUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the role of an existing share. Owner only."""
    try:
        share = await share_service.update_role(
            db, share_id, owner_id=current_user.id, new_role=data.role,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return share_service.to_share_response(share)


@router.delete("/{share_id}", status_code=204)
async def remove_share(
    share_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove/revoke a share. Owner can revoke anyone; recipients can leave."""
    try:
        await share_service.revoke_share(db, share_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
