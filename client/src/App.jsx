import React, { useState, useEffect, useRef } from 'react';
import TerminalHeader from './components/TerminalHeader';
import SidebarNav from './components/SidebarNav';
import VirtualKeypad from './components/VirtualKeypad';
import PlaylistView from './components/Views/PlaylistView';
import LibraryView from './components/Views/LibraryView';
import TrackView from './components/Views/TrackView';
import SearchView from './components/Views/SearchView';
import { extractCoverPalette } from './utils/colorExtractor';

// Order of bottom/sidebar sections; swipe left/right cycles through these.
const TAB_ORDER = ['library', 'queue', 'track', 'playlist'];
const SWIPE_IGNORE = 'input, select, textarea, button, a, [role="slider"], [data-swipe-ignore]';

// True when the touch started inside a horizontally scrollable area (e.g. the
// filter pills row): let the user scroll it instead of navigating tabs.
function isHorizontalScrollArea(touchTarget, containerEl) {
  let el = touchTarget;
  while (el && el !== containerEl && el.parentElement !== containerEl) {
    if (el.scrollWidth > el.clientWidth + 2) return true;
    el = el.parentElement;
  }
  return false;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('library'); // 'playlist', 'library', 'track', 'search'
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [songs, setSongs] = useState([]);
  const [stats, setStats] = useState({});
  const [queue, setQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  // Dynamic Theme Palette State
  const [themeStyle, setThemeStyle] = useState({
    bgGradient: 'radial-gradient(circle at 50% 25%, rgba(255, 193, 7, 0.12) 0%, rgba(3, 7, 30, 0.98) 75%)',
    accentHex: '#FFC107'
  });

  const audioRef = useRef(null);
  const containerRef = useRef(null);
  const swipeRef = useRef({ x: 0, y: 0, ok: false, active: false });
  const [animDir, setAnimDir] = useState(null); // 'next' | 'prev' | null (utk animasi slide)

  // Auto-scan music directory on page load/refresh & fetch songs + stats
  useEffect(() => {
    const initApp = async () => {
      try {
        await fetch('/api/scan', { method: 'POST' });
      } catch (e) {
        console.error('Auto rescan on load failed:', e);
      } finally {
        fetchSongs();
        fetchStats();
      }
    };
    initApp();
  }, []);

  const fetchSongs = async () => {
    try {
      const res = await fetch('/api/songs');
      if (!res.ok) {
        console.error('Failed to fetch songs:', res.status);
        return;
      }
      const data = await res.json();
      setSongs(data);
    } catch (e) {
      console.error('Failed to fetch songs:', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) {
        console.error('Failed to fetch stats:', res.status);
        return;
      }
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  const currentSong = currentQueueIndex >= 0 && currentQueueIndex < queue.length ? queue[currentQueueIndex] : null;

  // Dynamic Palette Extraction when currentSong changes
  useEffect(() => {
    if (currentSong && currentSong.has_cover) {
      extractCoverPalette(`/api/cover/${currentSong.id}`).then((palette) => {
        setThemeStyle({
          bgGradient: palette.bgGradient,
          accentHex: palette.accentHex
        });
      });
    } else {
      setThemeStyle({
        bgGradient: 'radial-gradient(circle at 50% 25%, rgba(255, 193, 7, 0.12) 0%, rgba(3, 7, 30, 0.98) 75%)',
        accentHex: '#FFC107'
      });
    }
  }, [currentSong]);

  // Play a specific list of songs (replaces the queue). Used by "play
  // collection" (album / artist / playlist) and by single-song clicks from the
  // library. Fixes the old bug where the queue was permanently aliased to the
  // whole library, making playlist-order playback impossible.
  const playFromList = (list, index = 0) => {
    if (!list || list.length === 0) return;
    setQueue(list);
    setCurrentQueueIndex(Math.max(0, Math.min(index, list.length - 1)));
    setIsPlaying(true);
  };

  // Play a song from the Library screen: keeps the whole library as queue
  // context so Previous/Next walk the library order.
  const handlePlaySong = (song) => {
    if (!song) return;
    const idx = songs.findIndex(s => s.id === song.id);
    if (idx >= 0) {
      playFromList(songs, idx);
    } else {
      playFromList([song], 0);
    }
  };

  // Add song to queue without immediately switching
  const handleAddToQueue = (song) => {
    setQueue(prev => [...prev, song]);
  };

  // Handle Play/Pause toggle
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(e => console.error(e));
    }
  };

  // Play previous track
  const playPrev = () => {
    if (queue.length === 0) return;
    if (currentQueueIndex > 0) {
      setCurrentQueueIndex(prev => prev - 1);
    } else {
      setCurrentQueueIndex(queue.length - 1);
    }
    setIsPlaying(true);
  };

  // Play next track (isManual true when user clicks Next button)
  const playNext = (isManual = false) => {
    if (queue.length === 0) return;

    // Repeat 1 track logic on natural end of song
    if (!isManual && repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      return;
    }

    if (isShuffle) {
      const randIdx = Math.floor(Math.random() * queue.length);
      setCurrentQueueIndex(randIdx);
    } else if (currentQueueIndex < queue.length - 1) {
      setCurrentQueueIndex(prev => prev + 1);
    } else if (repeatMode === 'all' || repeatMode === 'one') {
      setCurrentQueueIndex(0);
    } else {
      setIsPlaying(false);
    }
  };

  // Seek forward / backward in seconds
  const seek = (seconds) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // MediaSession integration & iOS Background Audio Keepalive
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title || currentSong.filename,
        artist: currentSong.artist || 'Unknown Artist',
        album: currentSong.album || 'Unknown Album',
        artwork: currentSong.has_cover ? [{ src: `/api/cover/${currentSong.id}`, sizes: '512x512', type: currentSong.cover_mime || 'image/jpeg' }] : []
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) {
          audioRef.current.play();
          setIsPlaying(true);
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', playPrev);
      navigator.mediaSession.setActionHandler('nexttrack', () => playNext(true));
      try {
        navigator.mediaSession.setActionHandler('seekbackward', () => seek(-5));
        navigator.mediaSession.setActionHandler('seekforward', () => seek(5));
      } catch (e) {}
    }
  }, [currentSong, isPlaying]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      switch (e.key) {
        case 'F2':
          e.preventDefault();
          setActiveTab('queue');
          break;
        case 'F3':
          e.preventDefault();
          setActiveTab('library');
          break;
        case 'F4':
          e.preventDefault();
          setActiveTab('track');
          break;
        case 'F5':
          e.preventDefault();
          setActiveTab('playlist');
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'h':
        case 'ArrowLeft':
          e.preventDefault();
          playPrev();
          break;
        case 'l':
        case 'ArrowRight':
          e.preventDefault();
          playNext(true);
          break;
        case 'a':
          e.preventDefault();
          seek(-5);
          break;
        case 'd':
          e.preventDefault();
          seek(5);
          break;
        case 's':
          e.preventDefault();
          setIsShuffle(prev => !prev);
          break;
        case 'f':
          e.preventDefault();
          toggleRepeat();
          break;
        case '/':
          e.preventDefault();
          setActiveTab('playlist');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, queue, isPlaying, currentQueueIndex, isShuffle, repeatMode]);

  // Auto-play when currentSong changes
  useEffect(() => {
    if (audioRef.current && currentSong) {
      audioRef.current.src = `/api/stream/${currentSong.id}`;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Playback error:', err));
    }
  }, [currentQueueIndex]);

  // ---- Mobile swipe navigation between views ----
  // Geser kiri -> bagian berikutnya, geser kanan -> bagian sebelumnya.
  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) {
      swipeRef.current.active = false;
      return;
    }
    const t = e.touches[0];
    const target = e.target;
    const blocked =
      isSidebarOpen ||
      (target && target.closest && target.closest(SWIPE_IGNORE)) ||
      isHorizontalScrollArea(target, containerRef.current);
    swipeRef.current = { x: t.clientX, y: t.clientY, ok: !blocked, active: true };
  };

  const handleTouchEnd = (e) => {
    if (!swipeRef.current.active) return;
    const s = swipeRef.current;
    swipeRef.current.active = false;
    if (!s.ok) return;
    if (e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Butuh swipe horizontal minimal 60px dan lebih dominan dari scroll vertikal
    if (Math.abs(dx) < 60 || Math.abs(dy) * 1.25 > Math.abs(dx)) return;

    const idx = TAB_ORDER.indexOf(activeTab);
    if (idx === -1) return;
    if (dx < 0) {
      // geser kiri -> lanjut
      setAnimDir('next');
      setActiveTab(TAB_ORDER[(idx + 1) % TAB_ORDER.length]);
    } else {
      // geser kanan -> kembali
      setAnimDir('prev');
      setActiveTab(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length]);
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex flex-col h-screen text-slate-100 font-sans overflow-hidden transition-all duration-1000 [touch-action:pan-y]"
      style={{ background: themeStyle.bgGradient }}
    >
      {/* HTML5 Audio Element with iOS background playback optimizations */}
      <audio
        ref={audioRef}
        playsInline
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession && duration > 0) {
              try {
                navigator.mediaSession.setPositionState({
                  duration: duration,
                  playbackRate: audioRef.current.playbackRate || 1,
                  position: Math.min(audioRef.current.currentTime, duration)
                });
              } catch (e) {}
            }
          }
        }}
        onLoadedMetadata={() => setDuration(audioRef.current ? audioRef.current.duration : 0)}
        onEnded={() => playNext(false)}
      />

      {/* Top Navigation Header */}
      <TerminalHeader
        stats={stats}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
      />

      {/* Main Content Area with Collapsible SidebarNav */}
      <div className="flex-1 flex overflow-hidden relative">
        <SidebarNav
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          songs={songs}
          queue={queue}
          stats={stats}
        />

        {/* Active View Container */}
        <main
          key={activeTab}
          onAnimationEnd={() => setAnimDir(null)}
          className={`flex-1 overflow-hidden relative ${
            animDir ? (animDir === 'next' ? 'view-enter-next' : 'view-enter-prev') : ''
          }`}
        >
          {activeTab === 'queue' && (
            <PlaylistView
              queue={queue}
              currentQueueIndex={currentQueueIndex}
              onPlayFromQueue={(idx) => { setCurrentQueueIndex(idx); setIsPlaying(true); }}
              onRemoveFromQueue={(idx) => {
                const newQ = queue.filter((_, i) => i !== idx);
                setQueue(newQ);
                if (currentQueueIndex >= newQ.length) setCurrentQueueIndex(Math.max(0, newQ.length - 1));
              }}
              onMoveInQueue={(idx, dir) => {
                const newQ = [...queue];
                const target = idx + dir;
                if (target < 0 || target >= newQ.length) return;
                const temp = newQ[idx];
                newQ[idx] = newQ[target];
                newQ[target] = temp;
                setQueue(newQ);
                if (currentQueueIndex === idx) setCurrentQueueIndex(target);
              }}
              onClearQueue={() => { setQueue([]); setCurrentQueueIndex(-1); setIsPlaying(false); }}
            />
          )}

          {activeTab === 'library' && (
            <LibraryView
              songs={songs}
              onPlaySong={handlePlaySong}
              onAddToQueue={handleAddToQueue}
              currentSong={currentSong}
            />
          )}

          {activeTab === 'track' && (
            <TrackView
              song={currentSong}
              isPlaying={isPlaying}
              audioRef={audioRef}
              currentTime={currentTime}
              duration={duration}
              onSeek={(t) => { if (audioRef.current) audioRef.current.currentTime = t; }}
            />
          )}

          {activeTab === 'playlist' && (
            <SearchView
              songs={songs}
              onPlaySong={handlePlaySong}
              onPlayList={playFromList}
              onAddToQueue={handleAddToQueue}
              currentSong={currentSong}
            />
          )}
        </main>
      </div>

      {/* Bottom Player Controls Bar with Seek Progress Slider */}
      <VirtualKeypad
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        playPrev={playPrev}
        playNext={() => playNext(true)}
        seek={seek}
        currentTime={currentTime}
        duration={duration}
        onSeekTo={(t) => { if (audioRef.current) audioRef.current.currentTime = t; }}
        isShuffle={isShuffle}
        toggleShuffle={() => setIsShuffle(prev => !prev)}
        repeatMode={repeatMode}
        toggleRepeat={toggleRepeat}
      />
    </div>
  );
}
