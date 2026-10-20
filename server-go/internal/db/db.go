package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
	"keweb/internal/logger"
)

func Init(dataDir string) (*sql.DB, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "music.db")
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_synchronous=NORMAL&_foreign_keys=ON")
	if err != nil {
		return nil, fmt.Errorf("open sqlite db: %w", err)
	}

	// Limit connections for single-process SQLite WAL mode
	db.SetMaxOpenConns(1)

	if err := createSchema(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("create schema: %w", err)
	}

	if err := runMigrations(db); err != nil {
		logger.Warn("DB", fmt.Sprintf("migration warning: %v", err))
	}

	return db, nil
}

func createSchema(db *sql.DB) error {
	schema := `
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
		lyrics TEXT,
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
	`
	_, err := db.Exec(schema)
	return err
}

func runMigrations(db *sql.DB) error {
	var version int
	if err := db.QueryRow("PRAGMA user_version").Scan(&version); err != nil {
		return err
	}

	if version < 1 {
		// Migration 1: Add mime_type column to songs table
		_, _ = db.Exec("ALTER TABLE songs ADD COLUMN mime_type TEXT;")
		_, _ = db.Exec("PRAGMA user_version = 1;")
	}
	return nil
}
