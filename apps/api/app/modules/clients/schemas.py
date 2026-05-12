"""
Clients CRM schemas.
"""

from datetime import date
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


class ClientCRMUpdate(BaseModel):
    tags: Optional[List[str]] = None
    master_notes: Optional[str] = None
