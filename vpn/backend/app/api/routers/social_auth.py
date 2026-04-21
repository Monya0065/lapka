"""Social auth router."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.services import auth_service
from app.services.social_auth import social_auth_service, generate_oauth_state, SocialUser

router = APIRouter()


class OAuthUrlResponse(BaseModel):
    url: str
    state: str


class OAuthCallbackRequest(BaseModel):
    code: str
    id_token: str | None = None
    state: str


class OAuthCallbackResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str


@router.get("/google/url", response_model=OAuthUrlResponse)
async def get_google_auth_url():
    state = generate_oauth_state()
    url = social_auth_service.get_google_auth_url(state)
    return OAuthUrlResponse(url=url, state=state)


@router.get("/apple/url", response_model=OAuthUrlResponse)
async def get_apple_auth_url():
    state = generate_oauth_state()
    url = social_auth_service.get_apple_auth_url(state)
    return OAuthUrlResponse(url=url, state=state)


@router.post("/google/callback", response_model=OAuthCallbackResponse)
async def google_callback(data: OAuthCallbackRequest):
    user = await social_auth_service.google_login(data.code)
    if not user:
        raise HTTPException(status_code=400, detail="Failed to authenticate with Google")

    from app.services import auth_service
    access, refresh = await auth_service.social_register(
        provider="google",
        provider_id=user.provider_id,
        email=user.email,
        name=user.name,
    )

    return OAuthCallbackResponse(
        access_token=access,
        refresh_token=refresh,
        user_id=str(uuid.uuid4()),
    )


@router.post("/apple/callback", response_model=OAuthCallbackResponse)
async def apple_callback(data: OAuthCallbackRequest):
    if not data.id_token:
        raise HTTPException(status_code=400, detail="Missing id_token")

    user = await social_auth_service.apple_login(data.id_token)
    if not user:
        raise HTTPException(status_code=400, detail="Failed to authenticate with Apple")

    from app.services import auth_service
    access, refresh = await auth_service.social_register(
        provider="apple",
        provider_id=user.provider_id,
        email=user.email,
        name=user.name,
    )

    return OAuthCallbackResponse(
        access_token=access,
        refresh_token=refresh,
        user_id=str(uuid.uuid4()),
    )