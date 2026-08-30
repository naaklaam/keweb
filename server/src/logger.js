const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

const APP_LOG_PATH = path.join(LOGS_DIR, 'app.log');
const ACCESS_LOG_PATH = path.join(LOGS_DIR, 'access.log');
const ERROR_LOG_PATH = path.join(LOGS_DIR, 'error.log');

function formatTimestamp() {
  return new Date().toISOString();
}

function writeToFile(filePath, message) {
  fs.appendFile(filePath, message + '\n', (err) => {
    if (err) console.error('[Logger Error]', err);
  });
}

const logger = {
  info(category, message, meta = {}) {
    const time = formatTimestamp();
    const logStr = `[${time}] [INFO] [${category}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    console.log(`\x1b[36m[${time}]\x1b[0m \x1b[32m[INFO]\x1b[0m \x1b[35m[${category}]\x1b[0m ${message}`);
    writeToFile(APP_LOG_PATH, logStr);
  },

  warn(category, message, meta = {}) {
    const time = formatTimestamp();
    const logStr = `[${time}] [WARN] [${category}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    console.warn(`\x1b[36m[${time}]\x1b[0m \x1b[33m[WARN]\x1b[0m \x1b[35m[${category}]\x1b[0m ${message}`);
    writeToFile(APP_LOG_PATH, logStr);
  },

  error(category, message, error = null) {
    const time = formatTimestamp();
    const errStack = error ? (error.stack || error.toString()) : '';
    const logStr = `[${time}] [ERROR] [${category}] ${message} ${errStack}`;
    console.error(`\x1b[36m[${time}]\x1b[0m \x1b[31m[ERROR]\x1b[0m \x1b[35m[${category}]\x1b[0m ${message}`, errStack);
    writeToFile(APP_LOG_PATH, logStr);
    writeToFile(ERROR_LOG_PATH, logStr);
  },

  access(req, res, durationMs) {
    const time = formatTimestamp();
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const logStr = `[${time}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${durationMs}ms - IP: ${ip} - UA: "${userAgent}"`;
    writeToFile(ACCESS_LOG_PATH, logStr);
  },

  stream(songTitle, bytesSent, ip) {
    const time = formatTimestamp();
    const mbSent = (bytesSent / (1024 * 1024)).toFixed(2);
    const logStr = `[${time}] [STREAM] Track: "${songTitle}" | Sent: ${mbSent} MB | Client IP: ${ip}`;
    console.log(`\x1b[36m[${time}]\x1b[0m \x1b[34m[STREAM]\x1b[0m Track: "\x1b[1m${songTitle}\x1b[0m" | Sent: \x1b[33m${mbSent} MB\x1b[0m`);
    writeToFile(APP_LOG_PATH, logStr);
  }
};

module.exports = logger;
