package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Config struct {
	Port            int
	MusicDir        string
	EnableScanPurge bool
	Subdomain       string
	DataDir         string
	LogsDir         string
	ClientDistDir   string
	RepoRoot        string
}

// Load loads environment variables and optional .env file from repo root.
func Load(repoRoot string) (*Config, error) {
	// 1. Try to read .env file from repo root
	envFile := filepath.Join(repoRoot, ".env")
	loadEnvFile(envFile)

	port := 5000
	if p := os.Getenv("PORT"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			port = v
		}
	}

	musicDir := os.Getenv("MUSIC_DIR")
	enablePurge := strings.ToLower(os.Getenv("ENABLE_SCAN_PURGE")) == "true"
	subdomain := os.Getenv("SUBDOMAIN")
	if subdomain == "" {
		subdomain = "keweb"
	}

	dataDir := filepath.Join(repoRoot, "data")
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		legacyDir := filepath.Join(repoRoot, "server", "data")
		if _, err := os.Stat(legacyDir); err == nil {
			dataDir = legacyDir
		}
	}
	logsDir := filepath.Join(repoRoot, "logs")
	clientDist := filepath.Join(repoRoot, "client", "dist")

	return &Config{
		Port:            port,
		MusicDir:        musicDir,
		EnableScanPurge: enablePurge,
		Subdomain:       subdomain,
		DataDir:         dataDir,
		LogsDir:         logsDir,
		ClientDistDir:   clientDist,
		RepoRoot:        repoRoot,
	}, nil
}

func loadEnvFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])
		val = strings.Trim(val, `"'`)
		// Only set if not already set in OS environment
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, val)
		}
	}
}
