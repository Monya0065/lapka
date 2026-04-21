"""Seed data for VPN project."""
import asyncio
import uuid
from datetime import datetime, timedelta

from passlib.hash import bcrypt


async def seed():
    from app.database import create_pool, create_session
    from sqlalchemy import text

    await create_pool()
    session = await create_session()

    # Check if users exist
    result = await session.execute(text("SELECT COUNT(*) FROM users"))
    count = result.scalar()
    if count > 0:
        print(f"Database already has {count} users")
        return

    # Create demo user
    user_id = uuid.uuid4()
    password_hash = bcrypt.hash("demo123")
    await session.execute(text("""
        INSERT INTO users (id, email, password_hash, mfa_enabled, role, created_at)
        VALUES (:id, :email, :password_hash, :mfa_enabled, :role, :created_at)
    """), {
        "id": user_id,
        "email": "demo@lapka.ru",
        "password_hash": password_hash,
        "mfa_enabled": False,
        "role": "admin",
        "created_at": datetime.utcnow(),
    })

    # Create trial subscription
    sub_id = uuid.uuid4()
    await session.execute(text("""
        INSERT INTO subscriptions (id, user_id, plan_id, provider, status, renew_at, created_at, updated_at)
        VALUES (:id, :user_id, :plan_id, :provider, :status, :renew_at, :created_at, :updated_at)
    """), {
        "id": sub_id,
        "user_id": user_id,
        "plan_id": "trial",
        "provider": "internal",
        "status": "trial",
        "renew_at": datetime.utcnow() + timedelta(days=7),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    })

    # Create VPN nodes
    nodes = [
        {"region": "ru-central", "endpoint": "vpn-ru1.lapka.ru:51820", "public_key": "A1B2C3D4E5F6G7H8I9J0k="},
        {"region": "ru-east", "endpoint": "vpn-ru2.lapka.ru:51820", "public_key": "K0J9I8H7G6F5E4D3C2B1A="},
        {"region": "eu-west", "endpoint": "vpn-eu1.lapka.ru:51820", "public_key": "Z9Y8X7W6V5U4T3S2R1Q0="},
    ]

    for node in nodes:
        await session.execute(text("""
            INSERT INTO vpn_nodes (id, region, endpoint, public_key, status, capacity, health_score, created_at)
            VALUES (:id, :region, :endpoint, :public_key, :status, :capacity, :health_score, :created_at)
        """), {
            "id": uuid.uuid4(),
            "region": node["region"],
            "endpoint": node["endpoint"],
            "public_key": node["public_key"],
            "status": "active",
            "capacity": 100,
            "health_score": 100,
            "created_at": datetime.utcnow(),
        })

    await session.commit()
    print(f"Created demo user: demo@lapka.ru / demo123")
    print(f"Created {len(nodes)} VPN nodes")


if __name__ == "__main__":
    asyncio.run(seed())