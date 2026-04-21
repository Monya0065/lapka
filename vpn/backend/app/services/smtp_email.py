"""Email service with SMTP support."""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

from sqlalchemy import text

from app.database import create_session


class EmailService:
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("SMTP_FROM", "noreply@lapka.ru")
        self.from_name = os.getenv("SMTP_FROM_NAME", "Lapka VPN")
    
    def _send_email(self, to_email: str, subject: str, body: str, html: str = None) -> bool:
        """Send email via SMTP."""
        if not self.smtp_host:
            print(f"\n=== EMAIL ===")
            print(f"To: {to_email}")
            print(f"Subject: {subject}")
            print(f"Body: {body}")
            print(f"============\n")
            return True
        
        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email
            msg["Date"] = datetime.now().strftime("%a, %d %b %Y %H:%M:%S %z")
            msg["Subject"] = subject
            
            text_part = MIMEText(body, "plain", "utf-8")
            msg.attach(text_part)
            
            if html:
                html_part = MIMEText(html, "html", "utf-8")
                msg.attach(html_part)
            
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, to_email, msg.as_string())
            
            return True
        except Exception as e:
            print(f"Email send error: {e}")
            return False
    
    async def send_welcome(self, email: str, name: str = "User"):
        """Send welcome email."""
        subject = "Добро пожаловать в Lapka VPN!"
        body = f"""
Привет, {name}!

Спасибо за регистрацию в Lapka VPN.

Теперь ты можешь:
- Подключить до 5 устройств
- Использовать WireGuard для безопасного соединения
- Управлять подпиской в личном кабинете

Начни прямо сейчас: http://localhost:3001/dashboard

С уважением,
Команда Lapka VPN
        """
        html = f"""
<h1>Привет, {name}!</h1>
<p>Спасибо за регистрацию в <b>Lapka VPN</b>.</p>
<p>Теперь ты можешь:</p>
<ul>
<li>Подключить до 5 устройств</li>
<li>Использовать WireGuard для безопасного соединения</li>
<li>Управлять подпиской в личном кабинете</li>
</ul>
<p><a href="http://localhost:3001/dashboard">Начни прямо сейчас</a></p>
<p>С уважением,<br>Команда Lapka VPN</p>
        """
        return self._send_email(email, subject, body, html)
    
    async def send_verification(self, email: str, token: str):
        """Send email verification."""
        subject = "Подтверждение регистрации"
        verify_link = f"http://localhost:3001/verify?token={token}"
        body = f"""
Подтвердите ваш email, перейдя по ссылке:
{verify_link}

Ссылка действительна 24 часа.

Если это не вы — просто игнорируйте это письмо.
        """
        html = f"""
<h1>Подтверждение email</h1>
<p>Перейдите по ссылке для подтверждения:</p>
<p><a href="{verify_link}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Подтвердить</a></p>
<p>Ссылка действительна 24 часа.</p>
<p>Если это не вы — просто игнорируйте это письмо.</p>
        """
        return self._send_email(email, subject, body, html)
    
    async def send_password_reset(self, email: str, token: str):
        """Send password reset."""
        reset_link = f"http://localhost:3001/reset?token={token}"
        subject = "Восстановление пароля"
        body = f"""
Для восстановления пароля перейдите по ссылке:
{reset_link}

Ссылка действительна 1 час.

Если вы не запрашивали восстановление — игнорируйте это письмо.
        """
        html = f"""
<h1>Восстановление пароля</h1>
<p>Перейдите по ссылке:</p>
<p><a href="{reset_link}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Восстановить</a></p>
<p>Ссылка действительна 1 час.</p>
        """
        return self._send_email(email, subject, body, html)
    
    async def send_subscription_confirmed(self, email: str, plan: str):
        """Send subscription confirmation."""
        subject = "Подписка активирована"
        body = f"""
Ваша подписка {plan} активирована!

Теперь вы можете пользоваться VPN без ограничений.

С уважением,
Команда Lapka VPN
        """
        html = f"""
<h1>Подписка активирована</h1>
<p>Ваша подписка <b>{plan}</b> активирована!</p>
<p>Теперь вы можете пользоваться VPN без ограничений.</p>
        """
        return self._send_email(email, subject, body, html)

    async def send_subscription_expiring(self, email: str, days: int):
        """Send subscription expiring warning."""
        subject = "Подписка истекает"
        body = f"""
Ваша подписка истекает через {days} дней.

Продлите подписку, чтобы не потерять доступ к VPN.

С уважением,
Команда Lapka VPN
        """
        html = f"""
<h1>Подписка истекает</h1>
<p>Ваша подписка истекает через <b>{days} дней</b>.</p>
<p>Продлите подписку, чтобы не потерять доступ к VPN.</p>
        """
        return self._send_email(email, subject, body, html)

    async def send_2fa_enabled(self, email: str):
        """Send 2FA enabled notification."""
        subject = "2FA включена"
        body = """
Двухфакторная аутентификация включена для вашего аккаунта.

Если это были не вы — немедленно смените пароль.

С уважением,
Команда Lapka VPN
        """
        html = f"""
<h1>2FA включена</h1>
<p>Двухфакторная аутентификация включена.</p>
<p>Если это были не вы — немедленно смените пароль.</p>
        """
        return self._send_email(email, subject, body, html)

    async def send_device_connected(self, email: str, device_name: str, ip: str):
        """Send device connected notification."""
        subject = "Новое устройство подключено"
        body = f"""
Новое устройство подключено: {device_name}

IP: {ip}

Если это были не вы — удалите устройство в настройках.

С уважением,
Ком��нда Lapka VPN
        """
        html = f"""
<h1>Новое устройство</h1>
<p>Подключено: <b>{device_name}</b></p>
<p>IP: {ip}</p>
<p>Если это были не вы — удалите устройство в настройках.</p>
        """
        return self._send_email(email, subject, body, html)


email_service = EmailService()
