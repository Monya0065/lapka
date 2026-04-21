from datetime import datetime
from typing import Optional
import aiohttp
import asyncio


class PushNotificationService:
    def __init__(
        self,
        fcm_api_key: Optional[str] = None,
        apns_key_id: Optional[str] = None,
        apns_team_id: Optional[str] = None,
        apns_private_key: Optional[str] = None,
    ):
        self.fcm_api_key = fcm_api_key
        self.apns_key_id = apns_key_id
        self.apns_team_id = apns_team_id
        self.apns_private_key = apns_private_key
        self._apns_token: Optional[str] = None

    async def send_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Optional[dict] = None,
        device_token: Optional[str] = None,
        device_type: Optional[str] = None,
    ) -> bool:
        if device_type == "android" or (device_token and len(device_token) > 100):
            return await self._send_fcm(device_token, title, body, data)
        elif device_type == "ios":
            return await self._send_apns(device_token, title, body, data)
        return False

    async def _send_fcm(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Optional[dict],
    ) -> bool:
        if not self.fcm_api_key:
            return False

        payload = {
            "to": device_token,
            "notification": {
                "title": title,
                "body": body,
            },
            "data": data or {},
        }

        headers = {
            "Authorization": f"key={self.fcm_api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://fcm.googleapis.com/fcm/send",
                    json=payload,
                    headers=headers,
                ) as response:
                    return response.status == 200
        except Exception:
            return False

    async def _send_apns(
        self,
        device_token: str,
        title: str,
        body: str,
        data: Optional[dict],
    ) -> bool:
        if not all([self.apns_key_id, self.apns_team_id, self.apns_private_key]):
            return False

        payload = {
            "aps": {
                "alert": {
                    "title": title,
                    "body": body,
                },
                "sound": "default",
            },
        }

        if data:
            payload.update(data)

        headers = {
            "apns-topic": "ru.lapka.vpn",
            "apns-priority": "10",
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"https://api.push.apple.com/3/device/{device_token}",
                    json=payload,
                    headers=headers,
                ) as response:
                    return response.status == 200
        except Exception:
            return False

    async def notify_subscription_expiring(
        self,
        user_id: str,
        days_remaining: int,
        device_token: Optional[str] = None,
        device_type: Optional[str] = None,
    ) -> bool:
        title = "Подписка истекает"
        body = f"Через {days_remaining} дней"
        data = {"type": "subscription_expiring", "days": str(days_remaining)}

        return await self.send_notification(user_id, title, body, data, device_token, device_type)

    async def notify_payment_success(
        self,
        user_id: str,
        amount: float,
        device_token: Optional[str] = None,
        device_type: Optional[str] = None,
    ) -> bool:
        title = "Платёж успешен"
        body = f"Оплачено {amount} ₽"
        data = {"type": "payment_success", "amount": str(amount)}

        return await self.send_notification(user_id, title, body, data, device_token, device_type)

    async def notify_device_connected(
        self,
        user_id: str,
        device_name: str,
        device_token: Optional[str] = None,
        device_type: Optional[str] = None,
    ) -> bool:
        title = "Устройство подключено"
        body = f"{device_name} подключено к VPN"
        data = {"type": "device_connected", "device": device_name}

        return await self.send_notification(user_id, title, body, data, device_token, device_type)

    async def notify_server_maintenance(
        self,
        user_ids: list[str],
        start_time: datetime,
        duration: int,
    ) -> dict[str, bool]:
        title = "Техническое обслуживание"
        body = f"Начало в {start_time.strftime('%H:%M')}, продлится {duration} мин"
        data = {"type": "maintenance"}

        results = {}
        for user_id in user_ids:
            results[user_id] = await self.send_notification(user_id, title, body, data)

        return results


push_service = PushNotificationService()