package scanner

import (
	"testing"
)

func TestHasSyncedTimestamps(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"[00:12.34] Hello world", true},
		{"[01:05] Old style LRC", true},
		{"[00:12.345] 3-digit ms", true},
		{"[ar: Artist]\n[ti: Title]\nPlain lyrics", false},
		{"[id: wmgzkyrg]\nJust text", false},
	}

	for _, tt := range tests {
		got := HasSyncedTimestamps(tt.input)
		if got != tt.expected {
			t.Errorf("HasSyncedTimestamps(%q) = %v, expected %v", tt.input, got, tt.expected)
		}
	}
}

func TestParseJSONLyrics(t *testing.T) {
	// Spotify format
	spotifyJSON := `{"lines": [{"startTimeMs": "12340", "words": "Line one"}, {"startTimeMs": "24680", "words": "Line two"}]}`
	res := ParseAndNormalizeLyrics(spotifyJSON)
	if res == nil {
		t.Fatalf("Expected normalized lyrics, got nil")
	}
	if !HasSyncedTimestamps(*res) {
		t.Errorf("Expected synced lyrics from Spotify JSON, got: %s", *res)
	}

	// NetEase format
	neteaseJSON := `{"lrc": "[00:05.12] Netease line\n[00:10.50] Second line"}`
	res2 := ParseAndNormalizeLyrics(neteaseJSON)
	if res2 == nil || !HasSyncedTimestamps(*res2) {
		t.Errorf("Expected synced lyrics from NetEase JSON, got: %v", res2)
	}
}

func TestParseTTMLLyrics(t *testing.T) {
	ttml := `<tt><body><div><p begin="00:00:05.500">Hello</p><p begin="00:00:10.200">World</p></div></body></tt>`
	res := ParseAndNormalizeLyrics(ttml)
	if res == nil || !HasSyncedTimestamps(*res) {
		t.Fatalf("Expected synced lyrics from TTML, got: %v", res)
	}
}

func TestParseSRTLyrics(t *testing.T) {
	srt := "1\n00:00:02,500 --> 00:00:05,000\nFirst line\n\n2\n00:00:06,100 --> 00:00:09,000\nSecond line"
	res := ParseAndNormalizeLyrics(srt)
	if res == nil || !HasSyncedTimestamps(*res) {
		t.Fatalf("Expected synced lyrics from SRT, got: %v", res)
	}
}

func TestLrcIndexMatch(t *testing.T) {
	lrcs := []string{
		"/music/Arctic Monkeys - 505.lrc",
		"/music/Arctic Monkeys - Balaclava.lrc",
		"/music/AM/Arctic Monkeys - Arabella.lrc",
		"/music/Cigarettes After Sex - Apocalypse.lrc",
	}
	idx := BuildLrcIndex(lrcs)

	m1 := idx.FindMatch("/music/505 - Arctic Monkeys.flac", "505", "Arctic Monkeys")
	if m1 != "/music/Arctic Monkeys - 505.lrc" {
		t.Errorf("Expected match for 505, got: %q", m1)
	}

	m2 := idx.FindMatch("/music/04 - Arctic Monkeys - Balaclava.flac", "Balaclava", "Arctic Monkeys")
	if m2 != "/music/Arctic Monkeys - Balaclava.lrc" {
		t.Errorf("Expected match for Balaclava, got: %q", m2)
	}

	m3 := idx.FindMatch("/music/Apocalypse.flac", "Apocalypse", "Cigarettes After Sex")
	if m3 != "/music/Cigarettes After Sex - Apocalypse.lrc" {
		t.Errorf("Expected match for Apocalypse, got: %q", m3)
	}

	m4 := idx.FindMatch("/music/03 - Arctic Monkeys - Arabella.flac", "Arabella", "Arctic Monkeys")
	if m4 != "/music/AM/Arctic Monkeys - Arabella.lrc" {
		t.Errorf("Expected global match for Arabella, got: %q", m4)
	}
}
