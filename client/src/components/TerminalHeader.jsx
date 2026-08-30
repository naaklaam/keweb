import React, { useState, useEffect } from 'react';
import { Terminal, Disc, Music, HardDrive, Wifi } from 'lucide-react';

export default function TerminalHeader({ activeTab, setActiveTab, stats }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="bg-slate-950 border-b border-slate-800 p-2 md:p-3 text-xs font-mono select-none">
      {/* Top Status Line */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2 pb-2 border-b border-slate-900">
        <div className="flex items-center space-x-2 text-cyan-400 font-bold">
          <Terminal size={14} />
          <span className="text-glow">kew-web // FLAC Lossless Player</span>
          <span className="bg-cyan-950 text-cyan-400 px-1.5 py-0.5 rounded text-[10px] border border-cyan-800">ONLINE</span>
        </div>

        {/* Stats */}
        <div className="flex items-center space-x-3 text-slate-400 text-[11px]">
          <div className="flex items-center space-x-1" title="Total FLAC Songs">
            <Music size={12} className="text-emerald-400" />
            <span>{stats.totalSongs || 0} tracks</span>
          </div>
          <div className="hidden sm:flex items-center space-x-1" title="Hi-Res FLAC Count">
            <Disc size={12} className="text-purple-400" />
            <span>{stats.hiResCount || 0} Hi-Res</span>
          </div>
          <div className="hidden md:flex items-center space-x-1" title="Total Albums">
            <HardDrive size={12} className="text-amber-400" />
            <span>{stats.totalAlbums || 0} albums</span>
          </div>
          <div className="text-slate-500 font-mono pl-2 border-l border-slate-800">
            {time}
          </div>
        </div>
      </div>

      {/* TUI Navigation Tab Bar */}
      <div className="flex items-center justify-between overflow-x-auto no-scrollbar gap-1 pt-1">
        <div className="flex items-center space-x-1 md:space-x-2">
          <button
            onClick={() => setActiveTab('playlist')}
            className={`px-2.5 py-1 rounded border transition-colors flex items-center space-x-1.5 ${
              activeTab === 'playlist'
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300 text-glow font-bold'
                : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-cyan-500 font-bold">[F2]</span>
            <span>Playlist</span>
          </button>

          <button
            onClick={() => setActiveTab('library')}
            className={`px-2.5 py-1 rounded border transition-colors flex items-center space-x-1.5 ${
              activeTab === 'library'
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300 text-glow font-bold'
                : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-cyan-500 font-bold">[F3]</span>
            <span>Library</span>
          </button>

          <button
            onClick={() => setActiveTab('track')}
            className={`px-2.5 py-1 rounded border transition-colors flex items-center space-x-1.5 ${
              activeTab === 'track'
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300 text-glow font-bold'
                : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-cyan-500 font-bold">[F4]</span>
            <span>Track Info</span>
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`px-2.5 py-1 rounded border transition-colors flex items-center space-x-1.5 ${
              activeTab === 'search'
                ? 'bg-cyan-950 border-cyan-400 text-cyan-300 text-glow font-bold'
                : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-cyan-500 font-bold">[F5]</span>
            <span>Search</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center text-[10px] text-slate-500 space-x-2">
          <span>Shortcuts: <kbd className="text-cyan-400">Space</kbd> Play/Pause</span>
          <span><kbd className="text-cyan-400">h/l</kbd> Prev/Next</span>
          <span><kbd className="text-cyan-400">a/d</kbd> Seek</span>
        </div>
      </div>
    </header>
  );
}
