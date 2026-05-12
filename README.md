# BookMaster Pro

Платформа онлайн-записи к мастерам услуг.

**Telegram TWA + VK MAX Mini-App · Python/FastAPI · React 18 · PostgreSQL · AI-ассистент**

## Архитектура

```
bookmaster-pro/
├── apps/
│   ├── api/          # FastAPI backend (Python 3.12)
│   ├── mini-app/     # React 18 Mini-App (TG + MAX)
│   ├── marketplace/  # Next.js 14 SSR (SEO-сайт)
│   ├── bot-tg/       # Telegram бот (aiogram 3)
│   └── bot-max/      # MAX бот (httpx + webhook)
├── packages/
│   └── shared-types/ # Общие типы TypeScript
├── infra/
│   ├── docker-compose.yml
│   ├── nginx/
│   └── scripts/
└── .env.example
```

## Быстрый старт

### 1. Клонировать и настроить окружение

```bash
git clone <repo-url> && cd bookmaster-pro
cp .env.example .env
# Заполнить .env
```

### 2. Поднять инфраструктуру

```bash
cd infra && docker-compose up -d
```

### 3. Backend (API)

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

## Стек

| Компонент | Технология |
|---|---|
| Backend | FastAPI + SQLAlchemy 2 async |
| Frontend | React 18 + TypeScript + Vite + Tailwind |
| БД | PostgreSQL 16 + pgvector + PostGIS |
| Кэш | Redis 7 |
| AI | OpenAI / YandexGPT + LangChain |
| Платежи | ЮKassa Splits API |
| Боты | aiogram 3 (TG) + httpx (MAX) |
| Маркетплейс | Next.js 14 SSR |

## Модули

Auth · Masters · Services · Booking · Payments · CRM · Loyalty · Promo · Waitlist · Reviews · AI · Analytics · Portfolio · Support · Marketplace · Superadmin
