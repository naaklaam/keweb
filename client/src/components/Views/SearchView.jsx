import React, { useState } from 'react';
import { Search, Play, Plus, Music } from 'lucide-react';

export default function SearchView({ songs, onPlaySong, onAddToQueue, currentSong }) {
  const [query, setQuery] = useState('');

  const results = query.trim() === '' ? [] : songs.filter(song => {
    const q = query.toLowerCase();
    return (
      (song.title && song.title.toLowerCase().includes(q)) ||
      (song.artist && song.artist.toLowerCase().includes(q)) ||
      (song.album && song.album.toLowerCase().includes(q)) ||
      (song.filename && song.filename.toLowerCase().includes(q))
    );
  });

  const formatDuration = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs text-slate-300">
      {/* Search Input Toolbar */}
      <div className="p-3 border-b border-slate-800 bg-slate-900/60">
        <div className="relative max-w-xl mx-auto">
          <Search size={16} className="absolute left-3 top-3 text-cyan-400" />
          <input
            type="text"
            autoFocus
            placeholder="Type artist, song title, or album name to search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-950 border-2 border-cyan-800 focus:border-cyan-400 rounded-md pl-10 pr-4 py-2 text-cyan-300 placeholder-slate-600 focus:outline-none font-mono text-xs shadow-lg shadow-cyan-950/40"
          />
        </div>
      </div>

      {/* Results Listing */}
      <div className="flex-1 overflow-y-auto">
        {query.trim() === '' ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2 p-6">
            <Search size={36} strokeWidth={1} />
            <p className="font-mono text-sm">Enter search term above.</p>
            <p className="text-[11px] text-slate-700">Searches through all 700+ FLAC tracks instantly.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2 p-6">
            <Music size={36} strokeWidth={1} />
            <p className="font-mono text-sm">No matches found for "{query}".</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-900">
            {results.map((song, idx) => {
              const isCurrent = currentSong && currentSong.id === song.id;

              return (
                <div
                  key={song.id}
                  className={`flex items-center justify-between p-2.5 hover:bg-slate-900 transition group ${
                    isCurrent ? 'bg-cyan-950/40 text-cyan-300 font-bold border-l-2 border-cyan-400' : ''
                  }`}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="text-slate-500 w-6 text-center">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-200 truncate group-hover:text-cyan-400 transition">
                        {song.title || song.filename}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {song.artist} — {song.album} ({song.bits_per_sample || 16}-bit FLAC)
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pl-3">
                    <span className="text-slate-400 text-[11px] mr-2">{formatDuration(song.duration)}</span>
                    <button
                      onClick={() => onPlaySong(song)}
                      className="p-1.5 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 transition"
                      title="Play Now"
                    >
                      <Play size={12} fill="currentColor" />
                    </button>
                    <button
                      onClick={() => onAddToQueue(song)}
                      className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-700 transition"
                      title="Add to Queue"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
