"""Seed (or promote) the first admin user.

Usage (inside the api container):
    python -m app.scripts.seed_admin --email admin@docuguard.local --password 'ChangeMe123!' --name 'Admin'
If the user already exists it is promoted to admin and reactivated.
"""
import argparse
import asyncio
from datetime import datetime, timezone

from app.database import db, connect_to_mongo, close_mongo_connection
from app.utils.auth_utils import hash_password


async def seed(email: str, password: str, name: str) -> None:
    await connect_to_mongo()
    email = email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {"role": "admin", "is_active": True}},
        )
        print(f"Promoted existing user {email} to admin.")
    else:
        await db.users.insert_one({
            "email": email,
            "hashed_password": hash_password(password),
            "full_name": name,
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "last_login": None,
        })
        print(f"Created admin user {email}.")
    await close_mongo_connection()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed/promote the first DocuGuard admin")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", default="Administrator")
    args = parser.parse_args()
    asyncio.run(seed(args.email, args.password, args.name))


if __name__ == "__main__":
    main()
