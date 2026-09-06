import React, { useState, useEffect, useRef } from 'react';
import { Disc, Music2, FileText, Zap, ShieldCheck, Layers, RefreshCw } from 'lucide-react';
import { parseLyrics, getActiveLyricIndex } from '../../utils/lrcParser';

export default function TrackView({ song, isPlaying, audioRef, currentTime, duration, onSeek }) {
  const [activeSubTab, setActiveSubTab] = useState('lyrics'); // 'lyrics' or 'specs'
  const [syncedLyricsData, setSyncedLyricsData] = useState(null);
  const [detailLyrics, setDetailLyrics] = useState(null);
  const [isLoadingLrc, setIsLoadingLrc] = useState(false);
  const activeLineRef = useRef(null);
  const lyricsBoxRef = useRef(null);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isHiRes = song && (song.bits_per_sample > 16 || song.sample_rate > 44100);

  // Lyrics detail fetch from server API
  useEffect(() => {
    setDetailLyrics(null);
    if (!song) return;
    let cancelled = false;
    fetch(`/api/songs/${song.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(detail => { if (!cancelled && detail) setDetailLyrics(detail.lyrics || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [song?.id]);

  // Auto-fetch online synced LRC lyrics
  useEffect(() => {
    setSyncedLyricsData(null);
    if (!song) return;

    const baseLyrics = detailLyrics ?? (song ? song.lyrics : null);
    const hasLocalLrc = baseLyrics && /\[\d{2}:\d{2}/.test(baseLyrics);
    if (hasLocalLrc) {
      setSyncedLyricsData(baseLyrics);
      return;
    }

    if (song.artist && song.title) {
      setIsLoadingLrc(true);
      const cleanTitle = song.title.replace(/\([^)]*\)/g, '').replace(/\[[^\]]*\]/g, '').trim();
      const cleanArtist = song.artist.replace(/\([^)]*\)/g, '').trim();
      const queryUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}&duration=${Math.round(duration || song.duration || 0)}`;

      fetch(queryUrl)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.syncedLyrics) {
            setSyncedLyricsData(data.syncedLyrics);
          } else {
            const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanArtist + ' ' + cleanTitle)}`;
            return fetch(searchUrl)
              .then(res => res.ok ? res.json() : null)
              .then(searchResults => {
                if (Array.isArray(searchResults) && searchResults.length > 0) {
                  const syncedItem = searchResults.find(item => item.syncedLyrics && item.syncedLyrics.trim());
                  if (syncedItem) {
                    setSyncedLyricsData(syncedItem.syncedLyrics);
                    return;
                  }
                  const plainItem = searchResults.find(item => item.plainLyrics && item.plainLyrics.trim());
                  if (plainItem && !baseLyrics) {
                    setSyncedLyricsData(plainItem.plainLyrics);
                  } else {
                    setSyncedLyricsData(baseLyrics || null);
                  }
                } else {
                  setSyncedLyricsData(baseLyrics || null);
                }
              });
          }
        })
        .catch(() => {
          setSyncedLyricsData(baseLyrics || null);
        })
        .finally(() => {
          setIsLoadingLrc(false);
        });
    } else {
      setSyncedLyricsData(baseLyrics || null);
    }
  }, [song?.id, detailLyrics]);

  const activeLyricsText = syncedLyricsData || detailLyrics || (song ? song.lyrics : '');
  const parsedLyrics = parseLyrics(activeLyricsText, duration, 0);
  const activeLyricIndex = getActiveLyricIndex(parsedLyrics, currentTime);

  // Auto-scroll lirik HANYA di dalam kotak lirik (bukan ikut scroll halaman).
  // scrollIntoView sebelumnya membuat seluruh halaman (termasuk cover di atas)
  // ikut tergeser sehingga layar kebawa ke bawah.
  useEffect(() => {
    if (activeSubTab !== 'lyrics') return;
    const box = lyricsBoxRef.current;
    const line = activeLineRef.current;
    if (!box || !line) return;
    const boxTop = box.getBoundingClientRect().top;
    const lineTop = line.getBoundingClientRect().top - boxTop + box.scrollTop;
    const target = lineTop - box.clientHeight / 2 + line.offsetHeight / 2;
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeLyricIndex, activeSubTab]);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-8">
      {song ? (
        <div className="max-w-4xl mx-auto w-full flex flex-col space-y-6">
          {/* Main Album Art & Track Info Banner */}
          <div className="bg-slate-900/30 border border-white/10 p-6 sm:p-8 rounded-3xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative overflow-hidden backdrop-blur-md shadow-2xl">
            {/* Ambient Background Blur Highlight inside Card */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />

            {/* Left: Album Cover Art */}
            <div className="md:col-span-5 flex justify-center">
              <div className="relative group w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-slate-950/80 overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
                {song.has_cover ? (
                  <img
                    src={`/api/cover/${song.id}`}
                    alt={song.album}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600 space-y-3">
                    <Disc size={96} className={`${isPlaying ? 'animate-spin-slow text-white' : 'text-slate-700'}`} />
                    <span className="text-xs font-semibold text-slate-500">NO ALBUM ART</span>
                  </div>
                )}
                {/* Audio Spec Badge Overlay */}
                <div className="absolute top-3 right-3 px-2.5 py-0.5 text-[11px] font-bold text-white flex items-center space-x-1">
                  <Zap size={12} className="text-amber-400 fill-amber-400" />
                  <span>{song.bits_per_sample || 16}-BIT FLAC</span>
                </div>
              </div>
            </div>

            {/* Right: Track Metadata Details */}
            <div className="md:col-span-7 flex flex-col space-y-5">
              <div>
                {isHiRes && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-purple-300 font-semibold flex items-center space-x-1">
                      <ShieldCheck size={13} />
                      <span>HI-RES LOSSLESS</span>
                    </span>
                  </div>
                )}

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mb-1">
                  {song.title || song.filename}
                </h1>
                <p className="text-white/90 font-bold text-base sm:text-lg">{song.artist || 'Unknown Artist'}</p>
                <p className="text-slate-400 text-xs sm:text-sm font-medium">{song.album || 'Unknown Album'} {song.year ? `(${song.year})` : ''}</p>
              </div>

              {/* Thread-Thin Gold Progress Bar & Menitan Display */}
              <div className="flex flex-col space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-200 font-medium">{formatTime(currentTime)}</span>
                  <span className="text-slate-400 font-medium">{formatTime(duration)}</span>
                </div>
                <div className="relative flex items-center group">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    step="0.1"
                    value={currentTime || 0}
                    onChange={(e) => onSeek && onSeek(parseFloat(e.target.value))}
                    className="w-full h-2 bg-transparent appearance-none cursor-pointer accent-[#FFC107] z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  {/* Thread Track Background */}
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-[2px] bg-white/20 rounded-full pointer-events-none" />
                  {/* Passed Progress Overlay Bar - Thread Thin Gold */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 left-0 h-[2px] bg-[#FFC107] rounded-full pointer-events-none transition-all duration-100 shadow-sm shadow-[#FFC107]/50"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Technical Specifications Highlights - Frameless & Unboxed */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Sample Rate</span>
                  <span className="text-purple-300 font-bold text-sm">
                    {song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : '44.1 kHz'}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Bit Depth</span>
                  <span className="text-[#FFC107] font-bold text-sm">{song.bits_per_sample || 16}-bit</span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Bitrate</span>
                  <span className="text-emerald-300 font-bold text-sm">
                    {song.bitrate ? `${Math.round(song.bitrate / 1000)} kbps` : 'VBR'}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Duration</span>
                  <span className="text-white font-bold text-sm">{formatTime(song.duration)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigation: Lyrics vs Detailed Spec Matrix (Frameless & Unboxed) */}
          <div className="flex flex-col space-y-6 pt-2">
            <div className="flex items-center space-x-6 border-b border-white/10 pb-3">
              <button
                onClick={() => setActiveSubTab('lyrics')}
                className={`flex items-center space-x-2 text-xs font-bold transition-colors ${
                  activeSubTab === 'lyrics'
                    ? 'text-[#FFC107]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText size={15} />
                <span>Lirik Lagu ({parsedLyrics.length})</span>
              </button>

              <button
                onClick={() => setActiveSubTab('specs')}
                className={`flex items-center space-x-2 text-xs font-bold transition-colors ${
                  activeSubTab === 'specs'
                    ? 'text-[#FFC107]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Layers size={15} />
                <span>Informasi Metadata</span>
              </button>
            </div>

            {/* Tab 1: Lyrics Content */}
            {activeSubTab === 'lyrics' && (
              <div
                ref={lyricsBoxRef}
                className="min-h-[320px] max-h-[500px] overflow-y-auto px-4 py-4 flex flex-col space-y-4 text-center sm:text-left scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                {isLoadingLrc ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
                    <RefreshCw size={32} className="animate-spin text-white" />
                    <p className="text-xs font-semibold">Mengambil lirik presisi dari cloud database...</p>
                  </div>
                ) : parsedLyrics.length > 0 ? (
                  parsedLyrics.map((lineObj, idx) => {
                    const isActive = idx === activeLyricIndex;
                    return (
                      <div
                        key={idx}
                        ref={isActive ? activeLineRef : null}
                        onClick={() => onSeek && onSeek(lineObj.time)}
                        className={`cursor-pointer transition-all duration-300 py-2.5 px-3 rounded-xl ${
                          isActive
                            ? 'text-[#FFC107] font-bold text-lg sm:text-xl scale-[1.03] opacity-100 drop-shadow-md'
                            : 'text-slate-400 font-medium text-base sm:text-lg opacity-50 hover:opacity-80'
                        }`}
                      >
                        <p>{lineObj.text}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
                    <Music2 size={40} className="text-slate-600" />
                    <p className="text-sm font-semibold text-slate-400">Lirik tidak ditemukan di metadata lagu ini.</p>
                    <p className="text-xs text-slate-500">Lagu ini mungkin musik instrumental atau tidak memiliki tag VORBIS/ID3 lirik embedded.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Detailed Specs Matrix (Frameless & Unboxed) */}
            {activeSubTab === 'specs' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs py-2">
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400 font-medium">Filename</span>
                  <span className="text-slate-200 font-mono text-[11px] truncate max-w-[240px]" title={song.filename}>
                    {song.filename}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400 font-medium">Container / Codec</span>
                  <span className="text-white font-bold">{song.container || 'FLAC'} (Free Lossless Audio Codec)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400 font-medium">Channels</span>
                  <span className="text-slate-200 font-semibold">{song.channels === 2 ? 'Stereo (2 Ch)' : `${song.channels} Ch`}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400 font-medium">Genre</span>
                  <span className="text-slate-200 font-semibold">{song.genre || 'Unspecified'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400 font-medium">Track Number</span>
                  <span className="text-slate-200 font-semibold">Track #{song.track_no || 1}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400 font-medium">Audio Compression</span>
                  <span className="text-emerald-400 font-bold">100% Uncompressed Lossless</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4 py-20">
          <Music2 size={64} className="text-slate-700" />
          <h2 className="text-lg font-bold text-slate-300">Belum ada lagu yang diputar</h2>
          <p className="text-xs text-slate-500">Pilih lagu dari menu Library atau Queue untuk melihat detail & lirik.</p>
        </div>
      )}
    </div>
  );
}
