"""Promote a user to admin by email.

Usage:
    cd apps/api
    uv run python -m app.cli.promote_admin user@example.com
"""

import asyncio
import sys

from sqlalchemy import func, select

from app.db.session import AsyncSessionLocal
from app.models.user import User


async def promote(email: str) -> None:
    async with AsyncSessionLocal() as db:
        stmt = select(User).where(
            func.lower(User.email) == email.lower(),
            User.deleted_at.is_(None),
        )
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user is None:
            print(f"No active user found with email: {email}")
            sys.exit(1)

        if user.is_admin:
            print(f"{email} is already an admin.")
            return

        user.is_admin = True
        await db.commit()
        print(f"Promoted {email} to admin.")


def main() -> None:
    if len(sys.argv) != 2:
        print("Usage: uv run python -m app.cli.promote_admin <email>")
        sys.exit(1)
    asyncio.run(promote(sys.argv[1]))


if __name__ == "__main__":
    main()
