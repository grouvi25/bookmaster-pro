"""
AI custom documents — загрузка PDF/TXT мастером в RAG-базу знаний.

Поток:
  1) HTTP-эндпоинт принимает файл (UploadFile).
  2) Файл льётся в S3 (Yandex Object Storage).
  3) Из файла извлекается plain-text (pypdf для PDF, decode для TXT).
  4) Текст чанкуется и эмбеддится через AIIndexer.index_custom_document().
  5) В таблицу `ai_custom_documents` пишется запись со статусом 'indexed'.
"""

from __future__ import annotations

import io
import logging
import uuid
from typing import Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.ai.models import AICustomDocument
from app.modules.ai.indexer import AIIndexer

logger = logging.getLogger(__name__)

# Лимит размера загружаемого документа.
MAX_DOC_SIZE = 10 * 1024 * 1024  # 10 MB

# Поддерживаемые типы (по mime / расширению).
ALLOWED_MIME = {
    "application/pdf",
    "text/plain",
    "text/markdown",
}
ALLOWED_EXT = {"pdf", "txt", "md", "markdown"}


class DocumentValidationError(ValueError):
    """Бросается при невалидном файле (тип/размер/пустой)."""


def _detect_kind(filename: str, mime_type: str) -> str:
    """Возвращает 'pdf' или 'text'. Бросает DocumentValidationError."""
    ext = (filename or "").rsplit(".", 1)[-1].lower() if filename else ""
    if mime_type == "application/pdf" or ext == "pdf":
        return "pdf"
    if mime_type in {"text/plain", "text/markdown"} or ext in {"txt", "md", "markdown"}:
        return "text"
    raise DocumentValidationError(
        f"Неподдерживаемый формат файла: {mime_type or ext or 'unknown'}. "
        f"Принимаем PDF и TXT."
    )


def extract_text_from_pdf(data: bytes) -> Tuple[str, int]:
    """
    Извлекает текст из PDF. Возвращает (text, pages_count).
    Бросает DocumentValidationError если PDF битый или не текстовый.
    """
    try:
        from pypdf import PdfReader
    except ImportError as e:  # pragma: no cover
        raise DocumentValidationError(
            "PDF-парсер недоступен (pypdf не установлен)."
        ) from e

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as e:
        raise DocumentValidationError(f"Не удалось открыть PDF: {e}") from e

    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            parts.append("")
    text = "\n\n".join(p.strip() for p in parts if p and p.strip())
    return text, len(reader.pages)


def extract_text_from_txt(data: bytes) -> str:
    """Декодирует TXT-файл в строку, пытаясь несколько кодировок."""
    for enc in ("utf-8", "utf-8-sig", "cp1251", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


async def upload_to_s3(
    data: bytes, filename: str, content_type: str
) -> str:
    """Заливает байты в S3 (под уникальным ключом) и возвращает file_key."""
    try:
        import aioboto3
    except ImportError as e:  # pragma: no cover
        raise DocumentValidationError(
            "S3-клиент недоступен (aioboto3 не установлен)."
        ) from e

    ext = (filename or "").rsplit(".", 1)[-1].lower() if filename else "bin"
    file_key = f"ai_documents/{uuid.uuid4()}.{ext}"

    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    ) as s3:
        await s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=file_key,
            Body=data,
            ContentType=content_type or "application/octet-stream",
        )
    return file_key


async def delete_from_s3(file_key: str) -> None:
    """Удаляет файл из S3. Ошибки логирует, но не пробрасывает."""
    try:
        import aioboto3
    except ImportError:  # pragma: no cover
        return

    try:
        session = aioboto3.Session()
        async with session.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY_ID,
            aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        ) as s3:
            await s3.delete_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=file_key,
            )
    except Exception as e:
        logger.warning(f"S3 delete failed for {file_key}: {e}")


async def process_uploaded_document(
    db: AsyncSession,
    master_id: int,
    raw_bytes: bytes,
    filename: str,
    mime_type: str,
) -> Tuple[AICustomDocument, int]:
    """
    Полный цикл загрузки: валидация → S3 → извлечение текста → RAG.
    Возвращает (AICustomDocument, chunks_created).

    Бросает DocumentValidationError для пользовательских ошибок (4xx).
    """
    if not raw_bytes:
        raise DocumentValidationError("Пустой файл.")
    if len(raw_bytes) > MAX_DOC_SIZE:
        raise DocumentValidationError(
            f"Файл слишком большой (макс {MAX_DOC_SIZE // (1024 * 1024)} MB)."
        )

    kind = _detect_kind(filename, mime_type)

    if kind == "pdf":
        text, pages_count = extract_text_from_pdf(raw_bytes)
    else:
        text = extract_text_from_txt(raw_bytes)
        pages_count = None

    text = (text or "").strip()
    if not text:
        raise DocumentValidationError(
            "Не удалось извлечь текст из файла (пустой документ или скан без OCR)."
        )

    s3_key = await upload_to_s3(raw_bytes, filename, mime_type)

    doc = AICustomDocument(
        master_id=master_id,
        filename=filename or "document",
        mime_type=mime_type or ("application/pdf" if kind == "pdf" else "text/plain"),
        s3_key=s3_key,
        size_bytes=len(raw_bytes),
        pages_count=pages_count,
        chars_count=len(text),
        chunks_count=0,
        status="processing",
    )
    db.add(doc)
    await db.flush()  # получаем doc.id

    try:
        indexer = AIIndexer(db)
        chunks_created = await indexer.index_custom_document(
            master_id=master_id,
            doc_id=doc.id,
            filename=doc.filename,
            text=text,
        )
        doc.chunks_count = chunks_created
        doc.status = "indexed"
    except Exception as e:
        logger.exception(f"Failed to index custom doc {doc.id}: {e}")
        doc.status = "error"
        doc.error = str(e)[:1000]
        await db.flush()
        # Не удаляем файл из S3 — мастер может попробовать переиндексировать.
        raise

    await db.flush()
    return doc, doc.chunks_count
