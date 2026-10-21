#!/usr/bin/env bash
# Deploy the JALTRON knowledge engine. Run from the server/ folder: sudo bash setup.sh
set -euo pipefail
DIR=/opt/jaltron-kb
PORT="${PORT:-11904}"
NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "Node.js 18+ is required and was not found."
  echo "Install it first, for example: apt-get update && apt-get install -y nodejs"
  exit 1
fi
V="$("$NODE" -p 'process.versions.node.split(".")[0]')"
if [ "$V" -lt 18 ]; then
  echo "Node.js $($NODE -v) found, need 18 or newer."
  exit 1
fi
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DIR"
install -m 0644 "$HERE/kb-server.js" "$DIR/kb-server.js"
if [ ! -f /etc/jaltron-kb.env ]; then
  printf 'PORT=%s\nDAILY_CAP=3000\n' "$PORT" > /etc/jaltron-kb.env
  chmod 0600 /etc/jaltron-kb.env
fi
if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd not found. Start it manually with:"
  echo "  cd $DIR && PORT=$PORT nohup $NODE kb-server.js >/var/log/jaltron-kb.log 2>&1 &"
  exit 0
fi
cat > /etc/systemd/system/jaltron-kb.service <<UNIT
[Unit]
Description=JALTRON knowledge engine
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=-/etc/jaltron-kb.env
Environment=PORT=$PORT
ExecStart=$NODE $DIR/kb-server.js
WorkingDirectory=$DIR
DynamicUser=yes
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
MemoryMax=320M
CPUQuota=50%
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now jaltron-kb
sleep 1
if curl -fsS "http://127.0.0.1:$PORT/api/health"; then
  echo
  echo "jaltron-kb is running on port $PORT."
else
  echo "Service installed but health check failed. Check: journalctl -u jaltron-kb -n 50"
  exit 1
fi
