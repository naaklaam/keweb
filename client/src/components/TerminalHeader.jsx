import { Clock, Disc, Disc3, ListMusic, Music2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export default function TerminalHeader({ activeTab, setActiveTab, stats = {}, songs = [], queue = [], onRescan }) {
  const [time, setTime] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleScanClick = async () => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      if (onRescan) await onRescan();
    } catch (e) {
      console.error('Rescan failed:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const totalLibraryCount = (songs && songs.length > 0) ? songs.length : (stats.totalSongs || 0);

  const tabs = [
    { id: 'library', label: 'Library', icon: Music2, badge: totalLibraryCount },
    { id: 'queue', label: 'Queue', icon: ListMusic, badge: queue ? queue.length : 0 },
    { id: 'track', label: 'Now Playing', icon: Disc3 },
    { id: 'playlist', label: 'Playlist', icon: Disc },
  ];

  return (
    <header className="px-4 py-3 border-b border-white/10 glass-panel z-20 flex flex-col sm:flex-row items-center justify-between gap-3">
      {/* Brand & App Title */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-black border border-[#FFC107]/40 flex items-center justify-center shadow-lg shadow-[#FFC107]/10">
          <Disc size={20} className="text-[#FFC107] animate-spin-slow" />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight text-white flex items-center space-x-2">
            <span>KEWEB</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black text-[#FFC107] border border-[#FFC107]/30">
              FLAC
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 font-medium">
            Lossless Audio Player
          </p>
        </div>
      </div>

      {/* Navigation Tabs Pill Bar */}
      <nav className="flex items-center space-x-1 sm:space-x-2 bg-black/60 p-1.5 rounded-2xl border border-white/10 shadow-inner">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs transition-all duration-300 ${
                isActive
                  ? "bg-black text-[#FFC107] border-2 border-[#FFC107] shadow-md shadow-[#FFC107]/20 font-bold"
                  : "bg-black/40 text-slate-400 border border-white/20 hover:text-white hover:border-white/40"
              }`}
            >
              <Icon size={15} className={isActive ? "text-[#FFC107]" : "text-slate-400"} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-[#FFC107]/20 text-[#FFC107] border border-[#FFC107]/30" : "bg-white/10 text-slate-400"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* System Stats, Rescan & Live Clock */}
      <div className="flex items-center space-x-2 sm:space-x-3 text-xs text-slate-400 font-medium">
        <button
          onClick={handleScanClick}
          disabled={isScanning}
          title="Pindai ulang folder musik"
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-black/60 border border-white/20 text-slate-300 hover:text-[#FFC107] hover:border-[#FFC107]/40 transition-all text-xs font-semibold"
        >
          <RefreshCw size={12} className={isScanning ? "animate-spin text-[#FFC107]" : "text-slate-400"} />
          <span>{isScanning ? "Memindai..." : "Scan Extra"}</span>
        </button>

        {stats.hiResCount > 0 && (
          <span className="hidden md:inline-flex items-center space-x-1 text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-full text-[11px]">
            <span>{stats.hiResCount} Hi-Res</span>
          </span>
        )}
        <div className="hidden md:flex items-center space-x-1.5 bg-black/60 border border-white/10 px-3 py-1 rounded-full text-slate-300">
          <Clock size={13} className="text-[#FFC107]" />
          <span className="font-mono text-xs tracking-wider">{time}</span>
        </div>
      </div>
    </header>
  );
}
