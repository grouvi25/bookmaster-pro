"""Run pytest on VPS inside API container."""
from pathlib import Path
import sys, time, paramiko

SECRETS = {}
for line in Path(".deploy_secrets").read_text(encoding="utf-8").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        SECRETS[k.strip()] = v.strip()

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(hostname=SECRETS["VPS_HOST"], username=SECRETS["VPS_USER"],
    password=SECRETS["VPS_PASSWORD"], timeout=20, look_for_keys=False, allow_agent=False)

def run(cmd, label="", timeout=300):
    print(f"\n{'='*10} {label or cmd[:70]} {'='*10}")
    transport = client.get_transport()
    chan = transport.open_session(); chan.settimeout(timeout); chan.get_pty()
    chan.exec_command(cmd)
    out = []
    while True:
        if chan.recv_ready():
            data = chan.recv(4096).decode(errors="replace"); sys.stdout.write(data); sys.stdout.flush(); out.append(data)
        elif chan.exit_status_ready():
            while chan.recv_ready():
                data = chan.recv(4096).decode(errors="replace"); sys.stdout.write(data); sys.stdout.flush(); out.append(data)
            break
        else: time.sleep(0.1)
    code = chan.recv_exit_status(); print(f"\n[exit {code}]")
    return code, "".join(out)

# Install test deps and run pytest inside the API container
run(
    'docker exec bm_api pip install pytest pytest-asyncio aiosqlite httpx 2>&1 | tail -5',
    "Install test deps in container"
)

run(
    'docker exec -w /app bm_api python -m pytest tests/ -v --tb=short 2>&1',
    "Run pytest",
    timeout=120,
)

client.close()
print("\n[DONE]")
