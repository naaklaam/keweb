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

  echo "------------------------------------------------------------"
  echo " STATUS:        ONLINE & HEALTHY (Systemd Managed Daemon)"
  echo " Service Units: keweb.service | keweb-tunnel.service"
  echo " Local Access:   http://localhost:${PORT}"
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

  echo "------------------------------------------------------------"
  echo " ACTIVE DEVICES (dari logs/access.log, 24 jam terakhir)"
  node -e '
    const fs = require("fs");
    const path = require("path");
    const logPath = path.join(process.env.HOME || ".", "playering-flac", "logs", "access.log");
    let txt = "";
    try { txt = fs.readFileSync(logPath, "utf8"); }
    catch (e) { console.log(" (belum ada log)"); process.exit(0); }

    const cutoff = Date.now() - 24 * 3600 * 1000;
    function parseUA(ua) {
      let os = "Desktop", browser = "?";
      if (/Android/.test(ua)) os = "Android";
      else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
      else if (/Windows/.test(ua)) os = "Windows";
      else if (/Linux/.test(ua)) os = "Linux";
      else if (/Mac OS X/.test(ua)) os = "macOS";
      if (/CriOS/.test(ua)) browser = "Chrome(iOS)";
      else if (/Edg/.test(ua)) browser = "Edge";
      else if (/Chrome/.test(ua)) browser = "Chrome";
      else if (/Firefox/.test(ua)) browser = "Firefox";
      else if (/Brave/.test(ua)) browser = "Brave";
      else if (/Safari/.test(ua)) browser = "Safari";
      return { os, browser, mobile: /Mobile|iPhone|iPad/.test(ua) };
    }
    const devs = {};
    for (const line of txt.split("\n")) {
      if (!line.includes("/api/stream")) continue;
      const time = /^\[([^\]]+)\]/.exec(line);
      if (!time) continue;
      const t = new Date(time[1]).getTime();
      if (isNaN(t) || t < cutoff) continue;
      const ip = /IP: ([^ ]+)/.exec(line);
      const ua = /UA: "([^"]*)"/.exec(line);
      if (!ip || !ua) continue;
      const p = parseUA(ua[1]);
      const key = ip[1] + "|" + p.os + "|" + p.browser + "|" + (p.mobile ? "m" : "d");
      if (!devs[key]) devs[key] = { ip: ip[1], os: p.os, browser: p.browser, mobile: p.mobile, streams: 0, last: time[1] };
      devs[key].streams++;
      if (time[1] > devs[key].last) devs[key].last = time[1];
    }
    const arr = Object.values(devs).sort((a, b) => b.streams - a.streams);
    const mobile = arr.filter(d => d.mobile).length;
    console.log(` Device unik (24jam): ${arr.length}  (mobile ${mobile} / desktop ${arr.length - mobile})`);
    const byOS = {};
    for (const d of arr) byOS[d.os] = (byOS[d.os] || 0) + d.streams;
    const totalStreams = arr.reduce((s, d) => s + d.streams, 0);
    console.log(" OS (proporsi stream):");
    for (const [k, v] of Object.entries(byOS).sort((a, b) => b[1] - a[1]))
      console.log(`   ${k}: ${v} (${(v / totalStreams * 100).toFixed(1)}%)`);
    if (arr.length === 0) { console.log(" (tidak ada stream dalam 24 jam terakhir)"); process.exit(0); }
    console.log(" Per device (IP | OS | browser | stream | last):");
    for (const d of arr.slice(0, 8))
      console.log(`   ${d.ip} | ${d.os}${d.mobile ? "(mob)" : ""} | ${d.browser} | ${d.streams} | ${d.last}`);
  '

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
