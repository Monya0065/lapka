"""Email service for confirmations."""
import secrets
import uuid
from datetime import datetime, timedelta

from sqlalchemy import text

from app.database import create_session


class EmailService:
    """Email service for confirmations."""
    
    async def send_welcome(self, email: str):
        print(f"[EMAIL] Sending welcome email to {email}")
        
    async def send_verification(self, email: str, token: str):
        print(f"[EMAIL] To: {email}")
        print(f"[EMAIL] Subject: Подтверждение регистрации в Lapka VPN")
        print(f"[EMAIL] Link: http://localhost:3001/verify?token={token}")
        print(f"[EMAIL] ---")
        
    async def send_password_reset(self, email: str, token: str):
        print(f"[EMAIL] To: {email}")
        print(f"[EMAIL] Subject: Восстановление пароля")
        print(f"[EMAIL] Link: http://localhost:3001/reset?token={token}")


email_service = EmailService()
