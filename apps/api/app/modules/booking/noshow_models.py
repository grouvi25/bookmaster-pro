"""
No-show log — антиноу-шоу скоринг.
"""

from sqlalchemy import (
    Column, Integer, String, ForeignKey,
)

from app.core.base_model import BaseModel


class ClientNoShowLog(BaseModel):
    __tablename__ = "client_no_show_log"

    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    type = Column(String(30), nullable=True)  # 'no_show' | 'last_minute_cancel'
