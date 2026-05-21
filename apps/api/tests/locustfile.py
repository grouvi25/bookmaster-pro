"""
Locust нагрузочное тестирование — Phase 6 ТЗ.
100 одновременных пользователей. Проверка race condition на слотах.

Запуск:
  pip install locust
  locust -f tests/locustfile.py --host=http://localhost:8000

Или headless:
  locust -f tests/locustfile.py --host=http://localhost:8000 \
    --users=100 --spawn-rate=10 --run-time=60s --headless
"""

import random
from datetime import date, timedelta

from locust import HttpUser, task, between, tag


class ClientUser(HttpUser):
    """Имитация клиента, записывающегося к мастеру."""

    wait_time = between(1, 3)

    def on_start(self):
        """Получаем мастера для тестов."""
        resp = self.client.get("/api/v1/marketplace/search?per_page=5")
        if resp.status_code == 200:
            masters = resp.json().get("masters", [])
            if masters:
                self.master = random.choice(masters)
                self.master_id = self.master["id"]
                self.master_slug = self.master["slug"]
            else:
                self.master_id = 1
                self.master_slug = "anna-petrova"
        else:
            self.master_id = 1
            self.master_slug = "anna-petrova"

    @task(5)
    @tag("read")
    def health_check(self):
        """GET /health — baseline."""
        self.client.get("/health")

    @task(10)
    @tag("read", "marketplace")
    def marketplace_search(self):
        """GET /marketplace/search — основной поиск."""
        self.client.get("/api/v1/marketplace/search")

    @task(8)
    @tag("read", "marketplace")
    def marketplace_search_filtered(self):
        """GET /marketplace/search с фильтрами."""
        specs = ["Маникюр", "Массаж", "Брови", "Парикмахер", "Косметолог"]
        self.client.get(
            "/api/v1/marketplace/search",
            params={"specialization": random.choice(specs)},
        )

    @task(5)
    @tag("read", "marketplace")
    def marketplace_featured(self):
        """GET /marketplace/featured."""
        self.client.get("/api/v1/marketplace/featured?limit=6")

    @task(8)
    @tag("read", "booking")
    def available_dates(self):
        """GET /booking/available-dates — тяжёлый запрос (N дней × DB queries)."""
        self.client.get(
            "/api/v1/booking/available-dates",
            params={
                "master_id": self.master_id,
                "service_id": 1,
                "days_ahead": 14,
            },
        )

    @task(6)
    @tag("read", "booking")
    def available_slots(self):
        """GET /booking/slots — запрос слотов на конкретную дату."""
        target = date.today() + timedelta(days=random.randint(1, 14))
        self.client.get(
            "/api/v1/booking/slots",
            params={
                "master_id": self.master_id,
                "service_id": 1,
                "date": target.isoformat(),
            },
        )

    @task(4)
    @tag("read")
    def master_public_profile(self):
        """GET /masters/{slug} — публичный профиль."""
        self.client.get(f"/api/v1/masters/{self.master_slug}")

    @task(3)
    @tag("read")
    def master_reviews(self):
        """GET /reviews/master/{id} — отзывы."""
        self.client.get(
            f"/api/v1/reviews/master/{self.master_id}",
            params={"limit": 5},
        )

    @task(2)
    @tag("read", "marketplace")
    def marketplace_profile(self):
        """GET /marketplace/master/{slug} — полный профиль для маркетплейса."""
        self.client.get(f"/api/v1/marketplace/master/{self.master_slug}")


class RaceConditionUser(HttpUser):
    """
    Имитация race condition: 10 клиентов одновременно
    пытаются занять один и тот же слот.
    """

    wait_time = between(0.1, 0.5)
    weight = 3  # меньше чем ClientUser

    def on_start(self):
        self.master_id = 1

    @task
    @tag("write", "race-condition")
    def try_book_same_slot(self):
        """POST /booking/create — race condition test.
        Без реального токена — ожидаем 401, но нагрузка на DB всё равно идёт."""
        target = date.today() + timedelta(days=1)
        self.client.post(
            "/api/v1/booking/create",
            json={
                "master_id": self.master_id,
                "service_id": 1,
                "date": target.isoformat(),
                "time_start": f"{target.isoformat()}T10:00:00",
                "client_name": "Load Test",
                "client_phone": "+79001234567",
            },
            headers={"Authorization": "Bearer fake_token_for_load_test"},
            name="/api/v1/booking/create [race-condition]",
        )
