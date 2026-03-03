"""Account deletion schemas."""

from app.schemas.common import CamelBase


class DeleteAccountRequest(CamelBase):
    """Request to delete account (requires password confirmation)."""

    password: str
    delete_data: bool = False


class CancelDeletionRequest(CamelBase):
    """Request to cancel a pending account deletion."""

    token: str
