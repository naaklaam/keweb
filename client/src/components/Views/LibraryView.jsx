import React, { memo, useState, useMemo, useRef, useEffect } from 'react';
import { Play, Plus, Disc, Music2, ListPlus, ChevronLeft, ChevronRight } from 'lucide-react';

function LibraryView({
  songs = [],
  onPlaySong,
  onPlayList,
  onAddToQueue,
  onAddToPlaylist,
  currentSong,
  searchQuery = '',
}) {
  const [currentAlbumIndex, setCurrentAlbumIndex] = useState(0);
  const tracklistRef = useRef(null);
  const lastWheelTime = useRef(0);
  const touchStartY = useRef(0);

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Filter songs based on global searchQuery from header
  const filteredSongs = useMemo(() => {
    if (!searchQuery || !searchQuery.trim()) return songs;
    const q = searchQuery.toLowerCase();
    return songs.filter(song =>
      (song.title && song.title.toLowerCase().includes(q)) ||
      (song.artist && song.artist.toLowerCase().includes(q)) ||
      (song.album && song.album.toLowerCase().includes(q)) ||
      (song.filename && song.filename.toLowerCase().includes(q))
    );
  }, [songs, searchQuery]);

  // Group songs by Album for Dynamo (Cover) & Propeller (List)
  const albumGroups = useMemo(() => {
    const map = new Map();
    filteredSongs.forEach(song => {
      const albumName = song.album || 'Unknown Album';
      if (!map.has(albumName)) {
        map.set(albumName, {
          id: `album-${albumName}`,
          album: albumName,
          artist: song.artist || 'Unknown Artist',
          coverSongId: song.has_cover ? song.id : null,
          songs: [],
          isHiRes: false,
        });
      }
      const group = map.get(albumName);
      if (!group.coverSongId && song.has_cover) {
        group.coverSongId = song.id;
      }
      if (song.bits_per_sample > 16 || song.sample_rate > 44100) {
        group.isHiRes = true;
      }
      group.songs.push(song);
    });

    // Sort tracks inside each album by disc & track number
    map.forEach(group => {
      group.songs.sort((a, b) => {
        if (a.disc_number !== b.disc_number && a.disc_number && b.disc_number) {
          return a.disc_number - b.disc_number;
        }
        if (a.track_number && b.track_number) {
          return a.track_number - b.track_number;
        }
        return (a.title || '').localeCompare(b.title || '');
      });
    });

    return Array.from(map.values());
  }, [filteredSongs]);

  // Clamp currentAlbumIndex if album list changes
  useEffect(() => {
    if (currentAlbumIndex >= albumGroups.length) {
      setCurrentAlbumIndex(Math.max(0, albumGroups.length - 1));
    }
  }, [albumGroups.length, currentAlbumIndex]);

  // Reset tracklist scroll position to top whenever album changes
  useEffect(() => {
    if (tracklistRef.current) {
      tracklistRef.current.scrollTop = 0;
    }
  }, [currentAlbumIndex]);

  const currentAlbum = albumGroups[currentAlbumIndex] || null;

  // Dynamo Wheel Handler: scrolling over the cover changes album
  const handleDynamoWheel = (e) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 180) return;

    if (e.deltaY > 15) {
      setCurrentAlbumIndex(prev => Math.min(prev + 1, albumGroups.length - 1));
      lastWheelTime.current = now;
    } else if (e.deltaY < -15) {
      setCurrentAlbumIndex(prev => Math.max(prev - 1, 0));
      lastWheelTime.current = now;
    }
  };

  // Dynamo Touch Handlers for Mobile Swipe
  const handleDynamoTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleDynamoTouchEnd = (e) => {
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 35) {
      if (dy > 0) {
        setCurrentAlbumIndex(prev => Math.min(prev + 1, albumGroups.length - 1));
      } else {
        setCurrentAlbumIndex(prev => Math.max(prev - 1, 0));
      }
    }
  };

  if (!currentAlbum || albumGroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-24 text-slate-500 space-y-3">
        <Music2 size={48} className="text-slate-700 animate-pulse" />
        <p className="text-sm font-semibold">
          {searchQuery ? `Tidak ada lagu yang cocok dengan "${searchQuery}"` : 'Koleksi musik masih kosong.'}
        </p>
      </div>
    );
  }

  // Render a Single Track Item
  const renderTrackItem = (song, trackIdx) => {
    const isCurrent = currentSong && currentSong.id === song.id;
    const trackNum = song.track_number || trackIdx + 1;

    return (
      <div
        key={song.id}
        onClick={() => {
          if (onPlayList) onPlayList(currentAlbum.songs, trackIdx);
          else if (onPlaySong) onPlaySong(song);
        }}
        className={`group/track w-full flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl cursor-pointer transition-all duration-200 select-none ${
          isCurrent
            ? 'bg-[#FFC107]/15 border border-[#FFC107]/40 text-[#FFC107] shadow-sm'
            : 'hover:bg-white/5 border border-transparent text-slate-300 hover:text-white'
        }`}
      >
        {/* Left: Track Number & Large Typography */}
        <div className="flex items-center space-x-4 sm:space-x-5 min-w-0 flex-1 pr-4">
          <span className={`w-6 text-center font-mono text-sm sm:text-base font-bold flex-shrink-0 ${
            isCurrent ? 'text-[#FFC107]' : 'text-slate-500 group-hover/track:text-slate-300'
          }`}>
            {isCurrent ? '▶' : trackNum}
          </span>

          <div className="min-w-0 flex-1">
            <h4 className={`text-base sm:text-lg font-bold truncate leading-tight transition-colors ${
              isCurrent ? 'text-[#FFC107]' : 'text-white'
            }`}>
              {song.title || song.filename}
            </h4>
            <p className="text-xs sm:text-sm text-slate-400 truncate mt-1">
              {song.artist || currentAlbum.artist}
            </p>
          </div>
        </div>

        {/* Right: Duration & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4 flex-shrink-0">
          <span className="font-mono text-slate-400 text-sm sm:text-base font-medium w-12 text-right">
            {formatTime(song.duration)}
          </span>

          {/* Quick Hover Actions */}
          <div className="flex items-center space-x-1 opacity-0 group-hover/track:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToQueue && onAddToQueue(song);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#FFC107] hover:bg-white/10 transition-colors"
              title="Tambah ke Antrean"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddToPlaylist && onAddToPlaylist(song);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-[#FFC107] hover:bg-white/10 transition-colors"
              title="Tambah ke Playlist"
            >
              <ListPlus size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex items-center justify-center h-full overflow-hidden px-4 sm:px-8 md:px-12 py-4 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row items-center md:items-stretch gap-6 sm:gap-8 md:gap-12 lg:gap-16 w-full max-h-[85vh]">
        {/* ========================================================================= */}
        {/* DINAMO: COVER ALBUM DI KIRI (SCROLL COVER = GANTI ALBUM)                   */}
        {/* ========================================================================= */}
        <div className="flex flex-col flex-shrink-0 items-center md:items-start justify-center">
          {/* Cover Frame: Width & Height Locked */}
          <div
            onWheel={handleDynamoWheel}
            onTouchStart={handleDynamoTouchStart}
            onTouchEnd={handleDynamoTouchEnd}
            onClick={() => {
              if (onPlayList) onPlayList(currentAlbum.songs, 0);
              else if (onPlaySong) onPlaySong(currentAlbum.songs[0]);
            }}
            className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[410px] lg:h-[410px] aspect-square rounded-3xl overflow-hidden relative shadow-2xl cursor-pointer group/dynamo bg-slate-950/80 border border-white/10 select-none transition-transform duration-300 hover:scale-[1.01]"
            title={`Klik untuk putar se-album "${currentAlbum.album}" | Scroll untuk ganti album`}
          >
            {currentAlbum.coverSongId ? (
              <img
                src={`/api/cover/${currentAlbum.coverSongId}`}
                alt={currentAlbum.album}
                className="w-full h-full object-cover select-none pointer-events-none"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-900">
                <Disc size={64} className="text-slate-700" />
              </div>
            )}

            {/* Hi-Res Badge */}
            {currentAlbum.isHiRes && (
              <span className="absolute top-3.5 left-3.5 text-[10px] font-black px-2 py-0.5 rounded-lg bg-purple-950/90 text-purple-300 border border-purple-500/40 backdrop-blur-md shadow-md pointer-events-none">
                24-BIT
              </span>
            )}

            {/* Hover Play Button (Putar Se-Album) */}
            <div className="absolute inset-0 bg-slate-950/35 opacity-0 group-hover/dynamo:opacity-100 backdrop-blur-[2px] transition-opacity duration-200 flex items-center justify-center">
              <div className="p-4 rounded-full bg-black/80 text-white border border-white/20 shadow-2xl transform scale-95 group-hover/dynamo:scale-100 transition-transform">
                <Play size={26} className="fill-white ml-0.5" />
              </div>
            </div>
          </div>

          {/* Album Title & Artist Below Cover with Subtle Switcher */}
          <div className="mt-3 w-64 sm:w-80 md:w-96 lg:w-[410px] flex items-center justify-between px-1">
            <div className="min-w-0 flex-1 pr-3">
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate">
                {currentAlbum.album}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 truncate mt-0.5">
                {currentAlbum.artist} • {currentAlbum.songs.length} Lagu
              </p>
            </div>

            {/* Subtle Prev / Next Arrows */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              <button
                onClick={() => setCurrentAlbumIndex(prev => Math.max(prev - 1, 0))}
                disabled={currentAlbumIndex === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Album Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-[11px] font-mono text-slate-500 px-1">
                {currentAlbumIndex + 1}/{albumGroups.length}
              </span>
              <button
                onClick={() => setCurrentAlbumIndex(prev => Math.min(prev + 1, albumGroups.length - 1))}
                disabled={currentAlbumIndex === albumGroups.length - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                title="Album Berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PROPELER: LIST LAGU DI KANAN (1 KOLOM TUNGGAL, TINGGI SEJAJAR COVER)       */}
        {/* ========================================================================= */}
        <div className="flex-1 w-full min-w-0 flex flex-col justify-center">
          {/* Height locked exactly to cover height */}
          <div className="w-full h-64 sm:h-80 md:h-96 lg:h-[410px] flex flex-col">
            {/* KASUS 1 LAGU: Pivot tengah sejajar mid-point cover */}
            {currentAlbum.songs.length === 1 && (
              <div className="h-full flex flex-col justify-center">
                {renderTrackItem(currentAlbum.songs[0], 0)}
              </div>
            )}

            {/* KASUS 2 LAGU: Dibagi dua rata sepanjang tinggi cover */}
            {currentAlbum.songs.length === 2 && (
              <div className="h-full flex flex-col justify-around">
                {currentAlbum.songs.map((song, idx) => renderTrackItem(song, idx))}
              </div>
            )}

            {/* KASUS 3 LAGU ATAU LEBIH: Tepat 3 track per viewport layar, sisa lagu di-scroll */}
            {currentAlbum.songs.length >= 3 && (
              <div
                ref={tracklistRef}
                className="h-full overflow-y-auto scroll-fade-edge snap-y snap-mandatory flex flex-col pr-1 space-y-1"
              >
                {currentAlbum.songs.map((song, trackIdx) => (
                  <div key={song.id} className="h-1/3 min-h-[68px] sm:min-h-[80px] snap-start flex items-center flex-shrink-0">
                    {renderTrackItem(song, trackIdx)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(LibraryView);
