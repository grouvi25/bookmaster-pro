import logging
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
from sqlalchemy import select as sa_select
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
    _vlog = logging.getLogger("auth.validate")
    try:
        parsed = parse_qs(init_data)
        _vlog.warning("VALIDATE keys=%s", sorted(parsed.keys()))

        # Extract and verify hash
        received_hash = parsed.get("hash", [None])[0]
        if not received_hash:
            _vlog.warning("VALIDATE FAIL: no hash in initData")
            return None

        # Check auth_date (не старше 24 часов)
        auth_date = int(parsed.get("auth_date", [0])[0])
        age = time.time() - auth_date
        _vlog.warning("VALIDATE auth_date=%s age=%.0fs", auth_date, age)
        if age > 86400:
            _vlog.warning("VALIDATE FAIL: auth_date too old (%.0fs > 86400)", age)
            return None

        # Build data-check-string.
        # Exclude BOTH "hash" AND "signature":
        # - "hash"      — always excluded (it's the value being verified)
        # - "signature" — added in Bot API 7.3 (Telegram Desktop got it first);
        #                 Telegram computes "hash" WITHOUT "signature", so
        #                 including it here causes a mismatch on Desktop clients.
        _EXCLUDED_KEYS = {"hash", "signature"}
        data_pairs = []
        for key in sorted(parsed.keys()):
            if key not in _EXCLUDED_KEYS:
                data_pairs.append(f"{key}={unquote(parsed[key][0])}")
        data_check_string = "\n".join(data_pairs)

        # Compute secret key
        secret_key = hmac.HMAC(
            b"WebAppData", settings.TG_BOT_TOKEN.encode(), hashlib.sha256
        ).digest()

        # Compute hash
        computed_hash = hmac.HMAC(
            secret_key, data_check_string.encode(), hashlib.sha256
        ).hexdigest()

        if computed_hash != received_hash:
            _vlog.warning("VALIDATE FAIL: hash mismatch. computed=%s received=%s", computed_hash[:16], received_hash[:16])
            _vlog.warning("VALIDATE data_check_string (first 200 chars): %s", data_check_string[:200])
            return None
        _vlog.warning("VALIDATE OK: hash matched, user_present=%s", bool(parsed.get("user")))

        # Parse user data.
        # Return the user dict if present; otherwise return an empty dict to
        # signal "hash is valid but no user payload" instead of returning None
        # (which the caller cannot distinguish from "hash verification failed").
        user_str = parsed.get("user", [None])[0]
        if user_str:
            return json.loads(unquote(user_str))
        # Hash verified, but no user field (e.g. channel/group context).
        # Return an empty dict so the caller knows validation succeeded.
        return {}
    except Exception:
        return None


def validate_max_init_data(init_data: str) -> Optional[dict]:
    """
    Validate MAX Mini-App initData (WebAppData), per:
    https://dev.max.ru/docs/webapps/validation

    `init_data` is the value of the `WebAppData` launch param, a
    `key=value&key=value` string (URL-encoded values). Returns the parsed
    `user` dict on success, or None if the signature is invalid/missing.
    """
    try:
        if not init_data or not settings.MAX_BOT_TOKEN:
            return None

        # Split into key=value pairs (split only on first '=' per pair).
        pairs = [p.split("=", 1) for p in init_data.split("&") if "=" in p]

        # hash must appear exactly once.
        hashes = [v for (k, v) in pairs if k == "hash"]
        if len(hashes) != 1:
            return None
        received_hash = hashes[0]

        # URL-decode all values.
        decoded = [(k, unquote(v)) for (k, v) in pairs]

        # auth_date freshness check (<= 24h). MAX recommends 1h, we allow 24h.
        auth_date_val = next((v for (k, v) in decoded if k == "auth_date"), None)
        if auth_date_val is not None:
            try:
                if time.time() - int(auth_date_val) > 86400:
                    return None
            except (TypeError, ValueError):
                return None

        # Sort by key a->z, exclude hash, join with \n.
        launch_pairs = sorted(
            [(k, v) for (k, v) in decoded if k != "hash"], key=lambda x: x[0]
        )
        launch_params = "\n".join(f"{k}={v}" for (k, v) in launch_pairs)

        # secret_key = HMAC_SHA256(key="WebAppData", msg=BOT_TOKEN)
        secret_key = hmac.HMAC(
            b"WebAppData", settings.MAX_BOT_TOKEN.encode(), hashlib.sha256
        ).digest()

        # computed = hex(HMAC_SHA256(key=secret_key, msg=launch_params))
        computed_hash = hmac.HMAC(
            secret_key, launch_params.encode(), hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed_hash, received_hash):
            return None

        user_str = next((v for (k, v) in decoded if k == "user"), None)
        if user_str:
            return json.loads(user_str)
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


async def get_current_master(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает объект Master для текущего пользователя."""
    from app.modules.masters.models import Master

    identity_id = user.get("identity_id")
    if not identity_id:
        raise HTTPException(status_code=403, detail="Not a master")

    result = await db.execute(
        sa_select(Master).where(Master.identity_id == identity_id)
    )
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=403, detail="Master profile not found")
    return master


async def get_current_client(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Возвращает объект Client для текущего пользователя."""
    from app.modules.clients.models import Client

    identity_id = user.get("identity_id")
    if not identity_id:
        raise HTTPException(status_code=403, detail="Not a client")

    result = await db.execute(
        sa_select(Client).where(Client.identity_id == identity_id)
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=403, detail="Client profile not found")
    return client
