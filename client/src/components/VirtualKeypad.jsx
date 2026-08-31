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
      {/* Thread-Thin Gold Seek Progress Bar */}
      <div className="flex items-center space-x-3 text-xs font-mono">
        <span className="text-slate-300 font-medium w-10 text-right">{formatTime(currentTime)}</span>
        
        <div className="relative flex-1 flex items-center group">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime || 0}
            onChange={(e) => onSeekTo && onSeekTo(parseFloat(e.target.value))}
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

        <span className="text-slate-400 font-medium w-10 text-left">{formatTime(duration)}</span>
      </div>

      {/* Control Buttons & Volume Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Playback Control Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={toggleShuffle}
            title="Shuffle Mode"
            className={`p-2 rounded-xl transition-all ${
              isShuffle
                ? 'bg-black text-[#FFC107] border-2 border-[#FFC107] shadow-md shadow-[#FFC107]/20 font-bold'
                : 'bg-black/40 text-slate-400 border border-white/20 hover:text-white'
            }`}
          >
            <Shuffle size={16} />
          </button>

          <button
            onClick={playPrev}
            title="Lagu Sebelumnya"
            className="p-2.5 rounded-xl bg-black/40 border border-white/20 text-slate-200 hover:text-[#FFC107] hover:border-[#FFC107]/40 transition-all active:scale-95"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
            className="p-3.5 rounded-2xl bg-black text-[#FFC107] border-2 border-[#FFC107] shadow-lg shadow-[#FFC107]/25 hover:scale-105 active:scale-95 transition-all"
          >
            {isPlaying ? <Pause size={20} className="fill-[#FFC107] text-[#FFC107]" /> : <Play size={20} className="fill-[#FFC107] text-[#FFC107] ml-0.5" />}
          </button>

          <button
            onClick={playNext}
            title="Lagu Berikutnya"
            className="p-2.5 rounded-xl bg-black/40 border border-white/20 text-slate-200 hover:text-[#FFC107] hover:border-[#FFC107]/40 transition-all active:scale-95"
          >
            <SkipForward size={18} />
          </button>

          <button
            onClick={toggleRepeat}
            title="Repeat Mode"
            className={`p-2 rounded-xl transition-all ${
              isRepeat
                ? 'bg-black text-[#FFC107] border-2 border-[#FFC107] shadow-md shadow-[#FFC107]/20 font-bold'
                : 'bg-black/40 text-slate-400 border border-white/20 hover:text-white'
            }`}
          >
            <Repeat size={16} />
          </button>
        </div>

        {/* Quick Seek Shortcut Buttons */}
        <div className="flex items-center space-x-2 text-xs font-semibold">
          <button
            onClick={() => seek(-5)}
            className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/20 text-slate-300 hover:text-[#FFC107] hover:border-[#FFC107]/40 transition-all flex items-center space-x-1"
          >
            <RotateCcw size={12} />
            <span>-5s</span>
          </button>

          <button
            onClick={() => seek(5)}
            className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/20 text-slate-300 hover:text-[#FFC107] hover:border-[#FFC107]/40 transition-all flex items-center space-x-1"
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
            className="w-20 sm:w-28 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#FFC107]"
          />
        </div>
      </div>
    </footer>
  );
}
