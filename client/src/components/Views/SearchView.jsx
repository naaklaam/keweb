import React, { useState } from 'react';
import { Search, Plus, Play, Disc, Music2 } from 'lucide-react';

export default function SearchView({ songs, onPlaySong, onAddToQueue, currentSong }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSongs = searchTerm.trim() === '' ? [] : songs.filter(song => {
    const term = searchTerm.toLowerCase();
    return (
      (song.title && song.title.toLowerCase().includes(term)) ||
      (song.artist && song.artist.toLowerCase().includes(term)) ||
      (song.album && song.album.toLowerCase().includes(term)) ||
      (song.filename && song.filename.toLowerCase().includes(term))
    );
  });

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4 max-w-4xl mx-auto w-full">
      {/* Search Input Box Header */}
      <div className="glass-panel p-6 rounded-3xl flex flex-col space-y-3">
        <h2 className="text-lg font-extrabold text-white">SEARCH MUSIC LIBRARY</h2>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" />
          <input
            type="text"
            placeholder="Ketik judul lagu, artist, atau nama album..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
          />
        </div>
      </div>

      {/* Search Results List */}
      <div className="glass-panel rounded-3xl flex-1 overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-2">
          {searchTerm.trim() === '' ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
              <Search size={48} className="text-slate-700" />
              <p className="text-sm font-semibold">Ketik kata kunci untuk mencari di koleksi FLAC.</p>
            </div>
          ) : filteredSongs.length > 0 ? (
            filteredSongs.map((song, index) => {
              const isCurrent = currentSong && currentSong.id === song.id;
              return (
                <div
                  key={song.id}
                  onClick={() => onPlaySong(song)}
                  className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                    isCurrent
                      ? 'bg-cyan-500/15 border border-cyan-500/30 text-white shadow-md'
                      : 'hover:bg-white/5 border border-transparent text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-4 min-w-0 flex-1">
                    {/* Album Art Thumbnail */}
                    <div className="w-12 h-12 rounded-xl bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {song.has_cover ? (
                        <img src={`/api/cover/${song.id}`} alt={song.album} className="w-full h-full object-cover" />
                      ) : (
                        <Disc size={22} className="text-slate-700" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className={`text-sm font-bold truncate ${isCurrent ? 'text-cyan-300' : 'text-slate-100'}`}>
                        {song.title || song.filename}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">
                        {song.artist || 'Unknown Artist'} • {song.album || 'Unknown Album'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 ml-2">
                    <span className="text-xs font-semibold text-slate-400 font-mono">
                      {formatTime(song.duration)}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToQueue(song);
                      }}
                      title="Tambah ke Queue"
                      className="p-2 rounded-xl glass-pill text-slate-400 hover:text-cyan-300"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
              <Music2 size={48} className="text-slate-700" />
              <p className="text-sm font-semibold">Tidak ada lagu yang cocok dengan "{searchTerm}".</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
