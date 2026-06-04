"""
Superadmin router — /api/v1/superadmin

ТЗ раздел 12: доступ через SUPERADMIN_IDS, дашборд, мастера, финансы,
тикеты, аналитика роста, системные тесты, настройки, промо-коды,
ручная выдача доступа, broadcast от платформы.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel as PydanticBaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, is_superadmin
from app.modules.superadmin.service import SuperadminService
from app.modules.superadmin.schemas import (
    MasterAdminListItem,
    MasterAdminUpdate,
    HealthCheckResponse,
)


# ── Request schemas ───────────────────────────────────────────

class CreatePromoCodeRequest(PydanticBaseModel):
    code: str = Field(..., min_length=2, max_length=50)
    plan: str = "pro"
    duration_days: int = Field(..., ge=1, le=365)
    max_uses: Optional[int] = None
    valid_until: Optional[str] = None  # ISO date string
    note: Optional[str] = None


class GrantAccessRequest(PydanticBaseModel):
    plan: str = "pro"
    duration_days: int = Field(..., ge=1, le=365)
    note: Optional[str] = None


class TicketReplyRequest(PydanticBaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


class BroadcastRequest(PydanticBaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    plan_filter: Optional[str] = None
    only_active: bool = True
    button_text: Optional[str] = None
    button_url: Optional[str] = None


class BroadcastPreviewRequest(PydanticBaseModel):
    plan_filter: Optional[str] = None
    only_active: bool = True


router = APIRouter()


def _require_superadmin(user: dict = Depends(get_current_user)):
    platform_id = user.get("platform_id") or str(user.get("identity_id", ""))
    if not is_superadmin(platform_id):
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return user


# ── Дашборд ──────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Платформенная аналитика согласно ТЗ 12.3:
    MRR, ARR, Transaction Revenue, Churn, LTV, NPS, Тикеты без ответа > SLA,
    конверсия регистрации (мастер сделал ≥1 запись)."""
    svc = SuperadminService(db)
    return await svc.get_dashboard()


# ── Мастера ──────────────────────────────────────────────────

@router.get("/masters")
async def get_masters_list(
    plan: Optional[str] = None,
    verified: Optional[bool] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Список мастеров с фильтрами."""
    svc = SuperadminService(db)
    masters, total = await svc.get_masters_list(
        plan_filter=plan,
        verified_filter=verified,
        search=search,
        page=page,
        per_page=per_page,
    )
    return {
        "masters": [
            MasterAdminListItem(
                id=m.id,
                display_name=m.display_name,
                slug=m.slug,
                specialization=m.specialization,
                city=m.city,
                current_plan=m.current_plan or "start",
                is_verified=bool(m.is_verified),
                is_active=bool(m.is_active) if m.is_active is not None else True,
                rating_avg=float(m.rating_avg or 0),
                total_clients=int(m.total_clients or 0),
                total_appointments=int(m.total_appointments or 0),
                created_at=m.created_at,
            )
            for m in masters
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.patch("/masters/{master_id}")
async def update_master(
    master_id: int,
    req: MasterAdminUpdate,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Обновить мастера: верификация, план, активность."""
    svc = SuperadminService(db)
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    master = await svc.update_master(
        master_id=master_id,
        is_verified=req.is_verified,
        is_active=req.is_active,
        current_plan=req.current_plan,
        admin_id=admin_id,
    )
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    await db.commit()
    return {"id": master.id, "updated": True}


@router.post("/masters/{master_id}/verify")
async def verify_master(
    master_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Верифицировать мастера (ставит is_verified=true)."""
    svc = SuperadminService(db)
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    master = await svc.update_master(
        master_id=master_id,
        is_verified=True,
        admin_id=admin_id,
    )
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")
    await db.commit()
    return {"id": master.id, "is_verified": True}


# ── Health Check (ТЗ 12.2) ───────────────────────────────────

@router.get("/health", response_model=HealthCheckResponse)
async def health_checks(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Реальная проверка состояния всех сервисов: DB, Redis, S3, ЮKassa,
    OpenAI, YandexGPT, Yandex STT, TG Bot, MAX Bot, Scheduler.
    Каждая проверка измеряет response time."""
    svc = SuperadminService(db)
    return await svc.run_health_checks()


@router.get("/logs")
async def get_service_logs(
    service: str = Query("bot_max"),
    tail: int = Query(200, ge=10, le=1000),
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Logs of a service container (Docker). Default bot_max (Zapisator)."""
    svc = SuperadminService(db)
    return await svc.get_container_logs(service=service, tail=tail)


# ── Audit ────────────────────────────────────────────────────

@router.get("/audit-log")
async def get_audit_log(
    limit: int = Query(50, ge=1, le=500),
    action: Optional[str] = None,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Лог действий администраторов."""
    from app.modules.superadmin.models import AdminAuditLog
    from sqlalchemy import select

    q = select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    if action:
        q = q.where(AdminAuditLog.action == action)
    q = q.limit(limit)

    logs = (await db.execute(q)).scalars().all()
    return [
        {
            "id": log.id,
            "admin_id": log.admin_id,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "payload": log.payload,
            "created_at": str(log.created_at),
        }
        for log in logs
    ]


# ── Финансы ──────────────────────────────────────────────────

@router.get("/finance")
async def get_finance_dashboard(
    period_days: int = Query(30, ge=1, le=365),
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Финансовый дашборд: выручка, MRR, возвраты, динамика, просроченные подписки."""
    svc = SuperadminService(db)
    return await svc.get_finance_dashboard(period_days)


# ── Тикеты ───────────────────────────────────────────────────

@router.get("/tickets")
async def get_tickets_queue(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Очередь тикетов с фильтрами + SLA-метрики."""
    svc = SuperadminService(db)
    return await svc.get_tickets_queue(status, priority, page, per_page)


@router.get("/tickets/{ticket_id}")
async def get_ticket_detail(
    ticket_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Полная информация о тикете + все сообщения."""
    svc = SuperadminService(db)
    detail = await svc.get_ticket_detail(ticket_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return detail


@router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(
    ticket_id: int,
    req: TicketReplyRequest,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Ответ суперадмина в тикет (ТЗ 8.5: быстрый ответ).
    Обновляет first_response_at + статус → in_progress + шлёт пуш инициатору."""
    svc = SuperadminService(db)
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    result = await svc.reply_to_ticket(ticket_id, admin_id, req.text)
    if "error" in result:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()
    return result


@router.post("/tickets/{ticket_id}/escalate")
async def escalate_ticket(
    ticket_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Эскалировать тикет."""
    svc = SuperadminService(db)
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    result = await svc.escalate_ticket(ticket_id, admin_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()
    return result


@router.get("/sla-stats")
async def get_sla_stats(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """SLA-сводка по приоритетам тикетов."""
    svc = SuperadminService(db)
    return await svc.get_sla_stats()


# ── Настройки ────────────────────────────────────────────────

@router.get("/settings")
async def get_platform_settings(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Глобальные настройки платформы (эффективные значения = БД override → .env)."""
    svc = SuperadminService(db)
    return await svc.get_platform_settings()


@router.post("/settings")
async def update_platform_settings(
    updates: dict,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Обновить системные настройки платформы (без деплоя).
    Применяется к рантайму (AI-провайдер, timezone, флаги)."""
    svc = SuperadminService(db)
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    try:
        result = await svc.update_platform_settings(updates, admin_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return result


# ── Аналитика роста ──────────────────────────────────────────

@router.get("/growth")
async def get_growth_analytics(
    period_days: int = Query(90, ge=7, le=365),
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Воронка регистрации, retention-когорты, revenue waterfall, топ-города."""
    svc = SuperadminService(db)
    return await svc.get_growth_analytics(period_days)


# ── Промо-коды платформы ─────────────────────────────────────

@router.get("/promo-codes")
async def list_promo_codes(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Список промо-кодов платформы."""
    from sqlalchemy import select
    from app.modules.core.models import PlatformPromoCode

    result = await db.execute(
        select(PlatformPromoCode).order_by(PlatformPromoCode.created_at.desc())
    )
    codes = result.scalars().all()
    return [
        {
            "id": c.id,
            "code": c.code,
            "plan": c.plan,
            "duration_days": c.duration_days,
            "max_uses": c.max_uses,
            "used_count": c.used_count,
            "valid_until": str(c.valid_until) if c.valid_until else None,
            "is_active": c.is_active,
            "created_by": c.created_by,
            "note": c.note,
            "created_at": str(c.created_at),
        }
        for c in codes
    ]


@router.post("/promo-codes")
async def create_promo_code(
    req: CreatePromoCodeRequest,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Создать промо-код платформы."""
    from datetime import date as date_type
    from sqlalchemy import select
    from app.modules.core.models import PlatformPromoCode

    code_str = req.code.upper().strip()
    existing = await db.execute(
        select(PlatformPromoCode).where(PlatformPromoCode.code == code_str)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Promo code already exists")

    valid_until = None
    if req.valid_until:
        try:
            valid_until = date_type.fromisoformat(req.valid_until)
        except ValueError:
            raise HTTPException(
                status_code=400, detail="valid_until must be ISO date (YYYY-MM-DD)"
            )

    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    code = PlatformPromoCode(
        code=code_str,
        plan=req.plan,
        duration_days=req.duration_days,
        max_uses=req.max_uses,
        valid_until=valid_until,
        created_by=admin_id,
        note=req.note,
    )
    db.add(code)

    svc = SuperadminService(db)
    await svc.log_action(
        admin_id=admin_id,
        action="create_promo_code",
        entity_type="platform_promo_code",
        payload={
            "code": code_str,
            "plan": req.plan,
            "duration_days": req.duration_days,
        },
    )
    await db.commit()
    return {"id": code.id, "code": code.code, "created": True}


@router.patch("/promo-codes/{code_id}/deactivate")
async def deactivate_promo_code(
    code_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Деактивировать промо-код."""
    from sqlalchemy import select
    from app.modules.core.models import PlatformPromoCode

    result = await db.execute(
        select(PlatformPromoCode).where(PlatformPromoCode.id == code_id)
    )
    code = result.scalar_one_or_none()
    if not code:
        raise HTTPException(status_code=404, detail="Promo code not found")

    code.is_active = False

    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    svc = SuperadminService(db)
    await svc.log_action(
        admin_id=admin_id,
        action="deactivate_promo_code",
        entity_type="platform_promo_code",
        entity_id=code.id,
        payload={"code": code.code},
    )
    await db.commit()
    return {"id": code.id, "is_active": False}


# ── Ручная выдача доступа ────────────────────────────────────

@router.post("/masters/{master_id}/grant-access")
async def grant_access_to_master(
    master_id: int,
    req: GrantAccessRequest,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Выдать доступ мастеру вручную (manual grant)."""
    from datetime import date, timedelta
    from sqlalchemy import select
    from app.modules.core.models import AccessGrant
    from app.modules.masters.models import Master
    from app.modules.notifications.service import NotificationService
    from app.core.config import settings

    master = (await db.execute(
        select(Master).where(Master.id == master_id)
    )).scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    valid_until = date.today() + timedelta(days=req.duration_days)
    grant = AccessGrant(
        master_id=master_id,
        grant_type="manual",
        plan=req.plan,
        valid_until=valid_until,
        granted_by=admin_id,
        note=req.note,
    )
    db.add(grant)

    # Синхронизируем current_plan мастера с выданным грантом
    master.current_plan = req.plan

    svc = SuperadminService(db)
    await svc.log_action(
        admin_id=admin_id,
        action="grant_access",
        entity_type="master",
        entity_id=master_id,
        payload={
            "plan": req.plan,
            "duration_days": req.duration_days,
            "valid_until": str(valid_until),
        },
    )

    # Уведомление мастеру
    try:
        await NotificationService.send_by_master_id(
            db,
            master_id,
            f"🎁 Вам выдан доступ к тарифу «{req.plan}» на "
            f"{req.duration_days} дней (до {valid_until}).",
            button_text="Открыть приложение",
            button_url=settings.APP_URL,
        )
    except Exception:
        pass

    await db.commit()
    return {
        "id": grant.id,
        "master_id": master_id,
        "plan": req.plan,
        "valid_until": str(valid_until),
        "granted": True,
    }


@router.get("/masters/{master_id}/access-grants")
async def get_master_access_grants(
    master_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """История грантов доступа мастера."""
    from sqlalchemy import select
    from app.modules.core.models import AccessGrant

    result = await db.execute(
        select(AccessGrant)
        .where(AccessGrant.master_id == master_id)
        .order_by(AccessGrant.created_at.desc())
    )
    grants = result.scalars().all()
    return [
        {
            "id": g.id,
            "grant_type": g.grant_type,
            "plan": g.plan,
            "valid_until": str(g.valid_until),
            "promo_code": g.promo_code,
            "granted_by": g.granted_by,
            "note": g.note,
            "created_at": str(g.created_at),
        }
        for g in grants
    ]


# ── Удаление мастера ─────────────────────────────────────────

@router.delete("/masters/{master_id}")
async def delete_master(
    master_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Полное удаление мастера и всех связанных данных из БД."""
    from sqlalchemy import select, delete as sa_delete, text
    from app.modules.masters.models import Master

    master = (await db.execute(
        select(Master).where(Master.id == master_id)
    )).scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    master_name = master.display_name or f"id={master_id}"
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))

    # Удаляем записи из таблиц с NO ACTION FK (CASCADE-таблицы удалятся автоматически)
    no_action_tables = [
        "loyalty_transactions",
        "loyalty_accounts",
        "master_subscriptions",
        "client_reviews",
        "payments",
        "referrals",
        "client_subscriptions",
        "master_payouts",
    ]
    for table in no_action_tables:
        await db.execute(text(f"DELETE FROM {table} WHERE master_id = :mid"), {"mid": master_id})

    # Логируем до удаления самого мастера
    svc = SuperadminService(db)
    await svc.log_action(
        admin_id=admin_id,
        action="delete_master",
        entity_type="master",
        entity_id=master_id,
        payload={"display_name": master_name},
    )

    # Удаляем identity мастера, чтобы при следующем входе он прошёл
    # онбординг как новый пользователь (а не попал в пустой дашборд).
    from app.modules.auth.models import Identity
    identity_id = master.identity_id
    await db.delete(master)

    if identity_id:
        identity = (await db.execute(
            select(Identity).where(Identity.id == identity_id)
        )).scalar_one_or_none()
        if identity:
            await db.delete(identity)

    await db.commit()

    return {"deleted": True, "master_id": master_id, "display_name": master_name}


# ── Broadcast от платформы (ТЗ 8.5) ──────────────────────────

@router.post("/broadcast/preview")
async def preview_broadcast(
    req: BroadcastPreviewRequest,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Сколько мастеров получит рассылку при текущих фильтрах."""
    from sqlalchemy import select, func
    from app.modules.masters.models import Master

    q = select(func.count(Master.id))
    if req.plan_filter:
        q = q.where(Master.current_plan == req.plan_filter)
    if req.only_active:
        q = q.where(Master.is_active.is_(True))
    count = (await db.execute(q)).scalar() or 0
    return {"recipients": int(count)}


@router.post("/broadcast/send")
async def send_broadcast(
    req: BroadcastRequest,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Системная рассылка от платформы по мастерам."""
    svc = SuperadminService(db)
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    result = await svc.broadcast_to_masters(
        admin_id=admin_id,
        text=req.text,
        plan_filter=req.plan_filter,
        only_active=req.only_active,
        button_text=req.button_text,
        button_url=req.button_url,
    )
    await db.commit()
    return result


# ── Модераторы (управление командой) ──────────────────────────


class AddModeratorRequest(PydanticBaseModel):
    platform_id: str = Field(..., min_length=1, max_length=50)
    platform: str = "telegram"


@router.get("/moderators")
async def list_moderators(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Список всех модераторов."""
    from sqlalchemy import select
    from app.modules.auth.models import Identity

    result = await db.execute(
        select(Identity)
        .where(Identity.role == "moderator")
        .order_by(Identity.created_at.desc())
    )
    moderators = result.scalars().all()
    return [
        {
            "id": m.id,
            "platform": m.platform,
            "platform_id": m.platform_id,
            "role": m.role,
            "created_at": str(m.created_at),
        }
        for m in moderators
    ]


@router.post("/moderators")
async def add_moderator(
    req: AddModeratorRequest,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Назначить пользователя модератором по platform_id.

    Если identity с таким platform+platform_id существует — меняем роль.
    Если не существует — создаём новый identity с role='moderator'.
    Отправляем push-уведомление.
    """
    from sqlalchemy import select
    from app.modules.auth.models import Identity
    from app.modules.notifications.service import NotificationService
    from app.core.config import settings

    platform_id = req.platform_id.strip()
    platform = req.platform.strip().lower()

    # Проверяем, не суперадмин ли
    from app.core.auth import is_superadmin
    if is_superadmin(platform_id):
        raise HTTPException(status_code=400, detail="Нельзя назначить суперадмина модератором")

    # Ищем существующую identity
    result = await db.execute(
        select(Identity).where(
            Identity.platform == platform,
            Identity.platform_id == platform_id,
        )
    )
    identity = result.scalar_one_or_none()

    if identity:
        if identity.role == "moderator":
            raise HTTPException(status_code=409, detail="Уже является модератором")
        identity.role = "moderator"
    else:
        identity = Identity(
            platform=platform,
            platform_id=platform_id,
            role="moderator",
        )
        db.add(identity)

    # Audit
    svc = SuperadminService(db)
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    await svc.log_action(
        admin_id=admin_id,
        action="add_moderator",
        entity_type="identity",
        entity_id=identity.id if identity.id else None,
        payload={"platform": platform, "platform_id": platform_id},
    )

    await db.commit()
    if identity.id:
        await db.refresh(identity)

    # Уведомление
    try:
        await NotificationService.send_to_client(
            platform=platform,
            platform_id=platform_id,
            text="👮 Вам предоставлен доступ модератора.\nОткройте приложение для работы с тикетами.",
            button_text="Открыть",
            button_url=settings.APP_URL,
        )
    except Exception:
        pass

    return {
        "id": identity.id,
        "platform": identity.platform,
        "platform_id": identity.platform_id,
        "role": identity.role,
        "created": True,
    }


@router.delete("/moderators/{identity_id}")
async def remove_moderator(
    identity_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Снять роль модератора (возвращает в client)."""
    from sqlalchemy import select
    from app.modules.auth.models import Identity

    result = await db.execute(
        select(Identity).where(Identity.id == identity_id)
    )
    identity = result.scalar_one_or_none()
    if not identity:
        raise HTTPException(status_code=404, detail="Identity not found")
    if identity.role != "moderator":
        raise HTTPException(status_code=400, detail="Пользователь не является модератором")

    identity.role = "client"

    svc = SuperadminService(db)
    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    await svc.log_action(
        admin_id=admin_id,
        action="remove_moderator",
        entity_type="identity",
        entity_id=identity_id,
        payload={"platform_id": identity.platform_id},
    )

    await db.commit()
    return {"id": identity_id, "role": "client", "removed": True}
