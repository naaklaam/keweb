const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'music.db');
const db = new Database(dbPath);

// Enable WAL mode for max speed & performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filepath TEXT UNIQUE NOT NULL,
    filename TEXT NOT NULL,
    title TEXT,
    artist TEXT,
    album TEXT,
    track_no INTEGER DEFAULT 0,
    year INTEGER,
    genre TEXT,
    duration REAL DEFAULT 0,
    sample_rate INTEGER,
    bits_per_sample INTEGER,
    bitrate INTEGER,
    channels INTEGER,
    lossless INTEGER DEFAULT 1,
    container TEXT DEFAULT 'FLAC',
    has_cover INTEGER DEFAULT 0,
    cover_mime TEXT,
    mtime INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
  CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
  CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
  CREATE INDEX IF NOT EXISTS idx_songs_duration ON songs(duration);
  CREATE INDEX IF NOT EXISTS idx_songs_filepath ON songs(filepath);

  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id INTEGER,
    song_id INTEGER,
    position INTEGER,
    PRIMARY KEY (playlist_id, song_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
  );
`);

module.exports = db;
