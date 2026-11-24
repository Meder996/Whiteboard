'use client';

import { useMemo } from 'react';
import type { BoardBackground, Camera } from '@/lib/types';

interface CanvasBackgroundProps {
  background: BoardBackground;
  camera: Camera;
}

/**
 * CSS-free, SVG-based canvas backdrop. Patterns are drawn in world space so
 * they pan and zoom with the board and stay crisp at every zoom level.
 */
export function CanvasBackground({ background, camera }: CanvasBackgroundProps) {
  const { kind, color } = background;
  const isDark = useMemo(() => {
    const hex = color.replace('#', '');
    if (hex.length !== 6) return false;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }, [color]);

  const line = isDark ? 'rgba(148,163,184,.22)' : 'rgba(15,23,42,.08)';
  const strongLine = isDark ? 'rgba(148,163,184,.32)' : 'rgba(15,23,42,.14)';

  // Keep a constant on-screen density: scale the pattern with the zoom.
  const step = camera.zoom < 0.45 ? 96 : camera.zoom < 1.1 ? 48 : 24;
  const patternId = `bg-${kind}`;

  return (
    <svg className="absolute inset-0 h-full w-full" aria-hidden data-testid="canvas-background">
      <defs>
        <pattern
          id={patternId}
          width={step}
          height={step}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${camera.x} ${camera.y}) scale(${camera.zoom})`}
        >
          {kind === 'grid' ? (
            <>
              <path d={`M ${step} 0 L 0 0 0 ${step}`} fill="none" stroke={line} strokeWidth={1} />
              <path d={`M ${step / 2} 0 L ${step / 2} ${step} M 0 ${step / 2} L ${step} ${step / 2}`} fill="none" stroke={line} strokeWidth={0.5} opacity={0.55} />
            </>
          ) : null}
          {kind === 'dots' ? <circle cx={step / 2} cy={step / 2} r={1.15} fill={strongLine} /> : null}
          {kind === 'lines' ? <path d={`M 0 ${step} L ${step} ${step}`} stroke={line} strokeWidth={1} /> : null}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={color} />
      {kind !== 'plain' ? <rect width="100%" height="100%" fill={`url(#${patternId})`} /> : null}
    </svg>
  );
}
