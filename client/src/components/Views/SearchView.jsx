import React, { useState, useEffect } from 'react';
import {
  Play, Plus, Disc, FolderPlus, ArrowLeft, Music2,
  ShieldCheck, ListMusic, Sparkles, Trash2, Search, Check
} from 'lucide-react';

export default function SearchView({ songs, onPlaySong, onAddToQueue, currentSong }) {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'album', 'artist', 'hires', 'custom'
  const [searchQuery, setSearchQuery] = useState('');
  const [customPlaylists, setCustomPlaylists] = useState(() => {
    try {
      const saved = localStorage.getItem('keweb_custom_playlists');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  // Save custom playlists to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('keweb_custom_playlists', JSON.stringify(customPlaylists));
    } catch (e) {}
  }, [customPlaylists]);

  // Group songs into Albums
  const albumMap = {};
  songs.forEach((song) => {
    const albumName = song.album || 'Unknown Album';
    if (!albumMap[albumName]) {
      albumMap[albumName] = {
        id: `album-${albumName}`,
        type: 'album',
        title: albumName,
        artist: song.artist || 'Unknown Artist',
        coverSongId: song.has_cover ? song.id : null,
        songs: [],
        isHiRes: false,
      };
    }
    albumMap[albumName].songs.push(song);
    if (!albumMap[albumName].coverSongId && song.has_cover) {
      albumMap[albumName].coverSongId = song.id;
    }
    if (song.bits_per_sample > 16 || song.sample_rate > 44100) {
      albumMap[albumName].isHiRes = true;
    }
  });

  const albums = Object.values(albumMap);

  // Group songs into Artists
  const artistMap = {};
  songs.forEach((song) => {
    const artistName = song.artist || 'Unknown Artist';
    if (!artistMap[artistName]) {
      artistMap[artistName] = {
        id: `artist-${artistName}`,
        type: 'artist',
        title: artistName,
        subtitle: `${artistName} Collection`,
        coverSongId: song.has_cover ? song.id : null,
        songs: [],
        isHiRes: false,
      };
    }
    artistMap[artistName].songs.push(song);
    if (!artistMap[artistName].coverSongId && song.has_cover) {
      artistMap[artistName].coverSongId = song.id;
    }
  });

  const artists = Object.values(artistMap);

  // Curated Hi-Res Playlist
  const hiResSongs = songs.filter(s => s.bits_per_sample > 16 || s.sample_rate > 44100);
  const curatedPlaylists = [];

  if (hiResSongs.length > 0) {
    curatedPlaylists.push({
      id: 'curated-hires',
      type: 'curated',
      title: 'Hi-Res Lossless FLAC',
      subtitle: '24-bit / 96kHz Collection',
      coverSongId: hiResSongs.find(s => s.has_cover)?.id || hiResSongs[0]?.id,
      songs: hiResSongs,
      isHiRes: true,
    });
  }

  // Map custom playlists
  const userPlaylists = customPlaylists.map(pl => {
    const plSongs = songs.filter(s => pl.songIds.includes(s.id));
    return {
      id: pl.id,
      type: 'custom',
      title: pl.name,
      subtitle: `${plSongs.length} Songs`,
      coverSongId: plSongs.find(s => s.has_cover)?.id || null,
      songs: plSongs,
      rawCustom: pl,
    };
  });

  // Filter items for grid display
  let allItems = [];
  if (activeFilter === 'all') {
    allItems = [...curatedPlaylists, ...userPlaylists, ...albums];
  } else if (activeFilter === 'album') {
    allItems = albums;
  } else if (activeFilter === 'artist') {
    allItems = artists;
  } else if (activeFilter === 'hires') {
    allItems = [...curatedPlaylists, ...albums.filter(a => a.isHiRes)];
  } else if (activeFilter === 'custom') {
    allItems = userPlaylists;
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    allItems = allItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.artist && item.artist.toLowerCase().includes(q)) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );
  }

  const handleCreatePlaylist = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    const newPl = {
      id: `custom-${Date.now()}`,
      name: newPlaylistName.trim(),
      songIds: [],
    };
    setCustomPlaylists(prev => [...prev, newPl]);
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const handleDeleteCustomPlaylist = (e, plId) => {
    e.stopPropagation();
    setCustomPlaylists(prev => prev.filter(p => p.id !== plId));
    if (selectedPlaylist && selectedPlaylist.id === plId) {
      setSelectedPlaylist(null);
    }
  };

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const playPlaylist = (pl, e) => {
    if (e) e.stopPropagation();
    if (!pl.songs || pl.songs.length === 0) return;
    onPlaySong(pl.songs[0]);
    for (let i = 1; i < pl.songs.length; i++) {
      onAddToQueue(pl.songs[i]);
    }
  };

  const addPlaylistToQueue = (pl, e) => {
    if (e) e.stopPropagation();
    if (!pl.songs) return;
    pl.songs.forEach(song => onAddToQueue(song));
  };

  // Render Playlist Detail View if a playlist is selected
  if (selectedPlaylist) {
    const totalSecs = selectedPlaylist.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
    return (
      <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4 max-w-6xl mx-auto w-full">
        {/* Detail Header Bar */}
        <div className="glass-panel p-4 sm:p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4 sm:space-x-6 min-w-0">
            <button
              onClick={() => setSelectedPlaylist(null)}
              className="p-3 rounded-2xl glass-pill text-slate-300 hover:text-white transition-all hover:scale-105 active:scale-95 flex-shrink-0"
              title="Kembali ke Daftar Playlist"
            >
              <ArrowLeft size={20} />
            </button>

            {/* Cover image large */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xl relative group">
              {selectedPlaylist.coverSongId ? (
                <img
                  src={`/api/cover/${selectedPlaylist.coverSongId}`}
                  alt={selectedPlaylist.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Disc size={44} className="text-slate-700" />
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {selectedPlaylist.type}
                </span>
                {selectedPlaylist.isHiRes && (
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center space-x-1">
                    <ShieldCheck size={11} />
                    <span>HI-RES</span>
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white truncate">
                {selectedPlaylist.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                {selectedPlaylist.artist || selectedPlaylist.subtitle || 'Koleksi Audio'} • {selectedPlaylist.songs.length} Lagu • {formatTime(totalSecs)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            <button
              onClick={() => playPlaylist(selectedPlaylist)}
              disabled={selectedPlaylist.songs.length === 0}
              className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
            >
              <Play size={16} className="fill-slate-950" />
              <span>Putar Semua</span>
            </button>

            <button
              onClick={() => addPlaylistToQueue(selectedPlaylist)}
              disabled={selectedPlaylist.songs.length === 0}
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl glass-pill text-slate-200 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
              title="Tambah semua ke Antrean"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Tambah ke Antrean</span>
            </button>
          </div>
        </div>

        {/* Songs List Table */}
        <div className="glass-panel rounded-3xl flex-1 overflow-hidden flex flex-col">
          <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-2">
            {selectedPlaylist.songs.length > 0 ? (
              selectedPlaylist.songs.map((song, index) => {
                const isCurrent = currentSong && currentSong.id === song.id;
                return (
                  <div
                    key={`${song.id}-${index}`}
                    onClick={() => onPlaySong(song)}
                    className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-cyan-500/15 border border-cyan-500/30 text-white shadow-md'
                        : 'hover:bg-white/5 border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <span className={`w-6 text-center text-xs font-bold ${isCurrent ? 'text-cyan-400' : 'text-slate-500'}`}>
                        {isCurrent ? '▶' : index + 1}
                      </span>

                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {song.has_cover ? (
                          <img src={`/api/cover/${song.id}`} alt={song.album} className="w-full h-full object-cover" />
                        ) : (
                          <Disc size={20} className="text-slate-700" />
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
                <p className="text-sm font-semibold">Playlist ini belum berisi lagu.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Grid View of Playlists & Albums
  return (
    <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4 max-w-6xl mx-auto w-full">
      {/* Header & Filter Controls Bar */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Title & Stats */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-500/20 to-sky-500/20 border border-cyan-500/30 rounded-2xl text-cyan-400">
            <ListMusic size={22} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white tracking-tight">PLAYLIST & ALBUM COLLECTIONS</h2>
            <p className="text-xs text-slate-400">{allItems.length} Koleksi tersedia</p>
          </div>
        </div>

        {/* Filter Pills & Actions */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 text-xs">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'album', label: 'Album' },
            { id: 'artist', label: 'Artist' },
            { id: 'hires', label: 'Hi-Res' },
            { id: 'custom', label: 'Custom' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeFilter === filter.id
                  ? 'bg-gradient-to-r from-cyan-500 to-sky-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'glass-pill text-slate-400 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}

          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold hover:bg-cyan-500/20 transition-all whitespace-nowrap"
          >
            <FolderPlus size={14} />
            <span>+ Playlist</span>
          </button>
        </div>
      </div>

      {/* Quick Search & Create Modal Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan-400" />
          <input
            type="text"
            placeholder="Cari album, playlist, atau artist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900/90 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors shadow-inner"
          />
        </div>
      </div>

      {/* Modal Dialog: Create Playlist */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleCreatePlaylist} className="glass-panel p-6 rounded-3xl w-full max-w-md space-y-4 border border-cyan-500/30 shadow-2xl">
            <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
              <FolderPlus size={20} className="text-cyan-400" />
              <span>Buat Playlist Baru</span>
            </h3>
            <input
              type="text"
              placeholder="Nama Playlist (contoh: Chill FLAC, Pop 90s)..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              autoFocus
              className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white glass-pill"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400 shadow-md"
              >
                Buat Playlist
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Playlist & Album Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-1">
        {allItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6 pb-6">
            {allItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedPlaylist(item)}
                className="group relative flex flex-col bg-slate-900/40 hover:bg-slate-800/70 border border-white/10 hover:border-cyan-500/40 rounded-2xl p-3 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-cyan-500/10 hover:-translate-y-1 backdrop-blur-sm"
              >
                {/* Card Image Box */}
                <div className="w-full aspect-square rounded-xl bg-slate-950/80 border border-white/10 overflow-hidden relative mb-3 flex items-center justify-center shadow-inner">
                  {item.coverSongId ? (
                    <img
                      src={`/api/cover/${item.coverSongId}`}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <Disc size={48} className="text-slate-700 group-hover:text-cyan-500/50 transition-colors" />
                  )}

                  {/* Hi-Res Badge Overlay */}
                  {item.isHiRes && (
                    <span className="absolute top-2 left-2 text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-500/40 backdrop-blur-sm">
                      24-BIT
                    </span>
                  )}

                  {/* Custom Playlist Delete Button */}
                  {item.type === 'custom' && (
                    <button
                      onClick={(e) => handleDeleteCustomPlaylist(e, item.id)}
                      title="Hapus Playlist"
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-500/40 opacity-0 group-hover:opacity-100 hover:bg-rose-600 hover:text-white transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}

                  {/* Hover Overlay Actions */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-opacity duration-300 flex items-center justify-center space-x-3">
                    <button
                      onClick={(e) => playPlaylist(item, e)}
                      title="Putar Playlist"
                      className="p-3 rounded-full bg-cyan-500 text-slate-950 hover:scale-110 active:scale-95 shadow-lg shadow-cyan-500/40 transition-all"
                    >
                      <Play size={18} className="fill-slate-950 ml-0.5" />
                    </button>
                    <button
                      onClick={(e) => addPlaylistToQueue(item, e)}
                      title="Tambah ke Antrean"
                      className="p-3 rounded-full glass-pill text-white hover:scale-110 active:scale-95 transition-all"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* Card Title & Info */}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-cyan-300 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {item.artist || item.subtitle || `${item.songs.length} Lagu`}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {item.songs.length} Tracks
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Disc size={48} className="text-slate-700 animate-pulse" />
            <p className="text-sm font-semibold">Tidak ada playlist atau album yang ditemukan.</p>
          </div>
        )}
      </div>
    </div>
  );
}
