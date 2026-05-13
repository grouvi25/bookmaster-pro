"""
Uploads router — /api/v1/uploads
S3 presigned URL и прямая загрузка файлов.
"""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class PresignedUrlResponse(BaseModel):
    upload_url: str
    file_key: str
    public_url: str


class UploadResponse(BaseModel):
    file_key: str
    public_url: str


@router.post("/presigned-url", response_model=PresignedUrlResponse)
async def get_presigned_url(
    folder: str = Query("uploads"),
    extension: str = Query("jpg"),
    user: dict = Depends(get_current_user),
):
    """Получить presigned URL для загрузки файла напрямую в S3."""
    try:
        import aioboto3
    except ImportError:
        raise HTTPException(status_code=501, detail="S3 client not available")

    file_key = f"{folder}/{uuid.uuid4()}.{extension}"

    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    ) as s3:
        upload_url = await s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": file_key,
                "ACL": "public-read",
            },
            ExpiresIn=600,
        )

    return PresignedUrlResponse(
        upload_url=upload_url,
        file_key=file_key,
        public_url=f"{settings.S3_PUBLIC_URL}/{file_key}",
    )


@router.post("/file", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    folder: str = Query("uploads"),
    user: dict = Depends(get_current_user),
):
    """Загрузить файл через сервер (fallback если presigned не работает)."""
    try:
        import aioboto3
    except ImportError:
        raise HTTPException(status_code=501, detail="S3 client not available")

    max_size = 10 * 1024 * 1024  # 10 MB
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB)")

    ext = (file.filename or "file").rsplit(".", 1)[-1] if file.filename else "bin"
    file_key = f"{folder}/{uuid.uuid4()}.{ext}"

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
            Body=content,
            ContentType=file.content_type or "application/octet-stream",
            ACL="public-read",
        )

    return UploadResponse(
        file_key=file_key,
        public_url=f"{settings.S3_PUBLIC_URL}/{file_key}",
    )


@router.get("/s3/{file_key:path}")
async def proxy_s3_file(file_key: str):
    """Проксирование файлов из S3 (если бакет приватный)."""
    try:
        import aioboto3
    except ImportError:
        raise HTTPException(status_code=501, detail="S3 client not available")

    session = aioboto3.Session()
    async with session.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY_ID,
        aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
    ) as s3:
        try:
            obj = await s3.get_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=file_key,
            )
            body = await obj["Body"].read()
            content_type = obj.get("ContentType", "application/octet-stream")
            return Response(
                content=body,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=31536000"},
            )
        except Exception:
            raise HTTPException(status_code=404, detail="File not found")
