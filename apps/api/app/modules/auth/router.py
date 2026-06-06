import logging

_auth_logger = logging.getLogger("auth.identify")

"""
Auth router — /api/v1/auth
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import validate_telegram_init_data, validate_max_init_data, get_current_user
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
    """Extract platform, platform_id and platform_user from request body.
    If init_data is present, validate and parse it for the right platform.
    When platform is not explicitly provided, auto-detect: try Telegram
    first, then MAX. This makes register/identify resilient to clients
    that forget to send `platform`.
    """
    tg_user = None
    platform = body.platform
    platform_id = body.platform_id

    if body.init_data:
        if platform == "max":
            max_user = validate_max_init_data(body.init_data)
            if max_user is None:
                raise HTTPException(status_code=401, detail="Invalid initData")
            platform = "max"
            platform_id = platform_id or str(max_user["id"])
            tg_user = max_user
        elif platform == "telegram":
            tg_user = validate_telegram_init_data(body.init_data)
            if tg_user is None:
                raise HTTPException(status_code=401, detail="Invalid initData")
            platform = "telegram"
            platform_id = platform_id or str(tg_user["id"])
        else:
            # Platform not specified — auto-detect.
            tg_user = validate_telegram_init_data(body.init_data)
            if tg_user is not None:
                platform = "telegram"
                platform_id = platform_id or str(tg_user["id"])
            else:
                max_user = validate_max_init_data(body.init_data)
                if max_user is None:
                    raise HTTPException(status_code=401, detail="Invalid initData")
                platform = "max"
                platform_id = platform_id or str(max_user["id"])
                tg_user = max_user

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

    _auth_logger.info(
        "IDENTIFY platform=%s pid=%s -> role=%s has_token=%s user_id=%s",
        platform, platform_id, result["role"],
        bool(result.get("token")), result.get("user_id"),
    )

    token = result.get("token")
    return IdentifyResponse(
        role=result["role"],
        token=token,
        access_token=token,
        user_id=result.get("user_id"),
        display_name=result.get("display_name"),
        master_id=result.get("master_id"),
    )




@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    """Возвращает текущую роль из JWT — для восстановления сессии без initData."""
    return {
        "role": user.get("role"),
        "identity_id": user.get("identity_id"),
        "platform": user.get("platform"),
    }

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


# ── Кросс-платформенная привязка аккаунтов ────────────────────────

from pydantic import BaseModel as PydanticBaseModel, Field as PydField

from app.modules.auth.link_service import AccountLinkService
from app.modules.auth.models import Identity


class ApplyLinkCodeRequest(PydanticBaseModel):
    code: str = PydField(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


class UnlinkRequest(PydanticBaseModel):
    identity_id: int | None = None  # если None — отвязываем текущий


@router.get("/link-code")
async def generate_link_code(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Сгенерировать код для привязки другого аккаунта.
    Возвращает 6-значный код + время жизни.
    """
    identity_id = int(user["sub"])

    # Проверяем что это не вторичный аккаунт
    result = await db.execute(
        select(Identity).where(Identity.id == identity_id)
    )
    identity = result.scalar_one_or_none()
    if identity and identity.linked_identity_id:
        raise HTTPException(
            400, "Вы используете вторичный аккаунт. Генерируйте код с основного."
        )

    svc = AccountLinkService(db)
    code = await svc.generate_link_code(identity_id)
    await db.commit()

    return {
        "code": code,
        "expires_in": 15 * 60,  # секунды
        "hint": "Введите этот код в настройках другого мессенджера",
    }


@router.post("/link-account")
async def apply_link_code(
    body: ApplyLinkCodeRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Ввести код привязки с другой платформы.
    После этого текущий аккаунт видит данные основного.
    """
    svc = AccountLinkService(db)
    try:
        result = await svc.apply_link_code(
            code=body.code,
            current_identity_id=int(user["sub"]),
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    await db.commit()
    return result


@router.delete("/link-account")
async def unlink_account(
    identity_id: Optional[int] = Query(None, description="ID вторичной identity для отвязки"),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Отвязать вторичный аккаунт от первичного.

    JWT sub всегда = primary, поэтому принимаем identity_id вторичной
    identity, которую нужно отвязать. Проверяем что она действительно
    привязана к текущему primary.
    """
    from sqlalchemy import select as sa_select
    from app.modules.auth.models import Identity

    primary_id = int(user["sub"])
    svc = AccountLinkService(db)

    if identity_id:
        # Проверяем что эта identity привязана к нашему primary
        target = await db.get(Identity, identity_id)
        if not target or target.linked_identity_id != primary_id:
            raise HTTPException(400, "Эта identity не привязана к вашему аккаунту")
        await svc.unlink_account(identity_id)
    else:
        # Обратная совместимость: если identity_id не передан,
        # ищем все вторичные текущего primary и отвязываем первую найденную
        result = await db.execute(
            sa_select(Identity.id).where(Identity.linked_identity_id == primary_id)
        )
        secondary_ids = result.scalars().all()
        if not secondary_ids:
            raise HTTPException(400, "Нет привязанных аккаунтов для отвязки")
        await svc.unlink_account(secondary_ids[0])

    await db.commit()
    return {"status": "unlinked"}




class LinkByInitDataRequest(PydanticBaseModel):
    """Привязка аккаунта по initData (без JWT). Для экрана регистрации."""
    init_data: str
    code: str = PydField(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    platform: str | None = None
    platform_id: str | None = None


@router.post("/link-by-init-data")
async def link_by_init_data(
    body: LinkByInitDataRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Привязка аккаунта по initData + код (без JWT).
    Используется на экране регистрации, когда JWT ещё нет.

    1. Валидирует initData → platform + platform_id
    2. Создаёт identity с role='new' если не существует
    3. Применяет код привязки
    4. Переидентифицирует → возвращает JWT
    """
    platform, platform_id, _ = _resolve_platform(body)

    service = AuthService(db)
    svc = AccountLinkService(db)

    # Получаем или создаём identity
    identity = await service._get_identity(platform, platform_id)
    if not identity:
        identity = Identity(
            platform=platform,
            platform_id=platform_id,
            role="new",
        )
        db.add(identity)
        await db.flush()

    # Если identity уже привязана — ошибка
    if identity.linked_identity_id:
        raise HTTPException(400, "Аккаунт уже привязан. Сначала отвяжите.")

    try:
        result = await svc.apply_link_code(
            code=body.code,
            current_identity_id=identity.id,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    await db.commit()

    # Переидентифицируем — теперь identity привязана к primary
    identify_result = await service.identify(platform, platform_id)

    return {
        "status": result.get("status", "linked"),
        "message": result.get("message", "Аккаунт привязан"),
        "access_token": identify_result.get("token"),
        "role": identify_result.get("role"),
        "user_id": identify_result.get("user_id"),
        "display_name": identify_result.get("display_name"),
        "master_id": identify_result.get("master_id"),
    }


@router.get("/linked-platforms")
async def get_linked_platforms(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список всех платформ привязанных к этому аккаунту."""
    identity_id = int(user["sub"])

    result = await db.execute(
        select(Identity).where(Identity.id == identity_id)
    )
    identity = result.scalar_one_or_none()
    if not identity:
        return {"platforms": []}

    primary_id = identity.linked_identity_id or identity.id

    svc = AccountLinkService(db)
    platforms = await svc.get_linked_platforms(primary_id)
    return {"platforms": platforms}
