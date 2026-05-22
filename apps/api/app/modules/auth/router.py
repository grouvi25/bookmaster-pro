"""
Auth router — /api/v1/auth
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import validate_telegram_init_data, get_current_user
from app.core.database import get_db
from app.core.rate_limit import rate_limit
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
    _rl=rate_limit("auth_identify", max_requests=30, window_seconds=60),
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


@router.post("/apply-promo-code")
async def apply_promo_code(
    body: dict,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Применить промо-код платформы (после регистрации / на онбординге)."""
    from datetime import date, timedelta
    from sqlalchemy import select, and_
    from app.modules.core.models import AccessGrant, PlatformPromoCode
    from app.modules.masters.models import Master

    code_str = body.get("code", "").strip().upper()
    if not code_str:
        raise HTTPException(status_code=400, detail="Promo code is required")

    result = await db.execute(
        select(Master).where(Master.identity_id == int(user["sub"]))
    )
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")

    promo = await db.execute(
        select(PlatformPromoCode).where(
            and_(
                PlatformPromoCode.code == code_str,
                PlatformPromoCode.is_active.is_(True),
            )
        )
    )
    promo_code = promo.scalar_one_or_none()
    if not promo_code:
        raise HTTPException(status_code=404, detail="Промо-код не найден или деактивирован")

    if promo_code.valid_until and promo_code.valid_until < date.today():
        raise HTTPException(status_code=410, detail="Промо-код истёк")

    if promo_code.max_uses and promo_code.used_count >= promo_code.max_uses:
        raise HTTPException(status_code=410, detail="Промо-код исчерпан")

    existing_grant = await db.execute(
        select(AccessGrant).where(
            and_(
                AccessGrant.master_id == master.id,
                AccessGrant.promo_code == code_str,
            )
        )
    )
    if existing_grant.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Промо-код уже был использован")

    grant = AccessGrant(
        master_id=master.id,
        grant_type="promo_code",
        plan=promo_code.plan,
        valid_until=date.today() + timedelta(days=promo_code.duration_days),
        promo_code=code_str,
        granted_by="system",
        note=f"Промо-код {code_str}",
    )
    db.add(grant)

    promo_code.used_count = (promo_code.used_count or 0) + 1
    await db.commit()

    return {
        "applied": True,
        "plan": promo_code.plan,
        "valid_until": str(grant.valid_until),
        "duration_days": promo_code.duration_days,
    }
