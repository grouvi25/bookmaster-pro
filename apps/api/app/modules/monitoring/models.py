"""
Monitoring models — error_events, error_solutions.
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, func

from app.core.database import Base


class ErrorEvent(Base):
    """Агрегированная ошибка (один тип = одна строка)."""
    __tablename__ = "error_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fingerprint = Column(Text, nullable=False, unique=True)
    error_type = Column(Text, nullable=False)
    error_msg = Column(Text, nullable=False)
    module = Column(Text, nullable=True)
    stack_trace = Column(Text, nullable=True)
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now())
    count = Column(Integer, server_default="1")
    status = Column(String(30), server_default="new")
    # status: new | acknowledged | resolved | ignored
    severity = Column(String(30), server_default="error")
    # severity: critical | error | warning
    request_id = Column(Text, nullable=True)
    user_id = Column(Integer, nullable=True)
    notified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ErrorSolution(Base):
    """База знаний: решения для каждой ошибки."""
    __tablename__ = "error_solutions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fingerprint = Column(Text, nullable=False)
    solution = Column(Text, nullable=False)
    added_by = Column(String(30), nullable=True)
    # added_by: admin | ai | auto
    is_verified = Column(Boolean, server_default="false")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
