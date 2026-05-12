"""
Admin audit log.
"""

from sqlalchemy import (
    Column, Integer, String, Text, JSON,
)

from app.core.base_model import BaseModel


class AdminAuditLog(BaseModel):
    __tablename__ = "admin_audit_log"

    admin_id = Column(String(50), nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    payload = Column(JSON, nullable=True)
