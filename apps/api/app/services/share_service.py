"""Share CRUD service layer — invitations, acceptance, role management."""

import logging
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.apiary import Apiary
from app.models.hive import Hive
from app.models.share import Share, ShareRole, ShareStatus
from app.models.user import User
from app.services import email_service

logger = logging.getLogger(__name__)


async def create_share(
    db: AsyncSession,
    owner_id: UUID,
    email: str,
    role: ShareRole,
    apiary_id: UUID | None = None,
    hive_id: UUID | None = None,
) -> Share:
    """Create a share invitation. Validates ownership and prevents duplicates."""
    asset_name = await _validate_asset_ownership(db, owner_id, apiary_id, hive_id)

    target_user = await _get_user_by_email(db, email)
    if target_user and target_user.id == owner_id:
        raise ValueError("Cannot share with yourself")

    share = Share(
        owner_id=owner_id,
        shared_with_user_id=target_user.id if target_user else None,
        invite_email=email.lower(),
        apiary_id=apiary_id,
        hive_id=hive_id,
        role=role,
        status=ShareStatus.PENDING,
    )
    db.add(share)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise ValueError("A share already exists for this user and asset")
    await db.refresh(share)
    await _notify_invitee(db, owner_id, email, apiary_id, asset_name, role)

    # Reload with eager-loaded relationships for the response
    return await get_share(db, share.id)  # type: ignore[return-value]


async def list_user_shares(
    db: AsyncSession,
    user_id: UUID,
    direction: str | None = None,
    status: ShareStatus | None = None,
) -> list[Share]:
    """Return shares where user is owner (outgoing) or shared_with (incoming)."""
    user = await db.get(User, user_id)
    user_email = user.email if user else None

    if direction == "incoming":
        stmt = select(Share).where(
            Share.deleted_at.is_(None),
            or_(
                Share.shared_with_user_id == user_id,
                Share.invite_email == user_email,
            ),
        )
    elif direction == "outgoing":
        stmt = select(Share).where(
            Share.deleted_at.is_(None),
            Share.owner_id == user_id,
        )
    else:
        stmt = select(Share).where(
            Share.deleted_at.is_(None),
            or_(
                Share.owner_id == user_id,
                Share.shared_with_user_id == user_id,
                Share.invite_email == user_email,
            ),
        )

    if status:
        stmt = stmt.where(Share.status == status)

    stmt = stmt.options(
        selectinload(Share.owner),
        selectinload(Share.shared_with_user),
        selectinload(Share.apiary),
        selectinload(Share.hive),
    ).order_by(Share.created_at.desc())

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_asset_shares(
    db: AsyncSession,
    user_id: UUID,
    apiary_id: UUID | None = None,
    hive_id: UUID | None = None,
) -> list[Share]:
    """List all shares for a specific asset. Caller must have access."""
    stmt = select(Share).where(Share.deleted_at.is_(None))

    if apiary_id:
        stmt = stmt.where(Share.apiary_id == apiary_id)
    elif hive_id:
        stmt = stmt.where(Share.hive_id == hive_id)
    else:
        raise ValueError("Provide either apiary_id or hive_id")

    stmt = stmt.options(
        selectinload(Share.owner),
        selectinload(Share.shared_with_user),
        selectinload(Share.apiary),
        selectinload(Share.hive),
    ).order_by(Share.created_at.desc())

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_share(db: AsyncSession, share_id: UUID) -> Share | None:
    """Get a single share by ID."""
    stmt = (
        select(Share)
        .where(Share.id == share_id, Share.deleted_at.is_(None))
        .options(
            selectinload(Share.owner),
            selectinload(Share.shared_with_user),
            selectinload(Share.apiary),
            selectinload(Share.hive),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def accept_share(db: AsyncSession, share_id: UUID, user_id: UUID) -> Share:
    """Accept a pending share invitation."""
    share = await get_share(db, share_id)
    if not share:
        raise ValueError("Share not found")
    if share.status != ShareStatus.PENDING:
        raise ValueError("Share is not pending")

    # Verify the user is the intended recipient
    user = await db.get(User, user_id)
    if not _is_share_recipient(share, user):
        raise ValueError("Share not found")

    share.status = ShareStatus.ACCEPTED
    share.shared_with_user_id = user_id
    await db.commit()
    return await get_share(db, share.id)  # type: ignore[return-value]


async def decline_share(db: AsyncSession, share_id: UUID, user_id: UUID) -> Share:
    """Decline a pending share invitation."""
    share = await get_share(db, share_id)
    if not share:
        raise ValueError("Share not found")
    if share.status != ShareStatus.PENDING:
        raise ValueError("Share is not pending")

    user = await db.get(User, user_id)
    if not _is_share_recipient(share, user):
        raise ValueError("Share not found")

    share.status = ShareStatus.DECLINED
    share.shared_with_user_id = user_id
    await db.commit()
    return await get_share(db, share.id)  # type: ignore[return-value]


async def revoke_share(db: AsyncSession, share_id: UUID, user_id: UUID) -> None:
    """Revoke a share. Asset owner can revoke anyone; recipients can remove themselves."""
    share = await get_share(db, share_id)
    if not share:
        raise ValueError("Share not found")

    is_owner = share.owner_id == user_id
    is_recipient = share.shared_with_user_id == user_id

    if not is_owner and not is_recipient:
        raise ValueError("Share not found")

    if share.status in (ShareStatus.DECLINED, ShareStatus.REVOKED):
        raise ValueError("Share is already inactive")

    share.status = ShareStatus.REVOKED
    await db.commit()


async def update_role(
    db: AsyncSession,
    share_id: UUID,
    owner_id: UUID,
    new_role: ShareRole,
) -> Share:
    """Change the role of an existing share. Owner only."""
    share = await get_share(db, share_id)
    if not share:
        raise ValueError("Share not found")
    if share.owner_id != owner_id:
        raise ValueError("Only the asset owner can change roles")

    share.role = new_role
    await db.commit()
    return await get_share(db, share.id)  # type: ignore[return-value]


async def claim_pending_shares(db: AsyncSession, user: User) -> list[Share]:
    """Find pending shares by email and link them to this user.

    Called during registration/login to handle invitations sent before
    the user had an account.
    """
    if not user.email:
        return []

    stmt = select(Share).where(
        Share.invite_email == user.email.lower(),
        Share.shared_with_user_id.is_(None),
        Share.status == ShareStatus.PENDING,
        Share.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    shares = list(result.scalars().all())

    if shares:
        for share in shares:
            share.shared_with_user_id = user.id
        await db.commit()
        logger.info("Claimed %d pending share(s) for user %s", len(shares), user.email)

    return shares


def to_share_response(share: Share) -> dict:
    """Convert a Share ORM instance to a response dict with denormalized names."""
    return {
        "id": share.id,
        "owner_id": share.owner_id,
        "owner_name": share.owner.name if share.owner else None,
        "shared_with_user_id": share.shared_with_user_id,
        "shared_with_name": (
            share.shared_with_user.name if share.shared_with_user else None
        ),
        "invite_email": share.invite_email,
        "apiary_id": share.apiary_id,
        "apiary_name": share.apiary.name if share.apiary else None,
        "hive_id": share.hive_id,
        "hive_name": share.hive.name if share.hive else None,
        "role": share.role,
        "status": share.status,
        "created_at": share.created_at,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


async def _validate_asset_ownership(
    db: AsyncSession,
    owner_id: UUID,
    apiary_id: UUID | None,
    hive_id: UUID | None,
) -> str:
    """Verify the owner owns the target asset. Returns the asset name."""
    if apiary_id:
        apiary = await db.get(Apiary, apiary_id)
        if not apiary or apiary.deleted_at is not None or apiary.user_id != owner_id:
            raise ValueError("Apiary not found or not owned by you")
        return apiary.name
    if hive_id:
        hive = await db.get(Hive, hive_id)
        if not hive or hive.deleted_at is not None:
            raise ValueError("Hive not found")
        apiary = await db.get(Apiary, hive.apiary_id)
        if not apiary or apiary.user_id != owner_id:
            raise ValueError("Hive not owned by you")
        return hive.name
    raise ValueError("Provide either apiary_id or hive_id")


async def _notify_invitee(
    db: AsyncSession,
    owner_id: UUID,
    email: str,
    apiary_id: UUID | None,
    asset_name: str,
    role: ShareRole,
) -> None:
    """Send the invitation email to the invitee."""
    owner = await db.get(User, owner_id)
    owner_name = owner.name or owner.email if owner else "Someone"
    resource_type = "apiary" if apiary_id else "hive"
    await _send_share_invitation_email(
        to=email,
        inviter_name=owner_name,
        resource_type=resource_type,
        resource_name=asset_name,
        role=role.value,
    )


async def _get_user_by_email(db: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(
        func.lower(User.email) == email.lower(),
        User.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _is_share_recipient(share: Share, user: User | None) -> bool:
    """Check if a user is the intended recipient of a share."""
    if user is None:
        return False
    if share.shared_with_user_id == user.id:
        return True
    if share.invite_email and user.email and share.invite_email == user.email.lower():
        return True
    return False


async def _send_share_invitation_email(
    to: str,
    inviter_name: str,
    resource_type: str,
    resource_name: str,
    role: str,
) -> None:
    """Send a share invitation email."""
    html = email_service._render_template(
        "share_invitation.html",
        {
            "app_name": "BeeBuddy",
            "inviter_name": inviter_name,
            "resource_type": resource_type,
            "resource_name": resource_name,
            "role": role,
        },
    )
    await email_service._send_email(
        to, f"{inviter_name} shared a {resource_type} with you on BeeBuddy", html,
    )
