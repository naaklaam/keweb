const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const mm = require('music-metadata');
const db = require('./db');

const COVERS_DIR = path.join(__dirname, '../data/covers');
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

// Common external folder cover image filenames (for subdirectories ONLY)
const FOLDER_COVER_NAMES = [
  'cover.jpg', 'cover.jpeg', 'cover.png', 'cover.webp',
  'folder.jpg', 'folder.jpeg', 'folder.png', 'folder.webp',
  'front.jpg', 'front.jpeg', 'front.png', 'front.webp',
  'album.jpg', 'album.jpeg', 'album.png', 'album.webp'
];

const SUPPORTED_AUDIO_EXTENSIONS = ['.flac', '.mp3', '.m4a', '.wav', '.ogg', '.opus', '.aac', '.alac'];

// Content-Type per container so the stream layer can serve more than just FLAC
const MIME_BY_CONTAINER = {
  FLAC: 'audio/flac',
  MPEG: 'audio/mpeg',
  'MPEG-GENERIC': 'audio/mpeg',
  'MP4': 'audio/mp4',
  'M4A': 'audio/mp4',
  ADTS: 'audio/aac',
  AAC: 'audio/aac',
  'AAC-ADTS': 'audio/aac',
  WAV: 'audio/wav',
  WAVE: 'audio/wav',
  OGG: 'audio/ogg',
  OPUS: 'audio/ogg',
  'OGG-OPUS': 'audio/ogg',
  ALAC: 'audio/mp4',
  AIFF: 'audio/aiff',
};

const MIME_BY_EXT = {
  '.flac': 'audio/flac',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.aac': 'audio/aac',
  '.alac': 'audio/mp4',
};

function mimeForMedia(container, filePath) {
  const c = String(container || '').toUpperCase();
  if (MIME_BY_CONTAINER[c]) return MIME_BY_CONTAINER[c];
  return MIME_BY_EXT[path.extname(filePath || '').toLowerCase()] || 'application/octet-stream';
}

function extractLyricsFromMetadata(filePath, metadata) {
  // 1. Primary: Check for external .lrc file next to the audio file
  const lrcCandidate = filePath.replace(/\.[^/.]+$/, '.lrc');
  try {
    if (fs.existsSync(lrcCandidate)) {
      const lrcContent = fs.readFileSync(lrcCandidate, 'utf-8');
      if (lrcContent && lrcContent.trim()) {
        return lrcContent.trim();
      }
    }
  } catch (e) {
    // Ignore read error
  }

  // 2. Secondary: Check embedded metadata tags
  const common = metadata.common || {};
  const native = metadata.native || {};

  let lyricsStr = null;

  if (common.lyrics && common.lyrics.length > 0) {
    const raw = common.lyrics;
    if (Array.isArray(raw)) {
      const parts = raw.map(item => {
        if (typeof item === 'string') return item;
        if (item && item.text) return item.text;
        if (item && item.syncText && Array.isArray(item.syncText)) {
          return item.syncText.map(s => s.text).join('\n');
        }
        return '';
      }).filter(Boolean);
      if (parts.length > 0) lyricsStr = parts.join('\n');
    } else if (typeof raw === 'string') {
      lyricsStr = raw;
    }
  }

  if (!lyricsStr && native['VORBIS_COMMENT']) {
    const lyricTag = native['VORBIS_COMMENT'].find(tag =>
      ['LYRICS', 'UNSYNCEDLYRICS', 'LYRICS_TEXT', 'USLT'].includes(tag.id.toUpperCase())
    );
    if (lyricTag && lyricTag.value) {
      lyricsStr = lyricTag.value;
    }
  }

  if (!lyricsStr) return null;

  // If lyrics is a JSON string formatted by some taggers
  if (typeof lyricsStr === 'string' && lyricsStr.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(lyricsStr);
      if (parsed.text && parsed.text.trim()) {
        return parsed.text.trim();
      }
      if (parsed.syncText && Array.isArray(parsed.syncText) && parsed.syncText.length > 0) {
        return parsed.syncText.map(s => s.text).filter(Boolean).join('\n');
      }
    } catch (e) {
      // Not JSON, return as is
    }
  }

  return typeof lyricsStr === 'string' && lyricsStr.trim() ? lyricsStr.trim() : null;
}

// Cap concurrent metadata parsing so a big library does not spawn thousands of
// parallel music-metadata workers into the event loop.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        results[i] = { error: e };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// Async recursive walker. Resolves symlinks once and keeps a realpath set so
// directory cycles cannot cause infinite recursion.
async function walkDir(rootDir, visited = new Set()) {
  let real;
  try {
    real = await fsp.realpath(rootDir);
  } catch (e) {
    real = rootDir;
  }
  if (visited.has(real)) return [];
  visited.add(real);

  let entries;
  try {
    entries = await fsp.readdir(rootDir, { withFileTypes: true });
  } catch (e) {
    return [];
  }

  const out = [];
  for (const entry of entries) {
    const p = path.join(rootDir, entry.name);
    try {
      if (entry.isDirectory()) {
        out.push(...(await walkDir(p, visited)));
      } else if (entry.isFile()) {
        out.push(p);
      } else if (entry.isSymbolicLink()) {
        const st = await fsp.stat(p).catch(() => null); // follows the link
        if (st && st.isDirectory()) {
          out.push(...(await walkDir(p, visited)));
        } else if (st && st.isFile()) {
          out.push(p);
        }
      }
    } catch (e) {
      // Skip individual unreadable entries instead of killing the scan
    }
  }
  return out;
}

function coverPathFor(filePath) {
  return path.join(COVERS_DIR, crypto.createHash('md5').update(filePath).digest('hex') + '.img');
}

async function scanDirectory(dirPath = process.env.MUSIC_DIR) {
  if (!dirPath) {
    console.error('[Scanner] No directory path specified and MUSIC_DIR environment variable is not set.');
    return;
  }

  const rootMusicDir = path.resolve(dirPath);
  if (!fs.existsSync(rootMusicDir)) {
    throw new Error(`[Scanner] Directory does not exist: ${rootMusicDir}`);
  }

  console.log(`[Scanner] Scanning directory: ${rootMusicDir}...`);
  const files = await walkDir(rootMusicDir);
  const audioFiles = files.filter(f => SUPPORTED_AUDIO_EXTENSIONS.includes(path.extname(f).toLowerCase()));
  const flacCount = audioFiles.filter(f => f.toLowerCase().endsWith('.flac')).length;
  console.log(`[Scanner] Found ${audioFiles.length} audio tracks (${flacCount} FLAC).`);

  const prevCount = db.prepare('SELECT COUNT(*) AS c FROM songs').get().c;
  // Purge safety: if a scan resolves dramatically fewer files than we already
  // know about, do not remove rows. Prevents a misconfigured or attacker-chosen
  // directory (e.g. /tmp) from wiping the index. Opt-in force via env.
  const PURGE_BLOCK_RATIO = 0.5;
  const canPurge = (() => {
    if (process.env.ENABLE_SCAN_PURGE === 'true') return true;
    return audioFiles.length > 0 && (prevCount === 0 || audioFiles.length >= prevCount * PURGE_BLOCK_RATIO);
  })();

  const existingRows = new Map(
    db.prepare('SELECT filepath, mtime, has_cover FROM songs').all().map(r => [r.filepath, r])
  );

  // ---- Phase 1: determine which files actually changed (mtime) ----
  const toParse = [];
  const audioSet = new Set();
  let unchangedCount = 0;
  for (const filePath of audioFiles) {
    audioSet.add(filePath);
    let stats;
    try {
      stats = await fsp.stat(filePath);
    } catch (e) {
      continue; // vanished mid-scan
    }
    const mtime = Math.floor(stats.mtimeMs);
    const cached = existingRows.get(filePath);
    if (cached && cached.mtime === mtime) {
      // Covers may have been deleted from disk without touching the audio
      // file; skip only when cached cover state still matches reality.
      const coverPath = coverPathFor(filePath);
      const coverExists = fs.existsSync(coverPath);
      if ((cached.has_cover === 1) === coverExists) {
        unchangedCount++;
        continue;
      }
    }
    toParse.push({ filePath, mtime });
  }

  // ---- Phase 2: parse changed files (async, bounded) ----
  const parsed = await mapLimit(toParse, 8, async ({ filePath, mtime }) => {
    const metadata = await mm.parseFile(filePath, { skipCovers: false });
    const filename = path.basename(filePath);
    const fileExt = path.extname(filePath).toLowerCase();
    const common = metadata.common || {};
    const format = metadata.format || {};

    const title = common.title || path.basename(filePath, path.extname(filePath));
    const artist = common.artist || common.albumartist || 'Unknown Artist';
    const album = common.album || 'Unknown Album';
    const trackNo = common.track ? common.track.no || 0 : 0;
    const year = common.year || null;
    const genre = Array.isArray(common.genre) ? common.genre.join(', ') : common.genre || '';

    const duration = format.duration || 0;
    const sampleRate = format.sampleRate || 44100;
    const bitsPerSample = format.bitsPerSample || 16;
    const bitrate = format.bitrate || 0;
    const channels = format.numberOfChannels || 2;
    const isLossless = format.lossless ? 1 : (['.flac', '.wav', '.alac'].includes(fileExt) ? 1 : 0);
    const containerName = (format.container || fileExt.replace('.', '')).toUpperCase();

    const lyrics = extractLyricsFromMetadata(filePath, metadata);

    let hasCover = 0;
    let coverMime = null;
    let coverBuffer = null;

    // 1. Primary: embedded picture tag
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      hasCover = 1;
      coverMime = pic.format || 'image/jpeg';
      coverBuffer = pic.data;
    } else {
      // 2. Secondary: folder cover in the track's own subfolder (not root)
      const parentDir = path.resolve(path.dirname(filePath));
      if (parentDir !== rootMusicDir) {
        for (const coverName of FOLDER_COVER_NAMES) {
          const candidatePath = path.join(parentDir, coverName);
          try {
            if (fs.existsSync(candidatePath)) {
              coverBuffer = await fsp.readFile(candidatePath);
              hasCover = 1;
              const ext = path.extname(coverName).toLowerCase();
              coverMime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
              break;
            }
          } catch (err) {
            // Ignore
          }
        }
      }
    }

    const coverPath = coverPathFor(filePath);
    if (hasCover && coverBuffer) {
      await fsp.writeFile(coverPath, coverBuffer);
    } else if (fs.existsSync(coverPath)) {
      await fsp.unlink(coverPath).catch(() => {});
    }

    return {
      filePath, mtime, filename, title, artist, album, trackNo, year, genre,
      duration, sampleRate, bitsPerSample, bitrate, channels, isLossless,
      containerName, lyrics, hasCover, coverMime,
    };
  });

  const rows = parsed.filter(r => !r.error);
  for (const r of parsed) {
    if (r.error) console.error(`[Scanner] Error parsing ${(r.error.filePath) || ''}:`, (r.error && r.error.message) || r.error);
  }

  // ---- Phase 3: write DB changes atomically ----
  const insertStmt = db.prepare(`
    INSERT INTO songs (
      filepath, filename, title, artist, album, track_no, year, genre,
      duration, sample_rate, bits_per_sample, bitrate, channels, lossless, container,
      mime_type, has_cover, cover_mime, lyrics, mtime
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
    ON CONFLICT(filepath) DO UPDATE SET
      title=excluded.title,
      artist=excluded.artist,
      album=excluded.album,
      track_no=excluded.track_no,
      year=excluded.year,
      genre=excluded.genre,
      duration=excluded.duration,
      sample_rate=excluded.sample_rate,
      bits_per_sample=excluded.bits_per_sample,
      bitrate=excluded.bitrate,
      channels=excluded.channels,
      lossless=excluded.lossless,
      container=excluded.container,
      mime_type=excluded.mime_type,
      has_cover=excluded.has_cover,
      cover_mime=excluded.cover_mime,
      lyrics=excluded.lyrics,
      mtime=excluded.mtime
  `);

  const deleteStmt = db.prepare('DELETE FROM songs WHERE filepath = ?');
  const dbRowsBefore = db.prepare('SELECT filepath FROM songs').all();

  const run = db.transaction(() => {
    for (const r of rows) {
      insertStmt.run(
        r.filePath, r.filename, r.title, r.artist, r.album, r.trackNo, r.year, r.genre,
        r.duration, r.sampleRate, r.bitsPerSample, r.bitrate, r.channels, r.isLossless,
        r.containerName, mimeForMedia(r.containerName, r.filePath),
        r.hasCover, r.coverMime, r.lyrics, r.mtime
      );
    }

    let pendingRemoval = 0;
    const validPathSet = new Set(audioFiles.map(f => path.resolve(f)));
    for (const row of dbRowsBefore) {
      if (!validPathSet.has(path.resolve(row.filepath))) {
        pendingRemoval++;
        if (canPurge) deleteStmt.run(row.filepath);
      }
    }
    return { added: rows.length, unchanged: unchangedCount, removed: canPurge ? pendingRemoval : 0, blocked: canPurge ? 0 : pendingRemoval };
  });

  const result = run();
  console.log(`[Scanner] Scan complete. Indexed ${result.added} tracks (${result.unchanged} unchanged), purged ${result.removed} stale.`);

  if (result.blocked > 0 && result.removed === 0) {
    console.error(
      `[Scanner] Purge blocked for ${result.blocked} track(s): scan found only ${audioFiles.length} files vs ${prevCount} known.` +
      ' Set ENABLE_SCAN_PURGE=true to force.'
    );
  }
  return result;
}

module.exports = { scanDirectory, walkDir, mimeForMedia, MIME_BY_CONTAINER };