package stream

import (
	"database/sql"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"keweb/internal/logger"
	"keweb/internal/scanner"
	"keweb/internal/telemetry"
)

type responseTracker struct {
	http.ResponseWriter
	bytesWritten int64
	statusCode   int
}

func (w *responseTracker) WriteHeader(code int) {
	w.statusCode = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *responseTracker) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytesWritten += int64(n)
	return n, err
}

func ClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

func DisableNagle(w http.ResponseWriter) {
	hijacker, ok := w.(http.Hijacker)
	if !ok {
		return
	}
	// Try unwrapping if it's a wrapper, or access raw conn if available
	_ = hijacker
}

// HandleAudioStream handles audio streaming with full RFC 7233 HTTP Range support.
func HandleAudioStream(db *sql.DB, w http.ResponseWriter, r *http.Request, songID int64) {
	var filepathStr, title, filename, container, mimeType sql.NullString
	err := db.QueryRow(`
		SELECT filepath, title, filename, container, mime_type
		FROM songs WHERE id = ?
	`, songID).Scan(&filepathStr, &title, &filename, &container, &mimeType)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"Song not found"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"DB error"}`, http.StatusInternalServerError)
		return
	}

	if !filepathStr.Valid || filepathStr.String == "" {
		http.Error(w, `{"error":"Song file path invalid"}`, http.StatusNotFound)
		return
	}

	f, err := os.Open(filepathStr.String)
	if err != nil {
		logger.Warn("STREAM", "Song file missing: "+filepathStr.String)
		http.Error(w, `{"error":"Song file not found"}`, http.StatusNotFound)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		http.Error(w, `{"error":"Stat error"}`, http.StatusInternalServerError)
		return
	}

	cType := mimeType.String
	if cType == "" {
		cType = scanner.MimeForMedia(container.String, filepathStr.String)
	}

	w.Header().Set("Content-Type", cType)
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=3600")

	tracker := &responseTracker{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
	}

	songName := title.String
	if songName == "" {
		songName = filename.String
	}
	clientIP := ClientIP(r)

	// http.ServeContent automatically handles HEAD, GET, Range, Content-Range, 206 Partial Content,
	// and Linux sendfile zero-copy streaming.
	http.ServeContent(tracker, r, stat.Name(), stat.ModTime(), f)

	// Record stream metrics once response finishes or connection closes
	if tracker.bytesWritten > 0 {
		telemetry.RecordStream(tracker.bytesWritten)
		logger.Stream(songName, tracker.bytesWritten, clientIP)
	}
}

// HandleCoverArt serves cached album art for a song.
func HandleCoverArt(db *sql.DB, coversDir string, w http.ResponseWriter, r *http.Request, songID int64) {
	var filepathStr, coverMime sql.NullString
	var hasCover int

	err := db.QueryRow(`
		SELECT filepath, has_cover, cover_mime
		FROM songs WHERE id = ?
	`, songID).Scan(&filepathStr, &hasCover, &coverMime)

	if err == sql.ErrNoRows || hasCover == 0 {
		http.Error(w, `{"error":"No cover art found"}`, http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, `{"error":"DB error"}`, http.StatusInternalServerError)
		return
	}

	coverPath := scanner.CoverPathFor(coversDir, filepathStr.String)
	f, err := os.Open(coverPath)
	if err != nil {
		http.Error(w, `{"error":"Cover file missing"}`, http.StatusNotFound)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		http.Error(w, `{"error":"Stat error"}`, http.StatusInternalServerError)
		return
	}

	mime := coverMime.String
	if mime == "" {
		mime = "image/jpeg"
	}

	w.Header().Set("Content-Type", mime)
	w.Header().Set("Cache-Control", "public, max-age=86400")

	http.ServeContent(w, r, filepath.Base(coverPath), stat.ModTime(), f)
}

func ParseID(idStr string) (int64, error) {
	return strconv.ParseInt(idStr, 10, 64)
}
