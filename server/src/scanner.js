const fs = require('fs');
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

async function scanDirectory(dirPath = process.env.MUSIC_DIR) {
  if (!dirPath) {
    console.error('[Scanner] No directory path specified and MUSIC_DIR environment variable is not set.');
    return;
  }

  const rootMusicDir = path.resolve(dirPath);
  console.log(`[Scanner] Scanning directory: ${rootMusicDir}...`);
  if (!fs.existsSync(rootMusicDir)) {
    console.error(`[Scanner] Directory does not exist: ${rootMusicDir}`);
    return;
  }

  const files = getFilesRecursively(rootMusicDir);
  const flacFiles = files.filter(f => f.toLowerCase().endsWith('.flac'));
  console.log(`[Scanner] Found ${flacFiles.length} FLAC files.`);

  const insertStmt = db.prepare(`
    INSERT INTO songs (
      filepath, filename, title, artist, album, track_no, year, genre,
      duration, sample_rate, bits_per_sample, bitrate, channels, lossless, container,
      has_cover, cover_mime, mtime
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
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
      has_cover=excluded.has_cover,
      cover_mime=excluded.cover_mime,
      mtime=excluded.mtime
  `);

  let addedCount = 0;
  for (const filePath of flacFiles) {
    try {
      const stats = fs.statSync(filePath);
      const mtime = Math.floor(stats.mtimeMs);

      const metadata = await mm.parseFile(filePath, { skipCovers: false });
      const filename = path.basename(filePath);
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

      let hasCover = 0;
      let coverMime = null;
      let coverBuffer = null;

      // 1. Primary: Extract embedded picture tag from individual FLAC file
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0];
        hasCover = 1;
        coverMime = pic.format || 'image/jpeg';
        coverBuffer = pic.data;
      } else {
        // 2. Secondary: Check parent folder ONLY if parent is a dedicated subfolder (not root MUSIC_DIR)
        const parentDir = path.resolve(path.dirname(filePath));
        if (parentDir !== rootMusicDir) {
          for (const coverName of FOLDER_COVER_NAMES) {
            const candidatePath = path.join(parentDir, coverName);
            if (fs.existsSync(candidatePath)) {
              try {
                coverBuffer = fs.readFileSync(candidatePath);
                hasCover = 1;
                const ext = path.extname(coverName).toLowerCase();
                coverMime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                break;
              } catch (err) {
                // Ignore read errors
              }
            }
          }
        }
      }

      // Save cover image to disk using unique MD5 hash of full file path
      const coverFileName = `${crypto.createHash('md5').update(filePath).digest('hex')}.img`;
      const coverPath = path.join(COVERS_DIR, coverFileName);

      if (hasCover && coverBuffer) {
        fs.writeFileSync(coverPath, coverBuffer);
      } else {
        // Remove stale cover if exists
        if (fs.existsSync(coverPath)) {
          fs.unlinkSync(coverPath);
        }
      }

      insertStmt.run(
        filePath,
        filename,
        title,
        artist,
        album,
        trackNo,
        year,
        genre,
        duration,
        sampleRate,
        bitsPerSample,
        bitrate,
        channels,
        1,
        'FLAC',
        hasCover,
        coverMime,
        mtime
      );

      addedCount++;
    } catch (err) {
      console.error(`[Scanner] Error parsing ${filePath}:`, err.message);
    }
  }

  console.log(`[Scanner] Scan complete. Updated ${addedCount} songs.`);
}

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

module.exports = { scanDirectory };
