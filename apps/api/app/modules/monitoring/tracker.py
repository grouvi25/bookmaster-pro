"""
ErrorTracker — перехватывает исключения и записывает в БД.
Агрегирует: если та же ошибка повторяется — увеличивает счётчик.
"""

import hashlib
import logging
import traceback
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.monitoring.models import ErrorEvent

logger = logging.getLogger(__name__)


class ErrorTracker:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _fingerprint(exc: Exception, module: str = "") -> str:
        """Уникальный идентификатор типа ошибки."""
        tb = traceback.extract_tb(exc.__traceback__)
        location = ""
        if tb:
            frame = tb[-1]
            location = f"{frame.filename}:{frame.lineno}"
        raw = f"{type(exc).__name__}:{location}:{module}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    async def track(
        self,
        exc: Exception,
        module: str = "",
        severity: str = "error",
        request_id: Optional[str] = None,
        user_id: Optional[int] = None,
    ) -> None:
        """Записать/обновить ошибку в БД."""
        try:
            fp = self._fingerprint(exc, module)
            now = datetime.now(timezone.utc)

            existing = await self.db.execute(
                select(ErrorEvent).where(ErrorEvent.fingerprint == fp)
            )
            event = existing.scalar_one_or_none()

            if event:
                event.count = (event.count or 1) + 1
                event.last_seen = now
                event.stack_trace = "".join(traceback.format_exception(exc))[-3000:]
                if request_id:
                    event.request_id = request_id
                if user_id:
                    event.user_id = user_id
            else:
                event = ErrorEvent(
                    fingerprint=fp,
                    error_type=type(exc).__name__,
                    error_msg=str(exc)[:500],
                    module=module,
                    stack_trace="".join(traceback.format_exception(exc))[-3000:],
                    severity=severity,
                    request_id=request_id,
                    user_id=user_id,
                )
                self.db.add(event)

            await self.db.flush()
        except Exception as e:
            # Трекер не должен ломать основной код
            logger.warning(f"ErrorTracker.track failed: {e}")
