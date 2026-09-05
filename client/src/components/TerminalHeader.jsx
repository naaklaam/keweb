import { Clock, Disc, Menu } from "lucide-react";
import { useEffect, useState } from "react";

export default function TerminalHeader({ stats = {}, onToggleSidebar }) {
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
    <header className="px-4 py-3 border-b border-white/10 glass-panel z-20 flex items-center justify-between gap-3">
      {/* Left: Hamburger Toggle Button & Brand Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-300 hover:text-[#FFC107] hover:bg-white/5 border border-transparent hover:border-white/10 transition-all flex items-center justify-center"
          title="Buka / Tutup Navigasi Menu"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-black border border-[#FFC107]/40 flex items-center justify-center shadow-lg shadow-[#FFC107]/10">
            <Disc size={20} className="text-[#FFC107] animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center space-x-2">
              <span>Keweb</span>
             
            </h1>
            <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Lossless Audio Player
            </p>
          </div>
        </div>
      </div>

      {/* Right: Hi-Res Count Badge & Live Clock */}
      <div className="flex items-center space-x-3 sm:space-x-4 text-xs text-slate-400 font-medium">
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
