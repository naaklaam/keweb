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

const app = express();
const PORT = process.env.PORT || 5000;
const MUSIC_DIR = process.env.MUSIC_DIR;

app.use(cors());
app.use(express.json());

// Request logging & telemetry middleware
app.use((req, res, next) => {
  const start = Date.now();
  telemetry.recordApiRequest();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.access(req, res, duration);
  });
  next();
});

// Serve static build of frontend in production if built
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// API Routes

// Get all songs with sorting & search
app.get('/api/songs', (req, res) => {
  const { search, sort = 'title', order = 'asc' } = req.query;
  
  const validSortFields = ['title', 'artist', 'album', 'duration', 'year', 'track_no', 'created_at', 'sample_rate', 'bits_per_sample'];
  const sortColumn = validSortFields.includes(sort) ? sort : 'title';
  const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  let query = 'SELECT id, filename, title, artist, album, track_no, year, genre, duration, sample_rate, bits_per_sample, bitrate, channels, lossless, container, has_cover, lyrics FROM songs';
  const params = [];

  if (search) {
    query += ' WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR filename LIKE ?';
    const term = `%${search}%`;
    params.push(term, term, term, term);
  }

  query += ` ORDER BY ${sortColumn} ${sortOrder}`;

  try {
    const songs = db.prepare(query).all(...params);
    res.json(songs);
  } catch (err) {
    logger.error('API', 'Error querying songs', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single song
app.get('/api/songs/:id', (req, res) => {
  try {
    const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id);
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
    const lyricsCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE lyrics IS NOT NULL AND lyrics != ""').get().count;

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
    const report = telemetry.getTelemetryReport();
    res.json(report);
  } catch (err) {
    logger.error('TELEMETRY', 'Error generating telemetry report', err);
    res.status(500).json({ error: err.message });
  }
});

// Trigger directory scan
app.post('/api/scan', async (req, res) => {
  try {
    const targetDir = req.body.dir || process.env.MUSIC_DIR;
    if (!targetDir) {
      return res.status(400).json({ error: 'MUSIC_DIR path not configured in .env' });
    }
    logger.info('SCAN', `Triggered manual directory scan for: ${targetDir}`);
    await scanDirectory(targetDir);
    res.json({ success: true, message: 'Scan completed successfully' });
  } catch (err) {
    logger.error('SCAN', 'Scan failed', err);
    res.status(500).json({ error: err.message });
  }
});

// Fallback handler for Single Page Application routing
app.use((req, res) => {
  const indexPath = path.join(clientBuildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Initial scan & server startup
async function start() {
  logger.info('SERVER', 'Starting keweb FLAC Music Player Server...');
  if (process.env.MUSIC_DIR) {
    await scanDirectory(process.env.MUSIC_DIR);
  } else {
    logger.error('SERVER', 'MUSIC_DIR is missing from environment variables.');
  }

  app.listen(PORT, () => {
    logger.info('SERVER', `keweb FLAC Music Player Server listening on port ${PORT}`);
  });
}

start();
