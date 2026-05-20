"""
Pytest fixtures — тестовая БД (SQLite async), HTTP клиент, фейковые пользователи.
Для unit-тестов бизнес-логики без обращения к реальным сервисам.
"""

import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.base_model import Base
from app.core.auth import create_access_token
from app.core.database import get_db
from app.main import app

# ─── SQLite async engine для тестов ───────────────────────────────────
TEST_DB_URL = "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true"

engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db() -> AsyncGenerator[AsyncSession, None]:
    """Свежая in-memory БД для каждого теста."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSession() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """HTTP клиент с подставленной тестовой БД."""

    async def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ─── Фабрики тестовых данных ──────────────────────────────────────────


@pytest_asyncio.fixture
async def master_identity(db: AsyncSession):
    """Создать identity мастера."""
    from app.modules.auth.models import Identity

    identity = Identity(platform="telegram", platform_id="111111", role="master")
    db.add(identity)
    await db.commit()
    await db.refresh(identity)
    return identity


@pytest_asyncio.fixture
async def master(db: AsyncSession, master_identity):
    """Создать профиль мастера."""
    from app.modules.masters.models import Master

    m = Master(
        identity_id=master_identity.id,
        display_name="Тест Мастер",
        slug="test-master",
        specialization="Маникюр",
        city="Москва",
        is_active=True,
        is_verified=True,
        buffer_minutes=10,
        current_plan="pro",
        rating_avg=4.5,
        rating_count=10,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return m


@pytest_asyncio.fixture
async def client_identity(db: AsyncSession):
    """Создать identity клиента."""
    from app.modules.auth.models import Identity

    identity = Identity(platform="telegram", platform_id="222222", role="client")
    db.add(identity)
    await db.commit()
    await db.refresh(identity)
    return identity


@pytest_asyncio.fixture
async def test_client(db: AsyncSession, client_identity):
    """Создать профиль клиента."""
    from app.modules.clients.models import Client

    c = Client(
        identity_id=client_identity.id,
        first_name="Тест",
        last_name="Клиент",
        platform="telegram",
        platform_id="222222",
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


@pytest_asyncio.fixture
async def service(db: AsyncSession, master):
    """Создать тестовую услугу."""
    from app.modules.services.models import Service

    svc = Service(
        master_id=master.id,
        name="Маникюр классический",
        duration_min=60,
        price=1500,
        is_active=True,
        sort_order=0,
    )
    db.add(svc)
    await db.commit()
    await db.refresh(svc)
    return svc


@pytest_asyncio.fixture
async def schedule_template(db: AsyncSession, master):
    """Шаблон расписания — пн-пт 9:00-18:00."""
    from app.modules.booking.models import ScheduleTemplate

    templates = []
    for day in range(5):  # Пн-Пт
        t = ScheduleTemplate(
            master_id=master.id,
            day_of_week=day,
            start_time=datetime(2000, 1, 1, 9, 0).time(),
            end_time=datetime(2000, 1, 1, 18, 0).time(),
            is_active=True,
        )
        db.add(t)
        templates.append(t)
    await db.commit()
    return templates


@pytest_asyncio.fixture
async def feature_flags(db: AsyncSession, master):
    """Feature flags для мастера (pro план)."""
    from app.modules.core.models import FeatureFlags

    flags = FeatureFlags(
        master_id=master.id,
        ai_advisor=True,
        ai_voice=True,
        ai_client_bot=True,
        analytics_enabled=True,
        broadcast_enabled=True,
        portfolio_enabled=True,
        marketplace_enabled=True,
        marketplace_featured=False,
        widget_enabled=True,
        consultations_enabled=True,
    )
    db.add(flags)
    await db.commit()
    await db.refresh(flags)
    return flags


def make_token(identity_id: int, role: str = "master", platform_id: str = "111111") -> str:
    """Создать JWT токен для тестов."""
    return create_access_token({
        "sub": str(identity_id),
        "identity_id": identity_id,
        "role": role,
        "platform_id": platform_id,
    })
