# BookMaster Pro

Полнофункциональная платформа онлайн-записи к мастерам услуг.  
Telegram Web App + VK MAX Mini-App · Python/FastAPI · React 18 · PostgreSQL · AI-ассистент

---

## Что это

BookMaster Pro — экосистема из трёх продуктов:

1. **Mini-App для мастера** — управление бизнесом (расписание, CRM, аналитика, AI-помощник)
2. **Mini-App для клиента** — запись, история визитов, баллы лояльности, отзывы
3. **Маркетплейс-сайт** — публичный каталог мастеров с SEO (Next.js SSR)

Бот-слой (TG + MAX) работает только как канал доставки уведомлений и точка входа в Mini-App.

---

## Архитектура

```
bookmaster-pro/
├── apps/
│   ├── api/              # FastAPI backend (Python 3.12)
│   ├── mini-app/         # React 18 Mini-App (TG + MAX)
│   ├── marketplace/      # Next.js 14 SSR (SEO маркетплейс)
│   ├── bot-tg/           # Telegram бот (aiogram 3)
│   ├── bot-max/          # MAX бот (httpx + webhook)
│   └── scheduler/        # APScheduler (фоновые задачи)
├── packages/
│   ├── shared-types/     # Общие TypeScript типы
│   └── shared-config/    # Общие константы
├── infra/
│   ├── docker-compose.deploy.yml
│   ├── nginx/
│   └── docker/
├── .env.example
├── turbo.json
└── pnpm-workspace.yaml
```

---

## Технологический стек

| Слой | Технология | Версия |
|------|-----------|--------|
| Backend | FastAPI + SQLAlchemy 2 async + Alembic | Python 3.12 |
| Frontend | React 18 + TypeScript + Vite + Tailwind + Zustand | Vite 5 |
| БД | PostgreSQL 16 + pgvector + PostGIS + pg_trgm | PG 16 |
| Кэш / очереди | Redis 7 | 7-alpine |
| AI | OpenAI GPT-4o / YandexGPT + RAG (pgvector) | — |
| STT | OpenAI Whisper / Yandex SpeechKit | — |
| Платежи | ЮKassa Splits API | — |
| Боты | aiogram 3 (TG) + httpx webhooks (MAX) | — |
| Маркетплейс | Next.js 14 App Router (SSR) | — |
| Планировщик | APScheduler + Redis jobstore | — |
| Мониторинг | Sentry + Prometheus + Grafana | — |
| Инфра | Docker Compose + Nginx (SSL, rate limit) | — |

---

## Модули (24 штуки)

| Модуль | Описание |
|--------|----------|
| **Auth** | JWT + Telegram initData / MAX Bridge, определение роли |
| **Masters** | Профиль, локации, расписание, настройки |
| **Services** | CRUD услуг с категориями и сортировкой |
| **Booking** | Генерация слотов, создание/отмена/завершение записей |
| **Payments** | ЮKassa: создание, webhook, расщепление, refund, рекуррент |
| **CRM (Clients)** | Карточка клиента, теги, заметки, сегменты, история |
| **Loyalty** | Баллы, уровни (new/regular/vip), стрики, рефералы, сгорание |
| **Promo** | Промокоды, скидки (%, фикс.), лимиты, аналитика |
| **Waitlist** | Лист ожидания + автоуведомление при освобождении слота |
| **Reviews** | Отзывы 1-5★, ответы мастера, модерация |
| **AI** | RAG-советник, клиентский чат-бот, контент-мастер, голосовой дневник |
| **Analytics** | Дашборд: выручка, топ-услуги, воронка, динамика |
| **Portfolio** | Фото работ (S3), галерея на профиле |
| **Consultations** | Онлайн-консультации (слоты, бронирование, видеозвонок) |
| **Support** | Тикеты, SLA-трекинг, приоритеты, модерация |
| **Broadcast** | Рассылки по сегментам клиентов |
| **NPS** | Ежеквартальный NPS-опрос мастеров |
| **Marketplace** | Каталог мастеров, геопоиск, FTS, SEO-страницы |
| **Widget** | Встраиваемый iframe для внешних сайтов |
| **Uploads** | S3 загрузка файлов (presigned URL) |
| **Superadmin** | Дашборд, финансы, мастера, тикеты, SLA, growth, промо-коды, broadcast, команда |
| **Feature Flags** | Тарифные ограничения per-мастер |
| **Webhooks** | ЮKassa incoming, валидация IP |
| **No-show** | AI-скоринг риска, авто-предоплата, чёрный список |

---

## Роли

| Роль | Интерфейс | Возможности |
|------|-----------|-------------|
| **Суперадмин** | Mini-App → скрытая вкладка | Полное управление платформой |
| **Модератор** | Mini-App → панель модератора | Тикеты, верификация, отзывы |
| **Мастер** | Mini-App → мастерский режим (6 вкладок) | Свои данные, клиенты, AI |
| **Клиент** | Mini-App → клиентский режим | Запись, история, баллы |

---

## Быстрый старт (development)

### 1. Клонировать и настроить

```bash
git clone <repo-url> && cd bookmaster-pro
cp .env.example .env
# Заполнить .env (минимум: DATABASE_URL, REDIS_URL, SECRET_KEY, TG_BOT_TOKEN)
```

### 2. Поднять инфраструктуру

```bash
cd infra && docker compose up -d db redis
```

### 3. Backend

```bash
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend (Mini-App)

```bash
cd apps/mini-app
pnpm install
pnpm dev
```

### 5. Scheduler (фоновые задачи)

```bash
cd apps/scheduler
python runner.py
```

### 6. Боты

```bash
# Telegram
cd apps/bot-tg && python -m app.bot

# MAX
cd apps/bot-max && uvicorn app.bot:app --port 8082
```

---

## Production деплой

Полный стек поднимается через Docker Compose:

```bash
docker compose -f infra/docker-compose.deploy.yml up -d
```

**Контейнеры:** db, redis, api, scheduler, bot-tg, bot-max, mini-app, marketplace

**Nginx:** SSL termination, rate limiting (30r/m API, 10r/m auth), WebSocket proxy для AI-чата.

**Деплой-скрипты:**
- `.deploy_apply.py` — полный деплой (pull → build → migrate → restart → smoke test)
- `.deploy_smoke.py` — проверка здоровья всех сервисов
- `.deploy_add_superadmin.py` — добавление суперадмина в .env

---

## Тарифная матрица

| Функция | Старт (590₽) | Базовый (990₽) | Профи (1990₽) | Профи+AI (2990₽) | Бизнес (4990₽) |
|---------|:---:|:---:|:---:|:---:|:---:|
| Записей/мес | 30 | 150 | ∞ | ∞ | ∞ |
| Услуг | 3 | 10 | ∞ | ∞ | ∞ |
| CRM расширенный | ❌ | ❌ | ✅ | ✅ | ✅ |
| Лояльность | ❌ | ❌ | ✅ | ✅ | ✅ |
| AI Советник | ❌ | ❌ | ✅ | ✅ | ✅ |
| AI Голосовой | ❌ | ❌ | ❌ | ✅ | ✅ |
| AI токены/мес | — | — | 200K | 1M | 3M |
| Маркетплейс | ❌ | ✅ | ✅ | ✅ | ✅+Featured |
| Онлайн-консультации | ❌ | ❌ | ✅ | ✅ | ✅ |
| Комиссия онлайн-оплат | 7% | 7% | 6% | 5.5% | 5% |

---

## Переменные окружения

Все переменные описаны в `.env.example`. Ключевые:

```env
# Платформы
TG_BOT_TOKEN=               # от @BotFather
MAX_BOT_TOKEN=              # VK Dev Console
SUPERADMIN_IDS=123456789    # TG user_id через запятую

# БД
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/bookmaster
REDIS_URL=redis://localhost:6379/0

# AI (опционально — без них AI-модуль работает в dummy-режиме)
AI_DEFAULT_PROVIDER=openai
AI_PROXY_URL=               # Railway прокси (обход блокировок из РФ)
OPENAI_API_KEY=sk-...

# Платежи
YOOKASSA_SHOP_ID=
YOOKASSA_SECRET_KEY=

# Приложение
APP_URL=https://app.bookmaster.pro
SECRET_KEY=change-me-64-chars
```

---

## Scheduler — фоновые задачи

| Job | Расписание | Что делает |
|-----|-----------|-----------|
| remind_24h | каждый час | Напоминание за 24ч до визита |
| remind_2h | каждые 30 мин | Напоминание за 2ч |
| cleanup_pending | каждую минуту | Освобождение незабронированных слотов (>5 мин) |
| admin_daily | 9:00 | Список записей на сегодня мастеру |
| birthday_promo | 8:00 | Поздравление + бонус за 3 дня до ДР |
| reactivation | 11:00 | Приглашение неактивных клиентов (>30 дней) |
| post_visit_review | каждый час | Запрос отзыва через 1ч после визита |
| post_visit_rebooking | каждые 2ч | Приглашение записаться снова (через 24ч) |
| billing_reminder | 10:00 | Напоминание об оплате подписки (за 3 дня) |
| billing_auto_charge | 6:00 | Автосписание рекуррентной оплаты |
| ai_reindex | 3:00 | Переиндексация RAG-базы знаний |
| loyalty_expire | 2:00 | Сгорание просроченных баллов |
| loyalty_expiry_warn | 10:30 | Предупреждение о скором сгорании |
| waitlist_notify | каждые 5 мин | Уведомление из листа ожидания |

---

## Тестирование

```bash
cd apps/api
pip install -r requirements-test.txt
pytest tests/ -v
```

Тесты используют SQLite in-memory — не требуют запущенного PostgreSQL.

---

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`):
- Backend: ruff lint + pytest
- Frontend: TypeScript type check + build
- Marketplace: Next.js build

---

## Лицензия

Проприетарный код. Все права защищены.
