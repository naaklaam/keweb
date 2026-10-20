package scanner

import (
	"crypto/md5"
	"database/sql"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"

	"github.com/dhowden/tag"
	"keweb/internal/logger"
	"keweb/internal/models"
)

var supportedAudioExtensions = map[string]bool{
	".flac": true,
	".mp3":  true,
	".m4a":  true,
	".wav":  true,
	".ogg":  true,
	".opus": true,
	".aac":  true,
	".alac": true,
}

var mimeByContainer = map[string]string{
	"FLAC":         "audio/flac",
	"MPEG":         "audio/mpeg",
	"MPEG-GENERIC": "audio/mpeg",
	"MP4":          "audio/mp4",
	"M4A":          "audio/mp4",
	"ADTS":         "audio/aac",
	"AAC":          "audio/aac",
	"AAC-ADTS":     "audio/aac",
	"WAV":          "audio/wav",
	"WAVE":         "audio/wav",
	"OGG":          "audio/ogg",
	"OPUS":         "audio/ogg",
	"OGG-OPUS":     "audio/ogg",
	"ALAC":         "audio/mp4",
	"AIFF":         "audio/aiff",
}

var mimeByExt = map[string]string{
	".flac": "audio/flac",
	".mp3":  "audio/mpeg",
	".m4a":  "audio/mp4",
	".wav":  "audio/wav",
	".ogg":  "audio/ogg",
	".opus": "audio/ogg",
	".aac":  "audio/aac",
	".alac": "audio/mp4",
}

var folderCoverNames = []string{
	"cover.jpg", "cover.jpeg", "cover.png", "cover.webp",
	"folder.jpg", "folder.jpeg", "folder.png", "folder.webp",
	"front.jpg", "front.jpeg", "front.png", "front.webp",
	"album.jpg", "album.jpeg", "album.png", "album.webp",
}

func MimeForMedia(container, filePath string) string {
	c := strings.ToUpper(container)
	if m, ok := mimeByContainer[c]; ok {
		return m
	}
	ext := strings.ToLower(filepath.Ext(filePath))
	if m, ok := mimeByExt[ext]; ok {
		return m
	}
	return "application/octet-stream"
}

func CoverPathFor(coversDir, filePath string) string {
	h := md5.Sum([]byte(filePath))
	return filepath.Join(coversDir, fmt.Sprintf("%x.img", h))
}

type cachedSongRow struct {
	MTime    int64
	HasCover int
}

type fileToParse struct {
	FilePath string
	MTime    int64
	FileSize int64
}

type parsedSong struct {
	Song        models.Song
	CoverBuffer []byte
}

type Scanner struct {
	db          *sql.DB
	coversDir   string
	enablePurge bool
	mu          sync.Mutex
	running     bool
}

func New(db *sql.DB, dataDir string, enablePurge bool) *Scanner {
	coversDir := filepath.Join(dataDir, "covers")
	_ = os.MkdirAll(coversDir, 0755)

	return &Scanner{
		db:          db,
		coversDir:   coversDir,
		enablePurge: enablePurge,
	}
}

func (s *Scanner) Scan(dirPath string) (*models.ScanResult, error) {
	if dirPath == "" {
		return nil, fmt.Errorf("no directory path specified")
	}

	rootMusicDir, err := filepath.Abs(dirPath)
	if err != nil {
		return nil, fmt.Errorf("resolve music dir: %w", err)
	}

	fi, err := os.Stat(rootMusicDir)
	if err != nil || !fi.IsDir() {
		return nil, fmt.Errorf("directory does not exist: %s", rootMusicDir)
	}

	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return nil, fmt.Errorf("a scan is already running")
	}
	s.running = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	logger.Info("Scanner", fmt.Sprintf("Scanning directory: %s...", rootMusicDir))

	// 1. Recursive directory walk
	audioFiles := make([]string, 0, 1024)
	flacCount := 0
	err = filepath.WalkDir(rootMusicDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // Skip unreadable entries instead of failing
		}
		if !d.IsDir() {
			ext := strings.ToLower(filepath.Ext(path))
			if supportedAudioExtensions[ext] {
				audioFiles = append(audioFiles, path)
				if ext == ".flac" {
					flacCount++
				}
			}
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk dir: %w", err)
	}

	logger.Info("Scanner", fmt.Sprintf("Found %d audio tracks (%d FLAC).", len(audioFiles), flacCount))

	var prevCount int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM songs").Scan(&prevCount)

	const purgeBlockRatio = 0.5
	canPurge := s.enablePurge || (len(audioFiles) > 0 && (prevCount == 0 || len(audioFiles) >= int(float64(prevCount)*purgeBlockRatio)))

	// Load existing cached records
	existingRows := make(map[string]cachedSongRow, prevCount)
	rows, err := s.db.Query("SELECT filepath, mtime, has_cover FROM songs")
	if err == nil {
		for rows.Next() {
			var fp string
			var mtime int64
			var hasCover int
			if err := rows.Scan(&fp, &mtime, &hasCover); err == nil {
				existingRows[fp] = cachedSongRow{MTime: mtime, HasCover: hasCover}
			}
		}
		rows.Close()
	}

	// Phase 1: Filter changed files by mtime and cover existence
	toParse := make([]fileToParse, 0, len(audioFiles))
	unchangedCount := 0
	for _, fp := range audioFiles {
		st, err := os.Stat(fp)
		if err != nil {
			continue
		}
		mtime := st.ModTime().UnixMilli()
		if cached, ok := existingRows[fp]; ok && cached.MTime == mtime {
			coverPath := CoverPathFor(s.coversDir, fp)
			_, coverErr := os.Stat(coverPath)
			coverExists := coverErr == nil
			if (cached.HasCover == 1) == coverExists {
				unchangedCount++
				continue
			}
		}
		toParse = append(toParse, fileToParse{
			FilePath: fp,
			MTime:    mtime,
			FileSize: st.Size(),
		})
	}

	// Phase 2: Parallel metadata parsing using Goroutine worker pool
	numWorkers := runtime.NumCPU() * 2
	if numWorkers < 4 {
		numWorkers = 4
	}
	if numWorkers > 16 {
		numWorkers = 16
	}

	jobs := make(chan fileToParse, len(toParse))
	for _, f := range toParse {
		jobs <- f
	}
	close(jobs)

	resultsChan := make(chan parsedSong, len(toParse))
	var wg sync.WaitGroup

	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for item := range jobs {
				parsed, err := s.parseAudioFile(item.FilePath, item.MTime, item.FileSize, rootMusicDir)
				if err != nil {
					logger.Error("Scanner", fmt.Sprintf("Error parsing %s", item.FilePath), err)
					continue
				}
				resultsChan <- parsed
			}
		}()
	}

	wg.Wait()
	close(resultsChan)

	parsedList := make([]parsedSong, 0, len(toParse))
	for r := range resultsChan {
		parsedList = append(parsedList, r)
	}

	// Save cover art to disk
	for _, item := range parsedList {
		coverPath := CoverPathFor(s.coversDir, item.Song.Filepath)
		if item.Song.HasCover == 1 && len(item.CoverBuffer) > 0 {
			_ = os.WriteFile(coverPath, item.CoverBuffer, 0644)
		} else if _, err := os.Stat(coverPath); err == nil {
			_ = os.Remove(coverPath)
		}
	}

	// Phase 3: Write DB changes in a single atomic transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		_ = tx.Rollback()
	}()

	stmt, err := tx.Prepare(`
		INSERT INTO songs (
			filepath, filename, title, artist, album, track_no, year, genre,
			duration, sample_rate, bits_per_sample, bitrate, channels, lossless, container,
			mime_type, has_cover, cover_mime, lyrics, mtime
		) VALUES (
			?, ?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?
		)
		ON CONFLICT(filepath) DO UPDATE SET
			title=excluded.title,
			artist=excluded.artist,
			album=excluded.album,
			track_no=excluded.track_no,
			year=excluded.year,
			genre=excluded.genre,
			duration=excluded.duration,
			sample_rate=excluded.sample_rate,
			bits_per_sample=excluded.bits_per_sample,
			bitrate=excluded.bitrate,
			channels=excluded.channels,
			lossless=excluded.lossless,
			container=excluded.container,
			mime_type=excluded.mime_type,
			has_cover=excluded.has_cover,
			cover_mime=excluded.cover_mime,
			lyrics=excluded.lyrics,
			mtime=excluded.mtime;
	`)
	if err != nil {
		return nil, fmt.Errorf("prepare insert statement: %w", err)
	}
	defer stmt.Close()

	for _, item := range parsedList {
		sn := item.Song
		_, err := stmt.Exec(
			sn.Filepath, sn.Filename, sn.Title, sn.Artist, sn.Album, sn.TrackNo, sn.Year, sn.Genre,
			sn.Duration, sn.SampleRate, sn.BitsPerSample, sn.Bitrate, sn.Channels, sn.Lossless,
			sn.Container, sn.MimeType, sn.HasCover, sn.CoverMime, sn.Lyrics, sn.MTime,
		)
		if err != nil {
			logger.Error("Scanner", fmt.Sprintf("Error writing %s to DB", sn.Filepath), err)
		}
	}

	// Check for stale songs that were removed from disk
	validPathSet := make(map[string]bool, len(audioFiles))
	for _, f := range audioFiles {
		validPathSet[filepath.Clean(f)] = true
	}

	delStmt, err := tx.Prepare("DELETE FROM songs WHERE filepath = ?")
	if err != nil {
		return nil, fmt.Errorf("prepare delete statement: %w", err)
	}
	defer delStmt.Close()

	pendingRemoval := 0
	for fp := range existingRows {
		if !validPathSet[filepath.Clean(fp)] {
			pendingRemoval++
			if canPurge {
				_, _ = delStmt.Exec(fp)
				coverPath := CoverPathFor(s.coversDir, fp)
				_ = os.Remove(coverPath)
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit scan transaction: %w", err)
	}

	removedCount := 0
	blockedCount := 0
	if canPurge {
		removedCount = pendingRemoval
	} else {
		blockedCount = pendingRemoval
	}

	logger.Info("Scanner", fmt.Sprintf("Scan complete. Indexed %d tracks (%d unchanged), purged %d stale.",
		len(parsedList), unchangedCount, removedCount))

	if blockedCount > 0 && removedCount == 0 {
		logger.Warn("Scanner", fmt.Sprintf("Purge blocked for %d track(s): scan found only %d files vs %d known. Set ENABLE_SCAN_PURGE=true to force.",
			blockedCount, len(audioFiles), prevCount))
	}

	return &models.ScanResult{
		Added:     len(parsedList),
		Unchanged: unchangedCount,
		Removed:   removedCount,
		Blocked:   blockedCount,
	}, nil
}

func (s *Scanner) parseAudioFile(fp string, mtime, fileSize int64, rootDir string) (parsedSong, error) {
	f, err := os.Open(fp)
	if err != nil {
		return parsedSong{}, err
	}
	defer f.Close()

	ext := strings.ToLower(filepath.Ext(fp))
	filename := filepath.Base(fp)
	baseNoExt := strings.TrimSuffix(filename, filepath.Ext(filename))

	title := baseNoExt
	artist := "Unknown Artist"
	album := "Unknown Album"
	trackNo := 0
	var year *int
	genre := ""

	sampleRate := 44100
	bitsPerSample := 16
	channels := 2
	duration := 0.0
	isLossless := 0
	container := strings.ToUpper(strings.TrimPrefix(ext, "."))

	if ext == ".flac" || ext == ".wav" || ext == ".alac" {
		isLossless = 1
	}

	// 1. If FLAC, read exact STREAMINFO directly
	if ext == ".flac" {
		info, err := ParseFlacStreamInfo(f)
		if err == nil {
			sampleRate = info.SampleRate
			channels = info.Channels
			bitsPerSample = info.BitsPerSample
			duration = info.Duration
		}
	}

	// 2. Read metadata tags (title, artist, album, etc.)
	_, _ = f.Seek(0, 0)
	meta, err := tag.ReadFrom(f)
	var coverData []byte
	var coverMime *string
	hasCover := 0

	if err == nil && meta != nil {
		if t := strings.TrimSpace(meta.Title()); t != "" {
			title = t
		}
		if a := strings.TrimSpace(meta.Artist()); a != "" {
			artist = a
		} else if aa := strings.TrimSpace(meta.AlbumArtist()); aa != "" {
			artist = aa
		}
		if alb := strings.TrimSpace(meta.Album()); alb != "" {
			album = alb
		}
		if tr, _ := meta.Track(); tr > 0 {
			trackNo = tr
		}
		if y := meta.Year(); y > 0 {
			year = &y
		}
		if g := strings.TrimSpace(meta.Genre()); g != "" {
			genre = g
		}

		// If duration not set from STREAMINFO, estimate or read from tags if available
		if pic := meta.Picture(); pic != nil && len(pic.Data) > 0 {
			hasCover = 1
			mime := pic.MIMEType
			if mime == "" {
				mime = "image/jpeg"
			}
			coverMime = &mime
			coverData = pic.Data
		}
	}

	// 3. Fallback folder cover in track's subfolder (not root)
	if hasCover == 0 {
		parentDir := filepath.Dir(fp)
		if parentDir != rootDir {
			for _, coverName := range folderCoverNames {
				candidate := filepath.Join(parentDir, coverName)
				if b, err := os.ReadFile(candidate); err == nil && len(b) > 0 {
					hasCover = 1
					coverData = b
					ext := strings.ToLower(filepath.Ext(coverName))
					mime := "image/jpeg"
					if ext == ".png" {
						mime = "image/png"
					} else if ext == ".webp" {
						mime = "image/webp"
					}
					coverMime = &mime
					break
				}
			}
		}
	}

	// 4. Calculate bitrate if duration > 0
	bitrate := 0
	if duration > 0 {
		bitrate = int(float64(fileSize*8) / duration)
	}

	// 5. Lyrics extraction
	lyrics := extractLyrics(fp, meta)

	mimeType := MimeForMedia(container, fp)

	return parsedSong{
		Song: models.Song{
			Filepath:      fp,
			Filename:      filename,
			Title:         title,
			Artist:        artist,
			Album:         album,
			TrackNo:       trackNo,
			Year:          year,
			Genre:         genre,
			Duration:      duration,
			SampleRate:    sampleRate,
			BitsPerSample: bitsPerSample,
			Bitrate:       bitrate,
			Channels:      channels,
			Lossless:      isLossless,
			Container:     container,
			MimeType:      mimeType,
			HasCover:      hasCover,
			CoverMime:     coverMime,
			Lyrics:        lyrics,
			MTime:         mtime,
		},
		CoverBuffer: coverData,
	}, nil
}

func extractLyrics(filePath string, meta tag.Metadata) *string {
	// 1. External .lrc file next to audio file
	ext := filepath.Ext(filePath)
	lrcCandidate := strings.TrimSuffix(filePath, ext) + ".lrc"
	if b, err := os.ReadFile(lrcCandidate); err == nil {
		s := strings.TrimSpace(string(b))
		if s != "" {
			return &s
		}
	}

	// 2. Embedded lyrics tag
	if meta != nil {
		if lyr := strings.TrimSpace(meta.Lyrics()); lyr != "" {
			return parseRawLyrics(lyr)
		}

		// Check raw vorbis / id3 comments
		if raw := meta.Raw(); raw != nil {
			for k, v := range raw {
				uk := strings.ToUpper(k)
				if uk == "LYRICS" || uk == "UNSYNCEDLYRICS" || uk == "LYRICS_TEXT" || uk == "USLT" {
					if str, ok := v.(string); ok && strings.TrimSpace(str) != "" {
						return parseRawLyrics(str)
					}
				}
			}
		}
	}

	return nil
}

func parseRawLyrics(lyr string) *string {
	s := strings.TrimSpace(lyr)
	if s == "" {
		return nil
	}

	// Check if JSON structured lyrics
	if strings.HasPrefix(s, "{") {
		var obj struct {
			Text     string `json:"text"`
			SyncText []struct {
				Text string `json:"text"`
			} `json:"syncText"`
		}
		if err := json.Unmarshal([]byte(s), &obj); err == nil {
			if strings.TrimSpace(obj.Text) != "" {
				clean := strings.TrimSpace(obj.Text)
				return &clean
			}
			if len(obj.SyncText) > 0 {
				lines := make([]string, 0, len(obj.SyncText))
				for _, st := range obj.SyncText {
					if t := strings.TrimSpace(st.Text); t != "" {
						lines = append(lines, t)
					}
				}
				if len(lines) > 0 {
					joined := strings.Join(lines, "\n")
					return &joined
				}
			}
		}
	}

	return &s
}
