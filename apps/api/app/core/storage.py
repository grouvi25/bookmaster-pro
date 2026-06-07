"""
StorageService — централизованная загрузка файлов в S3
с конвертацией в WebP и поддержкой HEIC.
"""

import io
import uuid
import logging
from typing import Optional, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

# Максимальные размеры по умолчанию
MAX_AVATAR_SIZE = (400, 400)
MAX_COVER_SIZE = (1200, 600)
MAX_PORTFOLIO_SIZE = (1920, 1920)
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

# Допустимые MIME-типы изображений
ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "image/heic", "image/heif", "image/bmp", "image/tiff",
}


def _ensure_heif_support():
    """Регистрируем pillow-heif если доступен."""
    try:
        import pillow_heif
        pillow_heif.register_heif_opener()
        return True
    except ImportError:
        return False


def _process_image(
    content: bytes,
    max_size: Optional[Tuple[int, int]] = None,
    quality: int = 85,
    convert_webp: bool = True,
) -> Tuple[bytes, str]:
    """
    Обработать изображение:
    - Поддержка HEIC/HEIF (через pillow-heif)
    - Конвертация в WebP
    - Ресайз с сохранением пропорций
    - Удаление EXIF

    Returns: (processed_bytes, extension)
    """
    from PIL import Image

    _ensure_heif_support()

    img = Image.open(io.BytesIO(content))

    # RGBA → RGB для WebP без прозрачности (сохраняем RGBA для PNG)
    if img.mode == "RGBA" and convert_webp:
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        img = background
    elif img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    # Ресайз с сохранением пропорций
    if max_size:
        img.thumbnail(max_size, Image.LANCZOS)

    # Удаляем EXIF (приватность)
    output = io.BytesIO()
    if convert_webp:
        img.save(output, format="WEBP", quality=quality, method=4)
        ext = "webp"
    else:
        img.save(output, format="PNG" if img.mode == "RGBA" else "JPEG", quality=quality)
        ext = "png" if img.mode == "RGBA" else "jpg"

    return output.getvalue(), ext


class StorageService:
    """Сервис загрузки файлов в Yandex Cloud S3."""

    @staticmethod
    async def upload_image(
        content: bytes,
        folder: str = "uploads",
        max_size: Optional[Tuple[int, int]] = None,
        quality: int = 85,
        convert_webp: bool = True,
        content_type: str = "image/webp",
    ) -> dict:
        """
        Загрузить изображение в S3 с обработкой.

        Returns: {"s3_key": str, "public_url": str, "size_bytes": int}
        """
        import aioboto3

        # Валидация размера
        if len(content) > MAX_FILE_BYTES:
            raise ValueError(f"Файл слишком большой (макс {MAX_FILE_BYTES // 1024 // 1024} MB)")

        # Обработка: ресайз + WebP
        processed, ext = _process_image(content, max_size, quality, convert_webp)

        # Генерируем уникальный ключ
        file_key = f"{folder}/{uuid.uuid4()}.{ext}"
        ct = f"image/{ext}"

        # Загружаем в S3
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
                Body=processed,
                ContentType=ct,
                ACL="public-read",
            )

        public_url = f"{settings.S3_PUBLIC_URL}/{file_key}"

        logger.info(
            f"Uploaded image: {file_key} ({len(processed)} bytes, {ext})"
        )

        return {
            "s3_key": file_key,
            "public_url": public_url,
            "size_bytes": len(processed),
        }

    @staticmethod
    async def upload_avatar(content: bytes) -> dict:
        """Загрузить аватар мастера (400×400, WebP)."""
        return await StorageService.upload_image(
            content, folder="avatars",
            max_size=MAX_AVATAR_SIZE, quality=85,
        )

    @staticmethod
    async def upload_cover(content: bytes) -> dict:
        """Загрузить обложку мастера (1200×600, WebP)."""
        return await StorageService.upload_image(
            content, folder="covers",
            max_size=MAX_COVER_SIZE, quality=85,
        )

    @staticmethod
    async def upload_portfolio(content: bytes) -> dict:
        """Загрузить фото портфолио (1920×1920, WebP)."""
        return await StorageService.upload_image(
            content, folder="portfolio",
            max_size=MAX_PORTFOLIO_SIZE, quality=90,
        )

    @staticmethod
    async def delete_file(s3_key: str) -> bool:
        """Удалить файл из S3."""
        import aioboto3

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
                    Key=s3_key,
                )
            logger.info(f"Deleted S3 object: {s3_key}")
            return True
        except Exception as e:
            logger.warning(f"Failed to delete S3 object {s3_key}: {e}")
            return False
