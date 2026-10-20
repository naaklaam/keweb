package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"keweb/internal/logger"
	"keweb/internal/models"
	"keweb/internal/stream"
	"keweb/internal/telemetry"
)

var validSortFields = map[string]string{
	"title":           "title",
	"artist":          "artist",
	"album":           "album",
	"duration":        "duration",
	"year":            "year",
	"track_no":        "track_no",
	"created_at":      "created_at",
	"sample_rate":     "sample_rate",
	"bits_per_sample": "bits_per_sample",
}

const songListColumns = `id, filename, title, artist, album, track_no, year, genre,
	duration, sample_rate, bits_per_sample, bitrate, channels, lossless,
	container, has_cover, cover_mime`

// HandleGetSongs lists all indexed songs with optional search, sorting, and pagination.
func HandleGetSongs(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		search := strings.TrimSpace(q.Get("search"))
		sortField := validSortFields[strings.ToLower(q.Get("sort"))]
		if sortField == "" {
			sortField = "title"
		}
		sortOrder := "ASC"
		if strings.ToLower(q.Get("order")) == "desc" {
			sortOrder = "DESC"
		}

		query := fmt.Sprintf("SELECT %s FROM songs", songListColumns)
		var args []interface{}

		if search != "" {
			query += " WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? OR filename LIKE ?"
			term := "%" + search + "%"
			args = append(args, term, term, term, term)
		}

		query += fmt.Sprintf(" ORDER BY %s %s", sortField, sortOrder)

		if limitStr := q.Get("limit"); limitStr != "" {
			limit, err := strconv.Atoi(limitStr)
			if err == nil && limit > 0 {
				if limit > 1000 {
					limit = 1000
				}
				offset := 0
				if offsetStr := q.Get("offset"); offsetStr != "" {
					if off, err := strconv.Atoi(offsetStr); err == nil && off >= 0 {
						offset = off
					}
				}
				query += " LIMIT ? OFFSET ?"
				args = append(args, limit, offset)
			}
		}

		rows, err := db.Query(query, args...)
		if err != nil {
			logger.Error("API", "Error querying songs", err)
			http.Error(w, `{"error":"Database query error"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		songs := make([]models.Song, 0, 100)
		for rows.Next() {
			var s models.Song
			var title, artist, album, genre, container sql.NullString
			var coverMime sql.NullString
			var year sql.NullInt64
			var trackNo, sampleRate, bitsPerSample, bitrate, channels, lossless, hasCover sql.NullFloat64

			err := rows.Scan(
				&s.ID, &s.Filename, &title, &artist, &album, &trackNo, &year, &genre,
				&s.Duration, &sampleRate, &bitsPerSample, &bitrate, &channels, &lossless,
				&container, &hasCover, &coverMime,
			)
			if err != nil {
				logger.Error("API", "Scan error in GetSongs", err)
				continue
			}

			s.Title = title.String
			s.Artist = artist.String
			s.Album = album.String
			s.Genre = genre.String
			s.Container = container.String
			s.TrackNo = int(trackNo.Float64)
			s.SampleRate = int(sampleRate.Float64)
			s.BitsPerSample = int(bitsPerSample.Float64)
			s.Bitrate = int(bitrate.Float64)
			s.Channels = int(channels.Float64)
			s.Lossless = int(lossless.Float64)
			s.HasCover = int(hasCover.Float64)
			if coverMime.Valid {
				s.CoverMime = &coverMime.String
			}
			if year.Valid {
				y := int(year.Int64)
				s.Year = &y
			}

			songs = append(songs, s)
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(songs)
	}
}

// HandleGetSongByID returns a single song with its lyrics.
func HandleGetSongByID(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			http.Error(w, `{"error":"Invalid song id"}`, http.StatusBadRequest)
			return
		}

		query := `
			SELECT id, filename, title, artist, album, track_no, year, genre, duration,
			       sample_rate, bits_per_sample, bitrate, channels, lossless,
			       container, mime_type, has_cover, cover_mime, lyrics
			FROM songs WHERE id = ?
		`
		var s models.Song
		var title, artist, album, genre, container, mimeType, coverMime, lyrics sql.NullString
		var year sql.NullInt64
		var trackNo, sampleRate, bitsPerSample, bitrate, channels, lossless, hasCover sql.NullFloat64

		err = db.QueryRow(query, id).Scan(
			&s.ID, &s.Filename, &title, &artist, &album, &trackNo, &year, &genre, &s.Duration,
			&sampleRate, &bitsPerSample, &bitrate, &channels, &lossless,
			&container, &mimeType, &hasCover, &coverMime, &lyrics,
		)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Song not found"}`, http.StatusNotFound)
			return
		} else if err != nil {
			logger.Error("API", "Error fetching song by ID", err)
			http.Error(w, `{"error":"Database query error"}`, http.StatusInternalServerError)
			return
		}

		s.Title = title.String
		s.Artist = artist.String
		s.Album = album.String
		s.Genre = genre.String
		s.Container = container.String
		s.MimeType = mimeType.String
		s.TrackNo = int(trackNo.Float64)
		s.SampleRate = int(sampleRate.Float64)
		s.BitsPerSample = int(bitsPerSample.Float64)
		s.Bitrate = int(bitrate.Float64)
		s.Channels = int(channels.Float64)
		s.Lossless = int(lossless.Float64)
		s.HasCover = int(hasCover.Float64)
		if coverMime.Valid {
			s.CoverMime = &coverMime.String
		}
		if lyrics.Valid {
			s.Lyrics = &lyrics.String
		}
		if year.Valid {
			y := int(year.Int64)
			s.Year = &y
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(s)
	}
}

// HandleStats returns library metrics.
func HandleStats(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var stats models.Stats
		var totalDuration sql.NullFloat64

		_ = db.QueryRow("SELECT COUNT(*) FROM songs").Scan(&stats.TotalSongs)
		_ = db.QueryRow("SELECT SUM(duration) FROM songs").Scan(&totalDuration)
		if totalDuration.Valid {
			stats.TotalDuration = totalDuration.Float64
		}
		_ = db.QueryRow("SELECT COUNT(DISTINCT artist) FROM songs").Scan(&stats.TotalArtists)
		_ = db.QueryRow("SELECT COUNT(DISTINCT album) FROM songs").Scan(&stats.TotalAlbums)
		_ = db.QueryRow("SELECT COUNT(*) FROM songs WHERE bits_per_sample > 16 OR sample_rate > 44100").Scan(&stats.HiResCount)
		_ = db.QueryRow("SELECT COUNT(*) FROM songs WHERE lyrics IS NOT NULL AND lyrics != ''").Scan(&stats.LyricsCount)

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(stats)
	}
}

// HandleTelemetry returns system and audio engine telemetry.
func HandleTelemetry(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		report := telemetry.GetTelemetryReport(db)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(report)
	}
}

// HandleStream wraps audio streaming handler.
func HandleStream(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := stream.ParseID(idStr)
		if err != nil {
			http.Error(w, `{"error":"Invalid song id"}`, http.StatusBadRequest)
			return
		}
		stream.HandleAudioStream(db, w, r, id)
	}
}

// HandleCover wraps cover art handler.
func HandleCover(db *sql.DB, coversDir string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := stream.ParseID(idStr)
		if err != nil {
			http.Error(w, `{"error":"Invalid song id"}`, http.StatusBadRequest)
			return
		}
		stream.HandleCoverArt(db, coversDir, w, r, id)
	}
}
