"""Share model for multi-user collaboration on apiaries and hives."""

import enum
import uuid

from sqlalchemy import CheckConstraint, ForeignKey, Index, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class ShareRole(enum.StrEnum):
    EDITOR = "editor"
    VIEWER = "viewer"


class ShareStatus(enum.StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    REVOKED = "revoked"


class Share(Base):
    __tablename__ = "shares"
    __table_args__ = (
        CheckConstraint(
            "(apiary_id IS NOT NULL AND hive_id IS NULL) OR "
            "(apiary_id IS NULL AND hive_id IS NOT NULL)",
            name="ck_shares_one_asset",
        ),
        Index("ix_shares_owner_id", "owner_id"),
        Index("ix_shares_shared_with_user_id", "shared_with_user_id"),
        Index("ix_shares_apiary_id", "apiary_id"),
        Index("ix_shares_hive_id", "hive_id"),
        Index("ix_shares_invite_email", "invite_email"),
        Index(
            "uq_shares_user_apiary",
            "shared_with_user_id",
            "apiary_id",
            unique=True,
            postgresql_where="apiary_id IS NOT NULL AND status IN ('pending', 'accepted')",
        ),
        Index(
            "uq_shares_user_hive",
            "shared_with_user_id",
            "hive_id",
            unique=True,
            postgresql_where="hive_id IS NOT NULL AND status IN ('pending', 'accepted')",
        ),
    )

    # Who created the share (the asset owner)
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Who the asset is shared with (NULL for pending email invites to non-users)
    shared_with_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
    )

    # Email for pending invitations (resolved to shared_with_user_id on accept)
    invite_email: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
    )

    # Polymorphic asset reference — exactly one must be set (CHECK constraint)
    apiary_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("apiaries.id", ondelete="CASCADE"),
        nullable=True,
    )
    hive_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hives.id", ondelete="CASCADE"),
        nullable=True,
    )

    role: Mapped[ShareRole] = mapped_column(
        SAEnum(
            "editor", "viewer",
            name="share_role", create_constraint=False,
        ),
        nullable=False,
    )
    status: Mapped[ShareStatus] = mapped_column(
        SAEnum(
            "pending", "accepted", "declined", "revoked",
            name="share_status", create_constraint=False,
        ),
        default=ShareStatus.PENDING,
        server_default="pending",
        nullable=False,
    )

    # Relationships
    owner: Mapped["User"] = relationship("User", foreign_keys=[owner_id])  # noqa: F821
    shared_with_user: Mapped["User | None"] = relationship(  # noqa: F821
        "User", foreign_keys=[shared_with_user_id],
    )
    apiary: Mapped["Apiary | None"] = relationship("Apiary")  # noqa: F821
    hive: Mapped["Hive | None"] = relationship("Hive")  # noqa: F821
