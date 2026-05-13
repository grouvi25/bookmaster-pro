"""
seed_demo.py — наполняет БД демо-данными для тестирования.

Запуск:
  cd apps/api && python -m seed_demo
  или: docker exec bm_api python -m seed_demo
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone

from app.core.database import async_session_factory, engine
from app.core.database import Base
from app.modules.auth.models import Identity
from app.modules.masters.models import Master, MasterLocation
from app.modules.services.models import Service
from app.modules.clients.models import Client
from app.modules.booking.models import Appointment, AppointmentStatus


MASTERS_DATA = [
    {
        "display_name": "Анна Мастер",
        "slug": "anna-master",
        "specialization": "Маникюр / Педикюр",
        "description": "Профессиональный мастер маникюра с 5-летним стажем. "
                        "Работаю с гель-лаком, акрилом, дизайном.",
        "city": "Москва",
        "phone": "+79001234567",
        "current_plan": "pro",
        "services": [
            {"name": "Маникюр классический", "price": 1500, "duration_min": 60, "category": "Маникюр"},
            {"name": "Маникюр с покрытием", "price": 2500, "duration_min": 90, "category": "Маникюр"},
            {"name": "Педикюр", "price": 2000, "duration_min": 75, "category": "Педикюр"},
            {"name": "Дизайн ногтей", "price": 500, "price_max": 1500, "duration_min": 30, "category": "Дизайн"},
        ],
    },
    {
        "display_name": "Михаил Барбер",
        "slug": "mikhail-barber",
        "specialization": "Барбер",
        "description": "Мужские стрижки, бороды, королевское бритьё. "
                        "Работаю на Арбате.",
        "city": "Москва",
        "phone": "+79009876543",
        "current_plan": "business",
        "services": [
            {"name": "Мужская стрижка", "price": 1200, "duration_min": 45, "category": "Стрижки"},
            {"name": "Стрижка + борода", "price": 2000, "duration_min": 60, "category": "Стрижки"},
            {"name": "Королевское бритьё", "price": 800, "duration_min": 30, "category": "Бритьё"},
            {"name": "Окрашивание", "price": 3000, "duration_min": 90, "category": "Окрашивание"},
        ],
    },
    {
        "display_name": "Елена Косметолог",
        "slug": "elena-cosmo",
        "specialization": "Косметология",
        "description": "Чистки, пилинги, мезотерапия, биоревитализация. "
                        "Медицинское образование.",
        "city": "Санкт-Петербург",
        "phone": "+79112345678",
        "current_plan": "pro",
        "services": [
            {"name": "Чистка лица", "price": 3500, "duration_min": 90, "category": "Чистки"},
            {"name": "Пилинг", "price": 2500, "duration_min": 45, "category": "Пилинги"},
            {"name": "Мезотерапия", "price": 5000, "duration_min": 60, "category": "Инъекции"},
            {"name": "Консультация", "price": 1000, "duration_min": 30, "category": "Консультации",
             "is_consultation": True, "is_online": True},
        ],
    },
]

CLIENT_NAMES = [
    "Ольга Иванова", "Дмитрий Петров", "Мария Сидорова",
    "Алексей Козлов", "Наталья Морозова", "Сергей Волков",
    "Екатерина Новикова", "Андрей Соколов", "Татьяна Лебедева",
    "Иван Кузнецов",
]


async def seed():
    async with async_session_factory() as session:
        # Identities для мастеров
        master_objs = []
        for i, mdata in enumerate(MASTERS_DATA, start=1):
            identity = Identity(
                platform="telegram",
                platform_id=f"demo_master_{i}",
                role="master",
            )
            session.add(identity)
            await session.flush()

            master = Master(
                identity_id=identity.id,
                display_name=mdata["display_name"],
                slug=mdata["slug"],
                specialization=mdata["specialization"],
                description=mdata["description"],
                city=mdata["city"],
                phone=mdata["phone"],
                current_plan=mdata["current_plan"],
                link_page_enabled=True,
                rating_avg=round(random.uniform(4.2, 5.0), 1),
                rating_count=random.randint(10, 80),
                is_verified=True,
            )
            session.add(master)
            await session.flush()

            # Services
            for j, svc in enumerate(mdata["services"]):
                service = Service(
                    master_id=master.id,
                    name=svc["name"],
                    price=svc["price"],
                    price_max=svc.get("price_max"),
                    duration_min=svc["duration_min"],
                    category=svc.get("category"),
                    sort_order=j,
                    is_active=True,
                    is_online=svc.get("is_online", False),
                    is_consultation=svc.get("is_consultation", False),
                )
                session.add(service)

            # Location
            loc = MasterLocation(
                master_id=master.id,
                name="Основной кабинет",
                address=f"г. {mdata['city']}, ул. Примерная, д.{random.randint(1,50)}",
                is_default=True,
            )
            session.add(loc)
            master_objs.append(master)

        await session.flush()

        # Client identities
        client_identities = []
        for i, name in enumerate(CLIENT_NAMES, start=1):
            ci = Identity(
                platform="telegram",
                platform_id=f"demo_client_{i}",
                role="client",
            )
            session.add(ci)
            client_identities.append(ci)
        await session.flush()

        # Clients for each master
        now = datetime.now(timezone.utc)
        for master in master_objs:
            services_q = await session.execute(
                Service.__table__.select().where(Service.master_id == master.id)
            )
            svc_list = services_q.fetchall()

            for j, ci in enumerate(client_identities[:6]):
                client = Client(
                    master_id=master.id,
                    identity_id=ci.id,
                    name=CLIENT_NAMES[j],
                    phone=f"+7900{random.randint(1000000,9999999)}",
                    source="demo",
                    first_visit_date=now - timedelta(days=random.randint(30, 180)),
                    last_visit_date=now - timedelta(days=random.randint(0, 14)),
                    visit_count=random.randint(1, 15),
                    total_revenue=random.randint(3000, 30000),
                    no_show_count=random.randint(0, 1),
                    loyalty_points=random.randint(0, 500),
                )
                session.add(client)
                await session.flush()

                # Appointments
                for k in range(random.randint(1, 4)):
                    svc = random.choice(svc_list)
                    appt_date = now - timedelta(days=random.randint(1, 60))
                    status = random.choice([
                        AppointmentStatus.completed,
                        AppointmentStatus.completed,
                        AppointmentStatus.completed,
                        AppointmentStatus.cancelled,
                    ])
                    appt = Appointment(
                        master_id=master.id,
                        client_id=client.id,
                        service_id=svc.id,
                        start_time=appt_date,
                        end_time=appt_date + timedelta(minutes=svc.duration_min),
                        status=status,
                        price=svc.price,
                    )
                    session.add(appt)

            # Future appointments
            for k in range(3):
                ci = random.choice(client_identities[:6])
                svc = random.choice(svc_list)
                future = now + timedelta(days=random.randint(1, 14), hours=random.randint(10, 18))
                client_q = await session.execute(
                    Client.__table__.select().where(
                        Client.master_id == master.id,
                        Client.identity_id == ci.id,
                    )
                )
                client_row = client_q.first()
                if client_row:
                    appt = Appointment(
                        master_id=master.id,
                        client_id=client_row.id,
                        service_id=svc.id,
                        start_time=future,
                        end_time=future + timedelta(minutes=svc.duration_min),
                        status=AppointmentStatus.confirmed,
                        price=svc.price,
                    )
                    session.add(appt)

        await session.commit()
        print(f"✓ Создано {len(MASTERS_DATA)} мастеров, "
              f"{len(CLIENT_NAMES)} клиентских identity, "
              f"записи и услуги.")


if __name__ == "__main__":
    asyncio.run(seed())
