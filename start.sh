#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Load environment variables from .env file if present
if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi

PORT="${PORT:-5000}"
SUBDOMAIN="${SUBDOMAIN:-keweb}"

echo "============================================================"
echo "      FLAC MUSIC PLAYER (TUI kew Aesthetic) STARTER         "
echo "============================================================"

# Ensure client is built
if [ ! -d "$DIR/client/dist" ]; then
  echo "[1/3] Building client frontend..."
  cd "$DIR/client" && npm run build
  cd "$DIR"
fi

# Kill any existing server on configured PORT
fuser -k "${PORT}/tcp" 2>/dev/null || true

echo "[2/3] Starting backend server on port ${PORT}..."
node "$DIR/server/src/index.js" &
SERVER_PID=$!

# Wait for server to respond on PORT
echo "Waiting for server to initialize..."
until curl -s "http://localhost:${PORT}/api/stats" >/dev/null; do
  sleep 1
done

# Fetch Tunnel Password IP for 1-time verification on new devices
TUNNEL_PASS=$(curl -s https://loca.lt/mytunnelpassword || echo "Check via curl https://loca.lt/mytunnelpassword")

echo "[3/3] Launching Localtunnel Subdomain..."
echo "------------------------------------------------------------"
echo " Local Access:     http://localhost:${PORT}"
echo " Fixed Remote URL: https://${SUBDOMAIN}.loca.lt"
echo " Tunnel Password:  ${TUNNEL_PASS} (Masukkan 1x jika diminta di HP)"
echo "------------------------------------------------------------"

trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

npx --yes localtunnel --port "${PORT}" --subdomain "${SUBDOMAIN}"
