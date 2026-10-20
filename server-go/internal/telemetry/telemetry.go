package telemetry

import (
	"database/sql"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"keweb/internal/models"
)

var (
	startTime          = time.Now()
	totalStreams       int64
	totalBytesStreamed int64
	totalAPIRequests   int64
)

func RecordStream(bytes int64) {
	atomic.AddInt64(&totalStreams, 1)
	atomic.AddInt64(&totalBytesStreamed, bytes)
}

func RecordAPIRequest() {
	atomic.AddInt64(&totalAPIRequests, 1)
}

func getSystemStats() (totalMemMB int, freeMemMB int, loadAvg []float64) {
	var info syscall.Sysinfo_t
	if err := syscall.Sysinfo(&info); err == nil {
		unit := uint64(info.Unit)
		if unit == 0 {
			unit = 1
		}
		totalMemMB = int((info.Totalram * unit) / (1024 * 1024))
		freeMemMB = int((info.Freeram * unit) / (1024 * 1024))
		loadAvg = []float64{
			float64(info.Loads[0]) / 65536.0,
			float64(info.Loads[1]) / 65536.0,
			float64(info.Loads[2]) / 65536.0,
		}
	}
	return
}

func getProcessRSSMB() float64 {
	// Read /proc/self/statm for Linux RSS pages
	data, err := os.ReadFile("/proc/self/statm")
	if err == nil {
		fields := strings.Fields(string(data))
		if len(fields) >= 2 {
			if pages, err := strconv.ParseInt(fields[1], 10, 64); err == nil {
				pageSize := int64(os.Getpagesize())
				return float64(pages*pageSize) / (1024 * 1024)
			}
		}
	}

	// Fallback to Go runtime Sys memory
	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	return float64(ms.Sys) / (1024 * 1024)
}

func GetTelemetryReport(db *sql.DB) *models.TelemetryReport {
	uptimeSecs := int64(time.Since(startTime).Seconds())
	h := uptimeSecs / 3600
	m := (uptimeSecs % 3600) / 60
	s := uptimeSecs % 60
	uptimeStr := fmt.Sprintf("%dh %dm %ds", h, m, s)

	totalMem, freeMem, loadAvg := getSystemStats()

	var ms runtime.MemStats
	runtime.ReadMemStats(&ms)
	rssMB := getProcessRSSMB()
	heapTotalMB := float64(ms.HeapSys) / (1024 * 1024)
	heapUsedMB := float64(ms.HeapAlloc) / (1024 * 1024)

	var songCount, hiResCount int
	if db != nil {
		_ = db.QueryRow("SELECT COUNT(*) FROM songs").Scan(&songCount)
		_ = db.QueryRow("SELECT COUNT(*) FROM songs WHERE bits_per_sample > 16 OR sample_rate > 44100").Scan(&hiResCount)
	}

	bytesStreamed := atomic.LoadInt64(&totalBytesStreamed)
	mbStreamed := float64(bytesStreamed) / (1024 * 1024)

	return &models.TelemetryReport{
		Service:       "keweb-flac-player",
		Status:        "ONLINE",
		Uptime:        uptimeStr,
		UptimeSeconds: uptimeSecs,
		System: models.TelemetrySystem{
			Platform:      runtime.GOOS,
			Arch:          runtime.GOARCH,
			TotalMemoryMB: totalMem,
			FreeMemoryMB:  freeMem,
			CPUs:          runtime.NumCPU(),
			LoadAvg:       loadAvg,
		},
		Process: models.TelemetryProcess{
			PID:         os.Getpid(),
			RSSMB:       fmt.Sprintf("%.2f", rssMB),
			HeapTotalMB: fmt.Sprintf("%.2f", heapTotalMB),
			HeapUsedMB:  fmt.Sprintf("%.2f", heapUsedMB),
		},
		AudioEngine: models.TelemetryAudio{
			TotalSongsIndexed:    songCount,
			HiResTracksCount:     hiResCount,
			TotalStreamsStarted:  atomic.LoadInt64(&totalStreams),
			TotalBytesStreamedMB: fmt.Sprintf("%.2f", mbStreamed),
			TotalAPIRequests:     atomic.LoadInt64(&totalAPIRequests),
		},
	}
}
