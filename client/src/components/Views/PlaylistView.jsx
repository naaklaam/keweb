import React from 'react';
import { Play, Trash2, ArrowUp, ArrowDown, ListMusic, Disc } from 'lucide-react';

export default function PlaylistView({
  queue,
  currentQueueIndex,
  onPlayFromQueue,
  onRemoveFromQueue,
  onMoveInQueue,
  onClearQueue
}) {
  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 md:p-6 space-y-4">
      {/* Queue Header & Actions */}
      <div className="glass-panel p-4 rounded-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-black border border-[#FFC107]/40 rounded-xl text-[#FFC107] shadow-sm">
            <ListMusic size={20} />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">PLAYLIST QUEUE</h2>
            <p className="text-xs text-slate-400">{queue.length} Lagu dalam antrean</p>
          </div>
        </div>

        {queue.length > 0 && (
          <button
            onClick={onClearQueue}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl glass-pill text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all"
          >
            <Trash2 size={14} />
            <span>Kosongkan Queue</span>
          </button>
        )}
      </div>

      {/* Queue List Container */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2">
        {queue.length > 0 ? (
          queue.map((song, index) => {
            const isCurrent = currentQueueIndex === index;
            return (
              <div
                key={`${song.id}-${index}`}
                className={`group flex items-center justify-between p-3 rounded-2xl transition-all ${
                  isCurrent
                    ? 'bg-black/70 border-2 border-[#FFC107] text-white shadow-lg shadow-[#FFC107]/15'
                    : 'bg-transparent border border-transparent hover:bg-white/5 text-slate-300'
                }`}
              >
                {/* Left: Queue Index & Details */}
                <div
                  onClick={() => onPlayFromQueue(index)}
                  className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1 cursor-pointer"
                >
                  <span className={`w-6 text-center text-xs font-bold ${isCurrent ? 'text-[#FFC107]' : 'text-slate-500 group-hover:text-[#FFC107]'}`}>
                    {isCurrent ? '▶' : index + 1}
                  </span>

                  {/* Album Art Thumbnail */}
                  <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-inner">
                    {song.has_cover ? (
                      <img src={`/api/cover/${song.id}`} alt={song.album} className="w-full h-full object-cover" />
                    ) : (
                      <Disc size={20} className="text-slate-700" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className={`text-xs sm:text-sm font-bold truncate ${isCurrent ? 'text-[#FFC107]' : 'text-slate-100'}`}>
                      {song.title || song.filename}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate">
                      {song.artist || 'Unknown Artist'} • {song.album || 'Unknown Album'}
                    </p>
                  </div>
                </div>

                {/* Right: Duration & Control Actions */}
                <div className="flex items-center space-x-2 ml-2">
                  <span className="text-xs font-semibold text-slate-400 font-mono mr-2">
                    {formatTime(song.duration)}
                  </span>

                  <button
                    onClick={() => onMoveInQueue(index, -1)}
                    disabled={index === 0}
                    title="Pindah Ke Atas"
                    className="p-1.5 rounded-lg glass-pill text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowUp size={13} />
                  </button>

                  <button
                    onClick={() => onMoveInQueue(index, 1)}
                    disabled={index === queue.length - 1}
                    title="Pindah Ke Bawah"
                    className="p-1.5 rounded-lg glass-pill text-slate-400 hover:text-white disabled:opacity-30"
                  >
                    <ArrowDown size={13} />
                  </button>

                  <button
                    onClick={() => onRemoveFromQueue(index)}
                    title="Hapus dari Queue"
                    className="p-1.5 rounded-lg glass-pill text-slate-400 hover:text-rose-400"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <ListMusic size={48} className="text-slate-700" />
            <p className="text-sm font-semibold">Queue pemutaran lagu masih kosong.</p>
            <p className="text-xs text-slate-600">Pilih lagu dari Library untuk ditambahkan ke antrean.</p>
          </div>
        )}
      </div>
    </div>
  );
}
