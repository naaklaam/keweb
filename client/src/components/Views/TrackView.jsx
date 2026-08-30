import React, { useState, useEffect, useRef } from 'react';
import { Disc, Music, Activity, Volume2, ShieldCheck, Zap } from 'lucide-react';

export default function TrackView({ song, isPlaying, audioRef, currentTime, duration, onSeek }) {
  const [visualizerMode, setVisualizerMode] = useState('bars'); // 'bars' or 'ascii'
  const canvasRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);

  // Initialize Web Audio API Analyser for real-time visualizer spectrum
  useEffect(() => {
    if (!audioRef || !audioRef.current) return;
    const audio = audioRef.current;

    try {
      if (!audioCtxRef.current) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtxRef.current = new AudioContext();
        analyserRef.current = audioCtxRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;

        sourceRef.current = audioCtxRef.current.createMediaElementSource(audio);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      }
    } catch (e) {
      // Audio element already connected or restricted by browser autoplay policy
    }
  }, [audioRef]);

  // Render Visualizer animation loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas || !analyserRef.current) return;

    const ctx = canvas.getContext('2d');
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      animId = requestAnimationFrame(renderFrame);
      analyserRef.current.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#00ffcc');
        gradient.addColorStop(0.7, '#8b5cf6');
        gradient.addColorStop(1, '#ec4899');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);

        x += barWidth;
      }
    };

    if (isPlaying) {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      renderFrame();
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isHiRes = song && (song.bits_per_sample > 16 || song.sample_rate > 44100);

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs text-slate-300 overflow-y-auto p-4">
      {song ? (
        <div className="max-w-3xl mx-auto w-full flex flex-col space-y-6">
          {/* Main Album Art & Info Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-900/60 p-4 border border-slate-800 rounded-lg">
            {/* Album Cover Art */}
            <div className="md:col-span-5 flex justify-center">
              <div className="relative group w-48 h-48 sm:w-56 sm:h-56 rounded border-2 border-slate-800 bg-slate-950 overflow-hidden shadow-xl flex items-center justify-center">
                {song.has_cover ? (
                  <img
                    src={`/api/cover/${song.id}`}
                    alt={song.album}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-700 space-y-2">
                    <Disc size={80} className={`${isPlaying ? 'animate-spin-slow text-cyan-500' : 'text-slate-800'}`} />
                    <span className="text-[10px] text-slate-600 font-mono">[ NO COVER ART ]</span>
                  </div>
                )}
                {/* Audio Spec Badge Overlay */}
                <div className="absolute top-2 right-2 bg-slate-950/90 border border-slate-800 backdrop-blur px-2 py-1 rounded text-[10px] text-cyan-400 font-bold flex items-center space-x-1 shadow">
                  <Zap size={10} className="text-amber-400" />
                  <span>{song.bits_per_sample || 16}-BIT FLAC</span>
                </div>
              </div>
            </div>

            {/* Track Metadata Info Details */}
            <div className="md:col-span-7 flex flex-col space-y-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-400 border border-cyan-800 font-bold">
                    NOW PLAYING
                  </span>
                  {isHiRes && (
                    <span className="px-2 py-0.5 rounded text-[10px] bg-purple-950 text-purple-300 border border-purple-800 font-bold flex items-center space-x-1">
                      <ShieldCheck size={10} />
                      <span>HI-RES LOSSLESS</span>
                    </span>
                  )}
                </div>

                <h1 className="text-lg sm:text-xl font-bold text-slate-100 text-glow truncate">
                  {song.title || song.filename}
                </h1>
                <p className="text-cyan-400 font-semibold text-sm truncate">{song.artist || 'Unknown Artist'}</p>
                <p className="text-slate-500 text-xs truncate">{song.album || 'Unknown Album'} {song.year ? `(${song.year})` : ''}</p>
              </div>

              {/* Technical Specifications Matrix */}
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-950 border border-slate-800/80 rounded text-[11px]">
                <div>
                  <span className="text-slate-600 block text-[10px]">CONTAINER / CODEC</span>
                  <span className="text-cyan-300 font-bold">FLAC (Lossless)</span>
                </div>
                <div>
                  <span className="text-slate-600 block text-[10px]">SAMPLE RATE</span>
                  <span className="text-purple-300 font-bold">
                    {song.sample_rate ? `${(song.sample_rate / 1000).toFixed(1)} kHz` : '44.1 kHz'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600 block text-[10px]">BIT DEPTH</span>
                  <span className="text-amber-300 font-bold">{song.bits_per_sample || 16}-bit</span>
                </div>
                <div>
                  <span className="text-slate-600 block text-[10px]">BITRATE</span>
                  <span className="text-emerald-300 font-bold">
                    {song.bitrate ? `${Math.round(song.bitrate / 1000)} kbps` : 'VBR'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Spectrum Audio Visualizer Box */}
          <div className="bg-slate-900/60 p-4 border border-slate-800 rounded-lg flex flex-col space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center space-x-1.5 text-cyan-400 font-bold">
                <Activity size={14} />
                <span>SPECTRUM VISUALIZER</span>
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {isPlaying ? '● REALTIME ANALYZER RUNNING' : '○ STANDBY'}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded p-2 h-24 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={500}
                height={80}
                className="w-full h-full"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-3">
          <Music size={48} strokeWidth={1} />
          <p className="font-mono text-sm">No track currently loaded.</p>
          <p className="text-[11px] text-slate-700">Select a song from [F3 Library] to view technical details.</p>
        </div>
      )}
    </div>
  );
}
