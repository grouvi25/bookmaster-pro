#!/bin/bash
# BookMaster Pro — ежедневный бэкап PostgreSQL + Redis → YC S3
# Запускается через scheduler или crontab
set -euo pipefail

DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/tmp/bookmaster_backup_${TIMESTAMP}"
S3_BUCKET="bookmaster-backups"
S3_ENDPOINT="https://storage.yandexcloud.net"
LOG_DIR="/var/log/bookmaster"
LOG_FILE="${LOG_DIR}/backup_${DATE}.log"

# Загружаем переменные окружения
if [ -f /opt/bookmaster/.env ]; then
    set -a
    source /opt/bookmaster/.env
    set +a
fi
if [ -f /opt/bookmaster/infra/.env ]; then
    set -a
    source /opt/bookmaster/infra/.env
    set +a
fi

# Функция логирования
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"; }

mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"
log "=== Бэкап начат: ${TIMESTAMP} ==="

# ── 1. PostgreSQL dump (через Docker) ──────────────────────────
log "Создаю pg_dump..."
docker exec bm_db pg_dump \
    -U bookmaster -d bookmaster \
    --format=custom \
    --compress=9 \
    -f /tmp/postgres_${DATE}.dump

docker cp bm_db:/tmp/postgres_${DATE}.dump "${BACKUP_DIR}/postgres_${DATE}.dump"
docker exec bm_db rm /tmp/postgres_${DATE}.dump

PG_SIZE=$(du -sh "${BACKUP_DIR}/postgres_${DATE}.dump" | cut -f1)
log "PostgreSQL dump готов: ${PG_SIZE}"

# ── 2. Redis snapshot (через Docker) ───────────────────────────
log "Создаю Redis snapshot..."
if [ -n "${REDIS_PASSWORD:-}" ]; then
    docker exec bm_redis redis-cli -a "${REDIS_PASSWORD}" BGSAVE 2>/dev/null
else
    docker exec bm_redis redis-cli BGSAVE 2>/dev/null
fi
sleep 3  # Ждём завершения фонового сохранения

docker cp bm_redis:/data/dump.rdb "${BACKUP_DIR}/redis_${DATE}.rdb" 2>/dev/null || {
    docker cp bm_redis:/data/appendonly.aof "${BACKUP_DIR}/redis_${DATE}.aof" 2>/dev/null || {
        log "WARN: не удалось скопировать Redis данные, пропускаю"
    }
}

# gzip Redis файл если он есть
if [ -f "${BACKUP_DIR}/redis_${DATE}.rdb" ]; then
    gzip "${BACKUP_DIR}/redis_${DATE}.rdb"
    REDIS_FILE="redis_${DATE}.rdb.gz"
    REDIS_SIZE=$(du -sh "${BACKUP_DIR}/${REDIS_FILE}" | cut -f1)
    log "Redis snapshot готов: ${REDIS_SIZE}"
elif [ -f "${BACKUP_DIR}/redis_${DATE}.aof" ]; then
    gzip "${BACKUP_DIR}/redis_${DATE}.aof"
    REDIS_FILE="redis_${DATE}.aof.gz"
    REDIS_SIZE=$(du -sh "${BACKUP_DIR}/${REDIS_FILE}" | cut -f1)
    log "Redis AOF готов: ${REDIS_SIZE}"
else
    REDIS_FILE=""
    REDIS_SIZE="0"
    log "WARN: Redis данные не найдены"
fi

# ── 3. Создаём манифест ─────────────────────────────────────────
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
cat > "${BACKUP_DIR}/manifest.json" << MANIFEST
{
  "timestamp": "${TIMESTAMP}",
  "date": "${DATE}",
  "postgres_file": "postgres_${DATE}.dump",
  "redis_file": "${REDIS_FILE}",
  "pg_size": "${PG_SIZE}",
  "redis_size": "${REDIS_SIZE}",
  "total_size": "${TOTAL_SIZE}",
  "status": "complete"
}
MANIFEST

# ── 4. Загружаем в YC S3 ────────────────────────────────────────
log "Загружаю в YC Object Storage..."

AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
aws s3 cp "${BACKUP_DIR}/" \
    "s3://${S3_BUCKET}/daily/${DATE}/" \
    --recursive \
    --endpoint-url "${S3_ENDPOINT}" \
    --quiet

log "Загрузка в S3 завершена"

# ── 5. Monthly snapshot (1-е число месяца) ──────────────────────
if [ "$(date +%d)" = "01" ]; then
    log "Создаю monthly snapshot..."
    AWS_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}" \
    AWS_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}" \
    aws s3 cp "${BACKUP_DIR}/" \
        "s3://${S3_BUCKET}/monthly/$(date +%Y-%m)/" \
        --recursive \
        --endpoint-url "${S3_ENDPOINT}" \
        --quiet
    log "Monthly snapshot создан"
fi

# ── 6. Чистим локальный temp ────────────────────────────────────
rm -rf "${BACKUP_DIR}"
log "=== Бэкап завершён успешно: ${TOTAL_SIZE} ==="

# ── 7. Чистим старые локальные логи (> 7 дней) ──────────────────
find "${LOG_DIR}" -name "backup_*.log" -mtime +7 -delete 2>/dev/null || true

exit 0
