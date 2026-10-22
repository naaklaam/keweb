package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"keweb/internal/logger"
	"keweb/internal/scanner"
	"keweb/internal/stream"
	"keweb/internal/telemetry"
)

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (lrw *loggingResponseWriter) WriteHeader(code int) {
	lrw.statusCode = code
	lrw.ResponseWriter.WriteHeader(code)
}

// NewRouter constructs the complete HTTP handler tree including CORS, logging, API routes, and SPA static fallback.
func NewRouter(db *sql.DB, sc *scanner.Scanner, coversDir, clientDistDir, defaultMusicDir string) http.Handler {
	mux := http.NewServeMux()

	// Songs and streaming
	mux.HandleFunc("GET /api/songs", HandleGetSongs(db))
	mux.HandleFunc("GET /api/songs/{id}", HandleGetSongByID(db))
	mux.HandleFunc("GET /api/stream/{id}", HandleStream(db))
	mux.HandleFunc("HEAD /api/stream/{id}", HandleStream(db))
	mux.HandleFunc("GET /api/cover/{id}", HandleCover(db, coversDir))
	mux.HandleFunc("HEAD /api/cover/{id}", HandleCover(db, coversDir))

	// Stats and Telemetry
	mux.HandleFunc("GET /api/stats", HandleStats(db))
	mux.HandleFunc("GET /api/telemetry", HandleTelemetry(db))

	// Playlists
	mux.HandleFunc("GET /api/playlists", HandleGetPlaylists(db))
	mux.HandleFunc("POST /api/playlists", HandleCreatePlaylist(db))
	mux.HandleFunc("GET /api/playlists/{id}", HandleGetPlaylistByID(db))
	mux.HandleFunc("POST /api/playlists/{id}/songs", HandleAddSongToPlaylist(db))
	mux.HandleFunc("DELETE /api/playlists/{id}/songs/{songId}", HandleRemoveSongFromPlaylist(db))
	mux.HandleFunc("PUT /api/playlists/{id}/songs", HandleReorderPlaylistSongs(db))
	mux.HandleFunc("DELETE /api/playlists/{id}", HandleDeletePlaylist(db))

	// Scan
	mux.HandleFunc("POST /api/scan", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Dir   string `json:"dir"`
			Force bool   `json:"force"`
		}
		_ = json.NewDecoder(r.Body).Decode(&req)
		force := req.Force || r.URL.Query().Get("force") == "true"

		targetDir := defaultMusicDir
		if req.Dir != "" {
			reqClean, err := filepath.Abs(req.Dir)
			rootClean, rootErr := filepath.Abs(defaultMusicDir)
			if err != nil || rootErr != nil || (reqClean != rootClean && !strings.HasPrefix(reqClean, rootClean+string(filepath.Separator))) {
				http.Error(w, `{"error":"Scan directory must be inside MUSIC_DIR"}`, http.StatusBadRequest)
				return
			}
			targetDir = reqClean
		}

		if targetDir == "" {
			http.Error(w, `{"error":"MUSIC_DIR not configured"}`, http.StatusBadRequest)
			return
		}

		logger.Info("SCAN", fmt.Sprintf("Manual scan requested for: %s (force=%v)", targetDir, force))
		result, err := sc.Scan(targetDir, force)
		if err != nil {
			logger.Error("SCAN", "Scan failed", err)
			http.Error(w, `{"error":"`+err.Error()+`"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Scan completed successfully",
			"result":  result,
		})
	})

	// Wrap with Global Middleware & SPA Static Fallback
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		telemetry.RecordAPIRequest()

		// Global CORS
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD")
		w.Header().Set("Access-Control-Allow-Headers", "Range, Content-Type, Authorization")
		w.Header().Set("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		lrw := &loggingResponseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// API routes are handled by ServeMux
		if strings.HasPrefix(r.URL.Path, "/api/") {
			mux.ServeHTTP(lrw, r)
			durationMs := time.Since(start).Milliseconds()
			logger.Access(r.Method, r.URL.Path, lrw.statusCode, durationMs, stream.ClientIP(r), r.UserAgent())
			return
		}

		// Static Frontend files & SPA routing
		filePath := filepath.Join(clientDistDir, filepath.Clean(r.URL.Path))
		fi, err := os.Stat(filePath)
		if err == nil && !fi.IsDir() {
			http.ServeFile(lrw, r, filePath)
		} else {
			// Fallback to index.html for React Single Page Application routing
			indexPath := filepath.Join(clientDistDir, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				http.ServeFile(lrw, r, indexPath)
			} else {
				http.NotFound(lrw, r)
			}
		}

		durationMs := time.Since(start).Milliseconds()
		logger.Access(r.Method, r.URL.Path, lrw.statusCode, durationMs, stream.ClientIP(r), r.UserAgent())
	})
}
