"""
Базовая модель для всех таблиц.
Добавляет id, created_at, updated_at автоматически.
"""

from sqlalchemy import Column, Integer, DateTime, func
from sqlalchemy.orm import declared_attr

from app.core.database import Base


class TimestampMixin:
    """Добавляет created_at и updated_at ко всем моделям."""

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class BaseModel(Base, TimestampMixin):
    """Абстрактная база: id + timestamps."""

    __abstract__ = True

    id = Column(Integer, primary_key=True, autoincrement=True)

    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower() + "s"

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}(id={self.id})>"
