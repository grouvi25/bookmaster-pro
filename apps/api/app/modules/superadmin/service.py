"""
Superadmin service — платформенная аналитика, управление мастерами, health checks.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.modules.masters.models import Master
from app.modules.auth.models import Identity
from app.modules.booking.models import Appointment
from app.modules.payments.models import Payment, MasterSubscription
from app.modules.clients.models import Client
from app.modules.superadmin.models import AdminAuditLog
from app.core.config import settings

logger = logging.getLogger(__name__)

PLAN_PRICES = {
    "start": 0,
    "basic": 490,
    "pro": 990,
    "pro_ai": 1490,
    "business": 2490,
}


class SuperadminService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self) -> dict:
        now = datetime.now(timezone.utc)
        month_ago = now - timedelta(days=30)

        # Total masters
        total_r = await self.db.execute(select(func.count(Master.id)))
        total_masters = total_r.scalar() or 0

        # Active masters (at least 1 appointment in 30 days)
        active_r = await self.db.execute(
            select(func.count(func.distinct(Appointment.master_id))).where(
                Appointment.created_at >= month_ago
            )
        )
        active_masters = active_r.scalar() or 0

        # New masters in 30 days
        new_r = await self.db.execute(
            select(func.count(Master.id)).where(Master.created_at >= month_ago)
        )
        new_masters = new_r.scalar() or 0

        # Total clients
        clients_r = await self.db.execute(select(func.count(Client.id)))
        total_clients = clients_r.scalar() or 0

        # Total appointments
        appts_r = await self.db.execute(select(func.count(Appointment.id)))
        total_appointments = appts_r.scalar() or 0

        # Total revenue (payments)
        rev_r = await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_paid), 0)).where(
                Payment.status == "succeeded"
            )
        )
        total_revenue = float(rev_r.scalar() or 0)

        # MRR — from active subscriptions
        mrr_r = await self.db.execute(
            select(func.coalesce(func.sum(MasterSubscription.price), 0)).where(
                MasterSubscription.status == "active"
            )
        )
        mrr = float(mrr_r.scalar() or 0)

        # Plan distribution
        plan_r = await self.db.execute(
            select(Master.current_plan, func.count(Master.id))
            .group_by(Master.current_plan)
        )
        plan_distribution = {row[0]: row[1] for row in plan_r.all()}

        # Churn rate
        churn_rate = 0.0
        if total_masters > 0:
            inactive = total_masters - active_masters
            churn_rate = round(inactive / total_masters * 100, 1)

        # Conversion rate
        total_identities_r = await self.db.execute(select(func.count(Identity.id)))
        total_identities = total_identities_r.scalar() or 1
        conversion_rate = round(total_masters / total_identities * 100, 1) if total_identities else 0

        # Appointments by day (last 30 days)
        days_r = await self.db.execute(
            select(
                Appointment.date,
                func.count(Appointment.id),
            )
            .where(Appointment.date >= month_ago.date())
            .group_by(Appointment.date)
            .order_by(Appointment.date)
        )
        by_day = [{"date": str(row[0]), "count": row[1]} for row in days_r.all()]

        return {
            "mrr": mrr,
            "arr": mrr * 12,
            "total_masters": total_masters,
            "active_masters": active_masters,
            "new_masters_30d": new_masters,
            "total_clients": total_clients,
            "total_appointments": total_appointments,
            "total_revenue": total_revenue,
            "avg_revenue_per_master": total_revenue / total_masters if total_masters else 0,
            "churn_rate_30d": churn_rate,
            "conversion_rate": conversion_rate,
            "plan_distribution": plan_distribution,
            "appointments_by_day": by_day,
        }

    async def get_masters_list(
        self,
        plan_filter: Optional[str] = None,
        verified_filter: Optional[bool] = None,
        search: Optional[str] = None,
        page: int = 1,
        per_page: int = 50,
    ) -> Tuple[List[Master], int]:
        q = select(Master)
        count_q = select(func.count(Master.id))

        if plan_filter:
            q = q.where(Master.current_plan == plan_filter)
            count_q = count_q.where(Master.current_plan == plan_filter)
        if verified_filter is not None:
            q = q.where(Master.is_verified == verified_filter)
            count_q = count_q.where(Master.is_verified == verified_filter)
        if search:
            q = q.where(Master.display_name.ilike(f"%{search}%"))
            count_q = count_q.where(Master.display_name.ilike(f"%{search}%"))

        q = q.order_by(Master.created_at.desc()).offset((page - 1) * per_page).limit(per_page)

        result = await self.db.execute(q)
        masters = list(result.scalars().all())

        total_r = await self.db.execute(count_q)
        total = total_r.scalar() or 0

        return masters, total

    async def update_master(
        self,
        master_id: int,
        is_verified: Optional[bool] = None,
        is_active: Optional[bool] = None,
        current_plan: Optional[str] = None,
        admin_id: str = "system",
    ) -> Optional[Master]:
        master = await self.db.get(Master, master_id)
        if not master:
            return None

        changes = {}
        if is_verified is not None:
            master.is_verified = is_verified
            changes["is_verified"] = is_verified
        if is_active is not None:
            master.is_active = is_active
            changes["is_active"] = is_active
        if current_plan is not None:
            master.current_plan = current_plan
            changes["current_plan"] = current_plan

        # Audit log
        if changes:
            log = AdminAuditLog(
                admin_id=admin_id,
                action="update_master",
                entity_type="master",
                entity_id=master_id,
                payload=changes,
            )
            self.db.add(log)

        await self.db.flush()
        return master

    async def run_health_checks(self) -> dict:
        """Проверка состояния всех сервисов."""
        checks = {}

        # DB
        try:
            r = await self.db.execute(select(func.now()))
            r.scalar()
            checks["database"] = {"status": "ok"}
        except Exception as e:
            checks["database"] = {"status": "error", "detail": str(e)}

        # Redis
        try:
            from app.core.redis import get_redis
            redis = await get_redis()
            await redis.ping()
            checks["redis"] = {"status": "ok"}
        except Exception as e:
            checks["redis"] = {"status": "error", "detail": str(e)}

        # S3
        checks["s3"] = {
            "status": "ok" if settings.S3_ACCESS_KEY_ID else "not_configured",
            "bucket": settings.S3_BUCKET_NAME,
        }

        # OpenAI
        checks["openai"] = {
            "status": "ok" if settings.OPENAI_API_KEY else "not_configured",
        }

        # ЮKassa
        checks["yookassa"] = {
            "status": "ok" if settings.YOOKASSA_SHOP_ID else "not_configured",
        }

        # TG Bot
        checks["telegram_bot"] = {
            "status": "ok" if settings.TG_BOT_TOKEN else "not_configured",
        }

        # MAX Bot
        checks["max_bot"] = {
            "status": "ok" if settings.MAX_BOT_TOKEN else "not_configured",
        }

        # Overall status
        statuses = [c.get("status") for c in checks.values()]
        if all(s == "ok" for s in statuses):
            overall = "healthy"
        elif any(s == "error" for s in statuses):
            overall = "degraded"
        else:
            overall = "ok"

        return {"status": overall, "checks": checks}

    async def log_action(
        self,
        admin_id: str,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        payload: Optional[dict] = None,
    ):
        log = AdminAuditLog(
            admin_id=admin_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            payload=payload,
        )
        self.db.add(log)
        await self.db.flush()
