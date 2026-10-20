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
)

// HandleGetPlaylists lists all playlists with song count and 4-grid cover art IDs.
func HandleGetPlaylists(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		query := `
			SELECT p.id, p.name, p.created_at, COUNT(ps.song_id) AS song_count
			FROM playlists p
			LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
			GROUP BY p.id
			ORDER BY p.name COLLATE NOCASE
		`
		rows, err := db.Query(query)
		if err != nil {
			logger.Error("API", "Error listing playlists", err)
			http.Error(w, `{"error":"Database query error"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		playlists := make([]models.Playlist, 0, 10)
		for rows.Next() {
			var pl models.Playlist
			if err := rows.Scan(&pl.ID, &pl.Name, &pl.CreatedAt, &pl.SongCount); err == nil {
				pl.CoverSongIDs = make([]int64, 0, 4)
				playlists = append(playlists, pl)
			}
		}

		// Retrieve up to 4 distinct cover song IDs per playlist
		coverRows, err := db.Query(`
			SELECT ps.playlist_id, ps.song_id
			FROM playlist_songs ps
			JOIN songs s ON s.id = ps.song_id
			WHERE s.has_cover = 1
			ORDER BY ps.playlist_id, ps.position ASC
		`)
		if err == nil {
			defer coverRows.Close()
			coverMap := make(map[int64][]int64)
			for coverRows.Next() {
				var plID, songID int64
				if err := coverRows.Scan(&plID, &songID); err == nil {
					list := coverMap[plID]
					if len(list) < 4 {
						exists := false
						for _, id := range list {
							if id == songID {
								exists = true
								break
							}
						}
						if !exists {
							coverMap[plID] = append(list, songID)
						}
					}
				}
			}

			for i := range playlists {
				if ids, ok := coverMap[playlists[i].ID]; ok {
					playlists[i].CoverSongIDs = ids
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(playlists)
	}
}

// HandleCreatePlaylist creates a new custom playlist.
func HandleCreatePlaylist(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
			return
		}
		name := strings.TrimSpace(req.Name)
		if name == "" {
			http.Error(w, `{"error":"Playlist name required"}`, http.StatusBadRequest)
			return
		}

		res, err := db.Exec("INSERT INTO playlists (name) VALUES (?)", name)
		if err != nil {
			logger.Error("API", "Error creating playlist", err)
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}
		newID, _ := res.LastInsertId()

		var pl models.Playlist
		err = db.QueryRow("SELECT id, name, created_at FROM playlists WHERE id = ?", newID).
			Scan(&pl.ID, &pl.Name, &pl.CreatedAt)
		if err != nil {
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}
		pl.SongCount = 0
		pl.CoverSongIDs = make([]int64, 0)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(pl)
	}
}

// HandleGetPlaylistByID returns a playlist and all its contained songs ordered by position.
func HandleGetPlaylistByID(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := r.PathValue("id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			http.Error(w, `{"error":"Invalid playlist id"}`, http.StatusBadRequest)
			return
		}

		var pl models.Playlist
		err = db.QueryRow("SELECT id, name, created_at FROM playlists WHERE id = ?", id).
			Scan(&pl.ID, &pl.Name, &pl.CreatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Playlist not found"}`, http.StatusNotFound)
			return
		} else if err != nil {
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}

		query := fmt.Sprintf(`
			SELECT %s
			FROM playlist_songs ps
			JOIN songs s ON s.id = ps.song_id
			WHERE ps.playlist_id = ?
			ORDER BY ps.position ASC, s.id ASC
		`, prefixColumns("s", songListColumns))

		rows, err := db.Query(query, id)
		if err != nil {
			logger.Error("API", "Error fetching playlist songs", err)
			http.Error(w, `{"error":"Database query error"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		songs := make([]models.Song, 0, 20)
		coverIDs := make([]int64, 0, 4)

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

			if s.HasCover == 1 && len(coverIDs) < 4 {
				exists := false
				for _, cid := range coverIDs {
					if cid == s.ID {
						exists = true
						break
					}
				}
				if !exists {
					coverIDs = append(coverIDs, s.ID)
				}
			}

			songs = append(songs, s)
		}

		pl.Songs = songs
		pl.SongCount = len(songs)
		pl.CoverSongIDs = coverIDs

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(pl)
	}
}

// HandleAddSongToPlaylist appends a song to a playlist.
func HandleAddSongToPlaylist(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		plIDStr := r.PathValue("id")
		plID, err := strconv.ParseInt(plIDStr, 10, 64)
		if err != nil {
			http.Error(w, `{"error":"Invalid playlist id"}`, http.StatusBadRequest)
			return
		}

		var req struct {
			SongID int64 `json:"songId"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.SongID <= 0 {
			http.Error(w, `{"error":"Valid songId required"}`, http.StatusBadRequest)
			return
		}

		var checkPl int64
		if err := db.QueryRow("SELECT id FROM playlists WHERE id = ?", plID).Scan(&checkPl); err != nil {
			http.Error(w, `{"error":"Playlist not found"}`, http.StatusNotFound)
			return
		}

		var checkSong int64
		if err := db.QueryRow("SELECT id FROM songs WHERE id = ?", req.SongID).Scan(&checkSong); err != nil {
			http.Error(w, `{"error":"Song not found"}`, http.StatusNotFound)
			return
		}

		// Check if song is already in playlist
		var exists int
		err = db.QueryRow("SELECT 1 FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", plID, req.SongID).Scan(&exists)
		if err == nil && exists == 1 {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"success": true,
				"message": "Song already in playlist",
				"added":   false,
			})
			return
		}

		var nextPos int
		_ = db.QueryRow("SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_songs WHERE playlist_id = ?", plID).Scan(&nextPos)

		_, err = db.Exec("INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)", plID, req.SongID, nextPos)
		if err != nil {
			logger.Error("API", "Error adding song to playlist", err)
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":  true,
			"added":    true,
			"position": nextPos,
		})
	}
}

// HandleRemoveSongFromPlaylist removes a single song from a playlist.
func HandleRemoveSongFromPlaylist(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		plIDStr := r.PathValue("id")
		plID, err := strconv.ParseInt(plIDStr, 10, 64)
		if err != nil {
			http.Error(w, `{"error":"Invalid playlist id"}`, http.StatusBadRequest)
			return
		}

		songIDStr := r.PathValue("songId")
		songID, err := strconv.ParseInt(songIDStr, 10, 64)
		if err != nil {
			http.Error(w, `{"error":"Valid songId required"}`, http.StatusBadRequest)
			return
		}

		res, err := db.Exec("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", plID, songID)
		if err != nil {
			logger.Error("API", "Error removing song from playlist", err)
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}
		aff, _ := res.RowsAffected()
		if aff == 0 {
			http.Error(w, `{"error":"Song not in playlist"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

// HandleReorderPlaylistSongs replaces playlist membership in order.
func HandleReorderPlaylistSongs(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		plIDStr := r.PathValue("id")
		plID, err := strconv.ParseInt(plIDStr, 10, 64)
		if err != nil {
			http.Error(w, `{"error":"Invalid playlist id"}`, http.StatusBadRequest)
			return
		}

		var req struct {
			SongIDs []int64 `json:"songIds"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"Invalid request payload"}`, http.StatusBadRequest)
			return
		}

		var checkPl int64
		if err := db.QueryRow("SELECT id FROM playlists WHERE id = ?", plID).Scan(&checkPl); err != nil {
			http.Error(w, `{"error":"Playlist not found"}`, http.StatusNotFound)
			return
		}

		tx, err := db.Begin()
		if err != nil {
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}
		defer func() { _ = tx.Rollback() }()

		_, err = tx.Exec("DELETE FROM playlist_songs WHERE playlist_id = ?", plID)
		if err != nil {
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}

		if len(req.SongIDs) > 0 {
			stmt, err := tx.Prepare("INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)")
			if err != nil {
				http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
				return
			}
			defer stmt.Close()

			for i, sid := range req.SongIDs {
				if _, err := stmt.Exec(plID, sid, i); err != nil {
					http.Error(w, `{"error":"Error inserting playlist song"}`, http.StatusInternalServerError)
					return
				}
			}
		}

		if err := tx.Commit(); err != nil {
			http.Error(w, `{"error":"Commit error"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"count":   len(req.SongIDs),
		})
	}
}

// HandleDeletePlaylist deletes a playlist.
func HandleDeletePlaylist(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		plIDStr := r.PathValue("id")
		plID, err := strconv.ParseInt(plIDStr, 10, 64)
		if err != nil {
			http.Error(w, `{"error":"Invalid playlist id"}`, http.StatusBadRequest)
			return
		}

		res, err := db.Exec("DELETE FROM playlists WHERE id = ?", plID)
		if err != nil {
			logger.Error("API", "Error deleting playlist", err)
			http.Error(w, `{"error":"Database error"}`, http.StatusInternalServerError)
			return
		}
		aff, _ := res.RowsAffected()
		if aff == 0 {
			http.Error(w, `{"error":"Playlist not found"}`, http.StatusNotFound)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]bool{"success": true})
	}
}

func prefixColumns(prefix, cols string) string {
	parts := strings.Split(cols, ",")
	res := make([]string, len(parts))
	for i, p := range parts {
		col := strings.TrimSpace(p)
		res[i] = prefix + "." + col
	}
	return strings.Join(res, ", ")
}
