"""Administrative commands that are deliberately not exposed as HTTP endpoints."""

import argparse
import asyncio

from sqlalchemy import select

from app.db import get_session_factory
from app.models import Recipe, User


async def find_user(session, email: str) -> User:
    user = await session.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        raise SystemExit(f"No user found for {email}.")
    return user


async def activate_user(email: str) -> None:
    async with get_session_factory()() as session:
        user = await find_user(session, email)
        user.is_active = True
        await session.commit()
        print(f"Activated {user.email}.")


async def assign_recipes(email: str, title_contains: str | None, unowned_only: bool) -> None:
    """Give matching recipes to one account. Fails without changes if nothing matches."""
    async with get_session_factory()() as session:
        user = await find_user(session, email)
        statement = select(Recipe)
        if title_contains:
            statement = statement.where(Recipe.title.ilike(f"%{title_contains}%"))
        if unowned_only:
            statement = statement.where(Recipe.owner_id.is_(None))
        recipes = (await session.scalars(statement)).all()
        if not recipes:
            raise SystemExit("No matching recipes; nothing changed.")
        for recipe in recipes:
            recipe.owner_id = user.id
            print(f"{recipe.title} -> {user.email}")
        await session.commit()
        print(f"Assigned {len(recipes)} recipe(s) to {user.email}.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crave administration")
    subparsers = parser.add_subparsers(dest="command", required=True)
    activate = subparsers.add_parser("activate-user", help="Activate a pending user")
    activate.add_argument("email")
    assign = subparsers.add_parser("assign-recipes", help="Make an account the owner of matching recipes")
    assign.add_argument("email")
    assign.add_argument("--title-contains", help="Only recipes whose title contains this text (case-insensitive)")
    assign.add_argument("--unowned-only", action="store_true", help="Only recipes that have no owner yet")
    args = parser.parse_args()
    if args.command == "activate-user":
        asyncio.run(activate_user(args.email))
    elif args.command == "assign-recipes":
        asyncio.run(assign_recipes(args.email, args.title_contains, args.unowned_only))


if __name__ == "__main__":
    main()
