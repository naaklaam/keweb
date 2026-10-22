package scanner

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/dhowden/tag"
)

var (
	trackPrefixRegex = regexp.MustCompile(`^(?:\d+[\s\.\-_]+)+`)
	lrcTimestampRegex = regexp.MustCompile(`\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]`)
	wordSyncRegex    = regexp.MustCompile(`<\d{1,2}:\d{2}(?:\.\d{1,3})?>`)
	metaHeaderRegex  = regexp.MustCompile(`^\[(ar|al|ti|au|length|by|offset|re|ve|id|tool):.*\]$`)
	ttmlLineRegex    = regexp.MustCompile(`(?i)<p\b[^>]*\bbegin=["']?(\d{1,2}:\d{2}(?:\.\d{1,3})?|\d+(?:\.\d+)?s?)["']?[^>]*>(.*?)</p>`)
	srtTimestampRegex = regexp.MustCompile(`(\d{2}):(\d{2}):(\d{2})[,.](\d{2,3})`)
)

// HasSyncedTimestamps returns true if the lyrics string contains at least one LRC millisecond timestamp.
func HasSyncedTimestamps(s string) bool {
	return lrcTimestampRegex.MatchString(s)
}

// LrcIndex manages and indexes all external LRC files across the library.
type LrcIndex struct {
	exactMap   map[string]string            // exact filepath without ext (lowercased) -> lrcPath
	folderMaps map[string]map[string]string // dir -> normalizedKey -> lrcPath
	globalMap  map[string]string            // normalizedKey -> lrcPath
}

// NormalizeSearchKey cleans strings for matching (lowercase, alphanumeric, single spaces).
func NormalizeSearchKey(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}
	return strings.Join(strings.Fields(b.String()), " ")
}

// BuildLrcIndex indexes a list of discovered .lrc files.
func BuildLrcIndex(lrcFiles []string) *LrcIndex {
	idx := &LrcIndex{
		exactMap:   make(map[string]string, len(lrcFiles)),
		folderMaps: make(map[string]map[string]string),
		globalMap:  make(map[string]string, len(lrcFiles)*3),
	}

	for _, lp := range lrcFiles {
		ext := filepath.Ext(lp)
		noExt := strings.TrimSuffix(lp, ext)
		idx.exactMap[strings.ToLower(noExt)] = lp

		dir := filepath.Dir(lp)
		fMap, ok := idx.folderMaps[dir]
		if !ok {
			fMap = make(map[string]string)
			idx.folderMaps[dir] = fMap
		}

		base := filepath.Base(noExt)
		cleanBase := trackPrefixRegex.ReplaceAllString(base, "")

		normBase := NormalizeSearchKey(base)
		normClean := NormalizeSearchKey(cleanBase)

		if normBase != "" {
			fMap[normBase] = lp
			if _, exists := idx.globalMap[normBase]; !exists {
				idx.globalMap[normBase] = lp
			}
		}
		if normClean != "" {
			fMap[normClean] = lp
			if _, exists := idx.globalMap[normClean]; !exists {
				idx.globalMap[normClean] = lp
			}
		}

		// Inverted artist - title
		parts := strings.Split(cleanBase, "-")
		if len(parts) == 2 {
			p0 := strings.TrimSpace(parts[0])
			p1 := strings.TrimSpace(parts[1])
			inv := NormalizeSearchKey(p1 + " " + p0)
			fMap[inv] = lp
			if _, exists := idx.globalMap[inv]; !exists {
				idx.globalMap[inv] = lp
			}
			normP1 := NormalizeSearchKey(p1)
			if normP1 != "" && len(normP1) >= 4 {
				fMap[normP1] = lp
				if _, exists := idx.globalMap[normP1]; !exists {
					idx.globalMap[normP1] = lp
				}
			}
		}
	}

	return idx
}

// FindMatch searches for an external LRC matching the audio file.
func (idx *LrcIndex) FindMatch(audioPath, title, artist string) string {
	if idx == nil {
		return ""
	}

	ext := filepath.Ext(audioPath)
	noExt := strings.TrimSuffix(audioPath, ext)

	// 1. Exact match (same filename with .lrc / .LRC)
	if lp, ok := idx.exactMap[strings.ToLower(noExt)]; ok {
		return lp
	}

	dir := filepath.Dir(audioPath)
	audioBase := filepath.Base(noExt)
	cleanAudioBase := trackPrefixRegex.ReplaceAllString(audioBase, "")

	normAudioBase := NormalizeSearchKey(audioBase)
	normCleanAudioBase := NormalizeSearchKey(cleanAudioBase)
	normTitle := NormalizeSearchKey(title)
	normArtist := NormalizeSearchKey(artist)

	// 2. Folder-level match
	if fMap, ok := idx.folderMaps[dir]; ok {
		if normAudioBase != "" {
			if lp, found := fMap[normAudioBase]; found {
				return lp
			}
		}
		if normCleanAudioBase != "" {
			if lp, found := fMap[normCleanAudioBase]; found {
				return lp
			}
		}

		// Inverted audio base
		parts := strings.Split(cleanAudioBase, "-")
		if len(parts) == 2 {
			inv := NormalizeSearchKey(strings.TrimSpace(parts[1]) + " " + strings.TrimSpace(parts[0]))
			if lp, found := fMap[inv]; found {
				return lp
			}
		}

		// Metadata: artist + title, or title
		if normArtist != "" && normTitle != "" {
			if lp, found := fMap[normArtist+" "+normTitle]; found {
				return lp
			}
			if lp, found := fMap[normTitle+" "+normArtist]; found {
				return lp
			}
		}
		if normTitle != "" && len(normTitle) >= 3 {
			if lp, found := fMap[normTitle]; found {
				return lp
			}
		}

		// Substring scan in same folder for distinctive title
		if len(normTitle) >= 4 {
			for k, lp := range fMap {
				if strings.Contains(k, normTitle) {
					return lp
				}
			}
		}
	}

	// 3. Global library match (e.g. AM/ folder, subfolders)
	if normArtist != "" && normTitle != "" {
		if lp, found := idx.globalMap[normArtist+" "+normTitle]; found {
			return lp
		}
		if lp, found := idx.globalMap[normTitle+" "+normArtist]; found {
			return lp
		}
	}
	if normCleanAudioBase != "" {
		if lp, found := idx.globalMap[normCleanAudioBase]; found {
			return lp
		}
	}
	if normTitle != "" && len(normTitle) >= 4 {
		if lp, found := idx.globalMap[normTitle]; found {
			return lp
		}
	}

	return ""
}

type timedLine struct {
	timeMs int64
	text   string
}

// formatMsToLrc converts milliseconds into [mm:ss.xx]
func formatMsToLrc(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	totalSec := ms / 1000
	min := totalSec / 60
	sec := totalSec % 60
	centisec := (ms % 1000) / 10
	return fmt.Sprintf("[%02d:%02d.%02d]", min, sec, centisec)
}

// ParseAndNormalizeLyrics converts any raw lyrics format (LRC, JSON, TTML, SRT, plain text) into a clean format.
func ParseAndNormalizeLyrics(raw string) *string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return nil
	}

	// 1. Check if structured JSON
	if strings.HasPrefix(s, "{") || strings.HasPrefix(s, "[") {
		if normalized := parseJSONLyrics(s); normalized != nil {
			return normalized
		}
	}

	// 2. Check if TTML / XML lyrics (<p begin="00:01:23.456">...</p>)
	if strings.Contains(s, "<p") && strings.Contains(s, "begin=") {
		if normalized := parseTTMLLyrics(s); normalized != nil {
			return normalized
		}
	}

	// 3. Check if SRT / WebVTT (00:01:23,456 --> 00:01:25,000)
	if strings.Contains(s, "-->") {
		if normalized := parseSRTLyrics(s); normalized != nil {
			return normalized
		}
	}

	// 4. Standard LRC or plain text
	lines := strings.Split(s, "\n")
	hasTimestamps := false
	var cleanedLines []string

	for _, line := range lines {
		line = strings.TrimRight(line, "\r ")
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			// keep single blank line between stanzas
			if len(cleanedLines) > 0 && cleanedLines[len(cleanedLines)-1] != "" {
				cleanedLines = append(cleanedLines, "")
			}
			continue
		}

		if lrcTimestampRegex.MatchString(trimmed) {
			hasTimestamps = true
			// Strip inline word-sync tags like <00:12.34>
			cleaned := wordSyncRegex.ReplaceAllString(trimmed, "")
			cleanedLines = append(cleanedLines, cleaned)
		} else {
			cleanedLines = append(cleanedLines, trimmed)
		}
	}

	if len(cleanedLines) == 0 {
		return nil
	}

	// If no timestamps were found, strip non-lyric metadata headers like [id: xxx]
	if !hasTimestamps {
		var finalLines []string
		for _, line := range cleanedLines {
			if line == "" {
				if len(finalLines) > 0 && finalLines[len(finalLines)-1] != "" {
					finalLines = append(finalLines, "")
				}
				continue
			}
			lower := strings.ToLower(line)
			if metaHeaderRegex.MatchString(lower) || strings.HasPrefix(lower, "[id:") || strings.HasPrefix(lower, "[tool:") {
				continue
			}
			finalLines = append(finalLines, line)
		}
		cleanedLines = finalLines
	}

	for len(cleanedLines) > 0 && cleanedLines[0] == "" {
		cleanedLines = cleanedLines[1:]
	}
	for len(cleanedLines) > 0 && cleanedLines[len(cleanedLines)-1] == "" {
		cleanedLines = cleanedLines[:len(cleanedLines)-1]
	}

	if len(cleanedLines) == 0 {
		return nil
	}

	result := strings.Join(cleanedLines, "\n")
	return &result
}

// parseJSONLyrics handles Spotify, NetEase, QQ Music, Musixmatch, and generic JSON lyrics.
func parseJSONLyrics(rawJSON string) *string {
	var raw interface{}
	if err := json.Unmarshal([]byte(rawJSON), &raw); err != nil {
		return nil
	}

	var timed []timedLine

	// Helper to inspect elements
	parseItem := func(item map[string]interface{}) {
		var text string
		for _, key := range []string{"words", "text", "line", "content", "lyric"} {
			if v, ok := item[key].(string); ok && strings.TrimSpace(v) != "" {
				text = strings.TrimSpace(v)
				break
			}
		}

		var timeMs int64 = -1
		// Check startTimeMs / time / start / begin
		for _, key := range []string{"startTimeMs", "time", "start", "begin", "start_time", "offset"} {
			if val, ok := item[key]; ok {
				switch v := val.(type) {
				case float64:
					if v < 1000.0 && strings.Contains(key, "time") && !strings.Contains(key, "Ms") {
						timeMs = int64(v * 1000)
					} else {
						timeMs = int64(v)
					}
				case string:
					if n, err := strconv.ParseInt(v, 10, 64); err == nil {
						timeMs = n
					} else if f, err := strconv.ParseFloat(v, 64); err == nil {
						timeMs = int64(f * 1000)
					}
				}
				if timeMs >= 0 {
					break
				}
			}
		}

		if text != "" {
			if timeMs >= 0 {
				timed = append(timed, timedLine{timeMs: timeMs, text: text})
			} else if lrcTimestampRegex.MatchString(text) {
				// Text already contains LRC timestamp
				timed = append(timed, timedLine{timeMs: 0, text: text})
			}
		}
	}

	switch v := raw.(type) {
	case map[string]interface{}:
		// 1. Direct "lrc" or "lyrics" string field
		for _, key := range []string{"lrc", "lyric", "lyrics"} {
			if s, ok := v[key].(string); ok && strings.TrimSpace(s) != "" && strings.Contains(s, "[") {
				return ParseAndNormalizeLyrics(s)
			}
		}

		// 2. Lines array
		for _, key := range []string{"lines", "syncText", "lyrics", "data", "sentences"} {
			if arr, ok := v[key].([]interface{}); ok {
				for _, elem := range arr {
					if m, ok := elem.(map[string]interface{}); ok {
						parseItem(m)
					}
				}
			}
		}

		// 3. Fallback plain text field if no timed lines
		if len(timed) == 0 {
			for _, key := range []string{"text", "plainText", "lyrics", "lyric"} {
				if s, ok := v[key].(string); ok && strings.TrimSpace(s) != "" {
					return ParseAndNormalizeLyrics(s)
				}
			}
		}

	case []interface{}:
		for _, elem := range v {
			if m, ok := elem.(map[string]interface{}); ok {
				parseItem(m)
			}
		}
	}

	if len(timed) > 0 {
		sort.SliceStable(timed, func(i, j int) bool {
			return timed[i].timeMs < timed[j].timeMs
		})

		var lines []string
		for _, tl := range timed {
			if lrcTimestampRegex.MatchString(tl.text) {
				lines = append(lines, tl.text)
			} else {
				lines = append(lines, fmt.Sprintf("%s %s", formatMsToLrc(tl.timeMs), tl.text))
			}
		}
		res := strings.Join(lines, "\n")
		return &res
	}

	return nil
}

// parseTTMLLyrics parses TTML XML subtitles into LRC format.
func parseTTMLLyrics(s string) *string {
	matches := ttmlLineRegex.FindAllStringSubmatch(s, -1)
	if len(matches) == 0 {
		return nil
	}

	var lines []string
	for _, m := range matches {
		timeStr := m[1]
		text := strings.TrimSpace(m[2])
		// Remove XML tags inside text
		text = regexp.MustCompile(`<[^>]+>`).ReplaceAllString(text, "")
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}

		var timeMs int64
		if strings.Contains(timeStr, ":") {
			parts := strings.Split(timeStr, ":")
			if len(parts) == 2 {
				min, _ := strconv.ParseInt(parts[0], 10, 64)
				secF, _ := strconv.ParseFloat(parts[1], 64)
				timeMs = min*60000 + int64(secF*1000)
			} else if len(parts) == 3 {
				hr, _ := strconv.ParseInt(parts[0], 10, 64)
				min, _ := strconv.ParseInt(parts[1], 10, 64)
				secF, _ := strconv.ParseFloat(parts[2], 64)
				timeMs = hr*3600000 + min*60000 + int64(secF*1000)
			}
		} else {
			f, _ := strconv.ParseFloat(strings.TrimSuffix(timeStr, "s"), 64)
			timeMs = int64(f * 1000)
		}

		lines = append(lines, fmt.Sprintf("%s %s", formatMsToLrc(timeMs), text))
	}

	if len(lines) == 0 {
		return nil
	}
	res := strings.Join(lines, "\n")
	return &res
}

// parseSRTLyrics parses SubRip (SRT) format subtitles into LRC format.
func parseSRTLyrics(s string) *string {
	rawBlocks := strings.Split(strings.ReplaceAll(s, "\r\n", "\n"), "\n\n")
	var lines []string

	for _, block := range rawBlocks {
		blockLines := strings.Split(strings.TrimSpace(block), "\n")
		var timeMs int64 = -1
		var textLines []string

		for _, bl := range blockLines {
			bl = strings.TrimSpace(bl)
			if bl == "" {
				continue
			}
			if strings.Contains(bl, "-->") {
				m := srtTimestampRegex.FindStringSubmatch(bl)
				if len(m) >= 5 {
					hr, _ := strconv.ParseInt(m[1], 10, 64)
					min, _ := strconv.ParseInt(m[2], 10, 64)
					sec, _ := strconv.ParseInt(m[3], 10, 64)
					msStr := m[4]
					if len(msStr) == 2 {
						msStr += "0"
					}
					ms, _ := strconv.ParseInt(msStr, 10, 64)
					timeMs = hr*3600000 + min*60000 + sec*1000 + ms
				}
			} else if timeMs >= 0 {
				textLines = append(textLines, bl)
			}
		}

		if timeMs >= 0 && len(textLines) > 0 {
			lineText := strings.Join(textLines, " ")
			lines = append(lines, fmt.Sprintf("%s %s", formatMsToLrc(timeMs), lineText))
		}
	}

	if len(lines) == 0 {
		return nil
	}
	res := strings.Join(lines, "\n")
	return &res
}

// ExtractBestLyrics gathers candidates from external LRC and embedded metadata tags,
// rigorously prioritizing synchronized lyrics over plain unsynced text.
func ExtractBestLyrics(
	filePath, title, artist string,
	vorbisComments map[string][]string,
	nonFlacMeta tag.Metadata,
	lrcIdx *LrcIndex,
) *string {
	var candidates []string

	// 1. External LRC file match (Top Priority - User Override)
	if lrcIdx != nil {
		if lrcPath := lrcIdx.FindMatch(filePath, title, artist); lrcPath != "" {
			if b, err := os.ReadFile(lrcPath); err == nil && len(b) > 0 {
				if norm := ParseAndNormalizeLyrics(string(b)); norm != nil && HasSyncedTimestamps(*norm) {
					return norm
				}
				candidates = append(candidates, string(b))
			}
		}
	}

	// 2. Vorbis Comments (for FLAC)
	if vorbisComments != nil {
		for _, key := range []string{"LYRICS", "UNSYNCEDLYRICS", "SYNCEDLYRICS", "LYRICS_TEXT"} {
			if vals, ok := vorbisComments[key]; ok {
				for _, v := range vals {
					if strings.TrimSpace(v) != "" {
						candidates = append(candidates, v)
					}
				}
			}
		}
	}

	// 3. ID3 / MP4 tags (for non-FLAC)
	if nonFlacMeta != nil {
		if lyr := strings.TrimSpace(nonFlacMeta.Lyrics()); lyr != "" {
			candidates = append(candidates, lyr)
		}
		if raw := nonFlacMeta.Raw(); raw != nil {
			for k, v := range raw {
				uk := strings.ToUpper(k)
				if uk == "LYRICS" || uk == "UNSYNCEDLYRICS" || uk == "USLT" || uk == "SYLT" {
					if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
						candidates = append(candidates, s)
					}
				}
			}
		}
	}

	var bestSynced *string
	var bestPlain *string

	for _, cand := range candidates {
		normalized := ParseAndNormalizeLyrics(cand)
		if normalized == nil {
			continue
		}

		if HasSyncedTimestamps(*normalized) {
			if bestSynced == nil || len(*normalized) > len(*bestSynced) {
				bestSynced = normalized
			}
		} else {
			if bestPlain == nil || len(*normalized) > len(*bestPlain) {
				bestPlain = normalized
			}
		}
	}

	if bestSynced != nil {
		return bestSynced
	}
	return bestPlain
}
