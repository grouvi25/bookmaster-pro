"""
Data import router — /api/v1/import
Импорт клиентов и услуг из CSV/XLSX (Yclients, Dikidi, и др.)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.modules.masters.service import MasterService
from app.modules.data_import.service import (
    parse_file_bytes,
    preview_clients,
    preview_services,
    execute_client_import,
    execute_service_import,
)
from app.modules.data_import.schemas import ImportConfirm

router = APIRouter()


async def _get_master(user: dict, db: AsyncSession):
    master = await MasterService(db).get_by_identity(int(user["sub"]))
    if not master:
        raise HTTPException(status_code=403, detail="Not a master")
    return master


@router.post("/preview")
async def import_preview(
    file: UploadFile = File(...),
    import_type: str = Query("clients", regex="^(clients|services)$"),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Загрузить файл и получить превью импорта.
    import_type: clients | services
    Поддерживаемые форматы: CSV, XLSX
    """
    master = await _get_master(user, db)

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file")

    ext = file.filename.lower().split(".")[-1]
    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(
            status_code=400,
            detail="Поддерживаются только CSV и XLSX файлы",
        )

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 10 МБ)")

    headers, rows = parse_file_bytes(content, file.filename)

    if not headers or not rows:
        raise HTTPException(
            status_code=400,
            detail="Не удалось прочитать файл — проверьте формат",
        )

    if import_type == "clients":
        result = preview_clients(headers, rows, master.id)
    else:
        result = preview_services(headers, rows, master.id)

    result["file_name"] = file.filename
    return result


@router.post("/confirm")
async def import_confirm(
    body: ImportConfirm,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Подтвердить импорт после превью.
    Можно переопределить column_mapping.
    """
    master = await _get_master(user, db)

    from app.modules.data_import.service import _import_sessions
    session = _import_sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сессия импорта не найдена или истекла")

    if session["master_id"] != master.id:
        raise HTTPException(status_code=403, detail="Чужая сессия")

    custom_mapping = None
    if body.column_mapping:
        custom_mapping = body.column_mapping

    if session["type"] == "clients":
        result = await execute_client_import(body.session_id, db, custom_mapping)
    else:
        result = await execute_service_import(body.session_id, db, custom_mapping)

    return result
