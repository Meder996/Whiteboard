'use client';

import { Maximize, Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useEditor } from '@/lib/store';
import { MAX_ZOOM, MIN_ZOOM, clamp } from '@/lib/geometry';
import { useState } from 'react';

export function ZoomControls() {
  const camera = useEditor((state) => state.camera);
  const zoomIn = useEditor((state) => state.zoomIn);
  const zoomOut = useEditor((state) => state.zoomOut);
  const resetZoom = useEditor((state) => state.resetZoom);
  const resetView = useEditor((state) => state.resetView);
  const fitToScreen = useEditor((state) => state.fitToScreen);
  const zoomTo = useEditor((state) => state.zoomTo);
  const [menuOpen, setMenuOpen] = useState(false);

  const percent = Math.round(camera.zoom * 100);

  return (
    <div className="panel relative flex items-center p-0.5">
      <button type="button" className="btn-ghost px-2 py-1.5" onClick={zoomOut} aria-label="Zoom out" title="Zoom out — ⌘−">
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="min-w-[54px] rounded-md px-1 py-1 text-xs font-semibold tabular-nums text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--ink)]"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label={`Zoom level ${percent} percent`}
        data-testid="zoom-level"
      >
        {percent}%
      </button>
      <button type="button" className="btn-ghost px-2 py-1.5" onClick={zoomIn} aria-label="Zoom in" title="Zoom in — ⌘+">
        <Plus className="h-4 w-4" aria-hidden />
      </button>
      <span className="mx-0.5 h-5 w-px bg-[var(--line)]" aria-hidden />
      <button type="button" className="btn-ghost px-2 py-1.5" onClick={fitToScreen} aria-label="Fit to screen" title="Fit to screen — ⇧1">
        <Maximize2 className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        className="btn-ghost px-2 py-1.5"
        onClick={resetView}
        aria-label="Reset view"
        title="Reset view — ⇧0"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
      </button>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close zoom menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="panel absolute bottom-full right-0 z-50 mb-2 w-40 animate-pop-in p-1.5" role="menu">
            {[0.25, 0.5, 1, 1.5, 2, 4].map((zoom) => (
              <button
                key={zoom}
                type="button"
                role="menuitem"
                className="menu-item"
                onClick={() => {
                  zoomTo(clamp(zoom, MIN_ZOOM, MAX_ZOOM));
                  setMenuOpen(false);
                }}
              >
                {Math.round(zoom * 100)}%
                <kbd>{zoom === 1 ? '100%' : ''}</kbd>
              </button>
            ))}
            <div className="my-1 border-t border-[var(--line)]" />
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={() => {
                resetZoom();
                setMenuOpen(false);
              }}
            >
              <Maximize className="h-3.5 w-3.5" aria-hidden /> Reset to 100%
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
