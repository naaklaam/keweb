import React from 'react';
import { Disc } from 'lucide-react';

export default function PlaylistCoverGrid({ coverSongIds = [], size = 'normal', fallbackIconSize = 44 }) {
  const validCovers = Array.isArray(coverSongIds) ? coverSongIds.filter(Boolean) : [];

  if (validCovers.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-700">
        <Disc size={fallbackIconSize} />
      </div>
    );
  }

  if (validCovers.length === 1) {
    return (
      <img
        loading="lazy"
        src={`/api/cover/${validCovers[0]}`}
        alt="Playlist Cover"
        className="w-full h-full object-cover"
      />
    );
  }

  // If 2, 3, or 4 covers: render 4-quadrant 2x2 grid
  // Fill up to 4 cells
  const gridCells = [
    validCovers[0],
    validCovers[1],
    validCovers[2] || validCovers[0],
    validCovers[3] || validCovers[1] || validCovers[0]
  ];

  return (
    <div className="w-full h-full grid grid-cols-2 grid-rows-2 overflow-hidden bg-slate-950">
      {gridCells.map((songId, idx) => (
        <div key={`${songId}-${idx}`} className="w-full h-full overflow-hidden relative">
          <img
            loading="lazy"
            src={`/api/cover/${songId}`}
            alt={`Cover ${idx + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
      ))}
    </div>
  );
}
