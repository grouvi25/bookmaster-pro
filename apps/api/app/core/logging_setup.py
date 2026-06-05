"""
Структурное логирование для BookMaster Pro.

Формат: JSON — читается как людьми, так и YC Cloud Logging.
Каждый лог содержит: timestamp, level, service, request_id,
user_id (если есть), module, message + произвольные поля.
"""

import logging
import sys
import json
import traceback
from datetime import datetime, timezone
from typing import Any


# Ключи, которые уже есть в стандартном LogRecord — не дублируем
_BUILTIN_ATTRS = frozenset(
    logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys()
) | {"message", "taskName"}


class JSONFormatter(logging.Formatter):
    """Форматтер: каждая строка лога = один JSON-объект."""

    SERVICE = "bookmaster-api"

    def format(self, record: logging.LogRecord) -> str:
        log: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.SERVICE,
            "module": record.name,
            "msg": record.getMessage(),
        }

        # Контекст запроса (thread-local через contextvars)
        try:
            from app.core.request_context import get_request_id, get_user_id

            rid = get_request_id()
            uid = get_user_id()
            if rid:
                log["request_id"] = rid
            if uid:
                log["user_id"] = uid
        except ImportError:
            pass

        # Стектрейс для ошибок
        if record.exc_info and record.exc_info[0] is not None:
            log["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "trace": traceback.format_exception(*record.exc_info),
            }

        # Дополнительные поля из extra={}
        for key, val in record.__dict__.items():
            if key not in _BUILTIN_ATTRS and not key.startswith("_"):
                log[key] = val

        return json.dumps(log, ensure_ascii=False, default=str)


def setup_logging(debug: bool = False, service_name: str = "bookmaster-api") -> None:
    """Инициализация — вызывается один раз при старте."""
    level = logging.DEBUG if debug else logging.INFO

    formatter = JSONFormatter()
    formatter.SERVICE = service_name

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]

    # Снижаем уровень для шумных библиотек
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
