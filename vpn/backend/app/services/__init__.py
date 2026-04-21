"""Auth Service using bcrypt directly."""
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, Header
from jose import jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import create_session, get_session
from app.repositories import UserRepository

SECRET_KEY = "dev-secret-key-change-in-prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = 3600
REFRESH_TOKEN_EXPIRE = 86400 * 30


async def get_current_user_id(authorization: str = Header(None)) -> uuid.UUID:
    """Dependency to get current user from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return uuid.UUID(payload["sub"])
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


class AuthService:
    def __init__(self):
        self.user_repo = None

    async def _get_user_repo(self):
        session = await create_session()
        return UserRepository(session)

    def _create_access_token(self, user_id: uuid.UUID) -> str:
        return jwt.encode(
            {"sub": str(user_id), "exp": datetime.utcnow() + timedelta(seconds=ACCESS_TOKEN_EXPIRE)},
            SECRET_KEY,
            algorithm=ALGORITHM,
        )

    def _create_refresh_token(self) -> str:
        return secrets.token_urlsafe(32)

    def _hash_password(self, password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    def _verify_password(self, password: str, hash: str) -> bool:
        return bcrypt.checkpw(password.encode(), hash.encode())

    async def register(self, email: str, password: str) -> tuple[dict, str, str]:
        user_repo = await self._get_user_repo()
        existing = await user_repo.get_by_email(email)
        if existing:
            raise ValueError("Email already registered")
        
        password_hash = self._hash_password(password)
        user = await user_repo.create(email, password_hash)
        
        access_token = self._create_access_token(uuid.UUID(user["id"]))
        refresh_token = self._create_refresh_token()
        return user, access_token, refresh_token

    async def login(self, email: str, password: str) -> tuple[dict, str, str]:
        user_repo = await self._get_user_repo()
        user = await user_repo.get_by_email(email)
        if not user or not self._verify_password(password, user["password_hash"]):
            raise ValueError("Invalid credentials")
        
        user_id = str(user["id"])
        access_token = self._create_access_token(uuid.UUID(user_id))
        refresh_token = self._create_refresh_token()
        return user, access_token, refresh_token

    async def verify_token(self, token: str) -> Optional[uuid.UUID]:
        """Verify JWT token and return user_id."""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return uuid.UUID(payload["sub"])
        except jwt.JWTError:
            return None


auth_service = AuthService()