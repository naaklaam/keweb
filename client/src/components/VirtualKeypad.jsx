import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward, Volume2, VolumeX, Shuffle, Repeat, Search, List, Library, Music } from 'lucide-react';

export default function VirtualKeypad({
  activeTab,
  setActiveTab,
  isPlaying,
  togglePlay,
  playPrev,
  playNext,
  seek,
  volume,
  setVolume,
  isShuffle,
  toggleShuffle,
  isRepeat,
  toggleRepeat
}) {
  return (
    <div className="bg-slate-950 border-t border-slate-800 p-2 font-mono select-none">
      {/* Primary Touch Playback Row */}
      <div className="flex items-center justify-between gap-1 max-w-xl mx-auto mb-2">
        <button
          onClick={playPrev}
          className="flex-1 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 py-2 rounded flex items-center justify-center space-x-1 active:scale-95 transition"
          title="Previous Track (h / Left Arrow)"
        >
          <SkipBack size={16} />
          <span className="text-xs font-bold hidden sm:inline">PREV</span>
        </button>

        <button
          onClick={() => seek(-5)}
          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-2 rounded flex items-center justify-center space-x-1 active:scale-95 transition"
          title="Rewind 5s (a)"
        >
          <Rewind size={14} />
          <span className="text-[10px]"> -5s</span>
        </button>

        <button
          onClick={togglePlay}
          className="flex-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-400 py-2 rounded flex items-center justify-center space-x-1 font-bold text-glow active:scale-95 transition shadow-lg shadow-cyan-950/50"
          title="Play / Pause (Space)"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          <span className="text-xs tracking-wide">{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        <button
          onClick={() => seek(5)}
          className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-2 rounded flex items-center justify-center space-x-1 active:scale-95 transition"
          title="Forward 5s (d)"
        >
          <FastForward size={14} />
          <span className="text-[10px]">+5s </span>
        </button>

        <button
          onClick={playNext}
          className="flex-1 bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 py-2 rounded flex items-center justify-center space-x-1 active:scale-95 transition"
          title="Next Track (l / Right Arrow)"
        >
          <span className="text-xs font-bold hidden sm:inline">NEXT</span>
          <SkipForward size={16} />
        </button>
      </div>

      {/* Secondary Quick TUI Mode & Volume Row for Mobile */}
      <div className="flex items-center justify-between gap-1 text-[11px] max-w-xl mx-auto">
        {/* Navigation Quick Keypad */}
        <div className="grid grid-cols-4 gap-1 flex-1">
          <button
            onClick={() => setActiveTab('playlist')}
            className={`py-1 rounded border text-center font-bold ${
              activeTab === 'playlist' ? 'bg-cyan-950 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            F2 Queue
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`py-1 rounded border text-center font-bold ${
              activeTab === 'library' ? 'bg-cyan-950 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            F3 Lib
          </button>
          <button
            onClick={() => setActiveTab('track')}
            className={`py-1 rounded border text-center font-bold ${
              activeTab === 'track' ? 'bg-cyan-950 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            F4 Track
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`py-1 rounded border text-center font-bold ${
              activeTab === 'search' ? 'bg-cyan-950 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            F5 Search
          </button>
        </div>

        {/* Toggles */}
        <div className="flex items-center space-x-1 pl-1 border-l border-slate-800">
          <button
            onClick={toggleShuffle}
            className={`p-1.5 rounded border ${
              isShuffle ? 'bg-purple-950 border-purple-400 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle Shuffle (s)"
          >
            <Shuffle size={14} />
          </button>
          <button
            onClick={toggleRepeat}
            className={`p-1.5 rounded border ${
              isRepeat ? 'bg-emerald-950 border-emerald-400 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
            title="Toggle Repeat (r)"
          >
            <Repeat size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
