const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const logger = require('./logger');
const telemetry = require('./telemetry');

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
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunkSize = (end - start) + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

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
    telemetry.recordStream(fileSize);
    logger.stream(song.title || song.filename, fileSize, clientIp);

    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'audio/flac',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    fs.createReadStream(filePath).pipe(res);
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

  res.setHeader('Content-Type', song.cover_mime || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(coverPath).pipe(res);
}

module.exports = { handleAudioStream, handleCoverArt };
