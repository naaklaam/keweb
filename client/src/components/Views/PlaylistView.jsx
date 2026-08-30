import React from 'react';
import { Play, Trash2, ArrowUp, ArrowDown, ListX, Disc } from 'lucide-react';

export default function PlaylistView({ queue, currentQueueIndex, onPlayFromQueue, onRemoveFromQueue, onMoveInQueue, onClearQueue }) {
  const formatDuration = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 font-mono text-xs text-slate-300">
      {/* Header Toolbar */}
      <div className="p-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-cyan-400 font-bold">
          <Disc size={14} className="animate-spin-slow" />
          <span>PLAYLIST QUEUE [{queue.length} Tracks]</span>
        </div>

        {queue.length > 0 && (
          <button
            onClick={onClearQueue}
            className="px-2 py-1 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 rounded flex items-center space-x-1 text-[11px] transition"
          >
            <ListX size={12} />
            <span>Clear Queue</span>
          </button>
        )}
      </div>

      {/* Queue List */}
      <div className="flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-600 space-y-2 p-6">
            <Disc size={40} strokeWidth={1} />
            <p className="font-mono text-sm">Queue is empty</p>
            <p className="text-[11px] text-slate-700">Add songs from [F3 Library] or [F5 Search] to populate queue.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-900">
            {queue.map((song, idx) => {
              const isCurrent = idx === currentQueueIndex;
              const isHiRes = song.bits_per_sample > 16 || song.sample_rate > 44100;

              return (
                <div
                  key={`${song.id}-${idx}`}
                  className={`flex items-center justify-between p-2 hover:bg-slate-900 transition group ${
                    isCurrent ? 'bg-cyan-950/40 text-cyan-300 font-bold border-l-2 border-cyan-400' : ''
                  }`}
                >
                  {/* Track Info */}
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className="w-6 text-center text-slate-500 font-mono text-[11px]">
                      {isCurrent ? '▶' : idx + 1}
                    </span>

                    <button
                      onClick={() => onPlayFromQueue(idx)}
                      className="text-left flex-1 min-w-0 group-hover:text-cyan-400 transition"
                    >
                      <div className="truncate font-medium text-slate-200">
                        {song.title || song.filename}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate flex items-center space-x-2">
                        <span>{song.artist || 'Unknown'} — {song.album}</span>
                        {isHiRes && (
                          <span className="text-purple-400 border border-purple-900 px-1 rounded text-[9px]">
                            {song.bits_per_sample}-bit
                          </span>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Actions & Time */}
                  <div className="flex items-center space-x-2 pl-2">
                    <span className="text-slate-400 font-mono text-[11px] mr-2">
                      {formatDuration(song.duration)}
                    </span>

                    {/* Move buttons */}
                    <button
                      onClick={() => onMoveInQueue(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-slate-800 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move Up"
                    >
                      <ArrowUp size={12} />
                    </button>

                    <button
                      onClick={() => onMoveInQueue(idx, 1)}
                      disabled={idx === queue.length - 1}
                      className="p-1 rounded hover:bg-slate-800 text-slate-500 disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move Down"
                    >
                      <ArrowDown size={12} />
                    </button>

                    <button
                      onClick={() => onRemoveFromQueue(idx)}
                      className="p-1 rounded hover:bg-red-950 text-red-400 hover:border hover:border-red-900 transition"
                      title="Remove from Queue"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
