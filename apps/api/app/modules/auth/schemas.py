"""
Auth schemas — request/response models.
"""

from typing import Optional

from pydantic import BaseModel


class IdentifyRequest(BaseModel):
    platform: str  # 'telegram' | 'max'
    platform_id: str
    init_data: Optional[str] = None  # Telegram initData для валидации
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None


class RegisterRequest(BaseModel):
    platform: str
    platform_id: str
    role: str  # 'master' | 'client'
    display_name: str
    specialization: Optional[str] = None  # только для мастера
    phone: Optional[str] = None
    city: Optional[str] = None


class IdentifyResponse(BaseModel):
    role: str  # 'master' | 'client' | 'superadmin' | 'moderator' | 'new'
    token: Optional[str] = None
    user_id: Optional[int] = None
    display_name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    display_name: str
