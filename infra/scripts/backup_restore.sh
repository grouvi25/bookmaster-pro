#!/bin/bash
# BookMaster Pro — восстановление из бэкапа (S3 → PostgreSQL + Redis)
# Использование: ./backup_restore.sh [YYYY-MM-DD] [--type daily|monthly]
set -euo pipefail

DATE="${1:-}"
TYPE="${2:---type}"
TIER="${3:-daily}"

if [ -z "$DATE" ]; then
    echo "Использование: $0 YYYY-MM-DD [--type daily|monthly]"
    echo ""
    echo "Примеры:"
    echo "  $0 2026-06-05              # восстановить из daily/2026-06-05"
    echo "  $0 2026-06 --type monthly  # восстановить из monthly/2026-06"
    exit 1
fi

S3_BUCKET="bookmaster-backups"
S3_ENDPOINT="https://storage.yandexcloud.net"
RESTORE_DIR="/tmp/bookmaster_restore_$(date +%s)"
LOG_DIR="/var/log/bookmaster"
LOG_FILE="${LOG_DIR}/restore_$(date +%Y-%m-%d_%H-%M-%S).log"

# Загружаем переменные окружения
if [ -f /opt/bookmaster/.env ]; then
    set -a
    source /opt/bookmaster/.env
    set +a
fi

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"; }

mkdir -p "${RESTORE_DIR}" "${LOG_DIR}"

# Определяем prefix в S3
if [ "$TYPE" = "--type" ] && [ "$TIER" = "monthly" ]; then
    S3_PREFIX="monthly/${DATE}"
else
    S3_PREFIX="daily/${DATE}"
fi

log "=== Восстановление начато из s3://${S3_BUCKET}/${S3_PREFIX}/ ==="

# ── 1. Скачиваем файлы из S3 ──────────────────────────────────
log "Скачиваю бэкап из S3..."
AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
aws s3 cp "s3://${S3_BUCKET}/${S3_PREFIX}/" \
    "${RESTORE_DIR}/" \
    --recursive \
    --endpoint-url "${S3_ENDPOINT}" || {
    log "ОШИБКА: не удалось скачать бэкап из S3"
    exit 1
}

log "Скачано:"
ls -la "${RESTORE_DIR}/"

# ── 2. Проверяем манифест ──────────────────────────────────────
if [ -f "${RESTORE_DIR}/manifest.json" ]; then
    log "Манифест:"
    cat "${RESTORE_DIR}/manifest.json" | tee -a "${LOG_FILE}"
    echo ""
else
    log "WARN: manifest.json не найден, продолжаем с тем что есть"
fi

# ── 3. Восстановление PostgreSQL ──────────────────────────────
PG_DUMP=$(find "${RESTORE_DIR}" -name "postgres_*.dump" | head -1)
if [ -n "$PG_DUMP" ]; then
    log "Восстанавливаю PostgreSQL из ${PG_DUMP}..."

    # Копируем дамп в контейнер
    docker cp "${PG_DUMP}" bm_db:/tmp/restore.dump

    # Останавливаем API чтобы не было активных коннектов
    log "Останавливаю API и scheduler..."
    cd /opt/bookmaster/infra
    docker compose -f docker-compose.deploy.yml stop api scheduler 2>/dev/null || true

    # Восстанавливаем
    docker exec bm_db bash -c '
        # Завершаем все подключения
        psql -U bookmaster -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '\''bookmaster'\'' AND pid <> pg_backend_pid();" 2>/dev/null || true
        # Дропаем и создаём заново
        psql -U bookmaster -d postgres -c "DROP DATABASE IF EXISTS bookmaster;"
        psql -U bookmaster -d postgres -c "CREATE DATABASE bookmaster OWNER bookmaster;"
        # Восстанавливаем из дампа
        pg_restore -U bookmaster -d bookmaster --no-owner --no-privileges /tmp/restore.dump
        rm /tmp/restore.dump
    '

    log "PostgreSQL восстановлен!"

    # Запускаем API обратно
    log "Запускаю API и scheduler..."
    docker compose -f docker-compose.deploy.yml up -d api scheduler
    sleep 5
else
    log "WARN: PostgreSQL дамп не найден, пропускаю"
fi

# ── 4. Восстановление Redis ───────────────────────────────────
REDIS_FILE=$(find "${RESTORE_DIR}" -name "redis_*.rdb.gz" -o -name "redis_*.aof.gz" | head -1)
if [ -n "$REDIS_FILE" ]; then
    log "Восстанавливаю Redis из ${REDIS_FILE}..."

    gunzip -k "${REDIS_FILE}" 2>/dev/null || true
    REDIS_UNZIPPED="${REDIS_FILE%.gz}"

    if [[ "$REDIS_UNZIPPED" == *.rdb ]]; then
        # Останавливаем Redis для замены файла
        docker exec bm_redis redis-cli ${REDIS_PASSWORD:+-a "$REDIS_PASSWORD"} SHUTDOWN NOSAVE 2>/dev/null || true
        sleep 2
        docker cp "${REDIS_UNZIPPED}" bm_redis:/data/dump.rdb
        cd /opt/bookmaster/infra
        docker compose -f docker-compose.deploy.yml up -d redis
        sleep 3
        log "Redis восстановлен из RDB"
    else
        log "WARN: AOF восстановление не поддерживается автоматически"
    fi
else
    log "WARN: Redis бэкап не найден, пропускаю"
fi

# ── 5. Чистим ──────────────────────────────────────────────────
rm -rf "${RESTORE_DIR}"

log "=== Восстановление завершено ==="

# Проверяем здоровье
log "Проверяю контейнеры..."
docker ps --format 'table {{.Names}}\t{{.Status}}' | tee -a "${LOG_FILE}"
