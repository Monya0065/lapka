from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.schemas.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    UserOut,
    SelectClinicRequest,
)
from src.schemas.common import TokenPair
from src.security.deps import get_current_user
from src.services.auth import login, logout, refresh, register_owner, select_clinic

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db_session)) -> UserOut:
    user = await register_owner(
        db,
        email=payload.email,
        full_name=payload.full_name,
        phone=payload.phone,
        password=payload.password,
    )
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenPair)
async def login_endpoint(payload: LoginRequest, db: AsyncSession = Depends(get_db_session)) -> TokenPair:
    # optional clinic context may be supplied for clinic staff
    _user, access_token, refresh_token = await login(
        db,
        email=payload.email,
        password=payload.password,
        clinic_id=payload.clinic_id,
    )
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/select-clinic", response_model=TokenPair)
async def select_clinic_endpoint(
    payload: SelectClinicRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> TokenPair:
    token = await select_clinic(db, user=current_user, clinic_id=payload.clinic_id)
    # we don't issue a new refresh token for convenience; reuse old one
    return TokenPair(access_token=token, refresh_token="")


@router.post("/refresh", response_model=TokenPair)
async def refresh_endpoint(payload: RefreshRequest, db: AsyncSession = Depends(get_db_session)) -> TokenPair:
    access_token, refresh_token = await refresh(db, raw_refresh_token=payload.refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


@router.post("/logout")
async def logout_endpoint(
    payload: LogoutRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    await logout(db, user_id=current_user.id, raw_refresh_token=payload.refresh_token)
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
async def me(current_user=Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)
