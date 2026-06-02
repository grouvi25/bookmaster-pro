"""
Clients CRM schemas.
"""

from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel


class ClientOut(BaseModel):
    id: int
    display_name: str
    phone: Optional[str] = None
    birthday: Optional[date] = None
    avatar_url: Optional[str] = None

    model_config = {"from_attributes": True}


class ClientCRMOut(BaseModel):
    client_id: int
    display_name: str
    phone: Optional[str] = None
    tags: List[str] = []
    master_notes: Optional[str] = None
    first_visit_date: Optional[date] = None
    last_visit_date: Optional[date] = None
    visit_count: int = 0
    total_spent: int = 0
    no_show_count: int = 0
    source: Optional[str] = None


class VisitHistoryItem(BaseModel):
    id: int
    date: datetime
    service_name: str
    status: str
    price: Optional[float] = None


class ClientNoteOut(BaseModel):
    id: int
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ClientDetailOut(BaseModel):
    client_id: int
    display_name: str
    phone: Optional[str] = None
    birthday: Optional[date] = None
    avatar_url: Optional[str] = None
    tags: List[str] = []
    master_notes: Optional[str] = None
    first_visit_date: Optional[date] = None
    last_visit_date: Optional[date] = None
    visit_count: int = 0
    total_spent: int = 0
    no_show_count: int = 0
    source: Optional[str] = None
    visits: List[VisitHistoryItem] = []
    notes: List[ClientNoteOut] = []
    loyalty_balance: int = 0
    loyalty_tier: str = "new"


class ClientCRMUpdate(BaseModel):
    tags: Optional[List[str]] = None
    master_notes: Optional[str] = None


class ClientNoteCreate(BaseModel):
    text: str


class ClientCreate(BaseModel):
    """Ручное создание клиента мастером (раздел «Клиенты»)."""
    name: str
    phone: Optional[str] = None
    birthday: Optional[date] = None
    notes: Optional[str] = None
    tags: Optional[List[str]] = None
