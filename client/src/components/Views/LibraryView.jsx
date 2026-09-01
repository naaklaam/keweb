import React, { useState } from 'react';
import { Play, Plus, Search, Disc, ArrowUpDown, Music2, ShieldCheck } from 'lucide-react';

export default function LibraryView({ songs, onPlaySong, onAddToQueue, currentSong }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');

  const filteredSongs = songs.filter(song => {
    const term = searchTerm.toLowerCase();
    return (
      (song.title && song.title.toLowerCase().includes(term)) ||
      (song.artist && song.artist.toLowerCase().includes(term)) ||
      (song.album && song.album.toLowerCase().includes(term)) ||
      (song.filename && song.filename.toLowerCase().includes(term))
    );
  });

  const sortedSongs = [...filteredSongs].sort((a, b) => {
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4">
      {/* Search Bar & Filter Options */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FFC107]" />
          <input
            type="text"
            placeholder="Cari lagu, artist, atau album..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFC107]/60 transition-colors"
          />
        </div>

        {/* Sort Pill Buttons */}
        <div className="flex items-center space-x-2 text-xs overflow-x-auto w-full sm:w-auto">
          <span className="text-slate-400 font-semibold mr-1 flex items-center space-x-1">
            <ArrowUpDown size={13} />
            <span>Urutkan:</span>
          </span>
          {[
            { id: 'title', label: 'Judul' },
            { id: 'artist', label: 'Artist' },
            { id: 'album', label: 'Album' },
            { id: 'duration', label: 'Durasi' },
            { id: 'bits_per_sample', label: 'Hi-Res' }
          ].map(field => (
            <button
              key={field.id}
              onClick={() => toggleSort(field.id)}
              className={`px-3 py-1.5 rounded-xl transition-all ${
                sortField === field.id
                  ? 'bg-black text-[#FFC107] border-2 border-[#FFC107] shadow-md shadow-[#FFC107]/20 font-bold'
                  : 'bg-black/40 text-slate-400 border border-white/20 hover:text-white'
              }`}
            >
              {field.label} {sortField === field.id ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Song Table & List */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {sortedSongs.length > 0 ? (
          sortedSongs.map((song, index) => {
            const isCurrent = currentSong && currentSong.id === song.id;
            const isHiRes = song.bits_per_sample > 16 || song.sample_rate > 44100;
            return (
              <div
                key={song.id}
                onClick={() => onPlaySong(song)}
                className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all duration-200 ${
                  isCurrent
                    ? 'bg-black/70 border-2 border-[#FFC107] text-white shadow-lg shadow-[#FFC107]/15'
                    : 'bg-transparent border border-transparent hover:bg-white/5 text-slate-300'
                }`}
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                  <span className={`w-6 text-center text-xs font-bold ${isCurrent ? 'text-[#FFC107]' : 'text-slate-500 group-hover:text-[#FFC107]'}`}>
                    {isCurrent ? '▶' : index + 1}
                  </span>

                  {/* Album Art Thumbnail */}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-950/80 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-inner">
                    {song.has_cover ? (
                      <img src={`/api/cover/${song.id}`} alt={song.album} className="w-full h-full object-cover" />
                    ) : (
                      <Disc size={22} className="text-slate-700" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-[#FFC107]' : 'text-slate-100'}`}>
                      {song.title || song.filename}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                      {song.artist || 'Unknown Artist'} • <span className="text-slate-500">{song.album || 'Unknown Album'}</span>
                    </p>
                  </div>
                </div>

                {/* Right: Spec Badges, Duration & Actions */}
                <div className="flex items-center space-x-3 sm:space-x-4 ml-2">
                  {isHiRes && (
                    <span className="hidden md:flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[10px] font-bold backdrop-blur-sm">
                      <ShieldCheck size={11} />
                      <span>{song.bits_per_sample || 24}-BIT</span>
                    </span>
                  )}

                  <span className="text-xs font-semibold text-slate-400 font-mono">
                    {formatTime(song.duration)}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToQueue(song);
                    }}
                    title="Tambah ke Queue"
                    className="p-2 rounded-xl glass-pill text-slate-400 hover:text-[#FFC107] opacity-0 group-hover:opacity-100 transition-opacity"
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
            <p className="text-sm font-semibold">Tidak ada lagu yang cocok dengan pencarian.</p>
          </div>
        )}
      </div>
    </div>
  );
}
