package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"keweb/internal/config"
	"keweb/internal/db"
	"keweb/internal/handlers"
	"keweb/internal/lock"
	"keweb/internal/logger"
	"keweb/internal/scanner"
)

func findRepoRoot() string {
	// 1. Check current working directory
	cwd, err := os.Getwd()
	if err == nil {
		if _, err := os.Stat(filepath.Join(cwd, "service.sh")); err == nil {
			return cwd
		}
		// If running from server-go subdirectory
		parent := filepath.Dir(cwd)
		if _, err := os.Stat(filepath.Join(parent, "service.sh")); err == nil {
			return parent
		}
	}

	// 2. Check executable directory
	exe, err := os.Executable()
	if err == nil {
		dir := filepath.Dir(exe)
		if _, err := os.Stat(filepath.Join(dir, "service.sh")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if _, err := os.Stat(filepath.Join(parent, "service.sh")); err == nil {
			return parent
		}
	}

	// Default fallback to cwd
	return cwd
}

func main() {
	repoRoot := findRepoRoot()

	cfg, err := config.Load(repoRoot)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Config] Failed to load config: %v\n", err)
		os.Exit(1)
	}

	// 1. Single-instance kernel lock
	lockPath := filepath.Join(cfg.DataDir, "server.lock")
	fileLock, err := lock.Acquire(lockPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Server] %v. Exiting.\n", err)
		os.Exit(0)
	}
	defer fileLock.Release()

	// 2. Initialize logger
	log, err := logger.Init(cfg.LogsDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "[Logger] Failed to init logger: %v\n", err)
		os.Exit(1)
	}
	log.Info("SERVER", "Starting keweb Golang Music Player Server...")

	// 3. Initialize SQLite database
	database, err := db.Init(cfg.DataDir)
	if err != nil {
		log.Error("SERVER", "Failed to initialize database", err)
		os.Exit(1)
	}
	defer database.Close()

	// 4. Initialize Scanner
	sc := scanner.New(database, cfg.DataDir, cfg.EnableScanPurge)

	// 5. Build Router
	coversDir := filepath.Join(cfg.DataDir, "covers")
	router := handlers.NewRouter(database, sc, coversDir, cfg.ClientDistDir, cfg.MusicDir)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 0, // No write timeout for audio streams
		IdleTimeout:  120 * time.Second,
	}

	// 6. Graceful shutdown handler
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Info("SERVER", fmt.Sprintf("keweb Golang Music Player Server listening on port %d", cfg.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Error("SERVER", "Server listen error", err)
			os.Exit(1)
		}
	}()

	// 7. Initial background library scan
	if cfg.MusicDir != "" {
		go func() {
			log.Info("SERVER", "Initial scan started in background...")
			if _, err := sc.Scan(cfg.MusicDir); err != nil {
				log.Error("SERVER", "Initial scan failed", err)
			} else {
				log.Info("SERVER", "Initial scan finished successfully")
			}
		}()
	} else {
		log.Warn("SERVER", "MUSIC_DIR environment variable is not set")
	}

	// Wait for shutdown signal
	<-stop
	log.Info("SERVER", "Shutting down keweb server gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Error("SERVER", "Forced server shutdown", err)
	}
	log.Info("SERVER", "Server stopped cleanly.")
}
