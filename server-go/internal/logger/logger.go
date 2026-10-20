package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

const (
	maxLogBytes   = 20 * 1024 * 1024 // 20 MB
	keepRotations = 3
)

type Logger struct {
	logsDir       string
	appLogPath    string
	accessLogPath string
	errorLogPath  string
	mu            sync.Mutex
	checkCount    uint64
}

var defaultLogger *Logger

func Init(logsDir string) (*Logger, error) {
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return nil, fmt.Errorf("create logs dir: %w", err)
	}

	l := &Logger{
		logsDir:       logsDir,
		appLogPath:    filepath.Join(logsDir, "app.log"),
		accessLogPath: filepath.Join(logsDir, "access.log"),
		errorLogPath:  filepath.Join(logsDir, "error.log"),
	}
	defaultLogger = l
	return l, nil
}

func (l *Logger) rotateIfNeeded(path string) {
	cnt := atomic.AddUint64(&l.checkCount, 1)
	if cnt%256 != 0 {
		return
	}

	fi, err := os.Stat(path)
	if err != nil || fi.Size() < maxLogBytes {
		return
	}

	l.mu.Lock()
	defer l.mu.Unlock()

	for i := keepRotations; i > 1; i-- {
		from := fmt.Sprintf("%s.%d", path, i-1)
		to := fmt.Sprintf("%s.%d", path, i)
		if _, err := os.Stat(from); err == nil {
			_ = os.Rename(from, to)
		}
	}
	_ = os.Rename(path, fmt.Sprintf("%s.1", path))
}

func (l *Logger) writeToFile(path, line string) {
	l.rotateIfNeeded(path)

	l.mu.Lock()
	defer l.mu.Unlock()

	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.WriteString(line + "\n")
}

func formatTimestamp() string {
	return time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
}

func (l *Logger) Info(category, message string) {
	t := formatTimestamp()
	line := fmt.Sprintf("[%s] [INFO] [%s] %s", t, category, message)
	fmt.Printf("\x1b[36m[%s]\x1b[0m \x1b[32m[INFO]\x1b[0m \x1b[35m[%s]\x1b[0m %s\n", t, category, message)
	l.writeToFile(l.appLogPath, line)
}

func (l *Logger) Warn(category, message string) {
	t := formatTimestamp()
	line := fmt.Sprintf("[%s] [WARN] [%s] %s", t, category, message)
	fmt.Printf("\x1b[36m[%s]\x1b[0m \x1b[33m[WARN]\x1b[0m \x1b[35m[%s]\x1b[0m %s\n", t, category, message)
	l.writeToFile(l.appLogPath, line)
}

func (l *Logger) Error(category, message string, err error) {
	t := formatTimestamp()
	errStr := ""
	if err != nil {
		errStr = " " + err.Error()
	}
	line := fmt.Sprintf("[%s] [ERROR] [%s] %s%s", t, category, message, errStr)
	fmt.Printf("\x1b[36m[%s]\x1b[0m \x1b[31m[ERROR]\x1b[0m \x1b[35m[%s]\x1b[0m %s%s\n", t, category, message, errStr)
	l.writeToFile(l.appLogPath, line)
	l.writeToFile(l.errorLogPath, line)
}

func (l *Logger) Access(method, urlPath string, statusCode int, durationMs int64, ip, userAgent string) {
	t := formatTimestamp()
	line := fmt.Sprintf("[%s] %s %s %d - %dms - IP: %s - UA: %q", t, method, urlPath, statusCode, durationMs, ip, userAgent)
	l.writeToFile(l.accessLogPath, line)
}

func (l *Logger) Stream(songTitle string, bytesSent int64, ip string) {
	t := formatTimestamp()
	mbSent := float64(bytesSent) / (1024 * 1024)
	line := fmt.Sprintf("[%s] [STREAM] Track: %q | Sent: %.2f MB | Client IP: %s", t, songTitle, mbSent, ip)
	fmt.Printf("\x1b[36m[%s]\x1b[0m \x1b[34m[STREAM]\x1b[0m Track: \x1b[1m%q\x1b[0m | Sent: \x1b[33m%.2f MB\x1b[0m\n", t, songTitle, mbSent)
	l.writeToFile(l.appLogPath, line)
}

// Global convenience wrappers
func Info(category, message string) {
	if defaultLogger != nil {
		defaultLogger.Info(category, message)
	}
}

func Warn(category, message string) {
	if defaultLogger != nil {
		defaultLogger.Warn(category, message)
	}
}

func Error(category, message string, err error) {
	if defaultLogger != nil {
		defaultLogger.Error(category, message, err)
	}
}

func Access(method, urlPath string, statusCode int, durationMs int64, ip, userAgent string) {
	if defaultLogger != nil {
		defaultLogger.Access(method, urlPath, statusCode, durationMs, ip, userAgent)
	}
}

func Stream(songTitle string, bytesSent int64, ip string) {
	if defaultLogger != nil {
		defaultLogger.Stream(songTitle, bytesSent, ip)
	}
}
