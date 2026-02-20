/**
 * FileFormatBadges Component
 * Displays supported audio file formats as pill-shaped badges
 */

import React from 'react';

interface FileFormatBadgesProps {
  formats: string[];
}

const FileFormatBadges: React.FC<FileFormatBadgesProps> = ({ formats }) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {formats.map((format) => (
        <span
          key={format}
          className="px-2.5 py-1 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-full border border-zinc-700"
        >
          {format}
        </span>
      ))}
    </div>
  );
};

export default FileFormatBadges;
