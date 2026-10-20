package lock

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

type Lock struct {
	file *os.File
	path string
}

// Acquire obtains an exclusive non-blocking kernel lock on the given lock file path.
// If another instance holds the lock, Acquire immediately returns an error.
// The OS kernel guarantees that when the process exits or is killed, the lock is automatically released.
func Acquire(lockPath string) (*Lock, error) {
	if err := os.MkdirAll(filepath.Dir(lockPath), 0755); err != nil {
		return nil, fmt.Errorf("create lock dir: %w", err)
	}

	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return nil, fmt.Errorf("open lockfile: %w", err)
	}

	// Try to get non-blocking exclusive lock
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = f.Close()
		return nil, fmt.Errorf("another instance is already running (flock failed: %w)", err)
	}

	// Record PID for human reference
	_ = f.Truncate(0)
	_, _ = f.Seek(0, 0)
	_, _ = fmt.Fprintf(f, "%d\n", os.Getpid())

	return &Lock{file: f, path: lockPath}, nil
}

// Release unlocks and closes the file descriptor, removing the lock file.
func (l *Lock) Release() {
	if l == nil || l.file == nil {
		return
	}
	_ = syscall.Flock(int(l.file.Fd()), syscall.LOCK_UN)
	_ = l.file.Close()
	_ = os.Remove(l.path)
}
