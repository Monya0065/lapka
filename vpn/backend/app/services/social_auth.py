from datetime import datetime
from typing import Optional
import aiohttp
import secrets
import jwt
import hashlib
import asyncio


class SocialUser:
    def __init__(
        self,
        provider: str,
        provider_id: str,
        email: str,
        name: str,
        avatar: Optional[str] = None,
    ):
        self.provider = provider
        self.provider_id = provider_id
        self.email = email
        self.name = name
        self.avatar = avatar


class SocialAuthService:
    def __init__(
        self,
        google_client_id: Optional[str] = None,
        google_client_secret: Optional[str] = None,
        apple_client_id: Optional[str] = None,
        apple_team_id: Optional[str] = None,
        apple_private_key: Optional[str] = None,
    ):
        self.google_client_id = google_client_id
        self.google_client_secret = google_client_secret
        self.apple_client_id = apple_client_id
        self.apple_team_id = apple_team_id
        self.apple_private_key = apple_private_key

    async def google_login(self, code: str) -> Optional[SocialUser]:
        if not all([self.google_client_id, self.google_client_secret]):
            return None

        token_url = "https://oauth2.googleapis.com/token"
        token_data = {
            "code": code,
            "client_id": self.google_client_id,
            "client_secret": self.google_client_secret,
            "redirect_uri": "https://lapka.ru/api/auth/callback/google",
            "grant_type": "authorization_code",
        }

        async with aiohttp.ClientSession() as session:
            async with session.post(token_url, data=token_data) as token_response:
                if token_response.status != 200:
                    return None
                token_json = await token_response.json()

            access_token = token_json.get("access_token")
            if not access_token:
                return None

            user_url = "https://www.googleapis.com/oauth2/v2/userinfo"
            headers = {"Authorization": f"Bearer {access_token}"}
            
            async with session.get(user_url, headers=headers) as user_response:
                if user_response.status != 200:
                    return None
                user_json = await user_response.json()

        return SocialUser(
            provider="google",
            provider_id=user_json["id"],
            email=user_json["email"],
            name=user_json.get("name", ""),
            avatar=user_json.get("picture"),
        )

    async def verify_apple_id_token(self, id_token: str) -> Optional[dict]:
        try:
            header = jwt.get_unverified_header(id_token)
            
            algorithms = ["ES256"]
            
            public_key = jwt.Algorithms.SHA256
            
            payload = jwt.decode(
                id_token,
                self.apple_private_key or "",
                algorithms=algorithms,
                options={"verify_signature": False},
            )
            
            if payload.get("iss") != f"https://appleid.apple.com":
                return None
            
            if payload.get("aud") != self.apple_client_id:
                return None
            
            return payload
        except Exception:
            return None

    async def apple_login(self, id_token: str, email: Optional[str] = None) -> Optional[SocialUser]:
        payload = await self.verify_apple_id_token(id_token)
        if not payload:
            return None

        user_email = email or payload.get("email")
        if not user_email:
            return None

        return SocialUser(
            provider="apple",
            provider_id=payload.get("sub", ""),
            email=user_email,
            name=payload.get("fullName", {}).get("givenName", ""),
            avatar=None,
        )

    def get_google_auth_url(self, state: str) -> str:
        params = {
            "client_id": self.google_client_id,
            "redirect_uri": "https://lapka.ru/api/auth/callback/google",
            "response_type": "code",
            "scope": "email profile",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    def get_apple_auth_url(self, state: str) -> str:
        params = {
            "client_id": self.apple_client_id,
            "redirect_uri": "https://lapka.ru/api/auth/callback/apple",
            "response_type": "code id_token",
            "scope": "name email",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
        return f"https://appleid.apple.com/auth/authorize?{query}"


social_auth_service = SocialAuthService()


def generate_oauth_state() -> str:
    random_bytes = secrets.token_bytes(32)
    return hashlib.sha256(random_bytes).hexdigest()