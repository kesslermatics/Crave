"""Administrative commands that are deliberately not exposed as HTTP endpoints."""

import argparse
import asyncio

from sqlalchemy import select

from app.db import get_session_factory
from app.models import User


async def activate_user(email: str) -> None:
    async with get_session_factory()() as session:
        user = await session.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            raise SystemExit("No user found for that email address.")
        user.is_active = True
        await session.commit()
        print(f"Activated {user.email}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crave administration")
    subparsers = parser.add_subparsers(dest="command", required=True)
    activate = subparsers.add_parser("activate-user", help="Activate a pending user")
    activate.add_argument("email")
    args = parser.parse_args()
    if args.command == "activate-user":
        asyncio.run(activate_user(args.email))


if __name__ == "__main__":
    main()