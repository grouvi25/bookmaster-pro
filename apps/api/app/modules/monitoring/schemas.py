"""
Monitoring schemas.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


class ErrorEventOut(BaseModel):
    id: int
    fingerprint: str
    error_type: str
    error_msg: str
    module: Optional[str] = None
    stack_trace: Optional[str] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    count: int = 1
    status: str = "new"
    severity: str = "error"
    request_id: Optional[str] = None


class ErrorEventsListOut(BaseModel):
    items: List[ErrorEventOut]
    total: int


class ErrorStatusUpdate(BaseModel):
    status: str  # resolved | acknowledged | ignored | new


class ErrorSolutionOut(BaseModel):
    id: int
    fingerprint: str
    solution: str
    added_by: Optional[str] = None
    is_verified: bool = False
    created_at: Optional[datetime] = None


class SolutionCreate(BaseModel):
    fingerprint: str
    solution: str


class BackupInfoOut(BaseModel):
    date: str
    size: Optional[str] = None
    status: str = "unknown"
    postgres_file: Optional[str] = None
    redis_file: Optional[str] = None
