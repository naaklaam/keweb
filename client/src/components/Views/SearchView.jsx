import React, { memo, useState, useEffect } from 'react';
import {
  Play, Plus, Disc, FolderPlus, ArrowLeft, Music2,
  ShieldCheck, ListMusic, Trash2, Search, X, Check
} from 'lucide-react';
import PlaylistCoverGrid from '../Common/PlaylistCoverGrid';

function SearchView({
  songs = [],
  onPlayList,
  onAddToQueue,
  currentSong,
  searchQuery = '',
  setSearchQuery,
}) {
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'album', 'artist', 'hires', 'custom'
  const [internalQuery, setInternalQuery] = useState('');
  const query = searchQuery !== undefined ? searchQuery : internalQuery;
  const updateQuery = setSearchQuery || setInternalQuery;
  const [serverPlaylists, setServerPlaylists] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isSongPickerOpen, setIsSongPickerOpen] = useState(false);
  const [songPickerQuery, setSongPickerQuery] = useState('');

  // Playlists live on the server (playlists + playlist_songs tables)
  const loadPlaylists = async () => {
    try {
      const res = await fetch('/api/playlists');
      if (!res.ok) return;
      setServerPlaylists(await res.json());
    } catch (e) {
      console.error('Failed to load playlists:', e);
    }
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const fetchPlaylistDetail = async (id) => {
    try {
      const res = await fetch(`/api/playlists/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('Failed to load playlist:', e);
      return null;
    }
  };

  const openPlaylist = async (item) => {
    if (item.type === 'custom') {
      const detail = await fetchPlaylistDetail(item.id);
      if (!detail) return;
      setSelectedPlaylist({
        ...detail,
        type: 'custom',
        isHiRes: false,
        artist: null,
        title: detail.name,
        subtitle: `${detail.songs.length} Lagu`,
        coverSongIds: detail.cover_song_ids || (detail.songs ? detail.songs.filter(s => s.has_cover).slice(0, 4).map(s => s.id) : []),
      });
    } else {
      setSelectedPlaylist(item);
    }
  };

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
        coverSongIds: song.has_cover ? [song.id] : [],
        songs: [],
        isHiRes: false,
      };
    }
    albumMap[albumName].songs.push(song);
    if (albumMap[albumName].coverSongIds.length === 0 && song.has_cover) {
      albumMap[albumName].coverSongIds = [song.id];
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
        coverSongIds: song.has_cover ? [song.id] : [],
        songs: [],
        isHiRes: false,
      };
    }
    artistMap[artistName].songs.push(song);
    if (artistMap[artistName].coverSongIds.length === 0 && song.has_cover) {
      artistMap[artistName].coverSongIds = [song.id];
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
      coverSongIds: hiResSongs.filter(s => s.has_cover).slice(0, 4).map(s => s.id),
      songs: hiResSongs,
      isHiRes: true,
    });
  }

  // Server-backed custom playlists
  const userPlaylists = serverPlaylists.map(pl => ({
    id: String(pl.id),
    type: 'custom',
    title: pl.name,
    subtitle: `${pl.song_count} Lagu`,
    song_count: pl.song_count,
    coverSongIds: pl.cover_song_ids || [],
    songs: [],
    isHiRes: false,
  }));

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

  if (query.trim()) {
    const q = query.toLowerCase();
    allItems = allItems.filter(item =>
      item.title.toLowerCase().includes(q) ||
      (item.artist && item.artist.toLowerCase().includes(q)) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
      (item.songs && item.songs.some(s =>
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.artist && s.artist.toLowerCase().includes(q))
      ))
    );
  }

  const handleCreatePlaylist = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlaylistName.trim() }),
      });
      if (res.ok) {
        await loadPlaylists();
        const created = await res.json();
        // Automatically open the new playlist
        openPlaylist({ id: String(created.id), type: 'custom', title: created.name });
      }
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
    setNewPlaylistName('');
    setIsCreating(false);
  };

  const handleDeleteCustomPlaylist = async (e, plId) => {
    e.stopPropagation();
    try {
      await fetch(`/api/playlists/${plId}`, { method: 'DELETE' });
      await loadPlaylists();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
    if (selectedPlaylist && String(selectedPlaylist.id) === String(plId)) {
      setSelectedPlaylist(null);
    }
  };

  const handleAddSongToSelectedPlaylist = async (song) => {
    if (!selectedPlaylist || selectedPlaylist.type !== 'custom') return;
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylist.id}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: song.id }),
      });
      if (res.ok) {
        const detail = await fetchPlaylistDetail(selectedPlaylist.id);
        if (detail) {
          setSelectedPlaylist({
            ...detail,
            type: 'custom',
            isHiRes: false,
            artist: null,
            title: detail.name,
            subtitle: `${detail.songs.length} Lagu`,
            coverSongIds: detail.cover_song_ids || (detail.songs ? detail.songs.filter(s => s.has_cover).slice(0, 4).map(s => s.id) : []),
          });
        }
        await loadPlaylists();
      }
    } catch (err) {
      console.error('Failed to add song to playlist:', err);
    }
  };

  const handleRemoveSongFromSelectedPlaylist = async (songId) => {
    if (!selectedPlaylist || selectedPlaylist.type !== 'custom') return;
    try {
      const res = await fetch(`/api/playlists/${selectedPlaylist.id}/songs/${songId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const detail = await fetchPlaylistDetail(selectedPlaylist.id);
        if (detail) {
          setSelectedPlaylist({
            ...detail,
            type: 'custom',
            isHiRes: false,
            artist: null,
            title: detail.name,
            subtitle: `${detail.songs.length} Lagu`,
            coverSongIds: detail.cover_song_ids || (detail.songs ? detail.songs.filter(s => s.has_cover).slice(0, 4).map(s => s.id) : []),
          });
        }
        await loadPlaylists();
      }
    } catch (err) {
      console.error('Failed to remove song from playlist:', err);
    }
  };

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Resolve songs for a collection, loading server playlists on demand
  const songsFor = async (item) => {
    if (item.songs && item.songs.length > 0) return item.songs;
    if (item.type === 'custom') {
      const detail = await fetchPlaylistDetail(item.id);
      return detail ? detail.songs : [];
    }
    return [];
  };

  const playPlaylist = async (item, e) => {
    if (e) e.stopPropagation();
    const list = await songsFor(item);
    if (!list || list.length === 0) return;
    onPlayList(list, 0);
  };

  const addPlaylistToQueue = async (item, e) => {
    if (e) e.stopPropagation();
    const list = await songsFor(item);
    if (!list) return;
    list.forEach(song => onAddToQueue(song));
  };

  // Render Playlist Detail View if a playlist is selected
  if (selectedPlaylist) {
    const totalSecs = selectedPlaylist.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
    const currentCoverIds = selectedPlaylist.coverSongIds || (selectedPlaylist.songs ? selectedPlaylist.songs.filter(s => s.has_cover).slice(0, 4).map(s => s.id) : []);

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

            {/* 4-Grid or Single Cover Image Box */}
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-xl relative group">
              <PlaylistCoverGrid coverSongIds={currentCoverIds} fallbackIconSize={44} />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center space-x-2">
                {selectedPlaylist.type === 'custom' ? (
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-black text-[#FFC107] border border-[#FFC107]/40 tracking-wider">
                    CUSTOM PLAYLIST
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-black text-[#FFC107] border border-[#FFC107]/40">
                    {selectedPlaylist.type}
                  </span>
                )}
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
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
            {selectedPlaylist.type === 'custom' && (
              <button
                onClick={() => setIsSongPickerOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-3 rounded-2xl bg-black text-[#FFC107] border-2 border-[#FFC107] font-bold text-xs shadow-lg shadow-[#FFC107]/20 hover:scale-105 active:scale-95 transition-all"
                title="Tambah Lagu ke Playlist Ini"
              >
                <Plus size={16} />
                <span>+ Tambah Lagu</span>
              </button>
            )}

            <button
              onClick={() => playPlaylist(selectedPlaylist)}
              disabled={!selectedPlaylist.songs || selectedPlaylist.songs.length === 0}
              className="flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-black text-[#FFC107] border-2 border-[#FFC107] font-bold text-xs shadow-lg shadow-[#FFC107]/25 hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
            >
              <Play size={16} className="fill-[#FFC107] text-[#FFC107]" />
              <span>Putar Semua</span>
            </button>

            <button
              onClick={() => addPlaylistToQueue(selectedPlaylist)}
              disabled={!selectedPlaylist.songs || selectedPlaylist.songs.length === 0}
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl bg-black/40 border border-white/20 text-slate-200 hover:text-white font-bold text-xs transition-all disabled:opacity-40"
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
                    onClick={() => onPlayList(selectedPlaylist.songs, index)}
                    className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all ${
                      isCurrent
                        ? 'bg-black border-2 border-[#FFC107] text-white shadow-lg shadow-[#FFC107]/15'
                        : 'hover:bg-white/5 border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-4 min-w-0 flex-1">
                      <span className={`w-6 text-center text-xs font-bold ${isCurrent ? 'text-[#FFC107]' : 'text-slate-500 group-hover:text-[#FFC107]'}`}>
                        {isCurrent ? '▶' : index + 1}
                      </span>

                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {song.has_cover ? (
                          <img loading="lazy" src={`/api/cover/${song.id}`} alt={song.album} className="w-full h-full object-cover" />
                        ) : (
                          <Disc size={20} className="text-slate-700" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm font-bold truncate ${isCurrent ? 'text-[#FFC107]' : 'text-slate-100'}`}>
                          {song.title || song.filename}
                        </h3>
                        <p className="text-xs text-slate-400 truncate">
                          {song.artist || 'Unknown Artist'} • {song.album || 'Unknown Album'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-2">
                      <span className="text-xs font-semibold text-slate-400 font-mono mr-1">
                        {formatTime(song.duration)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddToQueue(song);
                        }}
                        title="Tambah ke Queue"
                        className="p-1.5 text-slate-400 hover:text-[#FFC107] transition-colors"
                      >
                        <Plus size={16} />
                      </button>

                      {/* Remove Song from Custom Playlist Button */}
                      {selectedPlaylist.type === 'custom' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSongFromSelectedPlaylist(song.id);
                          }}
                          title="Hapus dari Playlist"
                          className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
                <Disc size={56} className="text-slate-700 animate-spin-slow" />
                <p className="text-sm font-bold text-slate-300">Playlist ini belum berisi lagu.</p>
                {selectedPlaylist.type === 'custom' && (
                  <button
                    onClick={() => setIsSongPickerOpen(true)}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-2xl bg-black text-[#FFC107] border-2 border-[#FFC107] font-bold text-xs shadow-lg shadow-[#FFC107]/25 hover:scale-105 active:scale-95 transition-all"
                  >
                    <Plus size={16} />
                    <span>+ Tambah Lagu ke Playlist</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal: Pick Songs to Add to Selected Custom Playlist */}
        {isSongPickerOpen && selectedPlaylist && selectedPlaylist.type === 'custom' && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-panel p-5 sm:p-6 rounded-3xl w-full max-w-xl space-y-4 border border-[#FFC107]/30 shadow-2xl flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                    <ListMusic size={20} className="text-[#FFC107]" />
                    <span>Tambah Lagu ke {selectedPlaylist.title}</span>
                  </h3>
                  <p className="text-xs text-slate-400">Pilih lagu dari library untuk dimasukkan ke playlist</p>
                </div>
                <button
                  onClick={() => setIsSongPickerOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search Bar inside Picker */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#FFC107]" />
                <input
                  type="text"
                  placeholder="Cari lagu berdasarkan judul, artis, atau album..."
                  value={songPickerQuery}
                  onChange={(e) => setSongPickerQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFC107]"
                />
              </div>

              {/* Songs List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[250px]">
                {songs
                  .filter(s => {
                    if (!songPickerQuery.trim()) return true;
                    const q = songPickerQuery.toLowerCase();
                    return (
                      (s.title && s.title.toLowerCase().includes(q)) ||
                      (s.artist && s.artist.toLowerCase().includes(q)) ||
                      (s.album && s.album.toLowerCase().includes(q)) ||
                      (s.filename && s.filename.toLowerCase().includes(q))
                    );
                  })
                  .slice(0, 100)
                  .map(song => {
                    const alreadyInPlaylist = selectedPlaylist.songs.some(ps => ps.id === song.id);
                    return (
                      <div
                        key={song.id}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                          alreadyInPlaylist
                            ? 'bg-[#FFC107]/5 border-[#FFC107]/20 text-[#FFC107]'
                            : 'bg-black/40 hover:bg-white/5 border-white/10 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {song.has_cover ? (
                              <img loading="lazy" src={`/api/cover/${song.id}`} alt={song.album} className="w-full h-full object-cover" />
                            ) : (
                              <Disc size={20} className="text-slate-700" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate">{song.title || song.filename}</h4>
                            <p className="text-[11px] text-slate-400 truncate">{song.artist || 'Unknown Artist'} • {song.album || 'Unknown Album'}</p>
                          </div>
                        </div>

                        <div className="ml-2 flex-shrink-0">
                          {alreadyInPlaylist ? (
                            <button
                              onClick={() => handleRemoveSongFromSelectedPlaylist(song.id)}
                              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Hapus dari Playlist"
                            >
                              <Check size={14} className="text-[#FFC107]" />
                              <span>Ada (Hapus)</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAddSongToSelectedPlaylist(song)}
                              className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-black text-[#FFC107] border border-[#FFC107]/40 text-xs font-bold hover:bg-[#FFC107]/10 transition-all"
                            >
                              <Plus size={14} />
                              <span>Tambah</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Modal Footer */}
              <div className="pt-2 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setIsSongPickerOpen(false)}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Grid View of Playlists & Albums
  return (
    <div className="flex flex-col h-full overflow-hidden px-4 md:px-8 py-2 md:py-3 space-y-3 max-w-7xl mx-auto w-full">
      {/* Sleek Minimalist Filter Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs [touch-action:pan-x] flex-shrink-0">
        <div className="flex items-center space-x-2">
          {[
            { id: 'all', label: 'Semua' },
            { id: 'custom', label: 'Custom' },
            { id: 'album', label: 'Album' },
            { id: 'artist', label: 'Artist' },
            { id: 'hires', label: 'Hi-Res' },
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3.5 py-1.5 rounded-full transition-all whitespace-nowrap text-xs font-semibold ${
                activeFilter === filter.id
                  ? 'bg-[#FFC107] text-black font-extrabold shadow-md shadow-[#FFC107]/20'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 hover:border-white/20'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline-block">
            {allItems.length} Koleksi
          </span>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-white/5 text-[#FFC107] border border-[#FFC107]/40 font-bold hover:bg-[#FFC107]/10 transition-all whitespace-nowrap shadow-sm text-xs"
          >
            <FolderPlus size={14} />
            <span>+ Playlist</span>
          </button>
        </div>
      </div>

      {/* Query Search Filter Feedback */}
      {query.trim() && (
        <div className="flex items-center justify-between text-xs text-slate-400 px-1 py-0.5 flex-shrink-0">
          <span>Hasil pencarian untuk <span className="text-white font-semibold">"{query}"</span> ({allItems.length} ditemukan)</span>
          <button
            onClick={() => updateQuery('')}
            className="text-[11px] text-[#FFC107] hover:underline font-semibold"
          >
            Hapus Filter
          </button>
        </div>
      )}

      {/* Modal Dialog: Create Playlist */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <form onSubmit={handleCreatePlaylist} className="glass-panel p-6 rounded-3xl w-full max-w-md space-y-4 border border-[#FFC107]/30 shadow-2xl">
            <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
              <FolderPlus size={20} className="text-[#FFC107]" />
              <span>Buat Playlist Custom Baru</span>
            </h3>
            <input
              type="text"
              placeholder="Nama Playlist (contoh: Chill FLAC, Pop 90s)..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              autoFocus
              className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FFC107]"
            />
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-black/40 border border-white/20"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-black text-[#FFC107] border-2 border-[#FFC107] hover:bg-[#FFC107]/10 shadow-md"
              >
                Buat Playlist
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Playlist & Album Cards Grid */}
      <div className="flex-1 overflow-y-auto pr-1 scroll-fade-edge pt-2">
        {allItems.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5 pb-8">
            {allItems.map((item) => (
              <div
                key={item.id}
                onClick={() => openPlaylist(item)}
                className="group relative flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1"
              >
                {/* Cover Image Artwork (Frameless & Borderless Card) */}
                <div className="w-full aspect-square rounded-2xl bg-slate-950/80 border border-white/10 overflow-hidden relative mb-2.5 flex items-center justify-center shadow-md group-hover:shadow-xl group-hover:border-white/30 transition-all duration-300">
                  <PlaylistCoverGrid
                    coverSongIds={item.coverSongIds || (item.songs ? item.songs.filter(s => s.has_cover).slice(0, 4).map(s => s.id) : [])}
                    fallbackIconSize={48}
                  />

                  {/* Badges Overlay */}
                  <div className="absolute top-2 left-2 flex flex-col gap-1 pointer-events-none">
                    {item.type === 'custom' && (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-black text-[#FFC107] border border-[#FFC107]/50 backdrop-blur-md shadow-md">
                        Custom
                      </span>
                    )}
                    {item.isHiRes && (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-purple-950/80 text-purple-300 border border-purple-500/40 backdrop-blur-sm">
                        24-BIT
                      </span>
                    )}
                  </div>

                  {/* Custom Playlist Delete Button */}
                  {item.type === 'custom' && (
                    <button
                      onClick={(e) => handleDeleteCustomPlaylist(e, item.id)}
                      title="Hapus Playlist"
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-950/80 text-rose-400 border border-rose-500/40 opacity-0 group-hover:opacity-100 hover:bg-rose-600 hover:text-white transition-all z-10"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}

                  {/* Hover Overlay Actions */}
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-opacity duration-300 flex items-center justify-center space-x-3 z-0">
                    <button
                      onClick={(e) => playPlaylist(item, e)}
                      title="Putar Playlist"
                      className="p-3 rounded-full bg-black text-[#FFC107] border-2 border-[#FFC107] hover:scale-110 active:scale-95 shadow-lg shadow-[#FFC107]/30 transition-all"
                    >
                      <Play size={18} className="fill-[#FFC107] text-[#FFC107] ml-0.5" />
                    </button>
                    <button
                      onClick={(e) => addPlaylistToQueue(item, e)}
                      title="Tambah ke Antrean"
                      className="p-3 rounded-full bg-black/60 border border-white/30 text-white hover:scale-110 active:scale-95 transition-all"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* Card Title & Info */}
                <div className="min-w-0 flex-1 space-y-0.5 px-0.5">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-[#FFC107] transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    {item.artist || item.subtitle || `${item.songs ? item.songs.length : 0} Lagu`}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {(item.song_count ?? (item.songs ? item.songs.length : 0))} Tracks
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Disc size={48} className="text-slate-700 animate-pulse" />
            <p className="text-sm font-semibold">
              {query.trim() ? `Tidak ada hasil untuk "${query}"` : 'Tidak ada playlist atau album yang ditemukan.'}
            </p>
            {query.trim() && (
              <button
                onClick={() => updateQuery('')}
                className="text-xs px-3.5 py-1.5 rounded-full bg-white/5 text-[#FFC107] border border-[#FFC107]/30 hover:bg-[#FFC107]/10 transition-colors font-medium"
              >
                Reset Pencarian
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(SearchView);