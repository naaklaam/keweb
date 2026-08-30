/**
 * Smart LRC & Unsynced Lyrics Parser Engine
 * Parses timestamped LRC lyrics or generates proportional line timing for plain text lyrics.
 */
export function parseLyrics(rawLyrics, totalDuration = 0) {
  if (!rawLyrics || typeof rawLyrics !== 'string' || !rawLyrics.trim()) {
    return [];
  }

  const lines = rawLyrics.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  const lrcRegex = /^\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)$/;
  const timestampedLines = [];
  let hasTimestamps = false;

  for (const line of lines) {
    const match = line.match(lrcRegex);
    if (match) {
      hasTimestamps = true;
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
      const timeInSeconds = min * 60 + sec + ms / 1000;
      const text = match[4].trim();
      if (text) {
        timestampedLines.push({ time: timeInSeconds, text });
      }
    }
  }

  if (hasTimestamps && timestampedLines.length > 0) {
    return timestampedLines.sort((a, b) => a.time - b.time);
  }

  // Fallback for Unsynced Plain Text Lyrics:
  // Distribute estimated line timestamps based on song duration
  const validDuration = totalDuration && totalDuration > 0 ? totalDuration : 180;
  const startOffset = Math.min(5, validDuration * 0.05); // Start lyrics ~5s into song
  const usableDuration = Math.max(10, validDuration - startOffset - 5);
  const timePerLine = usableDuration / lines.length;

  return lines.map((text, idx) => ({
    time: startOffset + idx * timePerLine,
    text
  }));
}

/**
 * Returns the index of the active lyric line for the given currentTime
 */
export function getActiveLyricIndex(parsedLines, currentTime) {
  if (!parsedLines || parsedLines.length === 0) return -1;

  for (let i = parsedLines.length - 1; i >= 0; i--) {
    if (currentTime >= parsedLines[i].time) {
      return i;
    }
  }

  return 0;
}
