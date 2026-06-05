"""
Request context — request_id и user_id доступны в любом месте кода
через contextvars (потокобезопасно для async).
"""

from contextvars import ContextVar

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
_user_id: ContextVar[int | None] = ContextVar("user_id", default=None)


def set_request_id(rid: str) -> None:
    _request_id.set(rid)


def get_request_id() -> str | None:
    return _request_id.get()


def set_user_id(uid: int) -> None:
    _user_id.set(uid)


def get_user_id() -> int | None:
    return _user_id.get()
