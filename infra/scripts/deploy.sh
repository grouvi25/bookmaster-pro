#!/bin/bash
# Скрипт полного деплоя на VPS/Yandex Cloud
# Использование: ./infra/scripts/deploy.sh
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_ok()   { echo -e "${GREEN}[OK] $1${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_err()  { echo -e "${RED}[ERROR] $1${NC}"; exit 1; }

echo "BookMaster Pro — деплой"
echo "=============================="

# ── 1. Проверка .env ─────────────────────────────────────────────────
echo "Проверка конфигурации..."
if [ ! -f ".env" ]; then
    log_err ".env файл не найден. Скопируйте .env.example и заполните."
fi

check_var() {
    val=$(grep "^$1=" .env | cut -d'=' -f2)
    if [ -z "$val" ]; then
        log_err "Переменная $1 не задана в .env"
    else
        log_ok "$1 задана"
    fi
}

check_var "TG_BOT_TOKEN"
check_var "DATABASE_URL"
check_var "REDIS_URL"
check_var "SECRET_KEY"
check_var_optional() {
    val=$(grep "^$1=" .env | cut -d'=' -f2)
    if [ -z "$val" ]; then
        log_warn "Переменная $1 не задана в .env (необязательная)"
    else
        log_ok "$1 задана"
    fi
}

check_var_optional "YOOKASSA_SHOP_ID"
check_var_optional "YOOKASSA_SECRET_KEY"
check_var "S3_ACCESS_KEY_ID"
check_var "S3_SECRET_ACCESS_KEY"
check_var "OPENAI_API_KEY"
check_var "SUPERADMIN_IDS"
check_var "APP_URL"

# ── 2. Проверка SSL ───────────────────────────────────────────────────
echo ""
echo "Проверка SSL сертификатов..."
if [ -f "infra/nginx/ssl/fullchain.pem" ] && \
   [ -f "infra/nginx/ssl/privkey.pem" ]; then
    expiry=$(openssl x509 -enddate -noout -in infra/nginx/ssl/fullchain.pem \
             | cut -d= -f2)
    log_ok "SSL сертификат найден. Истекает: $expiry"
else
    log_warn "SSL сертификаты не найдены. Работаем без HTTPS (только для dev)."
fi

# ── 3. Сборка Docker образов ─────────────────────────────────────────
echo ""
echo "Сборка Docker образов..."
docker compose -f infra/docker-compose.prod.yml build --no-cache
log_ok "Образы собраны"

# ── 4. Запуск инфраструктуры (БД, Redis) ─────────────────────────────
echo ""
echo "Запуск инфраструктуры..."
docker compose -f infra/docker-compose.prod.yml up -d db redis

echo "Ожидание готовности PostgreSQL..."
for i in {1..30}; do
    if docker compose -f infra/docker-compose.prod.yml exec -T db \
       pg_isready -U bookmaster > /dev/null 2>&1; then
        log_ok "PostgreSQL готов"
        break
    fi
    [ $i -eq 30 ] && log_err "PostgreSQL не запустился за 30 секунд"
    sleep 1
done

# ── 5. Миграции ──────────────────────────────────────────────────────
echo ""
echo "Применение миграций БД..."
docker compose -f infra/docker-compose.prod.yml run --rm api \
    sh -c "cd /app && alembic upgrade head"
log_ok "Миграции применены"

# ── 6. Seed данных ───────────────────────────────────────────────────
echo ""
echo "Инициализация системных данных..."
if [ -f "infra/scripts/seed.py" ]; then
    docker compose -f infra/docker-compose.prod.yml run --rm api \
        python infra/scripts/seed.py
    log_ok "Seed выполнен"
else
    log_warn "seed.py не найден — пропускаем seed"
fi

# ── 7. Запуск всех сервисов ──────────────────────────────────────────
echo ""
echo "Запуск всех сервисов..."
docker compose -f infra/docker-compose.prod.yml up -d
log_ok "Все сервисы запущены"

# ── 8. Smoke tests ───────────────────────────────────────────────────
echo ""
echo "Smoke tests..."
sleep 5

# Health check API
if curl -sf http://localhost:8000/health > /dev/null; then
    log_ok "API health check: OK"
else
    log_err "API не отвечает на health check"
fi

# Marketplace
if curl -sf http://localhost:3000 > /dev/null; then
    log_ok "Marketplace health check: OK"
else
    log_warn "Marketplace не отвечает (не критично)"
fi

# Telegram Bot
TG_TOKEN=$(grep "^TG_BOT_TOKEN=" .env | cut -d'=' -f2)
TG_RESP=$(curl -s "https://api.telegram.org/bot${TG_TOKEN}/getMe")
if echo "$TG_RESP" | grep -q '"ok":true'; then
    BOT_NAME=$(echo "$TG_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin)['result']['username'])")
    log_ok "Telegram Bot: @${BOT_NAME}"
else
    log_warn "Telegram Bot API недоступен"
fi

# ── 9. Настройка Telegram Webhook ────────────────────────────────────
echo ""
echo "Настройка Telegram Webhook..."
WEBHOOK_URL=$(grep "^TG_WEBHOOK_URL=" .env | cut -d'=' -f2)
WEBHOOK_SECRET=$(grep "^TG_WEBHOOK_SECRET=" .env | cut -d'=' -f2)
if [ -n "$WEBHOOK_URL" ]; then
    SET_RESP=$(curl -s -X POST \
        "https://api.telegram.org/bot${TG_TOKEN}/setWebhook" \
        -H "Content-Type: application/json" \
        -d "{
            \"url\": \"${WEBHOOK_URL}\",
            \"secret_token\": \"${WEBHOOK_SECRET}\",
            \"drop_pending_updates\": true
        }")
    if echo "$SET_RESP" | grep -q '"ok":true'; then
        log_ok "Telegram Webhook установлен: ${WEBHOOK_URL}"
    else
        log_warn "Не удалось установить webhook: $SET_RESP"
    fi
else
    log_warn "TG_WEBHOOK_URL не задан — бот работает в polling режиме"
fi

# ── 10. Итог ─────────────────────────────────────────────────────────
echo ""
echo "=============================="
echo -e "${GREEN}Деплой завершён успешно!${NC}"
echo ""
API_URL_VAL=$(grep "^API_URL=" .env | cut -d'=' -f2)
APP_URL_VAL=$(grep "^APP_URL=" .env | cut -d'=' -f2)
echo "API:          ${API_URL_VAL}"
echo "Mini-App:     ${APP_URL_VAL}"
echo ""
echo "Для просмотра логов:"
echo "  docker compose -f infra/docker-compose.prod.yml logs -f [service]"
echo ""
echo "Для перезапуска сервиса:"
echo "  docker compose -f infra/docker-compose.prod.yml restart [service]"
