const os = require('os');
const db = require('./db');

const metrics = {
  startTime: Date.now(),
  totalStreams: 0,
  totalBytesStreamed: 0,
  activeConnections: 0,
  totalApiRequests: 0,
};

function recordStream(bytes) {
  metrics.totalStreams++;
  metrics.totalBytesStreamed += bytes;
}

function recordApiRequest() {
  metrics.totalApiRequests++;
}

function getTelemetryReport() {
  const memoryUsage = process.memoryUsage();
  const uptimeSecs = Math.floor((Date.now() - metrics.startTime) / 1000);

  let songCount = 0;
  let hiResCount = 0;
  try {
    songCount = db.prepare('SELECT COUNT(*) as count FROM songs').get().count;
    hiResCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE bits_per_sample > 16').get().count;
  } catch (e) {}

  return {
    service: 'keweb-flac-player',
    status: 'ONLINE',
    uptime: `${Math.floor(uptimeSecs / 3600)}h ${Math.floor((uptimeSecs % 3600) / 60)}m ${uptimeSecs % 60}s`,
    uptimeSeconds: uptimeSecs,
    system: {
      platform: os.platform(),
      arch: os.arch(),
      totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
      cpus: os.cpus().length,
      loadAvg: os.loadavg()
    },
    process: {
      pid: process.pid,
      rssMB: (memoryUsage.rss / (1024 * 1024)).toFixed(2),
      heapTotalMB: (memoryUsage.heapTotal / (1024 * 1024)).toFixed(2),
      heapUsedMB: (memoryUsage.heapUsed / (1024 * 1024)).toFixed(2),
    },
    audioEngine: {
      totalSongsIndexed: songCount,
      hiResTracksCount: hiResCount,
      totalStreamsStarted: metrics.totalStreams,
      totalBytesStreamedMB: (metrics.totalBytesStreamed / (1024 * 1024)).toFixed(2),
      totalApiRequests: metrics.totalApiRequests,
    }
  };
}

module.exports = {
  recordStream,
  recordApiRequest,
  getTelemetryReport
};
