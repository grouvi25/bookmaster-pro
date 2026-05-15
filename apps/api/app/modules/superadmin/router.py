"""
Superadmin router — /api/v1/superadmin
Платформенный дашборд, управление мастерами, health checks, настройки.
Промо-коды платформы, ручная выдача доступа.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel as PydanticBaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_current_user, is_superadmin
from app.modules.superadmin.service import SuperadminService
from app.modules.superadmin.schemas import (
    SuperadminDashboard,
    MasterAdminListItem,
    MasterAdminUpdate,
    HealthCheckResponse,
)


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

router = APIRouter()


def _require_superadmin(user: dict = Depends(get_current_user)):
    platform_id = user.get("platform_id") or str(user.get("identity_id", ""))
    if not is_superadmin(platform_id):
        raise HTTPException(status_code=403, detail="Superadmin access required")
    return user


@router.get("/dashboard", response_model=SuperadminDashboard)
async def get_dashboard(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Платформенная аналитика: MRR, ARR, churn, конверсии."""
    svc = SuperadminService(db)
    return await svc.get_dashboard()


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
                current_plan=m.current_plan,
                is_verified=m.is_verified,
                is_active=m.is_active,
                rating_avg=m.rating_avg,
                total_clients=m.total_clients,
                total_appointments=m.total_appointments,
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
    """Обновить мастера (верификация, план, активность)."""
    svc = SuperadminService(db)
    admin_id = str(user.get("identity_id", "system"))
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


@router.get("/health", response_model=HealthCheckResponse)
async def health_checks(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Проверка состояния всех сервисов (DB, Redis, S3, ЮKassa, OpenAI, TG Bot)."""
    svc = SuperadminService(db)
    return await svc.run_health_checks()


@router.get("/audit-log")
async def get_audit_log(
    limit: int = Query(50, ge=1, le=200),
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Лог действий администраторов."""
    from app.modules.superadmin.models import AdminAuditLog
    from sqlalchemy import select

    result = await db.execute(
        select(AdminAuditLog).order_by(AdminAuditLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
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
    """Финансовый дашборд: выручка, MRR, возвраты, динамика."""
    svc = SuperadminService(db)
    return await svc.get_finance_dashboard(period_days)


# ── Тикеты ───────────────────────────────────────────────────

@router.get("/tickets")
async def get_tickets_queue(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Очередь тикетов поддержки с SLA-статистикой."""
    svc = SuperadminService(db)
    return await svc.get_tickets_queue(status, page, per_page)


@router.post("/tickets/{ticket_id}/escalate")
async def escalate_ticket(
    ticket_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Эскалировать тикет."""
    svc = SuperadminService(db)
    admin_id = str(user.get("identity_id", "system"))
    result = await svc.escalate_ticket(ticket_id, admin_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.commit()
    return result


# ── Настройки ────────────────────────────────────────────────

@router.get("/settings")
async def get_platform_settings(
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Глобальные настройки платформы: тарифы, флаги, AI-провайдер."""
    svc = SuperadminService(db)
    return await svc.get_platform_settings()


@router.post("/settings")
async def update_platform_settings(
    updates: dict,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Обновить системные настройки платформы (без деплоя)."""
    svc = SuperadminService(db)
    admin_id = str(user.get("identity_id", "system"))
    result = await svc.update_platform_settings(updates, admin_id)
    await db.commit()
    return result


# ── Аналитика роста ──────────────────────────────────────────

@router.get("/growth")
async def get_growth_analytics(
    period_days: int = Query(90, ge=7, le=365),
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Воронка регистрации, retention-когорты, revenue waterfall."""
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

    existing = await db.execute(
        select(PlatformPromoCode).where(PlatformPromoCode.code == req.code.upper())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Promo code already exists")

    valid_until = None
    if req.valid_until:
        valid_until = date_type.fromisoformat(req.valid_until)

    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    code = PlatformPromoCode(
        code=req.code.upper(),
        plan=req.plan,
        duration_days=req.duration_days,
        max_uses=req.max_uses,
        valid_until=valid_until,
        created_by=admin_id,
        note=req.note,
    )
    db.add(code)
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
    """Выдать доступ мастеру вручную (trial/manual/gift)."""
    from datetime import date, timedelta
    from sqlalchemy import select
    from app.modules.core.models import AccessGrant
    from app.modules.masters.models import Master

    result = await db.execute(
        select(Master).where(Master.id == master_id)
    )
    master = result.scalar_one_or_none()
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    admin_id = str(user.get("platform_id") or user.get("identity_id", "system"))
    grant = AccessGrant(
        master_id=master_id,
        grant_type="manual",
        plan=req.plan,
        valid_until=date.today() + timedelta(days=req.duration_days),
        granted_by=admin_id,
        note=req.note,
    )
    db.add(grant)
    await db.commit()
    return {
        "id": grant.id,
        "master_id": master_id,
        "plan": req.plan,
        "valid_until": str(grant.valid_until),
        "granted": True,
    }


@router.get("/masters/{master_id}/access-grants")
async def get_master_access_grants(
    master_id: int,
    user: dict = Depends(_require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Список грантов доступа мастера."""
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
