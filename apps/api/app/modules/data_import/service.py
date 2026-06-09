"""
Data import service — CSV/XLSX parsing for Yclients, Dikidi, generic formats.
Sessions stored in Redis (shared across workers, survives restarts).
"""

import csv
import io
import json
import logging
import re
import uuid
from datetime import date, datetime
from typing import Optional, Dict, List, Any, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── Column name patterns for auto-detection ──

CLIENT_FIELD_PATTERNS: Dict[str, List[str]] = {
    "name": [
        r"имя", r"ф\.?и\.?о", r"фио", r"клиент", r"name", r"client",
        r"display.?name", r"full.?name", r"фамилия.*имя",
    ],
    "phone": [
        r"телефон", r"phone", r"тел\.?$", r"номер", r"mobile", r"tel$",
    ],
    "email": [
        r"e-?mail", r"почта", r"электрон",
    ],
    "birthday": [
        r"дата.?рожд", r"д\.?р\.?$", r"birthday", r"birth.?date", r"др$",
    ],
    "notes": [
        r"заметк", r"коммент", r"примечан", r"notes?$", r"comment",
    ],
    "tags": [
        r"тег", r"tags?$", r"категори.*клиент", r"group",
    ],
    "source": [
        r"источник", r"source", r"откуда",
    ],
    "discount": [
        r"скидк", r"discount",
    ],
    "city": [
        r"город", r"city",
    ],
    "last_visit": [
        r"последн.*визит", r"last.?visit", r"посл.*посещ",
    ],
    "visit_count": [
        r"визит.*кол", r"кол.*визит", r"visit.*count", r"посещен",
    ],
    "total_spent": [
        r"сумм.*потрач", r"total.*spent", r"выручк", r"общ.*сумм",
    ],
}

SERVICE_FIELD_PATTERNS: Dict[str, List[str]] = {
    "name": [
        r"название", r"услуга", r"service", r"name",
    ],
    "description": [
        r"описани", r"description", r"desc$",
    ],
    "duration_min": [
        r"длительн", r"duration", r"время", r"минут", r"мин$",
    ],
    "price": [
        r"цена", r"стоимость", r"price", r"cost", r"тариф",
    ],
    "price_max": [
        r"цена.*макс", r"макс.*цена", r"price.*max", r"до$",
    ],
    "category": [
        r"категори", r"category", r"группа.*услуг", r"раздел",
    ],
    "is_active": [
        r"актив", r"active", r"статус", r"status",
    ],
}


# ── Redis session helpers ──

_SESSION_PREFIX = "import_session:"
_SESSION_TTL = 900  # 15 minutes


async def _save_session(session_id: str, data: dict) -> None:
    """Save import session to Redis with TTL."""
    from app.core.redis import get_redis
    redis = await get_redis()
    await redis.set(
        f"{_SESSION_PREFIX}{session_id}",
        json.dumps(data, ensure_ascii=False, default=str),
        ex=_SESSION_TTL,
    )


async def _get_session(session_id: str) -> Optional[dict]:
    """Get import session from Redis."""
    from app.core.redis import get_redis
    redis = await get_redis()
    raw = await redis.get(f"{_SESSION_PREFIX}{session_id}")
    if raw is None:
        return None
    return json.loads(raw)


async def _delete_session(session_id: str) -> None:
    """Delete import session from Redis."""
    from app.core.redis import get_redis
    redis = await get_redis()
    await redis.delete(f"{_SESSION_PREFIX}{session_id}")


# ── Utility functions ──

def _auto_map_columns(
    headers: List[str],
    patterns: Dict[str, List[str]],
) -> Dict[str, str]:
    """Auto-map CSV headers to target fields by pattern matching."""
    mapping: Dict[str, str] = {}
    used_targets: set = set()

    for header in headers:
        h_clean = header.strip().lower()
        best_target = None
        for target, pats in patterns.items():
            if target in used_targets:
                continue
            for pat in pats:
                if re.search(pat, h_clean, re.IGNORECASE):
                    best_target = target
                    break
            if best_target:
                break
        if best_target:
            mapping[header] = best_target
            used_targets.add(best_target)

    return mapping


def _detect_platform(headers: List[str], rows: List[Dict]) -> str:
    """Try to detect if this is Yclients, Dikidi, or generic export."""
    h_joined = " ".join(headers).lower()
    if "yclients" in h_joined or "id записи" in h_joined:
        return "yclients"
    if "dikidi" in h_joined:
        return "dikidi"
    yclients_markers = ["лояльность", "карта", "баланс", "категория клиента"]
    for m in yclients_markers:
        if m in h_joined:
            return "yclients"
    return "generic"


def _parse_phone(val: str) -> Optional[str]:
    """Normalize phone: digits only, ensure starts with country code."""
    if not val:
        return None
    digits = re.sub(r"[^\d]", "", str(val))
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if 10 <= len(digits) <= 15:
        return "+" + digits
    return None


def _parse_date(val: str) -> Optional[date]:
    """Try multiple date formats."""
    if not val or not val.strip():
        return None
    val = val.strip()
    for fmt in ["%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


def _parse_number(val: str) -> Optional[float]:
    """Parse number, handling comma as decimal separator."""
    if not val or not str(val).strip():
        return None
    val = str(val).strip().replace(",", ".").replace(" ", "").replace("\xa0", "")
    try:
        return float(val)
    except ValueError:
        return None


def parse_file_bytes(
    file_bytes: bytes,
    filename: str,
) -> Tuple[List[str], List[Dict[str, str]]]:
    """Parse CSV or XLSX file into headers + list of row dicts."""
    rows: List[Dict[str, str]] = []
    headers: List[str] = []

    if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
        ws = wb.active
        ws_rows = list(ws.iter_rows(values_only=True))
        if not ws_rows:
            return [], []
        headers = [str(h or "").strip() for h in ws_rows[0]]
        for row_vals in ws_rows[1:]:
            row_dict = {}
            for i, h in enumerate(headers):
                val = row_vals[i] if i < len(row_vals) else None
                row_dict[h] = str(val).strip() if val is not None else ""
            if any(v for v in row_dict.values()):
                rows.append(row_dict)
        wb.close()
    else:
        text = None
        for enc in ["utf-8-sig", "utf-8", "cp1251", "latin-1"]:
            try:
                text = file_bytes.decode(enc)
                break
            except (UnicodeDecodeError, ValueError):
                continue
        if not text:
            return [], []

        sniffer = csv.Sniffer()
        try:
            dialect = sniffer.sniff(text[:2000])
        except csv.Error:
            dialect = csv.excel
            dialect.delimiter = ";" if ";" in text[:500] else ","

        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        headers = reader.fieldnames or []
        for row in reader:
            if any(v for v in row.values()):
                rows.append({k: str(v or "").strip() for k, v in row.items()})

    headers = [h for h in headers if h.strip()]
    return headers, rows


async def preview_clients(
    headers: List[str],
    rows: List[Dict[str, str]],
    master_id: int,
) -> Dict:
    """Generate import preview for clients. Stats computed from ALL rows."""
    mapping = _auto_map_columns(headers, CLIENT_FIELD_PATTERNS)
    platform = _detect_platform(headers, rows)
    session_id = str(uuid.uuid4())

    preview_rows = []
    valid = 0
    errors = 0
    duplicates = 0
    seen_phones: set = set()

    # Process ALL rows for accurate stats
    for i, row in enumerate(rows):
        pr = {"row_num": i + 1, "data": {}, "status": "ok", "message": None}

        for src_col, tgt_field in mapping.items():
            pr["data"][tgt_field] = row.get(src_col, "")

        name = pr["data"].get("name", "").strip()
        phone_raw = pr["data"].get("phone", "").strip()
        phone = _parse_phone(phone_raw)

        if not name and not phone_raw:
            pr["status"] = "error"
            pr["message"] = "Нет имени и телефона"
            errors += 1
        elif phone_raw and not phone:
            pr["status"] = "warning"
            pr["message"] = f"Невалидный телефон: {phone_raw}"
            valid += 1
        elif phone and phone in seen_phones:
            pr["status"] = "warning"
            pr["message"] = "Дублирующийся телефон"
            duplicates += 1
            valid += 1
        else:
            valid += 1

        if phone:
            seen_phones.add(phone)
            pr["data"]["phone"] = phone

        if pr["data"].get("birthday"):
            parsed = _parse_date(pr["data"]["birthday"])
            pr["data"]["birthday"] = str(parsed) if parsed else pr["data"]["birthday"]

        # Only keep first 20 rows for preview response
        if i < 20:
            preview_rows.append(pr)

    # Store session in Redis
    await _save_session(session_id, {
        "type": "clients",
        "master_id": master_id,
        "rows": rows,
        "mapping": mapping,
        "platform": platform,
    })

    return {
        "file_name": "",
        "import_type": "clients",
        "platform_detected": platform,
        "total_rows": len(rows),
        "valid_rows": valid,
        "error_rows": errors,
        "duplicate_rows": duplicates,
        "columns_found": headers,
        "column_mapping": mapping,
        "preview_rows": preview_rows,
        "session_id": session_id,
    }


async def preview_services(
    headers: List[str],
    rows: List[Dict[str, str]],
    master_id: int,
) -> Dict:
    """Generate import preview for services. Stats computed from ALL rows."""
    mapping = _auto_map_columns(headers, SERVICE_FIELD_PATTERNS)
    session_id = str(uuid.uuid4())

    preview_rows = []
    valid = 0
    errors = 0

    # Process ALL rows for accurate stats
    for i, row in enumerate(rows):
        pr = {"row_num": i + 1, "data": {}, "status": "ok", "message": None}

        for src_col, tgt_field in mapping.items():
            pr["data"][tgt_field] = row.get(src_col, "")

        name = pr["data"].get("name", "").strip()
        price_raw = pr["data"].get("price", "")
        duration_raw = pr["data"].get("duration_min", "")

        if not name:
            pr["status"] = "error"
            pr["message"] = "Нет названия услуги"
            errors += 1
        else:
            price = _parse_number(price_raw)
            duration = _parse_number(duration_raw)
            if price is not None:
                pr["data"]["price"] = price
            if duration is not None:
                pr["data"]["duration_min"] = int(duration)
            if not price and not duration:
                pr["status"] = "warning"
                pr["message"] = "Нет цены и длительности"
            valid += 1

        if i < 20:
            preview_rows.append(pr)

    await _save_session(session_id, {
        "type": "services",
        "master_id": master_id,
        "rows": rows,
        "mapping": mapping,
    })

    return {
        "file_name": "",
        "import_type": "services",
        "total_rows": len(rows),
        "valid_rows": valid,
        "error_rows": errors,
        "duplicate_rows": 0,
        "columns_found": headers,
        "column_mapping": mapping,
        "preview_rows": preview_rows,
        "session_id": session_id,
    }


async def execute_client_import(
    session_id: str,
    db: AsyncSession,
    custom_mapping: Optional[Dict[str, str]] = None,
) -> Dict:
    """Actually import clients from a confirmed session (Redis-backed)."""
    from app.modules.auth.models import Identity
    from app.modules.clients.models import Client, ClientProfile, ClientMasterLink

    session = await _get_session(session_id)
    if not session or session["type"] != "clients":
        return {"imported": 0, "skipped": 0, "errors": 0, "details": ["Сессия не найдена"]}

    mapping = custom_mapping or session["mapping"]
    master_id = session["master_id"]
    rows = session["rows"]

    imported = 0
    skipped = 0
    error_count = 0
    details: List[str] = []

    # Get existing phones for dedup
    existing_phones: set = set()
    q = select(Client.phone).where(Client.phone.isnot(None))
    result = await db.execute(q)
    for row in result:
        if row[0]:
            existing_phones.add(row[0])

    # Get existing client_master_links for this master to prevent duplicates
    existing_links: set = set()
    q_links = select(ClientMasterLink.client_id).where(
        ClientMasterLink.master_id == master_id
    )
    result_links = await db.execute(q_links)
    for row in result_links:
        existing_links.add(row[0])

    rev_mapping = {v: k for k, v in mapping.items()}

    for i, row in enumerate(rows):
        # Use savepoint per row so one failure doesn't break the whole batch
        savepoint = await db.begin_nested()
        try:
            name = row.get(rev_mapping.get("name", ""), "").strip()
            phone_raw = row.get(rev_mapping.get("phone", ""), "").strip()
            phone = _parse_phone(phone_raw)
            birthday_raw = row.get(rev_mapping.get("birthday", ""), "").strip()
            notes = row.get(rev_mapping.get("notes", ""), "").strip()
            tags_raw = row.get(rev_mapping.get("tags", ""), "").strip()
            source_raw = row.get(rev_mapping.get("source", ""), "").strip()
            email = row.get(rev_mapping.get("email", ""), "").strip()
            city = row.get(rev_mapping.get("city", ""), "").strip()
            last_visit_raw = row.get(rev_mapping.get("last_visit", ""), "").strip()
            discount_raw = row.get(rev_mapping.get("discount", ""), "").strip()

            if not name and not phone:
                skipped += 1
                await savepoint.rollback()
                continue

            if not name:
                name = phone or f"Клиент {i + 1}"

            # Dedup by phone
            if phone and phone in existing_phones:
                skipped += 1
                details.append(f"Строка {i+1}: {name} — телефон уже есть")
                await savepoint.rollback()
                continue

            # Create identity (platform=manual)
            platform_id = phone or f"import_{master_id}_{uuid.uuid4().hex[:8]}"
            identity = Identity(
                platform="manual",
                platform_id=platform_id,
                role="client",
            )
            db.add(identity)
            await db.flush()

            # Create client
            birthday = _parse_date(birthday_raw)
            client = Client(
                identity_id=identity.id,
                display_name=name,
                phone=phone,
                birthday=birthday,
                notes=notes or None,
            )
            db.add(client)
            await db.flush()

            # Create ClientProfile if we have extra data (email, city, discount)
            has_profile_data = email or city or discount_raw
            if has_profile_data:
                prefs = {}
                if email:
                    prefs["email"] = email
                if discount_raw:
                    discount_val = _parse_number(discount_raw)
                    if discount_val is not None:
                        prefs["discount"] = discount_val

                profile = ClientProfile(
                    client_id=client.id,
                    city=city or None,
                    preferences=prefs if prefs else {},
                    source=source_raw or "csv_import",
                )
                db.add(profile)

            # Create link to master (skip if somehow duplicate)
            if client.id not in existing_links:
                tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []
                source = source_raw or "csv_import"
                total_spent_raw = row.get(rev_mapping.get("total_spent", ""), "")
                total_spent = _parse_number(total_spent_raw)
                visit_count_raw = row.get(rev_mapping.get("visit_count", ""), "")
                visit_count = _parse_number(visit_count_raw)
                last_visit = _parse_date(last_visit_raw)

                link = ClientMasterLink(
                    master_id=master_id,
                    client_id=client.id,
                    tags=tags,
                    source=source,
                    visit_count=int(visit_count) if visit_count else 0,
                    total_spent=int(total_spent) if total_spent else 0,
                    last_visit_date=last_visit,
                )
                db.add(link)
                existing_links.add(client.id)

            if phone:
                existing_phones.add(phone)

            await savepoint.commit()
            imported += 1

        except Exception as e:
            await savepoint.rollback()
            error_count += 1
            details.append(f"Строка {i+1}: ошибка — {str(e)[:80]}")
            logger.exception(f"Import client row {i+1} error")

    await db.commit()

    # Cleanup session from Redis
    await _delete_session(session_id)

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": error_count,
        "details": details[:50],
    }


async def execute_service_import(
    session_id: str,
    db: AsyncSession,
    custom_mapping: Optional[Dict[str, str]] = None,
) -> Dict:
    """Actually import services from a confirmed session (Redis-backed)."""
    from app.modules.services.models import Service

    session = await _get_session(session_id)
    if not session or session["type"] != "services":
        return {"imported": 0, "skipped": 0, "errors": 0, "details": ["Сессия не найдена"]}

    mapping = custom_mapping or session["mapping"]
    master_id = session["master_id"]
    rows = session["rows"]

    imported = 0
    skipped = 0
    error_count = 0
    details: List[str] = []

    # Get existing service names for dedup
    existing_names: set = set()
    q = select(Service.name).where(Service.master_id == master_id)
    result = await db.execute(q)
    for row in result:
        existing_names.add(row[0].lower().strip())

    rev_mapping = {v: k for k, v in mapping.items()}

    for i, row in enumerate(rows):
        savepoint = await db.begin_nested()
        try:
            name = row.get(rev_mapping.get("name", ""), "").strip()
            if not name:
                skipped += 1
                await savepoint.rollback()
                continue

            if name.lower().strip() in existing_names:
                skipped += 1
                details.append(f"Строка {i+1}: «{name}» — уже существует")
                await savepoint.rollback()
                continue

            desc = row.get(rev_mapping.get("description", ""), "").strip()
            price_raw = row.get(rev_mapping.get("price", ""), "")
            price = _parse_number(price_raw) or 0
            price_max_raw = row.get(rev_mapping.get("price_max", ""), "")
            price_max = _parse_number(price_max_raw)
            duration_raw = row.get(rev_mapping.get("duration_min", ""), "")
            duration = _parse_number(duration_raw)
            category = row.get(rev_mapping.get("category", ""), "").strip()

            service = Service(
                master_id=master_id,
                name=name,
                description=desc or None,
                duration_min=int(duration) if duration else 60,
                price=price,
                price_max=price_max,
                category=category or None,
                is_active=True,
            )
            db.add(service)
            existing_names.add(name.lower().strip())
            await savepoint.commit()
            imported += 1

        except Exception as e:
            await savepoint.rollback()
            error_count += 1
            details.append(f"Строка {i+1}: ошибка — {str(e)[:80]}")
            logger.exception(f"Import service row {i+1} error")

    await db.commit()
    await _delete_session(session_id)

    return {
        "imported": imported,
        "skipped": skipped,
        "errors": error_count,
        "details": details[:50],
    }
