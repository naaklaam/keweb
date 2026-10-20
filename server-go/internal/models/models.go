package models

// Song represents an indexed audio file in the database.
type Song struct {
	ID            int64    `json:"id"`
	Filepath      string   `json:"-"` // Never expose absolute filepath in JSON
	Filename      string   `json:"filename"`
	Title         string   `json:"title"`
	Artist        string   `json:"artist"`
	Album         string   `json:"album"`
	TrackNo       int      `json:"track_no"`
	Year          *int     `json:"year"`
	Genre         string   `json:"genre"`
	Duration      float64  `json:"duration"`
	SampleRate    int      `json:"sample_rate"`
	BitsPerSample int      `json:"bits_per_sample"`
	Bitrate       int      `json:"bitrate"`
	Channels      int      `json:"channels"`
	Lossless      int      `json:"lossless"`
	Container     string   `json:"container"`
	MimeType      string   `json:"mime_type,omitempty"`
	HasCover      int      `json:"has_cover"`
	CoverMime     *string  `json:"cover_mime"`
	Lyrics        *string  `json:"lyrics,omitempty"` // omitted in song list responses
	MTime         int64    `json:"-"`
	CreatedAt     string   `json:"created_at,omitempty"`
}

// Playlist represents a user custom playlist.
type Playlist struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	CreatedAt    string    `json:"created_at"`
	SongCount    int       `json:"song_count"`
	CoverSongIDs []int64   `json:"cover_song_ids"`
	Songs        []Song    `json:"songs,omitempty"`
}

// Stats holds high level library counts.
type Stats struct {
	TotalSongs    int     `json:"totalSongs"`
	TotalDuration float64 `json:"totalDuration"`
	TotalArtists  int     `json:"totalArtists"`
	TotalAlbums   int     `json:"totalAlbums"`
	HiResCount    int     `json:"hiResCount"`
	LyricsCount   int     `json:"lyricsCount"`
}

// TelemetryReport matches the JSON schema expected by ./service.sh status and the frontend.
type TelemetryReport struct {
	Service        string            `json:"service"`
	Status         string            `json:"status"`
	Uptime         string            `json:"uptime"`
	UptimeSeconds  int64             `json:"uptimeSeconds"`
	System         TelemetrySystem   `json:"system"`
	Process        TelemetryProcess  `json:"process"`
	AudioEngine    TelemetryAudio    `json:"audioEngine"`
}

type TelemetrySystem struct {
	Platform      string    `json:"platform"`
	Arch          string    `json:"arch"`
	TotalMemoryMB int       `json:"totalMemoryMB"`
	FreeMemoryMB  int       `json:"freeMemoryMB"`
	CPUs          int       `json:"cpus"`
	LoadAvg       []float64 `json:"loadAvg"`
}

type TelemetryProcess struct {
	PID         int    `json:"pid"`
	RSSMB       string `json:"rssMB"`
	HeapTotalMB string `json:"heapTotalMB"`
	HeapUsedMB  string `json:"heapUsedMB"`
}

type TelemetryAudio struct {
	TotalSongsIndexed    int    `json:"totalSongsIndexed"`
	HiResTracksCount     int    `json:"hiResTracksCount"`
	TotalStreamsStarted  int64  `json:"totalStreamsStarted"`
	TotalBytesStreamedMB string `json:"totalBytesStreamedMB"`
	TotalAPIRequests     int64  `json:"totalApiRequests"`
}

// ScanResult holds summary metrics returned by POST /api/scan.
type ScanResult struct {
	Added     int `json:"added"`
	Unchanged int `json:"unchanged"`
	Removed   int `json:"removed"`
	Blocked   int `json:"blocked"`
}
