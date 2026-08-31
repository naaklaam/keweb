/**
 * Smart LRC & Character-Weighted Lyrics Parser Engine
 * 1. Millisecond LRC timestamp parser for exact [mm:ss.xx] sync
 * 2. Character-weighted pacing engine for unsynced plain text lyrics fallback
 */
export function parseLyrics(rawLyrics, totalDuration = 0, offset = 0) {
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
          const timeInSeconds = Math.max(0, min * 60 + sec + ms / 1000 + offset);
          timestampedLines.push({ time: timeInSeconds, text });
        }
      }
    }
  }

  // 1. If exact LRC timestamps exist, return sorted millisecond timestamped lines
  if (hasLrcTimestamps && timestampedLines.length > 0) {
    return timestampedLines.sort((a, b) => a.time - b.time);
  }

  // 2. Fallback for Unsynced Plain Text Lyrics:
  // Character-Weighted Pacing Engine (longer lines take more time, short lines pass faster)
  const validDuration = totalDuration && totalDuration > 0 ? totalDuration : 180;
  const startOffset = Math.min(8, validDuration * 0.05); // Skip ~5-8s intro
  const endOffset = 5;
  const vocalDuration = Math.max(10, validDuration - startOffset - endOffset);

  const cleanLines = rawLines.filter(l => !l.startsWith('['));
  if (cleanLines.length === 0) return [];

  const totalChars = cleanLines.reduce((acc, l) => acc + Math.max(1, l.length), 0);

  let accumulatedTime = startOffset;
  const weightedLines = [];

  for (let i = 0; i < cleanLines.length; i++) {
    const lineText = cleanLines[i];
    const charCount = Math.max(1, lineText.length);
    const lineDuration = Math.max(1.8, (charCount / totalChars) * vocalDuration);

    weightedLines.push({
      time: accumulatedTime + offset,
      text: lineText
    });

    accumulatedTime += lineDuration;
  }

  return weightedLines;
}

/**
 * Returns the index of the active lyric line for the given currentTime
 */
export function getActiveLyricIndex(parsedLines, currentTime) {
  if (!parsedLines || parsedLines.length === 0) return -1;
  if (currentTime < parsedLines[0].time) return -1;

  for (let i = parsedLines.length - 1; i >= 0; i--) {
    if (currentTime >= parsedLines[i].time) {
      return i;
    }
  }

  return -1;
}
