const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');

async function checkLrcFormat() {
  const musicDir = '/home/jo/Music Flac/';
  const files = fs.readdirSync(musicDir).filter(f => f.endsWith('.flac'));

  let syncedCount = 0;
  for (const f of files) {
    const filePath = path.join(musicDir, f);
    try {
      const metadata = await mm.parseFile(filePath);
      const common = metadata.common || {};
      const native = metadata.native || {};

      let rawLyrics = null;
      if (common.lyrics && common.lyrics.length > 0) {
        if (Array.isArray(common.lyrics)) {
          rawLyrics = common.lyrics.map(l => typeof l === 'string' ? l : (l.text || (l.syncText ? JSON.stringify(l.syncText) : ''))).join('\n');
        } else if (typeof common.lyrics === 'string') {
          rawLyrics = common.lyrics;
        }
      }

      if (!rawLyrics && native['VORBIS_COMMENT']) {
        const lyricTag = native['VORBIS_COMMENT'].find(tag => ['LYRICS', 'UNSYNCEDLYRICS', 'LYRICS_TEXT', 'USLT'].includes(tag.id.toUpperCase()));
        if (lyricTag) rawLyrics = lyricTag.value;
      }

      if (rawLyrics && /\[\d{2}:\d{2}/.test(rawLyrics)) {
        syncedCount++;
        console.log(`[Synced LRC Found] ${f}: ${rawLyrics.split('\n').filter(l => /\[\d{2}:/.test(l)).slice(0, 2).join(' | ')}`);
      }
    } catch (e) {}
  }
  console.log(`Synced LRC songs: ${syncedCount} / ${files.length}`);
}

checkLrcFormat();
