# BookMaster Pro

Платформа для бронирования записей к мастерам услуг.
Telegram Mini-App + MAX Mini-App + Marketplace.

## Архитектура

| Компонент | Стек | Порт |
|-----------|------|------|
| API | FastAPI + SQLAlchemy + asyncpg | 8000 (внутри Docker), 8010 (хост) |
| Mini-App | React 18 + Vite + TanStack Query | 5173 → nginx → app.dealmaster.ru |
| Marketplace | Next.js 14 SSR | 3000 |
| Bot TG | aiogram 3 | — |
| Bot MAX | aiogram 3 | — |
| Scheduler | APScheduler (Redis jobstore) | — |
| DB | PostgreSQL 16 + PostGIS | 5432 |
| Cache | Redis 7 | 6379 |

### Мониторинг

| Компонент | Описание |
|-----------|----------|
| Prometheus | Scraping api:8000/metrics + node-exporter:9100 |
| Grafana | 127.0.0.1:3001 — 16 панелей |
| Node Exporter | Системные метрики |
| Telegram alerts | Каждые 5 мин — контейнеры, nginx, диск, API, CPU, RAM |
| YC Cloud Logging | gRPC shipper каждые 30с |

## Быстрый старт (development)

```bash
# Клонирование
git clone https://github.com/grouvi25/bookmaster-pro.git
cd bookmaster-pro
git checkout init-branch

# Установка зависимостей
pnpm install        # frontend (mini-app, marketplace)
cd apps/api && pip install -r requirements.txt  # backend

# Настройка
cp .env.example .env
# Заполнить: DB_PASSWORD, REDIS_PASSWORD, S3_*, TG_BOT_TOKEN,
#            MAX_BOT_TOKEN, YOOKASSA_*, OPENAI_API_KEY,
#            SUPERADMIN_IDS (через запятую)

# Запуск (dev)
docker compose -f infra/docker-compose.deploy.yml up -d
```

## Деплой на VPS (Yandex Cloud)

### Сервер
- **VPS:** `158.160.177.113` (Debian 12, Yandex Cloud)
- **SSH:** `ssh -i bm_deploy bmaster@158.160.177.113`
- **Домен:** `dealmaster.ru` (app.dealmaster.ru, api.dealmaster.ru)

### Структура на сервере

```
/opt/bookmaster/
├── .env                          # Переменные окружения (все сервисы)
├── apps/
│   ├── api/                      # FastAPI backend
│   ├── mini-app/                 # React frontend
│   ├── marketplace/              # Next.js marketplace
│   ├── bot-tg/                   # Telegram бот
│   ├── bot-max/                  # MAX бот
│   └── scheduler/                # APScheduler воркер
├── infra/
│   ├── docker-compose.deploy.yml # Основной compose (8 сервисов)
│   ├── monitoring/               # Prometheus + Grafana
│   ├── nginx/                    # Конфиги nginx
│   └── scripts/
│       ├── backup.sh             # Бэкап PostgreSQL+Redis → S3
│       ├── monitor_alerts.sh     # Telegram алерты
│       ├── deploy.sh             # Скрипт деплоя
│       └── yc_log_shipper.py     # Отправка логов в YC
└── packages/
    ├── shared-config/
    └── shared-types/
```

### Деплой

```bash
cd /opt/bookmaster/infra

# Билд одного сервиса (mini-app ОБЯЗАТЕЛЬНО --no-cache)
docker compose -f docker-compose.deploy.yml build --no-cache mini-app

# Запуск с пересозданием
docker compose -f docker-compose.deploy.yml up -d --force-recreate mini-app

# Полный деплой всех сервисов
docker compose -f docker-compose.deploy.yml up -d --build --force-recreate
```

### Важные особенности

1. **Nginx** — systemd-сервис, НЕ Docker контейнер
   ```bash
   systemctl status nginx
   systemctl reload nginx
   ```

2. **API порт** — внутри Docker `8000`, маппинг на хост `8010`

3. **mini-app** — ВСЕГДА билдить с `--no-cache`, иначе кешированные слои

4. **Миграции** — запускать внутри контейнера:
   ```bash
   docker exec -it bm_api alembic upgrade head
   ```

5. **БД** — имя `bookmaster` (не bookmaster_db), пользователь `bookmaster`

### Бэкапы

- **Расписание:** ежедневно в 00:00 (crontab bmaster)
- **Хранилище:** YC S3 бакет `bookmaster-backups`
- **Ротация:** daily/ — 30 дней, monthly/ — 365 дней
- **Проверка:**
  ```bash
  # Последний бэкап
  aws s3 ls s3://bookmaster-backups/daily/ --endpoint-url https://storage.yandexcloud.net | tail -5
  ```

### Мониторинг

```bash
# Все контейнеры
docker ps --format "table {{.Names}}\t{{.Status}}"

# Health check
curl http://localhost:8010/health/detailed

# Логи
docker logs bm_api --tail 50
docker logs bm_scheduler --tail 50

# Grafana
# http://127.0.0.1:3001 (admin/bookmaster2024)
# Доступ через SSH tunnel: ssh -L 3001:127.0.0.1:3001 bmaster@158.160.177.113
```

### Переменные окружения (.env)

| Переменная | Описание |
|------------|----------|
| `DB_PASSWORD` | Пароль PostgreSQL |
| `REDIS_PASSWORD` | Пароль Redis |
| `TG_BOT_TOKEN` | Токен Telegram бота |
| `MAX_BOT_TOKEN` | Токен MAX бота |
| `MAX_BOT_USERNAME` | Username MAX бота (для deeplinks) |
| `YOOKASSA_SHOP_ID` | YooKassa Shop ID |
| `YOOKASSA_SECRET_KEY` | YooKassa секретный ключ |
| `OPENAI_API_KEY` | Ключ OpenAI (через AI_PROXY_URL для РФ) |
| `SUPERADMIN_IDS` | ID суперадминов через запятую |
| `S3_*` | Настройки Yandex Cloud S3 |
| `APP_URL` | URL мини-приложения (app.dealmaster.ru) |
| `API_URL` | URL API (api.dealmaster.ru) |

## Модули API

| Модуль | Описание |
|--------|----------|
| auth | Аутентификация TG/MAX, кросс-платформенная привязка |
| masters | Профиль мастера, расписание, локации, QR |
| booking | Бронирование, Redis-блокировка слотов, anti-noshow |
| payments | YooKassa, T-Bank выплаты мастерам |
| clients | CRM — карточки клиентов, сегменты |
| services | Услуги мастера |
| loyalty | Программа лояльности, промокоды, рефералы |
| ai | AI-чат (WebSocket), контент-генерация, STT/TTS, RAG |
| analytics | Аналитика и дашборд |
| reviews | Отзывы и рейтинг |
| monitoring | Ошибки (ErrorTracker), AI-подсказки, бэкапы |
| notifications | Push TG/MAX, email, шаблоны |
| broadcast | Рассылки по сегментам |
| nps | NPS-опросы |
| marketplace | API маркетплейса |
| portfolio | Портфолио мастера |
| consultations | Онлайн-консультации |
| support | Тикеты поддержки |
| superadmin | Панель суперадмина (14 табов) |
| uploads | S3 загрузка файлов, StorageService |

## Лицензия

Proprietary. All rights reserved.
