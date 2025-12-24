import React from 'react';

const WaveformSkeleton: React.FC = () => {
  return (
    <div className="w-full h-32 bg-zinc-900/50 rounded-lg flex items-center justify-center border border-zinc-800 relative overflow-hidden animate-pulse">
      <div className="text-zinc-500 text-sm">Loading Visualizer...</div>
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/20 to-transparent pointer-events-none"></div>
    </div>
  );
};

export default WaveformSkeleton;
