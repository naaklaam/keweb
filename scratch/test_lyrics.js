const fs = require('fs');
const path = require('path');
const mm = require('music-metadata');

async function testLyrics() {
  const musicDir = '/home/jo/Music Flac/';
  const files = fs.readdirSync(musicDir).filter(f => f.endsWith('.flac'));
  console.log(`Testing ${files.length} FLAC files for lyrics...`);

  let count = 0;
  for (const f of files) {
    const filePath = path.join(musicDir, f);
    try {
      const metadata = await mm.parseFile(filePath);
      const common = metadata.common || {};
      const native = metadata.native || {};

      let lyrics = null;
      if (common.lyrics) {
        if (Array.isArray(common.lyrics)) {
          lyrics = common.lyrics.map(l => typeof l === 'string' ? l : (l.text || JSON.stringify(l))).join('\n');
        } else if (typeof common.lyrics === 'string') {
          lyrics = common.lyrics;
        }
      }

      if (!lyrics && native['VORBIS_COMMENT']) {
        const lyricTag = native['VORBIS_COMMENT'].find(tag => ['LYRICS', 'UNSYNCEDLYRICS', 'LYRICS_TEXT', 'USLT'].includes(tag.id.toUpperCase()));
        if (lyricTag) lyrics = lyricTag.value;
      }

      if (lyrics) {
        count++;
        console.log(`[Found Lyrics] ${f}: ${lyrics.substring(0, 100).replace(/\n/g, ' ')}...`);
      }
    } catch (e) {}
  }
  console.log(`Total songs with lyrics: ${count} / ${files.length}`);
}

testLyrics();
