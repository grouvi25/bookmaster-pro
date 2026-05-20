"""
Тесты модуля бронирования — слоты, создание записей, отмена, no-show.
"""

from datetime import date, datetime, timedelta, timezone, time

import pytest
from sqlalchemy import select

from app.modules.booking.models import (
    Appointment, AppointmentStatus, ScheduleTemplate,
)
from app.modules.booking.slot_service import SlotService
from tests.conftest import make_token


class TestSlotService:
    """Генерация доступных слотов."""

    @pytest.mark.asyncio
    async def test_returns_slots_for_working_day(
        self, db, master, service, schedule_template
    ):
        """На рабочий день с расписанием 9-18 должны быть слоты."""
        slot_svc = SlotService(db)
        # Найдём ближайший понедельник
        today = date.today()
        days_ahead = (0 - today.weekday()) % 7 or 7  # следующий пн
        target = today + timedelta(days=days_ahead)

        slots = await slot_svc.get_available_slots(
            master_id=master.id,
            target_date=target,
            service_id=service.id,
        )
        assert len(slots) > 0
        # Каждый слот должен иметь start и end
        for slot in slots:
            assert "start" in slot or "time_start" in slot

    @pytest.mark.asyncio
    async def test_no_slots_on_day_off(self, db, master, service):
        """В выходной (без расписания) слотов не должно быть."""
        slot_svc = SlotService(db)
        # Суббота
        today = date.today()
        days_ahead = (5 - today.weekday()) % 7 or 7
        target = today + timedelta(days=days_ahead)

        slots = await slot_svc.get_available_slots(
            master_id=master.id,
            target_date=target,
            service_id=service.id,
        )
        assert len(slots) == 0

    @pytest.mark.asyncio
    async def test_occupied_slot_not_available(
        self, db, master, service, schedule_template
    ):
        """Если на слот есть запись — он не доступен."""
        today = date.today()
        days_ahead = (0 - today.weekday()) % 7 or 7
        target = today + timedelta(days=days_ahead)

        # Создаём запись на 10:00-11:00
        appt = Appointment(
            master_id=master.id,
            service_id=service.id,
            client_name="Тест",
            date=target,
            time_start=datetime.combine(target, time(10, 0), tzinfo=timezone.utc),
            time_end=datetime.combine(target, time(11, 0), tzinfo=timezone.utc),
            status=AppointmentStatus.CONFIRMED.value,
        )
        db.add(appt)
        await db.commit()

        slot_svc = SlotService(db)
        slots = await slot_svc.get_available_slots(
            master_id=master.id,
            target_date=target,
            service_id=service.id,
        )
        # Слот 10:00 не должен быть в результатах
        start_times = [
            s.get("start") or s.get("time_start") for s in slots
        ]
        for t in start_times:
            if isinstance(t, str):
                assert "10:00" not in t or "10:10" in t  # buffer может сдвигать
            elif isinstance(t, datetime):
                assert t.hour != 10 or t.minute != 0

    @pytest.mark.asyncio
    async def test_invalid_master_returns_empty(self, db, service):
        """Несуществующий мастер → пустой список."""
        slot_svc = SlotService(db)
        slots = await slot_svc.get_available_slots(
            master_id=99999,
            target_date=date.today(),
            service_id=service.id,
        )
        assert slots == []

    @pytest.mark.asyncio
    async def test_invalid_service_returns_empty(self, db, master, schedule_template):
        """Несуществующая услуга → пустой список."""
        slot_svc = SlotService(db)
        slots = await slot_svc.get_available_slots(
            master_id=master.id,
            target_date=date.today(),
            service_id=99999,
        )
        assert slots == []


class TestBookingAPI:
    """Тесты API эндпоинтов бронирования."""

    @pytest.mark.asyncio
    async def test_get_available_dates(
        self, client, master, service, schedule_template
    ):
        resp = await client.get(
            "/api/v1/booking/available-dates",
            params={
                "master_id": master.id,
                "service_id": service.id,
                "days_ahead": 14,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "dates" in data
        # Должны быть хотя бы будние дни
        assert len(data["dates"]) > 0

    @pytest.mark.asyncio
    async def test_create_booking(
        self, client, db, master, service, schedule_template, test_client, client_identity
    ):
        """Создание записи через API."""
        token = make_token(client_identity.id, "client", "222222")

        # Находим ближайший рабочий день (понедельник)
        today = date.today()
        days_ahead = (0 - today.weekday()) % 7 or 7
        target = today + timedelta(days=days_ahead)

        resp = await client.post(
            "/api/v1/booking/create",
            json={
                "master_id": master.id,
                "service_id": service.id,
                "date": target.isoformat(),
                "time_start": f"{target.isoformat()}T10:00:00",
                "client_name": "Тест Клиент",
                "client_phone": "+79001234567",
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        # Может быть 200 или 201
        assert resp.status_code in (200, 201), resp.text

    @pytest.mark.asyncio
    async def test_get_master_schedule(
        self, client, master, master_identity, schedule_template
    ):
        """Получение расписания мастера."""
        token = make_token(master_identity.id, "master")
        today = date.today()
        resp = await client.get(
            "/api/v1/booking/schedule",
            params={
                "date_from": today.isoformat(),
                "date_to": (today + timedelta(days=7)).isoformat(),
            },
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
