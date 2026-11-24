'use client';

import { useCallback, useMemo, useRef } from 'react';
import { selectionBounds } from '@/lib/geometry';
import type { BoardElement, Camera } from '@/lib/types';

const MINIMAP_WIDTH = 172;
const MINIMAP_HEIGHT = 112;
const PADDING = 12;

interface MinimapProps {
  elements: BoardElement[];
  camera: Camera;
  viewport: { width: number; height: number };
  onNavigate: (world: { x: number; y: number }) => void;
  selectedIds: string[];
  collapsed: boolean;
  onToggle: () => void;
}

export function Minimap({ elements, camera, viewport, onNavigate, selectedIds, collapsed, onToggle }: MinimapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const { scale, offsetX, offsetY, world } = useMemo(() => {
    const visibleWorld = {
      x: -camera.x / camera.zoom,
      y: -camera.y / camera.zoom,
      width: viewport.width / camera.zoom,
      height: viewport.height / camera.zoom,
    };
    const content = elements.length ? selectionBounds(elements) : visibleWorld;
    const union = {
      x: Math.min(content.x, visibleWorld.x),
      y: Math.min(content.y, visibleWorld.y),
      width: 0,
      height: 0,
    };
    union.width = Math.max(content.x + content.width, visibleWorld.x + visibleWorld.width) - union.x;
    union.height = Math.max(content.y + content.height, visibleWorld.y + visibleWorld.height) - union.y;

    const pad = union.width * 0.05;
    const scaleValue = Math.min(
      (MINIMAP_WIDTH - PADDING * 2) / Math.max(union.width + pad * 2, 1),
      (MINIMAP_HEIGHT - PADDING * 2) / Math.max(union.height + pad * 2, 1),
    );
    const offsetXValue = (MINIMAP_WIDTH - union.width * scaleValue) / 2 - union.x * scaleValue;
    const offsetYValue = (MINIMAP_HEIGHT - union.height * scaleValue) / 2 - union.y * scaleValue;
    return { scale: scaleValue, offsetX: offsetXValue, offsetY: offsetYValue, world: union };
  }, [elements, camera, viewport]);

  const handleNavigate = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      onNavigate({ x: (localX - offsetX) / scale, y: (localY - offsetY) / scale });
    },
    [offsetX, offsetY, scale, onNavigate],
  );

  const viewportRect = {
    x: -camera.x / camera.zoom,
    y: -camera.y / camera.zoom,
    width: viewport.width / camera.zoom,
    height: viewport.height / camera.zoom,
  };

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="panel px-2.5 py-1.5 text-xs font-medium text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
        aria-label="Show minimap"
      >
        Show map
      </button>
    );
  }

  return (
    <div className="panel overflow-hidden p-1.5">
      <svg
        ref={svgRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        role="img"
        aria-label="Board minimap. Click to jump to a location."
        className="cursor-crosshair rounded-md bg-[var(--surface-sunken)]"
        onClick={handleNavigate}
      >
        {elements.map((element) => {
          const isSelected = selectedIds.includes(element.id);
          if (element.type === 'connector') return null;
          if (element.type === 'draw' || element.type === 'highlighter') {
            const points = element.points ?? [];
            if (points.length < 2) return null;
            const d = points
              .map((point, index) => `${index === 0 ? 'M' : 'L'} ${(element.x + point.x) * scale + offsetX} ${(element.y + point.y) * scale + offsetY}`)
              .join(' ');
            return (
              <path
                key={element.id}
                d={d}
                fill="none"
                stroke={element.stroke}
                strokeWidth={Math.max(1, element.strokeWidth * scale)}
                opacity={0.75}
              />
            );
          }
          return (
            <rect
              key={element.id}
              x={element.x * scale + offsetX}
              y={element.y * scale + offsetY}
              width={Math.max(element.width * scale, 1.5)}
              height={Math.max(element.height * scale, 1.5)}
              rx={element.type === 'ellipse' ? Math.min(element.width, element.height) * scale * 0.5 : 1.5}
              fill={element.fill === 'transparent' ? 'var(--line-strong)' : element.fill}
              fillOpacity={0.7}
              stroke={isSelected ? 'var(--accent)' : element.stroke}
              strokeOpacity={isSelected ? 1 : 0.5}
              strokeWidth={isSelected ? 1.5 : 0.6}
            />
          );
        })}
        <rect
          x={viewportRect.x * scale + offsetX}
          y={viewportRect.y * scale + offsetY}
          width={Math.max(viewportRect.width * scale, 4)}
          height={Math.max(viewportRect.height * scale, 4)}
          fill="var(--accent)"
          fillOpacity={0.08}
          stroke="var(--accent)"
          strokeWidth={1.25}
          rx={2}
          pointerEvents="none"
        />
      </svg>
      <div className="flex items-center justify-between px-1 pb-0.5 pt-1">
        <span className="text-[10px] font-medium text-[var(--ink-faint)]">
          {Math.round(world.width)} × {Math.round(world.height)}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="text-[10px] font-semibold text-[var(--ink-faint)] transition-colors hover:text-[var(--ink)]"
        >
          Hide
        </button>
      </div>
    </div>
  );
}
