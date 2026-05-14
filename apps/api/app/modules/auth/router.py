"""
Auth router — /api/v1/auth
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import validate_telegram_init_data, get_current_user
from app.core.database import get_db
from app.modules.auth.schemas import (
    IdentifyRequest,
    IdentifyResponse,
    RegisterRequest,
    SwitchRoleRequest,
    TokenResponse,
)
from app.modules.auth.service import AuthService

router = APIRouter()


def _resolve_platform(body) -> tuple[str, str, dict | None]:
    """Extract platform, platform_id and tg_user from request body.
    If init_data is present, validate and parse Telegram initData.
    """
    tg_user = None
    platform = body.platform
    platform_id = body.platform_id

    if body.init_data:
        tg_user = validate_telegram_init_data(body.init_data)
        if tg_user is None:
            raise HTTPException(status_code=401, detail="Invalid initData")
        platform = platform or "telegram"
        platform_id = platform_id or str(tg_user["id"])

    if not platform or not platform_id:
        raise HTTPException(
            status_code=400,
            detail="platform and platform_id are required (or provide init_data)",
        )

    return platform, platform_id, tg_user


@router.post("/identify", response_model=IdentifyResponse)
async def identify(
    body: IdentifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Определить роль пользователя по initData или platform + platform_id."""
    platform, platform_id, tg_user = _resolve_platform(body)

    service = AuthService(db)
    result = await service.identify(platform, platform_id)

    token = result.get("token")
    return IdentifyResponse(
        role=result["role"],
        token=token,
        access_token=token,
        user_id=result.get("user_id"),
        display_name=result.get("display_name"),
        master_id=result.get("master_id"),
    )


@router.post("/register", response_model=TokenResponse)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Регистрация нового мастера или клиента."""
    if body.role not in ("master", "client"):
        raise HTTPException(status_code=400, detail="Role must be 'master' or 'client'")

    platform, platform_id, tg_user = _resolve_platform(body)

    display_name = body.display_name
    if not display_name and tg_user:
        display_name = tg_user.get("first_name", "User")
        if tg_user.get("last_name"):
            display_name += f" {tg_user['last_name']}"

    if not display_name:
        raise HTTPException(status_code=400, detail="display_name is required")

    service = AuthService(db)
    try:
        result = await service.register(
            platform=platform,
            platform_id=platform_id,
            role=body.role,
            display_name=display_name,
            specialization=body.specialization,
            phone=body.phone,
            city=body.city,
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return TokenResponse(
        access_token=result["token"],
        role=result["role"],
        user_id=result["user_id"],
        display_name=result["display_name"],
    )


@router.post("/switch-role", response_model=TokenResponse)
async def switch_role(
    body: SwitchRoleRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Переключение роли для суперадмина.
    Создаёт Master/Client запись если её нет, возвращает новый JWT.
    """
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Only superadmin can switch roles")

    if body.target_role not in ("master", "client", "superadmin"):
        raise HTTPException(status_code=400, detail="target_role must be master, client, or superadmin")

    service = AuthService(db)
    result = await service.switch_role(
        identity_id=int(user["sub"]),
        target_role=body.target_role,
    )
    return TokenResponse(
        access_token=result["token"],
        role=result["role"],
        user_id=result["user_id"],
        display_name=result["display_name"],
        master_id=result.get("master_id"),
    )
