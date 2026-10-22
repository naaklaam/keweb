package scanner

import (
	"crypto/md5"
	"database/sql"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
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
	MTime           int64
	HasCover        int
	HasLyrics       bool
	HasSyncedLyrics bool
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

func (s *Scanner) Scan(dirPath string, force ...bool) (*models.ScanResult, error) {
	if dirPath == "" {
		return nil, fmt.Errorf("no directory path specified")
	}

	forceScan := len(force) > 0 && force[0]

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

	logger.Info("Scanner", fmt.Sprintf("Scanning directory: %s (force=%v)...", rootMusicDir, forceScan))

	// 1. Recursive directory walk for audio and LRC files
	audioFiles := make([]string, 0, 1024)
	lrcFiles := make([]string, 0, 128)
	flacCount := 0
	err = filepath.WalkDir(rootMusicDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() {
			ext := strings.ToLower(filepath.Ext(path))
			if supportedAudioExtensions[ext] {
				audioFiles = append(audioFiles, path)
				if ext == ".flac" {
					flacCount++
				}
			} else if ext == ".lrc" {
				lrcFiles = append(lrcFiles, path)
			}
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk dir: %w", err)
	}

	lrcIdx := BuildLrcIndex(lrcFiles)
	logger.Info("Scanner", fmt.Sprintf("Found %d audio tracks (%d FLAC) and %d LRC files.", len(audioFiles), flacCount, len(lrcFiles)))

	var prevCount int
	_ = s.db.QueryRow("SELECT COUNT(*) FROM songs").Scan(&prevCount)

	const purgeBlockRatio = 0.5
	canPurge := s.enablePurge || (len(audioFiles) > 0 && (prevCount == 0 || len(audioFiles) >= int(float64(prevCount)*purgeBlockRatio)))

	// Load existing cached records
	existingRows := make(map[string]cachedSongRow, prevCount)
	rows, err := s.db.Query("SELECT filepath, mtime, has_cover, lyrics FROM songs")
	if err == nil {
		for rows.Next() {
			var fp string
			var mtime int64
			var hasCover int
			var lyrics sql.NullString
			if err := rows.Scan(&fp, &mtime, &hasCover, &lyrics); err == nil {
				hasLyr := lyrics.Valid && strings.TrimSpace(lyrics.String) != ""
				hasSynced := hasLyr && HasSyncedTimestamps(lyrics.String)
				existingRows[fp] = cachedSongRow{
					MTime:           mtime,
					HasCover:        hasCover,
					HasLyrics:       hasLyr,
					HasSyncedLyrics: hasSynced,
				}
			}
		}
		rows.Close()
	}

	// Phase 1: Filter changed files by mtime, cover existence, and lyrics synchronization status
	toParse := make([]fileToParse, 0, len(audioFiles))
	unchangedCount := 0
	for _, fp := range audioFiles {
		st, err := os.Stat(fp)
		if err != nil {
			continue
		}
		mtime := st.ModTime().UnixMilli()

		// If a matching external LRC exists, take the newer mtime
		if lrcPath := lrcIdx.FindMatch(fp, "", ""); lrcPath != "" {
			if lrcSt, err := os.Stat(lrcPath); err == nil {
				lrcMTime := lrcSt.ModTime().UnixMilli()
				if lrcMTime > mtime {
					mtime = lrcMTime
				}
			}
		}

		if cached, ok := existingRows[fp]; ok && !forceScan && cached.MTime == mtime {
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
				parsed, err := s.parseAudioFile(item.FilePath, item.MTime, item.FileSize, rootMusicDir, lrcIdx)
				if err != nil {
					logger.Error("Scanner", fmt.Sprintf("Error parsing %s", item.FilePath), err)
					continue
				}
				resultsChan <- parsed
			}
		}()
	}

	go func() {
		wg.Wait()
		close(resultsChan)
	}()

	parsedList := make([]parsedSong, 0, len(toParse))
	for res := range resultsChan {
		parsedList = append(parsedList, res)
		// Save cover art if present
		if res.Song.HasCover == 1 && len(res.CoverBuffer) > 0 {
			coverPath := CoverPathFor(s.coversDir, res.Song.Filepath)
			_ = os.WriteFile(coverPath, res.CoverBuffer, 0644)
		}
	}

	// Phase 3: Batch SQLite Database Transaction
	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.Prepare(`
		INSERT INTO songs (
			filepath, filename, title, artist, album, track_no, year, genre,
			duration, sample_rate, bits_per_sample, bitrate, channels, lossless,
			container, mime_type, has_cover, cover_mime, lyrics, mtime
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(filepath) DO UPDATE SET
			filename=excluded.filename,
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

func (s *Scanner) parseAudioFile(fp string, mtime, fileSize int64, rootDir string, lrcIdx *LrcIndex) (parsedSong, error) {
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

	var coverData []byte
	var coverMime *string
	hasCover := 0
	var lyrics *string

	if ext == ".flac" {
		flacMeta, err := ParseFullFlacFile(fp)
		if err == nil {
			sampleRate = flacMeta.StreamInfo.SampleRate
			channels = flacMeta.StreamInfo.Channels
			bitsPerSample = flacMeta.StreamInfo.BitsPerSample
			duration = flacMeta.StreamInfo.Duration

			if t := flacMeta.FirstComment("TITLE"); t != "" {
				title = t
			}
			if a := flacMeta.FirstComment("ARTIST"); a != "" {
				artist = a
			} else if aa := flacMeta.FirstComment("ALBUMARTIST"); aa != "" {
				artist = aa
			}
			if alb := flacMeta.FirstComment("ALBUM"); alb != "" {
				album = alb
			}
			if tr := flacMeta.FirstComment("TRACKNUMBER"); tr != "" {
				if trNo, err := strconv.Atoi(strings.Split(tr, "/")[0]); err == nil && trNo > 0 {
					trackNo = trNo
				}
			}
			if dt := flacMeta.FirstComment("DATE"); dt != "" {
				if y, err := strconv.Atoi(strings.Split(dt, "-")[0]); err == nil && y > 0 {
					year = &y
				}
			} else if yr := flacMeta.FirstComment("YEAR"); yr != "" {
				if y, err := strconv.Atoi(strings.Split(yr, "-")[0]); err == nil && y > 0 {
					year = &y
				}
			}
			if g := flacMeta.FirstComment("GENRE"); g != "" {
				genre = g
			}

			if len(flacMeta.PictureData) > 0 {
				hasCover = 1
				mime := flacMeta.PictureMime
				if mime == "" {
					mime = "image/jpeg"
				}
				coverMime = &mime
				coverData = flacMeta.PictureData
			}

			lyrics = ExtractBestLyrics(fp, title, artist, flacMeta.Comments, nil, lrcIdx)
		}
	} else {
		// Non-FLAC audio files (MP3, M4A, etc.)
		f, err := os.Open(fp)
		if err == nil {
			defer f.Close()
			meta, metaErr := tag.ReadFrom(f)
			if metaErr == nil && meta != nil {
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
			lyrics = ExtractBestLyrics(fp, title, artist, nil, meta, lrcIdx)
		}
	}

	// Fallback folder cover in track's subfolder (not root)
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

	// Calculate bitrate if duration > 0
	bitrate := 0
	if duration > 0 {
		bitrate = int(float64(fileSize*8) / duration)
	}

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
