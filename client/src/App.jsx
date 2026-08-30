import React, { useState, useEffect, useRef } from 'react';
import TerminalHeader from './components/TerminalHeader';
import VirtualKeypad from './components/VirtualKeypad';
import PlaylistView from './components/Views/PlaylistView';
import LibraryView from './components/Views/LibraryView';
import TrackView from './components/Views/TrackView';
import SearchView from './components/Views/SearchView';
import { extractCoverPalette } from './utils/colorExtractor';

export default function App() {
  const [activeTab, setActiveTab] = useState('library'); // 'playlist', 'library', 'track', 'search'
  const [songs, setSongs] = useState([]);
  const [stats, setStats] = useState({});
  const [queue, setQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  // Dynamic Theme Palette State
  const [themeStyle, setThemeStyle] = useState({
    bgGradient: 'radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.2) 0%, rgba(8, 11, 17, 0.98) 75%)',
    accentHex: '#38bdf8'
  });

  const audioRef = useRef(null);

  // Fetch library songs & stats on initial load
  useEffect(() => {
    fetchSongs();
    fetchStats();
  }, []);

  const fetchSongs = async () => {
    try {
      const res = await fetch('/api/songs');
      const data = await res.json();
      setSongs(data);
      setQueue(data);
    } catch (e) {
      console.error('Failed to fetch songs:', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
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
        bgGradient: 'radial-gradient(circle at 50% 25%, rgba(56, 189, 248, 0.2) 0%, rgba(8, 11, 17, 0.98) 75%)',
        accentHex: '#38bdf8'
      });
    }
  }, [currentSong]);

  // Play a song from Library or Search
  const handlePlaySong = (song) => {
    let targetQueue = queue;
    if (targetQueue.length === 0 && songs.length > 0) {
      targetQueue = songs;
      setQueue(songs);
    }

    const idx = targetQueue.findIndex(s => s.id === song.id);
    if (idx !== -1) {
      setCurrentQueueIndex(idx);
    } else {
      const updatedQueue = [...targetQueue, song];
      setQueue(updatedQueue);
      setCurrentQueueIndex(updatedQueue.length - 1);
    }
    setIsPlaying(true);
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
      if (currentQueueIndex === -1 && queue.length > 0) {
        setCurrentQueueIndex(0);
      }
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

  // Play next track
  const playNext = () => {
    if (queue.length === 0) return;
    if (isShuffle) {
      const randIdx = Math.floor(Math.random() * queue.length);
      setCurrentQueueIndex(randIdx);
    } else if (currentQueueIndex < queue.length - 1) {
      setCurrentQueueIndex(prev => prev + 1);
    } else if (isRepeat) {
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
      navigator.mediaSession.setActionHandler('nexttrack', playNext);
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
          setActiveTab('playlist');
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
          setActiveTab('search');
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
          playNext();
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
        case 'r':
          e.preventDefault();
          setIsRepeat(prev => !prev);
          break;
        case '/':
          e.preventDefault();
          setActiveTab('search');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSong, queue, isPlaying, currentQueueIndex, isShuffle, isRepeat]);

  // Auto-play when currentSong changes
  useEffect(() => {
    if (audioRef.current && currentSong) {
      audioRef.current.src = `/api/stream/${currentSong.id}`;
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Playback error:', err));
    }
  }, [currentQueueIndex]);

  return (
    <div
      className="flex flex-col h-screen text-slate-100 font-sans overflow-hidden transition-all duration-1000"
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
        onEnded={playNext}
      />

      {/* Top Navigation Header */}
      <TerminalHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
      />

      {/* Main View Area */}
      <main className="flex-1 overflow-hidden relative">
        {activeTab === 'playlist' && (
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

        {activeTab === 'search' && (
          <SearchView
            songs={songs}
            onPlaySong={handlePlaySong}
            onAddToQueue={handleAddToQueue}
            currentSong={currentSong}
          />
        )}
      </main>

      {/* Bottom Player Controls Bar */}
      <VirtualKeypad
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        playPrev={playPrev}
        playNext={playNext}
        seek={seek}
        volume={volume}
        setVolume={(v) => { setVolume(v); if (audioRef.current) audioRef.current.volume = v; }}
        isShuffle={isShuffle}
        toggleShuffle={() => setIsShuffle(prev => !prev)}
        isRepeat={isRepeat}
        toggleRepeat={() => setIsRepeat(prev => !prev)}
      />
    </div>
  );
}
