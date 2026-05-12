"""
Analytics service — дашборд аналитики мастера.
Метрики: выручка, записи, топ-услуги, воронка, когорты.
"""

from datetime import datetime, timedelta, date, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, cast, Date

from app.modules.booking.models import Appointment, AppointmentStatus
from app.modules.services.models import Service
from app.modules.payments.models import Payment
from app.modules.masters.models import Master


class AnalyticsService:

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, master_id: int) -> dict:
        now = datetime.now(timezone.utc)
        today = now.date()
        week_ago = today - timedelta(days=7)
        month_ago = today - timedelta(days=30)

        # Today
        today_stats = await self._period_stats(master_id, today, today)
        week_stats = await self._period_stats(master_id, week_ago, today)
        month_stats = await self._period_stats(master_id, month_ago, today)

        # Master cached stats
        master = await self.db.get(Master, master_id)

        # Top services (month)
        top_services = await self._top_services(master_id, month_ago, today, limit=5)

        # Status breakdown
        status_breakdown = await self._status_breakdown(master_id, month_ago, today)

        return {
            "today_appointments": today_stats["total"],
            "today_completed": today_stats["completed"],
            "today_cancelled": today_stats["cancelled"],
            "today_revenue": today_stats["revenue"],
            "week_appointments": week_stats["total"],
            "week_revenue": week_stats["revenue"],
            "month_appointments": month_stats["total"],
            "month_revenue": month_stats["revenue"],
            "total_clients": master.total_clients if master else 0,
            "total_appointments": master.total_appointments if master else 0,
            "rating_avg": master.rating_avg if master else 0.0,
            "rating_count": master.rating_count if master else 0,
            "top_services": top_services,
            "appointments_by_status": status_breakdown,
        }

    async def get_revenue(
        self, master_id: int, date_from: date, date_to: date
    ) -> dict:
        # Total revenue from payments
        r = await self.db.execute(
            select(
                func.coalesce(func.sum(Payment.amount_paid), 0),
                func.count(Payment.id),
            ).where(
                Payment.master_id == master_id,
                Payment.status == "succeeded",
                cast(Payment.created_at, Date) >= date_from,
                cast(Payment.created_at, Date) <= date_to,
            )
        )
        row = r.one()
        total_revenue = float(row[0])
        row[1]

        # Appointments count
        r2 = await self.db.execute(
            select(func.count(Appointment.id)).where(
                Appointment.master_id == master_id,
                Appointment.status == AppointmentStatus.COMPLETED.value,
                Appointment.date >= date_from,
                Appointment.date <= date_to,
            )
        )
        appts_count = r2.scalar() or 0

        # Revenue by day
        r3 = await self.db.execute(
            select(
                cast(Payment.created_at, Date).label("day"),
                func.sum(Payment.amount_paid).label("revenue"),
            )
            .where(
                Payment.master_id == master_id,
                Payment.status == "succeeded",
                cast(Payment.created_at, Date) >= date_from,
                cast(Payment.created_at, Date) <= date_to,
            )
            .group_by("day")
            .order_by("day")
        )
        by_day = [{"date": str(row[0]), "revenue": float(row[1])} for row in r3.all()]

        days = (date_to - date_from).days or 1
        period = f"{days} days"

        return {
            "period": period,
            "total_revenue": total_revenue,
            "online_revenue": total_revenue,
            "appointments_count": appts_count,
            "avg_check": total_revenue / appts_count if appts_count else 0,
            "revenue_by_day": by_day,
        }

    async def get_funnel(self, master_id: int, days: int = 30) -> dict:
        date_from = datetime.now(timezone.utc).date() - timedelta(days=days)

        r = await self.db.execute(
            select(
                func.count(Appointment.id).label("total"),
                func.count(case(
                    (Appointment.status == AppointmentStatus.COMPLETED.value, 1)
                )).label("completed"),
                func.count(case(
                    (Appointment.status.in_([
                        AppointmentStatus.CANCELLED_BY_CLIENT.value,
                        AppointmentStatus.CANCELLED_BY_MASTER.value,
                    ]), 1)
                )).label("cancelled"),
                func.count(case(
                    (Appointment.status == AppointmentStatus.NO_SHOW.value, 1)
                )).label("no_show"),
            ).where(
                Appointment.master_id == master_id,
                Appointment.date >= date_from,
            )
        )
        row = r.one()
        total = row[0] or 1

        return {
            "period_days": days,
            "total_bookings": row[0],
            "completed": row[1],
            "cancelled": row[2],
            "no_show": row[3],
            "completion_rate": round(row[1] / total * 100, 1),
            "cancellation_rate": round(row[2] / total * 100, 1),
            "no_show_rate": round(row[3] / total * 100, 1),
        }

    # ── Helpers ──

    async def _period_stats(self, master_id: int, d_from: date, d_to: date) -> dict:
        r = await self.db.execute(
            select(
                func.count(Appointment.id),
                func.count(case(
                    (Appointment.status == AppointmentStatus.COMPLETED.value, 1)
                )),
                func.count(case(
                    (Appointment.status.in_([
                        AppointmentStatus.CANCELLED_BY_CLIENT.value,
                        AppointmentStatus.CANCELLED_BY_MASTER.value,
                    ]), 1)
                )),
            ).where(
                Appointment.master_id == master_id,
                Appointment.date >= d_from,
                Appointment.date <= d_to,
            )
        )
        row = r.one()

        # Revenue
        r2 = await self.db.execute(
            select(func.coalesce(func.sum(Payment.amount_paid), 0)).where(
                Payment.master_id == master_id,
                Payment.status == "succeeded",
                cast(Payment.created_at, Date) >= d_from,
                cast(Payment.created_at, Date) <= d_to,
            )
        )
        revenue = float(r2.scalar() or 0)

        return {
            "total": row[0],
            "completed": row[1],
            "cancelled": row[2],
            "revenue": revenue,
        }

    async def _top_services(
        self, master_id: int, d_from: date, d_to: date, limit: int = 5
    ) -> list:
        r = await self.db.execute(
            select(
                Appointment.service_id,
                Service.name,
                func.count(Appointment.id).label("cnt"),
                func.coalesce(func.sum(Appointment.price_final), 0).label("rev"),
            )
            .join(Service, Service.id == Appointment.service_id, isouter=True)
            .where(
                Appointment.master_id == master_id,
                Appointment.status == AppointmentStatus.COMPLETED.value,
                Appointment.date >= d_from,
                Appointment.date <= d_to,
            )
            .group_by(Appointment.service_id, Service.name)
            .order_by(func.count(Appointment.id).desc())
            .limit(limit)
        )
        return [
            {"service_id": row[0], "name": row[1] or "?", "count": row[2], "revenue": float(row[3])}
            for row in r.all()
        ]

    async def _status_breakdown(self, master_id: int, d_from: date, d_to: date) -> dict:
        r = await self.db.execute(
            select(
                Appointment.status,
                func.count(Appointment.id),
            )
            .where(
                Appointment.master_id == master_id,
                Appointment.date >= d_from,
                Appointment.date <= d_to,
            )
            .group_by(Appointment.status)
        )
        return {row[0]: row[1] for row in r.all()}
