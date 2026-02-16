'use client';

import { memo } from 'react';
import type { UnavailableBlock, UnavailableBlockType } from './constants';

interface UnavailableBlocksOverlayProps {
  blocks: UnavailableBlock[];
}

const BLOCK_STYLES: Record<UnavailableBlockType, { background: string; backgroundColor: string }> = {
  off_hours: {
    background:
      'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  day_off: {
    background:
      'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.10) 4px, rgba(0,0,0,0.10) 5px)',
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  unavailable: {
    background:
      'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(220,80,80,0.15) 4px, rgba(220,80,80,0.15) 5px)',
    backgroundColor: 'rgba(220,80,80,0.08)',
  },
};

export const UnavailableBlocksOverlay = memo(function UnavailableBlocksOverlay({
  blocks,
}: UnavailableBlocksOverlayProps) {
  if (blocks.length === 0) return null;

  return (
    <>
      {blocks.map((block, i) => {
        const style = BLOCK_STYLES[block.type];
        return (
          <div
            key={`${block.left}-${block.width}-${i}`}
            className="absolute top-0 h-full pointer-events-none z-[1]"
            style={{
              left: block.left,
              width: block.width,
              background: style.background,
              backgroundColor: style.backgroundColor,
            }}
            title={block.label}
          />
        );
      })}
    </>
  );
});
