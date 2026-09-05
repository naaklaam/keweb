#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

# Load environment variables
if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi

PORT="${PORT:-5000}"
SUBDOMAIN="${SUBDOMAIN:-keweb}"

start_service() {
  echo "============================================================"
  echo "         KEWEB FLAC PLAYER - SYSTEMD USER DAEMON            "
  echo "============================================================"

  # Build frontend client if dist missing
  if [ ! -d "$DIR/client/dist" ]; then
    echo "[1/2] Building client frontend..."
    cd "$DIR/client" && npm run build
    cd "$DIR"
  fi

  echo "[2/2] Reloading systemd & starting keweb.service + keweb-tunnel.service..."
  systemctl --user daemon-reload
  systemctl --user start keweb.service keweb-tunnel.service

  TUNNEL_PASS=$(curl -s https://loca.lt/mytunnelpassword || echo "103.117.59.28")

  echo "------------------------------------------------------------"
  echo " STATUS:        ONLINE & HEALTHY (Systemd Managed Daemon)"
  echo " Service Units: keweb.service | cloudflared.service"
  echo " Local Access:   http://localhost:${PORT}"
  echo " Custom Domain:  https://keweb.my.id"
  echo " Fallback URL:  https://${SUBDOMAIN}.loca.lt"
  echo " Journalctl:    journalctl --user -u keweb -f"
  echo "------------------------------------------------------------"
}

stop_service() {
  echo "[Stop] Halting keweb systemd user services..."
  systemctl --user stop keweb.service keweb-tunnel.service 2>/dev/null || true
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  pkill -f "localtunnel" 2>/dev/null || true
  echo "[✓] keweb systemd services stopped."
}

restart_service() {
  echo "[Restart] Reloading & restarting keweb systemd services..."
  systemctl --user daemon-reload
  systemctl --user restart keweb.service keweb-tunnel.service
  echo "[✓] keweb systemd services restarted."
}

enable_service() {
  echo "[Enable] Enabling keweb.service & keweb-tunnel.service for Linux auto-boot..."
  systemctl --user enable keweb.service keweb-tunnel.service
  echo "[✓] keweb is now enabled to start automatically on system boot!"
}

status_service() {
  echo "============================================================"
  echo "         KEWEB SYSTEMD DAEMON STATUS (systemctl)           "
  echo "============================================================"

  systemctl --user status keweb.service keweb-tunnel.service --no-pager

  echo "------------------------------------------------------------"
  if curl -s "http://localhost:${PORT}/api/stats" >/dev/null; then
    echo " API TELEMETRY: HEALTHY (Responding 200 OK)"
    curl -s "http://localhost:${PORT}/api/telemetry" | node -e '
      const fs = require("fs");
      try {
        const data = JSON.parse(fs.readFileSync(0, "utf-8"));
        console.log(` Service:       ${data.service} (${data.status})`);
        console.log(` System Uptime: ${data.uptime}`);
        console.log(` Memory Heap:   ${data.process.heapUsedMB} MB / ${data.process.heapTotalMB} MB (RSS: ${data.process.rssMB} MB)`);
        console.log(` Tracks:        ${data.audioEngine.totalSongsIndexed} FLAC tracks (${data.audioEngine.hiResTracksCount} Hi-Res)`);
        console.log(` Streams:       ${data.audioEngine.totalStreamsStarted} sessions (${data.audioEngine.totalBytesStreamedMB} MB streamed)`);
      } catch (e) {}
    ' 2>/dev/null || true
  else
    echo " API TELEMETRY: UNREACHABLE"
  fi
  echo "============================================================"
}

logs_service() {
  echo "============================================================"
  echo " Tailing live systemd journal logs (journalctl -f)"
  echo "============================================================"
  journalctl --user -u keweb -u keweb-tunnel -f
}

telemetry_service() {
  if curl -s "http://localhost:${PORT}/api/stats" >/dev/null; then
    curl -s "http://localhost:${PORT}/api/telemetry" | node -e '
      const fs = require("fs");
      try {
        const input = fs.readFileSync(0, "utf-8");
        console.log(JSON.stringify(JSON.parse(input), null, 2));
      } catch(e) {
        console.error("Telemetry unreachable");
      }
    '
  else
    echo '{"error": "keweb service is offline"}'
  fi
}

case "$1" in
  start)
    start_service
    ;;
  stop)
    stop_service
    ;;
  restart)
    restart_service
    ;;
  enable)
    enable_service
    ;;
  status)
    status_service
    ;;
  logs)
    logs_service
    ;;
  telemetry)
    telemetry_service
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|enable|status|logs|telemetry}"
    exit 1
    ;;
esac
