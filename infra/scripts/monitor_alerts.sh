#!/bin/bash
# BookMaster Pro — Monitoring Alerts → Telegram
# Checks: containers, nginx systemd, disk, CPU, RAM, API health
# Run via cron every 5 min

set -uo pipefail
source /opt/bookmaster/.env 2>/dev/null || true

BOT_TOKEN="${TG_BOT_TOKEN}"
CHAT_ID="1045744857"
ALERT_FILE="/tmp/bm_alert_state"

send_tg() {
    local msg="$1"
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -d chat_id="${CHAT_ID}" \
        -d parse_mode=HTML \
        -d text="${msg}" > /dev/null 2>&1
}

ALERTS=""

# 1. Check Docker containers
EXPECTED="bm_api bm_db bm_redis bm_scheduler bm_bot_tg bm_bot_max bm_marketplace bm_mini_app"
for c in $EXPECTED; do
    STATUS=$(docker inspect --format '{{.State.Status}}' "$c" 2>/dev/null || echo "missing")
    if [ "$STATUS" != "running" ]; then
        ALERTS="${ALERTS}\n🔴 Контейнер <b>${c}</b> — ${STATUS}"
    fi
done

# 2. Check nginx (systemd service, not docker)
NGINX_STATUS=$(systemctl is-active nginx 2>/dev/null || echo "inactive")
if [ "$NGINX_STATUS" != "active" ]; then
    ALERTS="${ALERTS}\n🔴 Nginx — ${NGINX_STATUS}"
fi

# 3. Check disk usage > 90%
DISK_PCT=$(df / --output=pcent | tail -1 | tr -d ' %')
if [ "$DISK_PCT" -gt 90 ]; then
    DISK_FREE=$(df -h / --output=avail | tail -1 | tr -d ' ')
    ALERTS="${ALERTS}\n🔴 Диск: ${DISK_PCT}% (свободно ${DISK_FREE})"
fi

# 4. API health (mapped to port 8010)
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:8010/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
    ALERTS="${ALERTS}\n🔴 API /health — HTTP ${HTTP_CODE}"
fi

# 5. CPU > 90% (average over 3 samples)
CPU_IDLE=$(top -bn1 | grep "Cpu(s)" | awk '{print $8}' | cut -d. -f1)
CPU_USED=$((100 - CPU_IDLE))
if [ "$CPU_USED" -gt 90 ]; then
    ALERTS="${ALERTS}\n🟡 CPU: ${CPU_USED}%"
fi

# 6. RAM > 90%
MEM_PCT=$(free | awk '/Mem:/ {printf "%.0f", ($3/$2)*100}')
if [ "$MEM_PCT" -gt 90 ]; then
    ALERTS="${ALERTS}\n🟡 RAM: ${MEM_PCT}%"
fi

# Send alert only if new/changed issues
if [ -n "$ALERTS" ]; then
    ALERT_HASH=$(echo -e "$ALERTS" | md5sum | cut -d' ' -f1)
    LAST_HASH=$(cat "$ALERT_FILE" 2>/dev/null || echo "")
    if [ "$ALERT_HASH" != "$LAST_HASH" ]; then
        MSG="⚠️ <b>BookMaster Alert</b>\n${ALERTS}\n\n🕐 $(date '+%H:%M %d.%m.%Y')"
        send_tg "$(echo -e "$MSG")"
        echo "$ALERT_HASH" > "$ALERT_FILE"
    fi
else
    rm -f "$ALERT_FILE" 2>/dev/null
fi
