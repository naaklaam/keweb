import React, { useState, useEffect } from 'react';
import { Music2, ListMusic, Disc3, Search, Clock, Disc } from 'lucide-react';

export default function TerminalHeader({ activeTab, setActiveTab, stats }) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'library', label: 'Library', icon: Music2, badge: stats.totalSongs || 0 },
    { id: 'playlist', label: 'Queue', icon: ListMusic },
    { id: 'track', label: 'Now Playing', icon: Disc3 },
    { id: 'search', label: 'Search', icon: Search },
  ];

  return (
    <header className="px-4 py-3 border-b border-white/10 glass-panel z-20 flex flex-col sm:flex-row items-center justify-between gap-3">
      {/* Brand & App Title */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-sky-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Disc size={20} className="text-slate-950 animate-spin-slow" />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-white flex items-center space-x-2">
            <span>KEWEB</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              FLAC
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 font-medium">Lossless Audio Player</p>
        </div>
      </div>

      {/* Navigation Tabs Pill Bar */}
      <nav className="flex items-center space-x-1 sm:space-x-2 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10 shadow-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-md shadow-cyan-500/25 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-slate-950/20 text-slate-900' : 'bg-white/10 text-slate-400'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Stats & Live Clock */}
      <div className="hidden md:flex items-center space-x-4 text-xs text-slate-400 font-medium">
        {stats.hiResCount > 0 && (
          <span className="flex items-center space-x-1 text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full text-[11px]">
            <span>{stats.hiResCount} Hi-Res Tracks</span>
          </span>
        )}
        <div className="flex items-center space-x-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded-full text-slate-300">
          <Clock size={13} className="text-cyan-400" />
          <span className="font-mono text-xs tracking-wider">{time}</span>
        </div>
      </div>
    </header>
  );
}
