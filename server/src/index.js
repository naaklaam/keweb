const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const db = require('./db');
const logger = require('./logger');
const telemetry = require('./telemetry');
const { scanDirectory } = require('./scanner');
const { handleAudioStream, handleCoverArt } = require('./stream');

// ---- Single-instance guard -------------------------------------------------
// A second copy of the server (orphaned `node index.js` from start.sh, a stray
// restart race, etc.) would fight over the same SQLite file and covers dir.
// The lock file records the PID; if the PID is dead the lock is stale and is
// reclaimed automatically.
const LOCK_PATH = path.join(__dirname, '../data/server.lock');
let LOCKED = false;
(function acquireLock() {
  let existingPid = null;
  try {
    existingPid = fs.readFileSync(LOCK_PATH, 'utf8').trim();
  } catch (e) {
    // No lock yet — proceed
  }
  if (existingPid) {
    try {
      process.kill(Number(existingPid), 0); // throws if no such process
      console.error(`[Server] Another instance is already running (pid ${existingPid}). Exiting.`);
      process.exit(0);
    } catch (e) {
      // Stale lock — reclaim below
    }
  }
  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeSync(fd, String(process.pid));
    fs.closeSync(fd);
    LOCKED = true;
    console.log(`[Server] Lock acquired (pid ${process.pid}).`);
  } catch (err) {
    console.warn('[Server] Could not create lock file, continuing anyway:', err.message);
  }
})();

function releaseLock() {
  if (LOCKED) {
    try { fs.unlinkSync(LOCK_PATH); } catch (e) {}
  }
}
process.on('exit', releaseLock);
process.on('SIGTERM', () => { releaseLock(); process.exit(0); });
process.on('SIGINT', () => { releaseLock(); process.exit(0); });

// ---- App setup -------------------------------------------------------------
const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const MUSIC_DIR = process.env.MUSIC_DIR;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Request logging & telemetry middleware
app.use((req, res, next) => {
  const start = Date.now();
  telemetry.recordApiRequest();
  res.on('finish', () => {
    logger.access(req, res, Date.now() - start);
  });
  next();
});

// Serve static build of frontend in production if built
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// Explicit column list; NEVER expose the absolute filepath, and keep the heavy
// lyrics column out of list responses (it is fetched per-song on the Now
// Playing screen).
const SONG_LIST_COLUMNS = `id, filename, title, artist, album, track_no, year, genre,
  duration, sample_rate, bits_per_sample, bitrate, channels, lossless,
  container, has_cover, cover_mime`;

// ---- API Routes ------------------------------------------------------------

// Get all songs with sorting & search
app.get('/api/songs', (req, res) => {
  const { search, sort = 'title', order = 'asc' } = req.query;

  const validSortFields = ['title', 'artist', 'album', 'duration', 'year', 'track_no', 'created_at', 'sample_rate', 'bits_per_sample'];
  const sortColumn = validSortFields.includes(sort) ? sort : 'title';
  const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  let query = `SELECT ${SONG_LIST_COLUMNS} FROM songs`;
  const params = [];

  if (search) {
    query += ' WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR filename LIKE ?';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  query += ` ORDER BY ${sortColumn} ${sortOrder}`;

  // Optional pagination for very large libraries
  if (req.query.limit !== undefined) {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  try {
    const songs = db.prepare(query).all(...params);
    res.json(songs);
  } catch (err) {
    logger.error('API', 'Error querying songs', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single song (includes lyrics, still no filepath)
app.get('/api/songs/:id', (req, res) => {
  try {
    const song = db.prepare(
      `SELECT id, filename, title, artist, album, track_no, year, genre, duration,
              sample_rate, bits_per_sample, bitrate, channels, lossless,
              container, mime_type, has_cover, cover_mime, lyrics
       FROM songs WHERE id = ?`
    ).get(req.params.id);
    if (!song) return res.status(404).json({ error: 'Song not found' });
    res.json(song);
  } catch (err) {
    logger.error('API', 'Error fetching song by ID', err);
    res.status(500).json({ error: err.message });
  }
});

// Audio stream route
app.get('/api/stream/:id', handleAudioStream);

// Cover art route
app.get('/api/cover/:id', handleCoverArt);

// Get overall stats
app.get('/api/stats', (req, res) => {
  try {
    const totalSongs = db.prepare('SELECT COUNT(*) as count FROM songs').get().count;
    const totalDuration = db.prepare('SELECT SUM(duration) as total FROM songs').get().total || 0;
    const totalArtists = db.prepare('SELECT COUNT(DISTINCT artist) as count FROM songs').get().count;
    const totalAlbums = db.prepare('SELECT COUNT(DISTINCT album) as count FROM songs').get().count;
    const hiResCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE bits_per_sample > 16 OR sample_rate > 44100').get().count;
    const lyricsCount = db.prepare("SELECT COUNT(*) as count FROM songs WHERE lyrics IS NOT NULL AND lyrics != ''").get().count;

    res.json({
      totalSongs,
      totalDuration,
      totalArtists,
      totalAlbums,
      hiResCount,
      lyricsCount
    });
  } catch (err) {
    logger.error('API', 'Error fetching stats', err);
    res.status(500).json({ error: err.message });
  }
});

// Telemetry Report Route
app.get('/api/telemetry', (req, res) => {
  try {
    res.json(telemetry.getTelemetryReport());
  } catch (err) {
    logger.error('TELEMETRY', 'Error generating telemetry report', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Playlists (server-side, matches the DB schema) ------------------------

// GET /api/playlists
app.get('/api/playlists', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.id, p.name, p.created_at, COUNT(ps.song_id) AS song_count
      FROM playlists p
      LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
      GROUP BY p.id
      ORDER BY p.name COLLATE NOCASE
    `).all();

    // Attach up to 4 distinct cover song IDs per playlist (ordered by position ASC)
    // Once 4 distinct covers are reached, they remain fixed unless songs are removed.
    const coverRows = db.prepare(`
      SELECT ps.playlist_id, ps.song_id
      FROM playlist_songs ps
      JOIN songs s ON s.id = ps.song_id
      WHERE s.has_cover = 1
      ORDER BY ps.playlist_id, ps.position ASC
    `).all();

    const coverMap = {};
    for (const r of coverRows) {
      if (!coverMap[r.playlist_id]) coverMap[r.playlist_id] = [];
      if (coverMap[r.playlist_id].length < 4 && !coverMap[r.playlist_id].includes(r.song_id)) {
        coverMap[r.playlist_id].push(r.song_id);
      }
    }

    const result = rows.map(r => ({
      ...r,
      cover_song_ids: coverMap[r.id] || []
    }));

    res.json(result);
  } catch (err) {
    logger.error('API', 'Error listing playlists', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/playlists { name }
app.post('/api/playlists', (req, res) => {
  const name = (req.body && typeof req.body.name === 'string' ? req.body.name : '').trim();
  if (!name) return res.status(400).json({ error: 'Playlist name required' });
  try {
    const info = db.prepare('INSERT INTO playlists (name) VALUES (?)').run(name);
    const row = db.prepare('SELECT id, name, created_at FROM playlists WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ ...row, song_count: 0, cover_song_ids: [] });
  } catch (err) {
    logger.error('API', 'Error creating playlist', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/playlists/:id  (resolves songs, ordered by position)
app.get('/api/playlists/:id', (req, res) => {
  try {
    const pl = db.prepare('SELECT id, name, created_at FROM playlists WHERE id = ?').get(req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    const songs = db.prepare(`
      SELECT ${SONG_LIST_COLUMNS}
      FROM playlist_songs ps JOIN songs s ON s.id = ps.song_id
      WHERE ps.playlist_id = ?
      ORDER BY ps.position ASC, s.id ASC
    `).all(pl.id);

    const cover_song_ids = [];
    for (const s of songs) {
      if (s.has_cover && cover_song_ids.length < 4 && !cover_song_ids.includes(s.id)) {
        cover_song_ids.push(s.id);
      }
    }

    res.json({ ...pl, songs, cover_song_ids });
  } catch (err) {
    logger.error('API', 'Error fetching playlist', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/playlists/:id/songs  { songId } — append single song to playlist
app.post('/api/playlists/:id/songs', (req, res) => {
  const songId = Number(req.body && req.body.songId);
  if (!Number.isInteger(songId)) return res.status(400).json({ error: 'Valid songId required' });

  try {
    const pl = db.prepare('SELECT id FROM playlists WHERE id = ?').get(req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });

    const song = db.prepare('SELECT id FROM songs WHERE id = ?').get(songId);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    // Check if already in playlist
    const existing = db.prepare('SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?').get(pl.id, songId);
    if (existing) {
      return res.json({ success: true, message: 'Song already in playlist', added: false });
    }

    const nextPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM playlist_songs WHERE playlist_id = ?').get(pl.id).pos;
    db.prepare('INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)').run(pl.id, songId, nextPos);

    res.status(201).json({ success: true, added: true, position: nextPos });
  } catch (err) {
    logger.error('API', 'Error adding song to playlist', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/playlists/:id/songs/:songId — remove single song from playlist
app.delete('/api/playlists/:id/songs/:songId', (req, res) => {
  const songId = Number(req.params.songId);
  if (!Number.isInteger(songId)) return res.status(400).json({ error: 'Valid songId required' });

  try {
    const info = db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?').run(req.params.id, songId);
    if (!info.changes) return res.status(404).json({ error: 'Song not in playlist' });
    res.json({ success: true });
  } catch (err) {
    logger.error('API', 'Error removing song from playlist', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/playlists/:id/songs  { songIds: [..] } — replace membership in order
app.put('/api/playlists/:id/songs', (req, res) => {
  const songIds = Array.isArray(req.body && req.body.songIds) ? req.body.songIds : [];
  const ids = songIds.map(Number).filter(Number.isInteger);
  if (ids.length !== songIds.length) return res.status(400).json({ error: 'Invalid song id' });

  try {
    const pl = db.prepare('SELECT id FROM playlists WHERE id = ?').get(req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });

    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const valid = db.prepare(`SELECT COUNT(*) AS c FROM songs WHERE id IN (${placeholders})`).get(...ids).c;
      if (valid !== ids.length) return res.status(400).json({ error: 'One or more song ids do not exist' });
    }

    const replace = db.transaction(() => {
      db.prepare('DELETE FROM playlist_songs WHERE playlist_id = ?').run(pl.id);
      if (ids.length > 0) {
        const ins = db.prepare('INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)');
        ids.forEach((sid, i) => ins.run(pl.id, sid, i));
      }
    });
    replace();
    res.json({ success: true, count: ids.length });
  } catch (err) {
    logger.error('API', 'Error updating playlist', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/playlists/:id
app.delete('/api/playlists/:id', (req, res) => {
  try {
    const info = db.prepare('DELETE FROM playlists WHERE id = ?').run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Playlist not found' });
    res.json({ success: true });
  } catch (err) {
    logger.error('API', 'Error deleting playlist', err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Scan ----------------------------------------------------------------
// Only ever scan inside MUSIC_DIR (never an arbitrary path from the client),
// and serialize scans so two racing requests cannot purge each other's rows.
const scanState = { running: false };

app.post('/api/scan', async (req, res) => {
  let targetDir = MUSIC_DIR;
  const requested = req.body && req.body.dir;
  if (requested) {
    const resolved = path.resolve(String(requested));
    const root = path.resolve(MUSIC_DIR || '');
    const ok = root && (resolved === root || resolved.startsWith(root + path.sep));
    if (!ok) {
      return res.status(400).json({ error: 'Scan directory must be inside MUSIC_DIR' });
    }
  }
  if (!targetDir) {
    return res.status(400).json({ error: 'MUSIC_DIR path not configured in .env' });
  }
  if (scanState.running) {
    return res.status(409).json({ error: 'A scan is already running' });
  }

  scanState.running = true;
  try {
    logger.info('SCAN', `Manual scan for: ${targetDir}`);
    const result = await scanDirectory(targetDir);
    res.json({ success: true, message: 'Scan completed successfully', result });
  } catch (err) {
    logger.error('SCAN', 'Scan failed', err);
    res.status(500).json({ error: err.message });
  } finally {
    scanState.running = false;
  }
});

// Fallback handler for Single Page Application routing (must stay before the
// error middleware so an unknown /api/* path still returns JSON 404).
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  next();
});

// Final error handler: keep unhandled rejections from crashing with raw stacks
app.use((err, req, res, next) => {
  logger.error('SERVER', 'Unhandled error', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ---- Startup ---------------------------------------------------------------
// Listen FIRST so the player is reachable (and can serve already-indexed
// songs) while the initial scan runs in the background.
function start() {
  logger.info('SERVER', 'Starting keweb FLAC Music Player Server...');

  const server = app.listen(PORT, () => {
    logger.info('SERVER', `keweb FLAC Music Player Server listening on port ${PORT}`);
  });

  server.on('error', (err) => {
    logger.error('SERVER', 'Failed to listen', err);
    process.exit(1); // let the supervisor (systemd) restart cleanly
  });

  if (MUSIC_DIR) {
    scanDirectory(MUSIC_DIR)
      .then(() => logger.info('SERVER', 'Initial scan finished'))
      .catch((err) => logger.error('SERVER', 'Initial scan failed', err));
  } else {
    logger.error('SERVER', 'MUSIC_DIR is missing from environment variables.');
  }
}

start();