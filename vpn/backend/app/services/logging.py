"""Structured logging service."""
import json
import logging
import sys
from datetime import datetime
from typing import Any, Optional
from enum import Enum


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class StructuredLogger:
    def __init__(self, name: str = "lapka-vpn"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
        
        if not self.logger.handlers:
            handler = logging.StreamHandler(sys.stdout)
            handler.setLevel(logging.INFO)
            
            formatter = logging.Formatter(
                "%(message)s",
                datefmt="%Y-%m-%dT%H:%M:%SZ"
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
    
    def _log(self, level: str, message: str, extra: Optional[dict] = None):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": level,
            "message": message,
            "service": "lapka-vpn",
        }
        
        if extra:
            log_entry.update(extra)
        
        self.logger.info(json.dumps(log_entry))
    
    def debug(self, message: str, **kwargs):
        self._log(LogLevel.DEBUG.value, message, kwargs)
    
    def info(self, message: str, **kwargs):
        self._log(LogLevel.INFO.value, message, kwargs)
    
    def warning(self, message: str, **kwargs):
        self._log(LogLevel.WARNING.value, message, kwargs)
    
    def error(self, message: str, **kwargs):
        self._log(LogLevel.ERROR.value, message, kwargs)
    
    def critical(self, message: str, **kwargs):
        self._log(LogLevel.CRITICAL.value, message, kwargs)
    
    def log_request(self, method: str, path: str, status_code: int, duration_ms: float, user_id: Optional[str] = None):
        self.info(
            f"{method} {path} {status_code}",
            event="api_request",
            method=method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            user_id=user_id,
        )
    
    def log_login(self, email: str, success: bool, ip: Optional[str] = None):
        self.info(
            f"Login {'success' if success else 'failed'}: {email}",
            event="login",
            email=email,
            success=success,
            ip=ip,
        )
    
    def log_logout(self, user_id: str):
        self.info(
            f"User logout",
            event="logout",
            user_id=user_id,
        )
    
    def log_payment(self, user_id: str, amount: float, plan: str, status: str):
        self.info(
            f"Payment {status}: {plan}",
            event="payment",
            user_id=user_id,
            amount=amount,
            plan=plan,
            status=status,
        )
    
    def log_subscription_changed(self, user_id: str, old_plan: str, new_plan: str):
        self.info(
            f"Subscription changed: {old_plan} -> {new_plan}",
            event="subscription_changed",
            user_id=user_id,
            old_plan=old_plan,
            new_plan=new_plan,
        )
    
    def log_device_created(self, user_id: str, device_id: str, device_name: str):
        self.info(
            f"Device created: {device_name}",
            event="device_created",
            user_id=user_id,
            device_id=device_id,
            device_name=device_name,
        )
    
    def log_device_deleted(self, user_id: str, device_id: str):
        self.info(
            f"Device deleted",
            event="device_deleted",
            user_id=user_id,
            device_id=device_id,
        )
    
    def log_security_event(self, event_type: str, details: dict):
        self.warning(
            f"Security event: {event_type}",
            event="security",
            event_type=event_type,
            **details,
        )
    
    def log_error(self, error: Exception, context: Optional[dict] = None):
        self.error(
            str(error),
            event="error",
            error_type=type(error).__name__,
            context=context or {},
        )


logger = StructuredLogger()