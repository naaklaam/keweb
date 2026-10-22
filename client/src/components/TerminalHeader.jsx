import { Clock, Disc, Menu, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function TerminalHeader({
  stats = {},
  onToggleSidebar,
  searchQuery = "",
  onSearchChange,
  activeTab,
  setActiveTab
}) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="px-4 sm:px-6 py-2.5 sm:py-3 bg-transparent z-20 flex items-center justify-between gap-3 sm:gap-6 flex-shrink-0">
      {/* Left: Hamburger Toggle Button & Brand Title */}
      <div className="flex items-center space-x-3 flex-shrink-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-300 hover:text-[#FFC107] hover:bg-white/5 border border-transparent hover:border-white/10 transition-all flex items-center justify-center"
          title="Buka / Tutup Navigasi Menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-black border border-[#FFC107]/40 flex items-center justify-center shadow-lg shadow-[#FFC107]/10 flex-shrink-0">
            <Disc size={20} className="text-[#FFC107] animate-spin-slow" />
          </div>
          <div>
            <h1 className="font-brand font-bold text-sm sm:text-base tracking-wide text-white uppercase leading-none flex items-center gap-1.5">
              <span>Keweb</span>
            </h1>
            <p className="text-[9px] sm:text-[10px] tracking-wider text-[#FFC107]/80 font-medium uppercase mt-0.5 hidden sm:block">
              Lossless Audio Player
            </p>
          </div>
        </div>
      </div>

      {/* Center: Search Bar Beside Logo */}
      <div className="flex-1 max-w-sm sm:max-w-md mx-1 sm:mx-4">
        <div className="relative flex items-center w-full">
          <Search size={14} className="absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari album, playlist, artist, lagu..."
            value={searchQuery}
            onChange={(e) => {
              onSearchChange?.(e.target.value);
              if (activeTab !== "playlist" && setActiveTab) {
                setActiveTab("playlist");
              }
            }}
            onFocus={() => {
              if (activeTab !== "playlist" && setActiveTab) {
                setActiveTab("playlist");
              }
            }}
            className="w-full bg-white/[0.06] hover:bg-white/[0.1] focus:bg-slate-950/85 border border-white/10 focus:border-[#FFC107]/50 rounded-full pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none transition-all duration-200 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange?.("")}
              className="absolute right-2.5 p-1 text-slate-400 hover:text-white transition-colors"
              title="Hapus pencarian"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Right: Hi-Res Count Badge & Live Clock */}
      <div className="flex items-center space-x-3 sm:space-x-4 text-xs text-slate-400 font-medium flex-shrink-0">
        {stats.hiResCount > 0 && (
          <span className="hidden md:inline-flex items-center space-x-1 text-purple-300 text-[11px] font-bold">
            <span>{stats.hiResCount} Hi-Res</span>
          </span>
        )}
        <div className="hidden md:flex items-center space-x-1.5 text-slate-300">
          <Clock size={13} className="text-[#FFC107]" />
          <span className="font-mono text-xs tracking-wider">{time}</span>
        </div>
      </div>
    </header>
  );
}
