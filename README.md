# keweb 🎵

> Ultra-lightweight, high-performance personal FLAC lossless music player & streaming server. Inspired by the minimal aesthetic of [`kew`](https://github.com/ravachol/kew), engineered with **Golang** and **React 19**.

---

## ⚡ Highlights & Architecture

* **Blazingly Fast & Ultralight Backend (Golang):**
  - **~8.7 MB Idle RAM** (vs 80+ MB on Node.js) — ~88% memory reduction.
  - **Instant Multi-Core Scanning:** Traverses and indexes 1,000+ FLAC files in **~20 milliseconds** via Goroutine worker pools.
  - **Zero-Copy Streaming:** Native `http.ServeContent` with Linux `sendfile(2)` and full RFC 7233 byte-range support (`206 Partial Content`).
  - **Kernel File Locking:** Rock-solid single-instance protection via `syscall.Flock` (eliminating stale PID collision bugs).
  - **Single Standalone Binary:** Compiles into a single ~15MB executable with zero runtime dependencies.

* **Sleek & Modern Web Player (React 19 + Tailwind CSS v4):**
  - **Lossless & Hi-Res Bit-Perfect:** Native browser FLAC audio decoder directly outputting PCM without lossy re-encoding.
  - **Buffer Indicator:** Visual buffered progress bar (YouTube Music style) tracking downloaded cache ahead of playback.
  - **Synchronized Lyrics (.lrc & Embedded):** Real-time lyric line tracking with smooth auto-scroll.
  - **Dynamic Theme Palette:** Real-time color extraction from album cover art to generate radiant background gradients.
  - **Custom Playlists:** Create and manage playlists with automatic 4-grid cover art composition.
  - **Mobile Responsive & Touch Gestures:** Horizontal swipe navigation between views, PWA-friendly viewport controls.

* **Zero-Config Remote Access:**
  - Integrated with **Cloudflare Tunnel (`cloudflared`)** for secure streaming outside your local network without opening router ports.
  - Systemd user service management with real-time hardware & access telemetry.

---

## 📊 Performance Comparison

| Metric | Node.js (Legacy) | Golang (Current) | Improvement |
| :--- | :--- | :--- | :--- |
| **RAM Usage (RSS)** | `~75 MB – 78 MB` | **`8.7 MB`** | **~88% lighter** |
| **Heap Memory** | `9.48 MB / 10.63 MB` | **`1.62 MB / 7.56 MB`** | Minimal GC pause |
| **Library Scan (1,000+ tracks)** | `~2,000 – 4,000 ms` | **`21 ms`** | **~100x faster** |
| **Binary / Artifact Size** | Ratusan MB (`node_modules`) | **15 MB standalone binary** | Self-contained |
| **Streaming Engine** | Node readStream pipe | Kernel `sendfile(2)` zero-copy | Maximum throughput |

---

## 🛠️ Tech Stack

* **Backend:** Golang 1.22+ (`net/http`, `modernc.org/sqlite` / `mattn/go-sqlite3`, `dhowden/tag`)
* **Database:** SQLite 3 in WAL (Write-Ahead Logging) mode
* **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons
* **Daemon & Tunnel:** Systemd User Unit + Cloudflare Tunnel (`cloudflared`)

---

## 🚀 Getting Started

### Prerequisites

* **Linux OS** (systemd supported)
* **Go** (1.22 or newer)
* **Node.js & npm** (only for building the frontend client)

### 1. Clone & Configure

```bash
git clone git@github.com:naaklaam/keweb.git
cd keweb
```

Create `.env` file in the root directory:

```env
PORT=5000
MUSIC_DIR="/home/your-user/Music"
SUBDOMAIN="keweb"
ENABLE_SCAN_PURGE=false
```

### 2. Build Frontend

```bash
cd client
npm install
npm run build
cd ..
```

### 3. Build Backend

```bash
cd server-go
go build -o ../bin/keweb-server ./cmd/server
cd ..
```

---

## ⚙️ Service Management

A unified script [`service.sh`](./service.sh) is provided to control the background daemon:

```bash
# Start background services (Server + Cloudflare Tunnel)
./service.sh start

# Check real-time status & active device telemetry
./service.sh status

# Restart services
./service.sh restart

# Stop services
./service.sh stop

# Enable automatic start on Linux boot
./service.sh enable
```

### Telemetry Dashboard

Running `./service.sh status` displays active metrics:

```
============================================================
         KEWEB SYSTEMD DAEMON STATUS (systemctl)           
============================================================
● keweb.service - keweb FLAC Lossless Music Player Server Daemon
   Main PID: 120383 (keweb-server)
     Memory: 8.7M (peak: 9.5M)
        CPU: 16ms
------------------------------------------------------------
 API TELEMETRY: HEALTHY (Responding 200 OK)
 Service:       keweb-flac-player (ONLINE)
 System Uptime: 1h 25m 12s
 Memory Heap:   1.62 MB / 7.56 MB (RSS: 18.48 MB)
 Tracks:        1003 FLAC tracks (453 Hi-Res)
 Streams:       28 sessions (450.20 MB streamed)
------------------------------------------------------------
 TELEMETRI PERANGKAT & PENGGUNA (logs/access.log, 24 Jam)
 Perangkat Unik (24h) : 3  (Mobile: 1 | Desktop: 2)
 Aktif 15m Terakhir  : 1 Perangkat
============================================================
```

---

## 📁 Project Structure

```
playering-flac/
├── bin/
│   ├── keweb-server            # Compiled Go binary
│   └── cloudflared             # Cloudflare tunnel daemon
├── client/                     # React 19 Frontend (Vite + Tailwind v4)
│   ├── src/
│   │   ├── components/         # Player, TrackView, SearchView, Modals
│   │   └── utils/              # LRC parser, Color extractor
│   └── dist/                   # Production build assets
├── data/                       # SQLite DB (music.db) & Album Covers cache
├── logs/                       # Rotating access.log, app.log, error.log
├── server-go/                  # High-performance Golang backend
│   ├── cmd/server/main.go      # Server entrypoint & graceful shutdown
│   └── internal/
│       ├── config/             # Environment configuration
│       ├── db/                 # SQLite schema & migrations
│       ├── handlers/           # REST API endpoints & SPA router
│       ├── lock/               # Linux kernel flock single-instance lock
│       ├── logger/             # Thread-safe log rotation
│       ├── models/             # Song, Playlist, Telemetry models
│       ├── scanner/            # Multi-core FLAC/audio scanner
│       ├── stream/             # HTTP Range audio streaming & cover delivery
│       └── telemetry/          # System & audio metrics
├── service.sh                  # CLI service controller
├── start.sh                    # Foreground runner script
└── etc-systemd-user/           # Systemd user unit definitions
```

---

## 📄 License

MIT © [naaklaam](https://github.com/naaklaam)
