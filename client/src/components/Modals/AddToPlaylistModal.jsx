import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Check, Plus, Disc, ListMusic } from 'lucide-react';
import PlaylistCoverGrid from '../Common/PlaylistCoverGrid';

export default function AddToPlaylistModal({ song, isOpen, onClose, onPlaylistUpdated }) {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addedMap, setAddedMap] = useState({}); // { [playlistId]: true }
  const [statusMsg, setStatusMsg] = useState('');

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/playlists');
      if (res.ok) {
        setPlaylists(await res.json());
      }
    } catch (e) {
      console.error('Failed to load playlists:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && song) {
      loadPlaylists();
      setAddedMap({});
      setStatusMsg('');
      setIsCreating(false);
      setNewPlaylistName('');
    }
  }, [isOpen, song]);

  if (!isOpen || !song) return null;

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
        const created = await res.json();
        setNewPlaylistName('');
        setIsCreating(false);
        // Automatically add song to the newly created playlist
        await handleAddSongToPlaylist(created.id, created.name);
        await loadPlaylists();
      }
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  };

  const handleAddSongToPlaylist = async (playlistId, playlistName) => {
    try {
      const res = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songId: song.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddedMap(prev => ({ ...prev, [playlistId]: true }));
        setStatusMsg(`Ditambahkan ke "${playlistName}"`);
        if (onPlaylistUpdated) onPlaylistUpdated();
        setTimeout(() => setStatusMsg(''), 2500);
      }
    } catch (err) {
      console.error('Failed to add song to playlist:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel p-5 sm:p-6 rounded-3xl w-full max-w-md space-y-4 border border-[#FFC107]/30 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <ListMusic size={20} className="text-[#FFC107]" />
            <h3 className="text-base font-extrabold text-white">Tambah ke Playlist Custom</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Song Preview */}
        <div className="flex items-center space-x-3 p-2.5 rounded-2xl bg-white/5 border border-white/10">
          <div className="w-11 h-11 rounded-xl bg-slate-950 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
            {song.has_cover ? (
              <img
                loading="lazy"
                src={`/api/cover/${song.id}`}
                alt={song.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Disc size={20} className="text-slate-700" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-white truncate">{song.title || song.filename}</h4>
            <p className="text-[11px] text-slate-400 truncate">{song.artist || 'Unknown Artist'}</p>
          </div>
        </div>

        {/* Status Toast Message */}
        {statusMsg && (
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#FFC107]/20 border border-[#FFC107]/40 text-[#FFC107] text-xs font-semibold animate-fade-in">
            <Check size={14} />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Quick Create Playlist Form Toggle */}
        {isCreating ? (
          <form onSubmit={handleCreatePlaylist} className="flex items-center space-x-2 pt-1">
            <input
              type="text"
              placeholder="Nama Playlist Custom..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              autoFocus
              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFC107]"
            />
            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-black text-[#FFC107] border border-[#FFC107] hover:bg-[#FFC107]/10"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
            >
              Batal
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center justify-center space-x-2 w-full py-2.5 rounded-2xl border border-dashed border-[#FFC107]/40 text-[#FFC107] hover:bg-[#FFC107]/10 text-xs font-bold transition-all"
          >
            <FolderPlus size={15} />
            <span>+ Buat Playlist Custom Baru</span>
          </button>
        )}

        {/* Playlists List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-[260px]">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-xs text-slate-500">
              Memuat playlist custom...
            </div>
          ) : playlists.length > 0 ? (
            playlists.map((pl) => {
              const isAdded = addedMap[pl.id];
              return (
                <div
                  key={pl.id}
                  onClick={() => !isAdded && handleAddSongToPlaylist(pl.id, pl.name)}
                  className={`group flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                    isAdded
                      ? 'bg-[#FFC107]/10 border-[#FFC107]/40 text-[#FFC107]'
                      : 'bg-black/40 hover:bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 flex items-center justify-center shadow-inner">
                      <PlaylistCoverGrid coverSongIds={pl.cover_song_ids || []} fallbackIconSize={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-xs sm:text-sm font-bold text-white truncate">{pl.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 text-[#FFC107] border border-[#FFC107]/30">
                          Custom
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{pl.song_count || 0} Lagu</p>
                    </div>
                  </div>

                  <button
                    disabled={isAdded}
                    className={`p-2 rounded-xl transition-all ${
                      isAdded
                        ? 'text-[#FFC107]'
                        : 'text-slate-400 hover:text-[#FFC107]'
                    }`}
                  >
                    {isAdded ? <Check size={16} /> : <Plus size={16} />}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500 space-y-2">
              <Disc size={36} className="text-slate-700" />
              <p className="text-xs font-semibold">Belum ada playlist custom.</p>
              <p className="text-[11px] text-slate-600">Buat playlist pertama menggunakan tombol di atas.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 transition-all"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
