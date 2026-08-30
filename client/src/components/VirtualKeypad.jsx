import React from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Shuffle, Repeat, RotateCcw
} from 'lucide-react';

export default function VirtualKeypad({
  activeTab,
  setActiveTab,
  isPlaying,
  togglePlay,
  playPrev,
  playNext,
  seek,
  currentTime,
  duration,
  onSeekTo,
  volume,
  setVolume,
  isShuffle,
  toggleShuffle,
  isRepeat,
  toggleRepeat
}) {
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <footer className="px-4 py-3 border-t border-white/10 glass-panel z-20 flex flex-col space-y-3">
      {/* Seek Progress Bar & Time Display */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        <span className="text-cyan-400 font-bold w-10 text-right">{formatTime(currentTime)}</span>
        
        <div className="relative flex-1 flex items-center group">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime || 0}
            onChange={(e) => onSeekTo && onSeekTo(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400 z-10"
          />
          {/* Progress Overlay bar */}
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 h-2 bg-gradient-to-r from-cyan-500 to-sky-400 rounded-lg pointer-events-none transition-all duration-100"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <span className="text-slate-400 font-semibold w-10 text-left">{formatTime(duration)}</span>
      </div>

      {/* Control Buttons & Volume Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Playback Control Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={toggleShuffle}
            title="Shuffle Mode"
            className={`p-2 rounded-xl transition-all ${
              isShuffle ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'glass-pill text-slate-400 hover:text-white'
            }`}
          >
            <Shuffle size={16} />
          </button>

          <button
            onClick={playPrev}
            title="Lagu Sebelumnya"
            className="p-2.5 rounded-xl glass-pill text-slate-200 hover:text-white transition-all active:scale-95"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className="p-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying ? <Pause size={20} className="fill-slate-950" /> : <Play size={20} className="fill-slate-950 ml-0.5" />}
          </button>

          <button
            onClick={playNext}
            title="Lagu Berikutnya"
            className="p-2.5 rounded-xl glass-pill text-slate-200 hover:text-white transition-all active:scale-95"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={toggleRepeat}
            title="Repeat Mode"
            className={`p-2 rounded-xl transition-all ${
              isRepeat ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'glass-pill text-slate-400 hover:text-white'
            }`}
          >
            <Repeat size={16} />
          </button>
        </div>

        {/* Quick Seek Shortcut Buttons */}
        <div className="flex items-center space-x-2 text-xs font-semibold">
          <button
            onClick={() => seek(-5)}
            className="px-3 py-1.5 rounded-xl glass-pill text-slate-300 hover:text-cyan-400 transition-all flex items-center space-x-1"
          >
            <RotateCcw size={12} />
            <span>-5s</span>
          </button>

          <button
            onClick={() => seek(5)}
            className="px-3 py-1.5 rounded-xl glass-pill text-slate-300 hover:text-cyan-400 transition-all flex items-center space-x-1"
          >
            <RotateCcw size={12} className="rotate-180" />
            <span>+5s</span>
          </button>
        </div>

        {/* Volume Slider Controls */}
        <div className="flex items-center space-x-2 text-slate-400">
          <button
            onClick={() => setVolume(volume === 0 ? 1 : 0)}
            className="p-1.5 hover:text-white transition-colors"
          >
            {volume === 0 ? <VolumeX size={16} className="text-rose-400" /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-20 sm:w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
        </div>
      </div>
    </footer>
  );
}
