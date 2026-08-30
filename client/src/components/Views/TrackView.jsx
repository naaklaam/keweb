import React, { useState } from 'react';
import { Disc, Music2, FileText, Zap, ShieldCheck, Layers, Radio, Volume2 } from 'lucide-react';

export default function TrackView({ song, isPlaying, audioRef, currentTime, duration, onSeek }) {
  const [activeSubTab, setActiveSubTab] = useState('lyrics'); // 'lyrics' or 'specs'

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isHiRes = song && (song.bits_per_sample > 16 || song.sample_rate > 44100);

  // Parse lyrics into clean readable lines
  const lyricsLines = song && song.lyrics ? song.lyrics.split('\n').filter(line => line.trim().length > 0) : [];

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 md:p-8">
      {song ? (
        <div className="max-w-4xl mx-auto w-full flex flex-col space-y-8">
          {/* Main Album Art & Track Info Banner */}
          <div className="glass-panel p-6 sm:p-8 rounded-3xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative overflow-hidden">
            {/* Ambient Background Blur Highlight inside Card */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Left: Album Cover Art */}
            <div className="md:col-span-5 flex justify-center">
              <div className="relative group w-56 h-56 sm:w-64 sm:h-64 rounded-2xl bg-slate-950 overflow-hidden shadow-2xl shadow-cyan-500/10 border border-white/10 flex items-center justify-center">
                {song.has_cover ? (
                  <img
                    src={`/api/cover/${song.id}`}
                    alt={song.album}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-600 space-y-3">
                    <Disc size={96} className={`${isPlaying ? 'animate-spin-slow text-cyan-400' : 'text-slate-700'}`} />
                    <span className="text-xs font-semibold text-slate-500">NO ALBUM ART</span>
                  </div>
                )}
                {/* Audio Spec Badge Overlay */}
                <div className="absolute top-3 right-3 glass-pill px-3 py-1 rounded-full text-xs font-bold text-cyan-300 flex items-center space-x-1.5 shadow-lg">
                  <Zap size={12} className="text-amber-400 fill-amber-400" />
                  <span>{song.bits_per_sample || 16}-BIT FLAC</span>
                </div>
              </div>
            </div>

            {/* Right: Track Metadata Details */}
            <div className="md:col-span-7 flex flex-col space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-semibold tracking-wide flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span>NOW PLAYING</span>
                  </span>
                  {isHiRes && (
                    <span className="px-3 py-1 rounded-full text-xs bg-purple-500/10 text-purple-300 border border-purple-500/30 font-semibold flex items-center space-x-1">
                      <ShieldCheck size={13} />
                      <span>HI-RES LOSSLESS</span>
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mb-1">
                  {song.title || song.filename}
                </h1>
                <p className="text-cyan-400 font-bold text-base sm:text-lg">{song.artist || 'Unknown Artist'}</p>
                <p className="text-slate-400 text-xs sm:text-sm font-medium">{song.album || 'Unknown Album'} {song.year ? `(${song.year})` : ''}</p>
              </div>

              {/* Technical Specifications Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="glass-pill p-3 rounded-2xl flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Sample Rate</span>
                  <span className="text-purple-300 font-bold text-sm">
                    {song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : '44.1 kHz'}
                  </span>
                </div>

                <div className="glass-pill p-3 rounded-2xl flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Bit Depth</span>
                  <span className="text-amber-300 font-bold text-sm">{song.bits_per_sample || 16}-bit</span>
                </div>

                <div className="glass-pill p-3 rounded-2xl flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Bitrate</span>
                  <span className="text-emerald-300 font-bold text-sm">
                    {song.bitrate ? `${Math.round(song.bitrate / 1000)} kbps` : 'VBR'}
                  </span>
                </div>

                <div className="glass-pill p-3 rounded-2xl flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Duration</span>
                  <span className="text-cyan-300 font-bold text-sm">{formatTime(song.duration)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigation: Lyrics vs Detailed Spec Matrix */}
          <div className="glass-panel p-6 rounded-3xl flex flex-col space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center space-x-2 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10">
                <button
                  onClick={() => setActiveSubTab('lyrics')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeSubTab === 'lyrics'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText size={15} />
                  <span>Lirik Lagu ({lyricsLines.length > 0 ? lyricsLines.length : '0'})</span>
                </button>

                <button
                  onClick={() => setActiveSubTab('specs')}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeSubTab === 'specs'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers size={15} />
                  <span>Informasi Metadata</span>
                </button>
              </div>

              {lyricsLines.length > 0 && (
                <span className="text-xs text-cyan-400 font-semibold hidden sm:inline-block">
                  ✓ Embedded Lyrics Loaded
                </span>
              )}
            </div>

            {/* Tab 1: Lyrics Container */}
            {activeSubTab === 'lyrics' && (
              <div className="min-h-[300px] max-h-[500px] overflow-y-auto px-4 py-2 flex flex-col space-y-4 text-center sm:text-left">
                {lyricsLines.length > 0 ? (
                  lyricsLines.map((line, idx) => (
                    <p
                      key={idx}
                      className="text-base sm:text-lg text-slate-200 hover:text-cyan-300 transition-colors font-medium leading-relaxed"
                    >
                      {line}
                    </p>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
                    <Music2 size={40} className="text-slate-600" />
                    <p className="text-sm font-semibold text-slate-400">Lirik tidak ditemukan di metadata lagu ini.</p>
                    <p className="text-xs text-slate-500">Lagu ini mungkin musik instrumental atau tidak memiliki tag VORBIS/ID3 lirik embedded.</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Detailed Specs Matrix */}
            {activeSubTab === 'specs' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="glass-pill p-4 rounded-2xl flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Full File Path</span>
                  <span className="text-slate-200 font-mono text-[11px] truncate max-w-[240px]" title={song.filepath}>
                    {song.filepath}
                  </span>
                </div>
                <div className="glass-pill p-4 rounded-2xl flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Container / Codec</span>
                  <span className="text-cyan-300 font-bold">{song.container || 'FLAC'} (Free Lossless Audio Codec)</span>
                </div>
                <div className="glass-pill p-4 rounded-2xl flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Channels</span>
                  <span className="text-slate-200 font-semibold">{song.channels === 2 ? 'Stereo (2 Ch)' : `${song.channels} Ch`}</span>
                </div>
                <div className="glass-pill p-4 rounded-2xl flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Genre</span>
                  <span className="text-slate-200 font-semibold">{song.genre || 'Unspecified'}</span>
                </div>
                <div className="glass-pill p-4 rounded-2xl flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Track Number</span>
                  <span className="text-slate-200 font-semibold">Track #{song.track_no || 1}</span>
                </div>
                <div className="glass-pill p-4 rounded-2xl flex items-center justify-between">
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
