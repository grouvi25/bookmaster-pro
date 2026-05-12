"""
JWT authentication + Telegram/MAX initData validation.
"""

import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import parse_qs, unquote

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db

security = HTTPBearer(auto_error=False)

ACCESS_TOKEN_EXPIRE_HOURS = 24 * 7  # 7 дней


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def validate_telegram_init_data(init_data: str) -> Optional[dict]:
    """
    Validate Telegram Mini-App initData.
    Returns parsed user data if valid, None if invalid.
    """
    try:
        parsed = parse_qs(init_data)

        # Extract and verify hash
        received_hash = parsed.get("hash", [None])[0]
        if not received_hash:
            return None

        # Check auth_date (не старше 24 часов)
        auth_date = int(parsed.get("auth_date", [0])[0])
        if time.time() - auth_date > 86400:
            return None

        # Build data-check-string
        data_pairs = []
        for key in sorted(parsed.keys()):
            if key != "hash":
                data_pairs.append(f"{key}={unquote(parsed[key][0])}")
        data_check_string = "\n".join(data_pairs)

        # Compute secret key
        secret_key = hmac.new(
            b"WebAppData", settings.TG_BOT_TOKEN.encode(), hashlib.sha256
        ).digest()

        # Compute hash
        computed_hash = hmac.new(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if computed_hash != received_hash:
            return None

        # Parse user data
        user_str = parsed.get("user", [None])[0]
        if user_str:
            return json.loads(unquote(user_str))
        return None
    except Exception:
        return None


def is_superadmin(platform_id: str) -> bool:
    return platform_id in settings.superadmin_list


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return decode_token(credentials.credentials)
