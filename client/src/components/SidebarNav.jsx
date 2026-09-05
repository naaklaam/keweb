import React from 'react';
import { Music2, ListMusic, Disc3, Disc, X } from 'lucide-react';

export default function SidebarNav({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  songs = [],
  queue = [],
  stats = {}
}) {
  const totalLibraryCount = (songs && songs.length > 0) ? songs.length : (stats.totalSongs || 0);

  const tabs = [
    { id: 'library', label: 'Library', icon: Music2, badge: totalLibraryCount },
    { id: 'queue', label: 'Queue', icon: ListMusic, badge: queue ? queue.length : 0 },
    { id: 'track', label: 'Now Playing', icon: Disc3 },
    { id: 'playlist', label: 'Playlist / Cari', icon: Disc },
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    // Close mobile drawer when an item is selected
    if (window.innerWidth < 768 && onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-30 transition-opacity"
        />
      )}

      {/* Sidebar / Drawer Container */}
      <aside
        className={`fixed md:relative top-0 left-0 h-full z-40 bg-[#03071E]/95 md:bg-transparent backdrop-blur-md transition-all duration-300 flex flex-col ${
          isOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-16'
        }`}
      >
        {/* Mobile Header Inside Drawer */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <Disc size={20} className="text-[#FFC107] animate-spin-slow" />
            <span className="font-extrabold text-white text-base">Keweb <span className="text-[#FFC107] text-xs">FLAC</span></span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav Items List (Frameless & Unboxed with Gold Active State) */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                title={tab.label}
                className={`w-full flex items-center space-x-3.5 px-4 py-3 text-sm font-medium transition-colors group ${
                  isActive
                    ? 'text-[#FFC107] font-bold'
                    : 'text-slate-400 hover:text-[#FFC107]'
                }`}
              >
                <Icon
                  size={20}
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-[#FFC107]' : 'text-slate-400 group-hover:text-[#FFC107]'
                  }`}
                />

                {/* Text Label & Unboxed Badge (Hidden in Collapsed Desktop Mode) */}
                <div className={`flex items-center justify-between flex-1 min-w-0 ${!isOpen ? 'md:hidden' : ''}`}>
                  <span className="truncate">{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`ml-auto text-xs font-semibold ${
                        isActive
                          ? 'text-[#FFC107]'
                          : 'text-slate-500 group-hover:text-[#FFC107]'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
