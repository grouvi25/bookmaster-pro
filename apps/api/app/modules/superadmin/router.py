"""
Superadmin router — /api/v1/superadmin
Платформенный дашборд, управление мастерами, health checks, настройки.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
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
