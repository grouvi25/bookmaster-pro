"""
Backup service — работа с S3 для чтения информации о бэкапах.
"""

import json
import logging
from typing import List

from app.core.config import settings
from app.modules.monitoring.schemas import BackupInfoOut

logger = logging.getLogger(__name__)


class BackupService:
    @staticmethod
    async def list_recent(limit: int = 30) -> List[BackupInfoOut]:
        """Получить список последних бэкапов из S3."""
        try:
            import aioboto3

            session = aioboto3.Session()
            async with session.client(
                "s3",
                endpoint_url=settings.S3_ENDPOINT_URL,
                aws_access_key_id=settings.S3_ACCESS_KEY_ID,
                aws_secret_access_key=settings.S3_SECRET_ACCESS_KEY,
            ) as s3:
                # Ищем manifest.json в daily/
                response = await s3.list_objects_v2(
                    Bucket="bookmaster-backups",
                    Prefix="daily/",
                    Delimiter="/",
                )
                prefixes = response.get("CommonPrefixes", [])
                # Сортируем по дате (имя = daily/YYYY-MM-DD/)
                dates = sorted(
                    [p["Prefix"].strip("/").split("/")[-1] for p in prefixes],
                    reverse=True,
                )[:limit]

                backups = []
                for d in dates:
                    try:
                        obj = await s3.get_object(
                            Bucket="bookmaster-backups",
                            Key=f"daily/{d}/manifest.json",
                        )
                        body = await obj["Body"].read()
                        manifest = json.loads(body)
                        backups.append(
                            BackupInfoOut(
                                date=d,
                                size=manifest.get("total_size"),
                                status="complete" if manifest.get("status") == "complete" else "partial",
                                postgres_file=manifest.get("postgres_file"),
                                redis_file=manifest.get("redis_file"),
                            )
                        )
                    except Exception:
                        backups.append(
                            BackupInfoOut(
                                date=d,
                                status="no_manifest",
                            )
                        )

                return backups

        except Exception as e:
            logger.error(f"BackupService.list_recent failed: {e}")
            return []
