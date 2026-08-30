const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const logger = require('./logger');
const telemetry = require('./telemetry');

// Maximum 2MB chunk size per HTTP Range response for instant playback (< 100ms) & zero tunnel lag
const MAX_CHUNK_SIZE = 2 * 1024 * 1024;

function handleAudioStream(req, res) {
  const songId = req.params.id;
  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(songId);

  if (!song || !fs.existsSync(song.filepath)) {
    logger.warn('STREAM', `Song file not found for ID ${songId}`);
    return res.status(404).json({ error: 'Song file not found' });
  }

  const filePath = song.filepath;
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    // Cap chunk end to start + MAX_CHUNK_SIZE - 1 to prevent sending 50MB single responses
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const end = Math.min(requestedEnd, start + MAX_CHUNK_SIZE - 1);

    if (start >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunkSize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end, highWaterMark: 64 * 1024 });

    // Cleanup read stream immediately when client closes connection or cancels stream request
    const cleanup = () => {
      if (fileStream && !fileStream.destroyed) {
        fileStream.destroy();
      }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    telemetry.recordStream(chunkSize);
    logger.stream(song.title || song.filename, chunkSize, clientIp);

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'audio/flac',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    fileStream.pipe(res);
  } else {
    // Non-range request: send initial 2MB chunk with Accept-Ranges header
    const end = Math.min(MAX_CHUNK_SIZE - 1, fileSize - 1);
    const chunkSize = end + 1;
    const fileStream = fs.createReadStream(filePath, { start: 0, end, highWaterMark: 64 * 1024 });

    const cleanup = () => {
      if (fileStream && !fileStream.destroyed) {
        fileStream.destroy();
      }
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    telemetry.recordStream(chunkSize);
    logger.stream(song.title || song.filename, chunkSize, clientIp);

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'audio/flac',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fileStream.pipe(res);
  }
}

function handleCoverArt(req, res) {
  const songId = req.params.id;
  const song = db.prepare('SELECT filepath, has_cover, cover_mime FROM songs WHERE id = ?').get(songId);

  if (!song || !song.has_cover) {
    return res.status(404).json({ error: 'No cover art found' });
  }

  // Generate MD5 hash filename of song's full filepath
  const coverFileName = `${crypto.createHash('md5').update(song.filepath).digest('hex')}.img`;
  const coverPath = path.join(__dirname, '../data/covers', coverFileName);

  if (!fs.existsSync(coverPath)) {
    return res.status(404).json({ error: 'Cover file missing' });
  }

  const stream = fs.createReadStream(coverPath);
  const cleanup = () => {
    if (stream && !stream.destroyed) {
      stream.destroy();
    }
  };

  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);

  res.setHeader('Content-Type', song.cover_mime || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  stream.pipe(res);
}

module.exports = { handleAudioStream, handleCoverArt };
