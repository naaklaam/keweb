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

echo "[Tunnel] Requesting fixed subdomain: https://${SUBDOMAIN}.loca.lt (Port: ${PORT})..."

# Launch localtunnel and stream output to log while verifying subdomain match
npx --yes localtunnel --port "${PORT}" --subdomain "${SUBDOMAIN}" 2>&1 | while read -r line; do
  echo "$line"
  if echo "$line" | grep -q "your url is:"; then
    if echo "$line" | grep -q "${SUBDOMAIN}.loca.lt"; then
      echo "[✓] SUCCESS: Connected to requested subdomain https://${SUBDOMAIN}.loca.lt"
    else
      echo "[!] WARNING: Localtunnel assigned a temporary random fallback URL because '${SUBDOMAIN}' is temporarily locked on loca.lt server."
      echo "[!] Exiting to trigger systemd auto-retry until https://${SUBDOMAIN}.loca.lt is acquired..."
      # Kill localtunnel subprocess and exit 1 so systemd retries
      pkill -P $$ || true
      exit 1
    fi
  fi
done
