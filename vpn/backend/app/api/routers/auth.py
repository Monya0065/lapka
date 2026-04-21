"""Auth router."""
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, status, Query

from app.database import get_session
from app.schemas import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
)
from app.services import auth_service
from app.services.email import email_service

router = APIRouter()


async def get_current_user_id(authorization: str = Header(None)) -> uuid.UUID:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.replace("Bearer ", "")
    user_id = await auth_service.verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    return user_id


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate):
    user, access, refresh = await auth_service.register(data.email, data.password)
    await email_service.send_verification(data.email, user["id"])
    return TokenResponse(access_token=access, refresh_token=refresh)


@router.post("/verify")
async def verify(token: str = Query(...)):
    from sqlalchemy import text
    session = await get_session()
    
    try:
        token_id, token_hash = token.split(".", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid token")
    
    result = await session.execute(
        text("""
            SELECT email FROM verification_tokens 
            WHERE token_hash = :hash AND type = 'email_verification' 
            AND used_at IS NULL AND expires_at > NOW()
        """),
        {"hash": token_hash}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    email = row.email
    
    await session.execute(
        text("UPDATE verification_tokens SET used_at = NOW() WHERE token_hash = :hash"),
        {"hash": token_hash}
    )
    await session.execute(
        text("UPDATE users SET email_verified = true WHERE email = :email"),
        {"email": email}
    )
    await session.commit()
    
    return {"status": "verified", "email": email}


@router.post("/resend-verification")
async def resend_verification(email: str):
    user_id = str(uuid.uuid4())
    await email_service.send_verification(email, user_id)
    return {"status": "sent"}


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest):
    try:
        user, access, refresh = await auth_service.login(data.email, data.password)
        return TokenResponse(access_token=access, refresh_token=refresh)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.get("/me", response_model=UserResponse)
async def get_me(user_id: uuid.UUID = Depends(get_current_user_id), session = Depends(get_session)):
    from sqlalchemy import text
    result = await session.execute(
        text("SELECT id, email, mfa_enabled, role, created_at FROM users WHERE id = :id"),
        {"id": str(user_id)}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=str(row.id),
        email=row.email,
        mfa_enabled=row.mfa_enabled,
        role=row.role or "user",
        created_at=row.created_at,
    )