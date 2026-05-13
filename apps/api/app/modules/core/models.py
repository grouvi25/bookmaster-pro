"""
FeatureFlags — тарифные ограничения per-мастер.
SystemSetting — ключ-значение системных настроек (без деплоя).
"""

from sqlalchemy import Column, Integer, Boolean, String, Text, ForeignKey

from app.core.base_model import BaseModel, TimestampMixin
from app.core.database import Base


class SystemSetting(BaseModel):
    __tablename__ = "system_settings"

    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    description = Column(Text, nullable=True)


class FeatureFlags(Base, TimestampMixin):
    __tablename__ = "feature_flags"

    master_id = Column(
        Integer,
        ForeignKey("masters.id", ondelete="CASCADE"),
        primary_key=True,
    )

    # Модули
    booking_enabled = Column(Boolean, default=True)
    crm_basic = Column(Boolean, default=False)
    crm_advanced = Column(Boolean, default=False)
    promo_enabled = Column(Boolean, default=False)
    loyalty_enabled = Column(Boolean, default=False)
    client_subscriptions = Column(Boolean, default=False)
    waitlist_enabled = Column(Boolean, default=False)
    analytics_enabled = Column(Boolean, default=False)
    ai_advisor = Column(Boolean, default=False)
    ai_client_bot = Column(Boolean, default=False)
    ai_voice = Column(Boolean, default=False)
    portfolio_enabled = Column(Boolean, default=False)
    marketplace_enabled = Column(Boolean, default=False)
    marketplace_featured = Column(Boolean, default=False)
    widget_enabled = Column(Boolean, default=False)
    consultations_enabled = Column(Boolean, default=False)
    multi_location = Column(Boolean, default=False)
    reviews_enabled = Column(Boolean, default=False)
    broadcast_enabled = Column(Boolean, default=False)

    # Лимиты
    max_bookings_per_month = Column(Integer, default=30)
    max_services = Column(Integer, default=3)
    max_locations = Column(Integer, default=1)
    ai_tokens_monthly = Column(Integer, default=0)

    # Комиссия (базисные пункты: 700 = 7.00%)
    commission_rate_bp = Column(Integer, default=700)
