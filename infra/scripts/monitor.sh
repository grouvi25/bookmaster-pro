#!/bin/bash
# Быстрая проверка состояния всех сервисов

echo "Статус сервисов BookMaster Pro"
echo "================================="

services=("db" "redis" "api" "scheduler" "bot-tg" "bot-max" "marketplace" "nginx")

for svc in "${services[@]}"; do
    status=$(docker-compose -f infra/docker-compose.prod.yml \
             ps -q "$svc" 2>/dev/null | xargs docker inspect \
             --format='{{.State.Status}}' 2>/dev/null)
    if [ "$status" = "running" ]; then
        echo "[OK]   $svc: running"
    elif [ -z "$status" ]; then
        echo "[--]   $svc: not started"
    else
        echo "[FAIL] $svc: $status"
    fi
done

echo ""
echo "Использование диска:"
docker system df

echo ""
echo "Использование памяти:"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
