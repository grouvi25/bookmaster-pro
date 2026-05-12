"""
Auth schemas — request/response models.
"""

from typing import Optional

from pydantic import BaseModel


class IdentifyRequest(BaseModel):
    platform: Optional[str] = None  # 'telegram' | 'max' — derived from init_data if omitted
    platform_id: Optional[str] = None  # derived from init_data if omitted
    init_data: Optional[str] = None  # Telegram initData для валидации
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None


class RegisterRequest(BaseModel):
    platform: Optional[str] = None
    platform_id: Optional[str] = None
    init_data: Optional[str] = None  # Telegram initData — used to derive platform/platform_id
    role: str  # 'master' | 'client'
    display_name: Optional[str] = None
    specialization: Optional[str] = None  # только для мастера
    phone: Optional[str] = None
    city: Optional[str] = None


class IdentifyResponse(BaseModel):
    role: str  # 'master' | 'client' | 'superadmin' | 'moderator' | 'new'
    token: Optional[str] = None
    access_token: Optional[str] = None
    user_id: Optional[int] = None
    display_name: Optional[str] = None
    master_id: Optional[int] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    display_name: str
