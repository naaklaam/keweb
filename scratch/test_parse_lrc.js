const db = require('./server/src/db');

function parseLyrics(rawLyrics, totalDuration = 0) {
  if (!rawLyrics || typeof rawLyrics !== 'string' || !rawLyrics.trim()) {
    return [];
  }

  const rawLines = rawLyrics.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return [];

  const timestampedLines = [];
  const lrcRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  let hasLrcTimestamps = false;

  for (const line of rawLines) {
    const matches = [...line.matchAll(lrcRegex)];
    if (matches && matches.length > 0) {
      hasLrcTimestamps = true;
      const text = line.replace(lrcRegex, '').trim();
      if (text) {
        for (const match of matches) {
          const min = parseInt(match[1], 10);
          const sec = parseInt(match[2], 10);
          const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
          const timeInSeconds = min * 60 + sec + ms / 1000;
          timestampedLines.push({ time: timeInSeconds, text });
        }
      }
    }
  }

  if (hasLrcTimestamps && timestampedLines.length > 0) {
    return timestampedLines.sort((a, b) => a.time - b.time);
  }
  return [];
}

const song = db.prepare("SELECT title, lyrics, duration FROM songs WHERE lyrics LIKE '%[%' LIMIT 1").get();
console.log('Testing Song:', song.title);
console.log('Parsed LRC:', parseLyrics(song.lyrics, song.duration).slice(0, 5));
