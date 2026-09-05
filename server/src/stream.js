const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const logger = require('./logger');
const telemetry = require('./telemetry');
const { mimeForMedia } = require('./scanner');

// Maximum 2MB chunk size per HTTP Range response for instant playback (<100ms)
// & zero tunnel lag.
const MAX_CHUNK_SIZE = 2 * 1024 * 1024;

function clientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

// Parse a Range header like "bytes=start-end" or "bytes=-suffix".
// Returns { start, end } (inclusive, absolute) or throws TypeError.
function parseRange(header, fileSize) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) throw new TypeError('Invalid range format');
  const startStr = match[1];
  const endStr = match[2];

  let start;
  let end;

  if (startStr === '' && endStr === '') {
    throw new TypeError('Invalid empty range');
  }

  if (startStr === '') {
    // Suffix range: bytes=-N  => last N bytes
    const suffix = Number(endStr);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) throw new RangeError('Unsatisfiable range');
    start = Math.max(0, fileSize - suffix);
    end = fileSize - 1;
  } else {
    start = Number(startStr);
    if (!Number.isSafeInteger(start) || start < 0) throw new RangeError('Unsatisfiable range');
    end = endStr === '' ? fileSize - 1 : Number(endStr);
    if (!Number.isSafeInteger(end) || end < start) throw new RangeError('Unsatisfiable range');
  }

  if (start >= fileSize) throw new RangeError('Unsatisfiable range');
  end = Math.min(end, fileSize - 1);
  return { start, end };
}

async function handleAudioStream(req, res) {
  let song;
  try {
    song = db.prepare(
      'SELECT id, filepath, title, filename, container, mime_type FROM songs WHERE id = ?'
    ).get(req.params.id);
  } catch (e) {
    return res.status(500).json({ error: 'DB error' });
  }

  if (!song) {
    return res.status(404).json({ error: 'Song not found' });
  }

  let stat;
  try {
    stat = await fsp.stat(song.filepath);
  } catch (e) {
    logger.warn('STREAM', `Song file missing for ID ${song.id}`);
    return res.status(404).json({ error: 'Song file not found' });
  }
  const fileSize = stat.size;
  const contentType = song.mime_type || mimeForMedia(song.container, song.filepath) || 'application/octet-stream';

  const streamChunks = (start, end) => {
    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(song.filepath, { start, end, highWaterMark: 64 * 1024 });

    const cleanup = () => {
      if (!fileStream.destroyed) fileStream.destroy();
    };
    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    telemetry.recordStream(chunkSize);
    logger.stream(song.title || song.filename, chunkSize, clientIp(req));

    fileStream.on('error', (err) => {
      logger.error('STREAM', `Stream read error for ${song.id}`, err);
      if (!res.headersSent) res.status(500).end();
      else res.destroy();
    });
    fileStream.pipe(res);
  };

  const rangeHeader = req.headers.range;
  if (rangeHeader) {
    let range;
    try {
      range = parseRange(rangeHeader, fileSize);
    } catch (e) {
      // 416 when the range is valid syntax but unsatisfiable, 400 otherwise.
      const status = e instanceof RangeError ? 416 : 400;
      return res.status(status).json({ error: e.message });
    }

    // Cap chunk end to MAX_CHUNK_SIZE to avoid 50MB single responses
    const cappedEnd = Math.min(range.end, range.start + MAX_CHUNK_SIZE - 1);

    const headers = {
      'Content-Range': `bytes ${range.start}-${cappedEnd}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': cappedEnd - range.start + 1,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    };
    res.writeHead(206, headers);
    streamChunks(range.start, cappedEnd);
  } else {
    // No Range header: stream the whole file with a truthful Content-Length so
    // curl / download clients get a complete, valid file.
    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    };
    res.writeHead(200, headers);
    streamChunks(0, fileSize - 1);
  }
}

async function handleCoverArt(req, res) {
  let song;
  try {
    song = db.prepare('SELECT filepath, has_cover, cover_mime FROM songs WHERE id = ?').get(req.params.id);
  } catch (e) {
    return res.status(500).json({ error: 'DB lookup' });
  }

  if (!song || !song.has_cover) {
    return res.status(404).json({ error: 'No cover art found' });
  }

  // MD5 hash of full filepath -> same filename used by the scanner
  const coverFileName = crypto.createHash('md5').update(song.filepath).digest('hex') + '.img';
  const coverPath = path.join(__dirname, '../data/covers', coverFileName);

  let exists;
  try {
    await fsp.access(coverPath);
    exists = true;
  } catch (e) {
    exists = false;
  }
  if (!exists) {
    return res.status(404).json({ error: 'Cover file missing' });
  }

  const stream = fs.createReadStream(coverPath);
  const cleanup = () => {
    if (!stream.destroyed) stream.destroy();
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
  stream.on('error', (err) => {
    logger.error('COVER', 'Cover read error', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Cover read error' });
    else res.destroy();
  });

  res.setHeader('Content-Type', song.cover_mime || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // revalidates daily, not "immutable"
  stream.pipe(res);
}

module.exports = { handleAudioStream, handleCoverArt };