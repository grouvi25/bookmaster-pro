#!/usr/bin/env python3
"""
Docker log shipper → YC Cloud Logging (gRPC)
Reads container logs via `docker logs --since`, sends via YC SDK gRPC.
"""
import json, time, os, sys, subprocess
from datetime import datetime, timezone

import yandexcloud
from yandex.cloud.logging.v1.log_ingestion_service_pb2_grpc import LogIngestionServiceStub
from yandex.cloud.logging.v1.log_ingestion_service_pb2 import WriteRequest
from yandex.cloud.logging.v1.log_entry_pb2 import IncomingLogEntry, Destination, LogLevel
from google.protobuf.timestamp_pb2 import Timestamp
from google.protobuf.struct_pb2 import Struct

FOLDER_ID = "b1gl2o95u528n9i3k1ea"
SA_KEY_PATH = "/opt/bookmaster/infra/yc_sa_key.json"
STATE_FILE = "/var/log/bookmaster/log_shipper_state.json"
BATCH_SIZE = 100
SHIP_INTERVAL = 30

CONTAINERS = {
    "bm_api": "api",
    "bm_scheduler": "scheduler",
    "bm_bot_tg": "bot-tg",
    "bm_bot_max": "bot-max",
    "bm_marketplace": "marketplace",
}

LEVEL_MAP = {
    "ERROR": LogLevel.ERROR,
    "WARN": LogLevel.WARN,
    "INFO": LogLevel.INFO,
    "DEBUG": LogLevel.DEBUG,
}

def get_docker_logs(container, since_ts):
    since = str(int(since_ts)) if since_ts else str(int(time.time()) - 60)
    try:
        result = subprocess.run(
            ["docker", "logs", "--since", since, "--timestamps", "--tail", str(BATCH_SIZE), container],
            capture_output=True, text=True, timeout=10
        )
        lines = []
        for line in (result.stdout + result.stderr).strip().split("\n"):
            if line.strip():
                lines.append(line)
        return lines
    except:
        return []

def detect_level(msg):
    ml = msg.lower()
    if "error" in ml or "traceback" in ml or "exception" in ml:
        return "ERROR"
    if "warn" in ml:
        return "WARN"
    if "debug" in ml:
        return "DEBUG"
    return "INFO"

def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except:
        return {}

def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)

def main():
    print(f"[{datetime.now()}] YC Log Shipper (gRPC) starting...", flush=True)

    with open(SA_KEY_PATH) as f:
        sa_key = json.load(f)

    sdk = yandexcloud.SDK(service_account_key=sa_key)
    ingestion = sdk.client(LogIngestionServiceStub)
    print(f"[{datetime.now()}] YC SDK initialized", flush=True)

    state = load_state()

    while True:
        try:
            entries = []
            now_ts = time.time()

            for container, service_name in CONTAINERS.items():
                last_ts = state.get(container, now_ts - 60)
                lines = get_docker_logs(container, last_ts)

                for line in lines:
                    msg = line.strip()
                    if not msg:
                        continue
                    level = detect_level(msg)

                    ts = Timestamp()
                    ts.GetCurrentTime()

                    jp = Struct()
                    jp.update({"service": service_name, "container": container})

                    entries.append(IncomingLogEntry(
                        message=msg[:4096],
                        level=LEVEL_MAP.get(level, LogLevel.INFO),
                        timestamp=ts,
                        json_payload=jp,
                    ))

                state[container] = now_ts

            if entries:
                dest = Destination(folder_id=FOLDER_ID)
                try:
                    ingestion.Write(WriteRequest(
                        destination=dest,
                        entries=entries[:BATCH_SIZE],
                    ))
                    save_state(state)
                    print(f"[{datetime.now()}] Shipped {len(entries)} entries via gRPC", flush=True)
                except Exception as e:
                    print(f"[{datetime.now()}] gRPC write failed: {e}", file=sys.stderr, flush=True)

            time.sleep(SHIP_INTERVAL)

        except KeyboardInterrupt:
            save_state(state)
            break
        except Exception as e:
            print(f"[{datetime.now()}] Error: {e}", file=sys.stderr, flush=True)
            time.sleep(60)

if __name__ == "__main__":
    main()
