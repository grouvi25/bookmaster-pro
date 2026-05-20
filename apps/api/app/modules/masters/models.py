"""
Master — профиль мастера.
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, Text, Float,
    ForeignKey, JSON,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship

from app.core.base_model import BaseModel


class Master(BaseModel):
    __tablename__ = "masters"

    identity_id = Column(
        Integer, ForeignKey("identities.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    # Основные данные
    display_name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    specialization = Column(String(100), nullable=True)
    specialization_tags = Column(ARRAY(String), default=list)  # ['гель-лак','наращивание',...]
    description = Column(Text, nullable=True)
    welcome_message = Column(Text, nullable=True)  # приветствие в боте/мини-апп
    avatar_url = Column(String(500), nullable=True)
    cover_url = Column(String(500), nullable=True)

    # Контакты
    phone = Column(String(20), nullable=True)
    city = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)

    # Геолокация
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Настройки
    accept_online_payment = Column(Boolean, default=False)
    yookassa_account_id = Column(String(100), nullable=True)
    noshow_deposit_amount = Column(Integer, default=0)
    noshow_prepay_percent = Column(Integer, default=0)
    noshow_ai_threshold = Column(Integer, default=70)
    noshow_blacklist_count = Column(Integer, default=2)
    buffer_minutes = Column(Integer, default=0)

    # Уведомления — настройки
    notify_new_booking = Column(Boolean, default=True)
    notify_cancel = Column(Boolean, default=True)
    notify_reminder = Column(Boolean, default=True)
    notify_review = Column(Boolean, default=True)
    notify_no_show = Column(Boolean, default=True)

    # Лояльность — настройки
    loyalty_earn_rate = Column(Integer, default=10)  # 1 балл = N рублей
    loyalty_first_visit_bonus = Column(Integer, default=200)
    loyalty_review_bonus = Column(Integer, default=50)
    loyalty_birthday_bonus = Column(Integer, default=300)
    loyalty_referral_bonus = Column(Integer, default=500)
    loyalty_max_spend_percent = Column(Integer, default=30)

    # Страница-линк (TapLink-like)
    link_page_enabled = Column(Boolean, default=True)
    link_page_theme = Column(String(50), default="default")
    link_page_links = Column(JSON, default=list)

    # Тариф
    tariff_type = Column(String(5), default="B")  # 'A'(комиссия) | 'B'(абонемент)
    current_plan = Column(String(20), default="start")
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # Рейтинг (кэшированный)
    rating_avg = Column(Float, default=0.0)
    rating_count = Column(Integer, default=0)
    total_clients = Column(Integer, default=0)
    total_appointments = Column(Integer, default=0)

    # Relationships
    identity = relationship("Identity", backref="master", uselist=False)
    services = relationship("Service", back_populates="master", cascade="all, delete-orphan")
    schedule_templates = relationship(
        "ScheduleTemplate", back_populates="master", cascade="all, delete-orphan"
    )
    locations = relationship("MasterLocation", back_populates="master", cascade="all, delete-orphan")


class MasterLocation(BaseModel):
    __tablename__ = "master_locations"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    address = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    master = relationship("Master", back_populates="locations")


class MasterPage(BaseModel):
    """TapLink-подобная публичная страница мастера."""
    __tablename__ = "master_pages"

    master_id = Column(
        Integer, ForeignKey("masters.id", ondelete="CASCADE"), unique=True, nullable=False
    )

    theme = Column(String(50), default="default")  # preset name: default|dark|warm|ocean|minimal|rose
    theme_config = Column(JSON, default=dict)  # полная кастомизация визуала (см. ТЗ)
    custom_links = Column(JSON, default=list)
    cover_image_url = Column(String(500), nullable=True)  # header cover image (S3)
    show_reviews = Column(Boolean, default=True)
    show_portfolio = Column(Boolean, default=True)
    show_services = Column(Boolean, default=True)
    show_prices = Column(Boolean, default=True)
    bio_text = Column(Text, nullable=True)
    custom_domain = Column(String(200), nullable=True)
    seo_title = Column(String(200), nullable=True)
    seo_description = Column(Text, nullable=True)

    master = relationship("Master", backref="page", uselist=False)
