"""
Data import schemas.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class ColumnMapping(BaseModel):
    """Маппинг колонок файла → поля системы."""
    source_column: str
    target_field: str


class ImportPreviewRow(BaseModel):
    row_num: int
    data: Dict[str, Any]
    status: str = "ok"  # ok | warning | error
    message: Optional[str] = None


class ImportPreview(BaseModel):
    """Превью перед импортом."""
    file_name: str
    import_type: str  # clients | services
    total_rows: int
    valid_rows: int
    error_rows: int
    duplicate_rows: int
    columns_found: List[str]
    column_mapping: Dict[str, str]
    preview_rows: List[ImportPreviewRow]
    session_id: str  # для подтверждения


class ImportConfirm(BaseModel):
    session_id: str
    column_mapping: Optional[Dict[str, str]] = None  # переопределение маппинга


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: int
    details: List[str]
