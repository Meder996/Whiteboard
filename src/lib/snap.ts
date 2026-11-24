import { selectionBounds } from './geometry';
import type { BoardElement } from './types';

export interface GuideLine {
  orientation: 'vertical' | 'horizontal';
  position: number;
  /** Extent of the guide so it visually connects both objects. */
  start: number;
  end: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: GuideLine[];
}

const THRESHOLD = 6;

/**
 * Snap a moving selection to the edges/centres of other elements.
 * Returns the correction delta and guide lines to draw.
 */
export const snapSelection = (
  elements: BoardElement[],
  movingIds: string[],
  proposedBounds: { x: number; y: number; width: number; height: number },
  threshold = THRESHOLD,
): SnapResult => {
  const moving = new Set(movingIds);
  const others = elements.filter((element) => !moving.has(element.id) && element.type !== 'connector');
  if (!others.length) return { dx: 0, dy: 0, guides: [] };

  const movingX = [
    proposedBounds.x,
    proposedBounds.x + proposedBounds.width / 2,
    proposedBounds.x + proposedBounds.width,
  ];
  const movingY = [
    proposedBounds.y,
    proposedBounds.y + proposedBounds.height / 2,
    proposedBounds.y + proposedBounds.height,
  ];

  let bestX = { delta: 0, distance: threshold + 1, line: null as GuideLine | null };
  let bestY = { delta: 0, distance: threshold + 1, line: null as GuideLine | null };

  for (const element of others) {
    const targetsX = [element.x, element.x + element.width / 2, element.x + element.width];
    const targetsY = [element.y, element.y + element.height / 2, element.y + element.height];

    for (const target of targetsX) {
      for (const candidate of movingX) {
        const distance = Math.abs(target - candidate);
        if (distance < bestX.distance) {
          bestX = {
            delta: target - candidate,
            distance,
            line: {
              orientation: 'vertical',
              position: target,
              start: Math.min(proposedBounds.y, element.y),
              end: Math.max(proposedBounds.y + proposedBounds.height, element.y + element.height),
            },
          };
        }
      }
    }

    for (const target of targetsY) {
      for (const candidate of movingY) {
        const distance = Math.abs(target - candidate);
        if (distance < bestY.distance) {
          bestY = {
            delta: target - candidate,
            distance,
            line: {
              orientation: 'horizontal',
              position: target,
              start: Math.min(proposedBounds.x, element.x),
              end: Math.max(proposedBounds.x + proposedBounds.width, element.x + element.width),
            },
          };
        }
      }
    }
  }

  const guides: GuideLine[] = [];
  if (bestX.line && bestX.distance <= threshold) guides.push(bestX.line);
  if (bestY.line && bestY.distance <= threshold) guides.push(bestY.line);

  return {
    dx: bestX.distance <= threshold ? bestX.delta : 0,
    dy: bestY.distance <= threshold ? bestY.delta : 0,
    guides,
  };
};

export const snapToGrid = (value: number, gridSize = 8) => Math.round(value / gridSize) * gridSize;

export const boundsOfSelection = (elements: BoardElement[], ids: string[]) =>
  selectionBounds(elements.filter((element) => ids.includes(element.id)));
