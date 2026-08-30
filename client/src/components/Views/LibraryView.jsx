import React, { useState } from 'react';
import { Play, Plus, ArrowUpDown, Disc, Music, Search, Filter } from 'lucide-react';

export default function LibraryView({ songs, onPlaySong, onAddToQueue, currentSong }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');

  // Filter songs
  const filtered = songs.filter(song => {
    const term = searchTerm.toLowerCase();
    return (
      (song.title && song.title.toLowerCase().includes(term)) ||
      (song.artist && song.artist.toLowerCase().includes(term)) ||
      (song.album && song.album.toLowerCase().includes(term)) ||
      (song.filename && song.filename.toLowerCase().includes(term))
    );
  });

  // Sort songs
  const sorted = [...filtered].sort((a, b) => {
    let valA = a[sortBy] || '';
    let valB = b[sortBy] || '';

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const formatDuration = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs text-slate-300">
      {/* Top Filter & Sort Control Toolbar */}
      <div className="p-2 border-b border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Filter library (Title, Artist, Album)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-cyan-400 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs"
          />
        </div>

        {/* Sorting TUI Buttons */}
        <div className="flex items-center space-x-1 text-[11px] overflow-x-auto no-scrollbar">
          <span className="text-slate-500 flex items-center mr-1">
            <Filter size={12} className="mr-1" /> Sort:
          </span>
          
          <button
            onClick={() => toggleSort('title')}
            className={`px-2 py-1 rounded border transition ${
              sortBy === 'title' ? 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            Title {sortBy === 'title' && (sortOrder === 'asc' ? '▲' : '▼')}
          </button>

          <button
            onClick={() => toggleSort('artist')}
            className={`px-2 py-1 rounded border transition ${
              sortBy === 'artist' ? 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            Artist {sortBy === 'artist' && (sortOrder === 'asc' ? '▲' : '▼')}
          </button>

          <button
            onClick={() => toggleSort('album')}
            className={`px-2 py-1 rounded border transition ${
              sortBy === 'album' ? 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            Album {sortBy === 'album' && (sortOrder === 'asc' ? '▲' : '▼')}
          </button>

          <button
            onClick={() => toggleSort('duration')}
            className={`px-2 py-1 rounded border transition ${
              sortBy === 'duration' ? 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            Duration {sortBy === 'duration' && (sortOrder === 'asc' ? '▲' : '▼')}
          </button>

          <button
            onClick={() => toggleSort('bits_per_sample')}
            className={`px-2 py-1 rounded border transition ${
              sortBy === 'bits_per_sample' ? 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'
            }`}
          >
            Bitrate {sortBy === 'bits_per_sample' && (sortOrder === 'asc' ? '▲' : '▼')}
          </button>
        </div>
      </div>

      {/* Songs TUI Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px] sticky top-0 uppercase tracking-wider">
            <tr>
              <th className="py-2 px-3 w-10 text-center">#</th>
              <th className="py-2 px-3">Title</th>
              <th className="py-2 px-3 hidden sm:table-cell">Artist</th>
              <th className="py-2 px-3 hidden md:table-cell">Album</th>
              <th className="py-2 px-3 hidden lg:table-cell text-center">FLAC Spec</th>
              <th className="py-2 px-3 text-right">Time</th>
              <th className="py-2 px-3 w-16 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-slate-600 font-mono">
                  No FLAC tracks found matching search term.
                </td>
              </tr>
            ) : (
              sorted.map((song, idx) => {
                const isCurrent = currentSong && currentSong.id === song.id;
                const isHiRes = song.bits_per_sample > 16 || song.sample_rate > 44100;

                return (
                  <tr
                    key={song.id}
                    className={`hover:bg-slate-900/80 group transition ${
                      isCurrent ? 'bg-cyan-950/40 text-cyan-300 font-bold border-l-2 border-cyan-400' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-center text-slate-500 font-mono">
                      {isCurrent ? '▶' : idx + 1}
                    </td>
                    
                    <td className="py-2 px-3">
                      <div className="flex flex-col">
                        <span className={`font-semibold truncate max-w-xs md:max-w-md ${isCurrent ? 'text-cyan-300 text-glow' : 'text-slate-200'}`}>
                          {song.title || song.filename}
                        </span>
                        <span className="text-[10px] text-slate-500 sm:hidden truncate">
                          {song.artist} — {song.album}
                        </span>
                      </div>
                    </td>

                    <td className="py-2 px-3 hidden sm:table-cell text-slate-400 truncate max-w-[150px]">
                      {song.artist || 'Unknown'}
                    </td>

                    <td className="py-2 px-3 hidden md:table-cell text-slate-500 truncate max-w-[150px]">
                      {song.album || 'Unknown'}
                    </td>

                    <td className="py-2 px-3 hidden lg:table-cell text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        isHiRes
                          ? 'bg-purple-950 border-purple-800 text-purple-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}>
                        {song.bits_per_sample || 16}-bit / {Math.round((song.sample_rate || 44100) / 1000)}kHz
                      </span>
                    </td>

                    <td className="py-2 px-3 text-right text-slate-400 font-mono">
                      {formatDuration(song.duration)}
                    </td>

                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => onPlaySong(song)}
                          className="p-1 rounded hover:bg-cyan-950 text-cyan-400 border border-transparent hover:border-cyan-800 transition"
                          title="Play Track Now"
                        >
                          <Play size={12} fill="currentColor" />
                        </button>
                        <button
                          onClick={() => onAddToQueue(song)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 border border-transparent hover:border-slate-700 transition"
                          title="Add to Queue"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
