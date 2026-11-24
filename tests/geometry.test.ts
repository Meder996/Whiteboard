import { describe, expect, it } from 'vitest';
import {
  boundsOfPoints,
  closestAnchor,
  getFitCamera,
  normalizeRect,
  resizeElement,
  rotatePoint,
  screenToWorld,
  selectionBounds,
  smoothPath,
  simplifyPoints,
  worldToScreen,
  zoomAtPoint,
} from '@/lib/geometry';
import type { BoardElement } from '@/lib/types';

const make = (overrides: Partial<BoardElement> = {}): BoardElement => ({
  id: 'el_1',
  type: 'rect',
  x: 100,
  y: 50,
  width: 200,
  height: 100,
  angle: 0,
  opacity: 1,
  locked: false,
  groupId: null,
  stroke: '#000',
  strokeWidth: 2,
  strokeStyle: 'solid',
  fill: '#fff',
  fillStyle: 'solid',
  ...overrides,
});

describe('geometry', () => {
  it('converts between screen and world coordinates at any zoom', () => {
    const camera = { x: 40, y: -20, zoom: 2.5 };
    const world = { x: 123.4, y: -56.7 };
    const screen = worldToScreen(world, camera);
    expect(screen).toEqual({ x: 123.4 * 2.5 + 40, y: -56.7 * 2.5 - 20 });
    const roundTrip = screenToWorld(screen, camera);
    expect(roundTrip.x).toBeCloseTo(world.x);
    expect(roundTrip.y).toBeCloseTo(world.y);
  });

  it('zooms around the pointer so the world point stays put', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const pointer = { x: 300, y: 200 };
    const before = screenToWorld(pointer, camera);
    const zoomed = zoomAtPoint(camera, 2.4, pointer);
    const after = screenToWorld(pointer, zoomed);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('clamps zoom to the supported range', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    expect(zoomAtPoint(camera, 99, { x: 0, y: 0 }).zoom).toBe(4);
    expect(zoomAtPoint(camera, 0.0001, { x: 0, y: 0 }).zoom).toBe(0.1);
  });

  it('resizes from the south-east handle keeping the top-left anchored', () => {
    const element = make();
    const next = resizeElement(element, 'se', { x: 400, y: 300 });
    expect(next).toEqual({ x: 100, y: 50, width: 300, height: 250 });
  });

  it('resizes from the north-west handle keeping the opposite corner fixed', () => {
    const element = make();
    const next = resizeElement(element, 'nw', { x: 150, y: 100 });
    expect(next.x).toBe(150);
    expect(next.y).toBe(100);
    expect(next.x + next.width).toBe(300);
    expect(next.y + next.height).toBe(150);
  });

  it('never collapses an element below the minimum size', () => {
    const element = make();
    const next = resizeElement(element, 'se', { x: -1000, y: -1000 }, { minSize: 8 });
    expect(next.width).toBeGreaterThanOrEqual(8);
    expect(next.height).toBeGreaterThanOrEqual(8);
  });

  it('keeps aspect ratio when requested', () => {
    const element = make({ width: 200, height: 100 });
    const next = resizeElement(element, 'se', { x: 500, y: 120 }, { keepAspect: true });
    expect(next.width / next.height).toBeCloseTo(2, 1);
  });

  it('rotates points around a centre', () => {
    const rotated = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    expect(rotated.x).toBeCloseTo(0);
    expect(rotated.y).toBeCloseTo(1);
  });

  it('computes selection bounds including rotated elements', () => {
    const bounds = selectionBounds([make(), make({ id: 'el_2', x: 0, y: 0, width: 50, height: 50 })]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 300, height: 150 });

    const rotated = selectionBounds([make({ id: 'el_3', x: 0, y: 0, width: 100, height: 100, angle: Math.PI / 4 })]);
    expect(rotated.width).toBeCloseTo(Math.SQRT2 * 100, 5);
  });

  it('normalises rectangles dragged in any direction', () => {
    expect(normalizeRect({ x: 10, y: 10 }, { x: 2, y: 4 })).toEqual({ x: 2, y: 4, width: 8, height: 6 });
  });

  it('fits content into the viewport with padding', () => {
    const camera = getFitCamera([make()], { width: 800, height: 600 }, 50);
    const topLeft = {
      x: 100 * camera.zoom + camera.x,
      y: 50 * camera.zoom + camera.y,
    };
    expect(topLeft.x).toBeGreaterThanOrEqual(49);
    expect(topLeft.y).toBeGreaterThanOrEqual(49);
    expect(camera.zoom).toBeLessThanOrEqual(1.5);
  });

  it('finds the nearest anchor side on a shape', () => {
    const element = make();
    expect(closestAnchor(element, { x: 200, y: -100 }).side).toBe('top');
    expect(closestAnchor(element, { x: 500, y: 100 }).side).toBe('right');
    expect(closestAnchor(element, { x: 200, y: 400 }).side).toBe('bottom');
    expect(closestAnchor(element, { x: -400, y: 100 }).side).toBe('left');
  });

  it('bounds a list of points', () => {
    expect(boundsOfPoints([{ x: 3, y: 9 }, { x: -2, y: 4 }, { x: 8, y: -1 }])).toEqual({
      x: -2,
      y: -1,
      width: 10,
      height: 10,
    });
  });
});

describe('freehand smoothing', () => {
  it('emits quadratic curves rather than a faceted polyline', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 10, y: 6 },
      { x: 20, y: 0 },
      { x: 30, y: -6 },
      { x: 40, y: 0 },
    ];
    const d = smoothPath(points);
    expect(d.startsWith(`M 0 0`)).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(3);
    // Ends exactly on the last captured sample, so ink stays under the finger.
    expect(d.endsWith('L 40 0')).toBe(true);
  });

  it('rounds coordinates and drops duplicate samples', () => {
    const d = smoothPath([
      { x: 0, y: 0 },
      { x: 0.05, y: 0.05 },
      { x: 10.123456, y: 20.987654 },
      { x: 20, y: 30 },
    ]);
    expect(d).toContain('10.12 20.99');
    expect(d).not.toContain('0.05');
  });

  it('handles degenerate strokes without throwing', () => {
    expect(smoothPath([])).toBe('');
    expect(smoothPath([{ x: 4, y: 4 }])).toContain('l 0.01 0');
    expect(smoothPath([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBe('M 0 0 L 5 5');
  });
});
