'use client';

import { memo } from 'react';
import type { UnavailableBlock } from './constants';

interface UnavailableBlocksOverlayProps {
  blocks: UnavailableBlock[];
}

export const UnavailableBlocksOverlay = memo(function UnavailableBlocksOverlay({
  blocks,
}: UnavailableBlocksOverlayProps) {
  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, i) => (
        <div
          key={`${block.left}-${block.width}-${i}`}
          className="absolute top-0 h-full pointer-events-none z-[1]"
          style={{
            left: block.left,
            width: block.width,
            background:
              'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(0,0,0,0.06) 3px, rgba(0,0,0,0.06) 4px)',
            backgroundColor: 'rgba(0,0,0,0.04)',
          }}
          title={block.label}
        />
      ))}
    </>
  );
});
