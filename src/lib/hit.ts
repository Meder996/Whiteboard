import {
  boundsOfPoints,
  closestAnchor,
  distance,
  distanceToSegment,
  elementRect,
  fromLocal,
  pointInRect,
  rectsIntersect,
  rotatedCorners,
  toLocal,
} from './geometry';
import { lineEndPoints, resolveEndpoint } from './render';
import type { BoardElement, ElementBinding, Point } from './types';

const inRotatedRect = (point: Point, element: BoardElement, padding = 0): boolean => {
  const local = toLocal(point, element);
  return pointInRect(local, {
    x: element.x - padding,
    y: element.y - padding,
    width: element.width + padding * 2,
    height: element.height + padding * 2,
  });
};

const distanceToFreehand = (point: Point, element: BoardElement): number => {
  const points = element.points ?? [];
  if (!points.length) return Infinity;
  const local = toLocal(point, element);
  const absolute = points.map((p) => ({ x: p.x + element.x, y: p.y + element.y }));
  if (absolute.length === 1) return distance(local, absolute[0]);
  let min = Infinity;
  for (let i = 1; i < absolute.length; i += 1) {
    min = Math.min(min, distanceToSegment(local, absolute[i - 1], absolute[i]));
  }
  return min;
};

/** Does the point hit the element (in board coordinates)? */
export const hitTest = (point: Point, element: BoardElement, tolerance = 6): boolean => {
  if (element.type === 'connector') {
    const start = resolveEndpoint(element.start, { x: element.x, y: element.y }, [element]);
    const end = resolveEndpoint(element.end, { x: element.x + element.width, y: element.y + element.height }, [element]);
    return distanceToSegment(point, start, end) <= tolerance + element.strokeWidth;
  }

  if (element.type === 'draw' || element.type === 'highlighter') {
    return distanceToFreehand(point, element) <= tolerance + element.strokeWidth + 2;
  }

  if (element.type === 'line' || element.type === 'arrow') {
    const { start, end } = lineEndPoints(element);
    return distanceToSegment(point, start, end) <= tolerance + element.strokeWidth;
  }

  if (element.type === 'ellipse') {
    const local = toLocal(point, element);
    if (element.fillStyle !== 'none' && element.fill !== 'transparent') {
      return inRotatedRect(point, element, 2);
    }
    return inRotatedRect(point, element, tolerance) && distanceToFreehandEllipse(local, element) <= tolerance + 4;
  }

  if (element.type === 'text') {
    return inRotatedRect(point, element, 4);
  }

  return inRotatedRect(point, element, element.fillStyle === 'none' ? tolerance : 2);
};

const distanceToFreehandEllipse = (local: Point, element: BoardElement) => {
  const rx = Math.max(element.width / 2, 0.001);
  const ry = Math.max(element.height / 2, 0.001);
  const cx = element.x + rx;
  const cy = element.y + ry;
  const norm = Math.hypot((local.x - cx) / rx, (local.y - cy) / ry);
  // Approximate radial distance in world units.
  return Math.abs(norm - 1) * Math.min(rx, ry);
};

/** Topmost element under the point, honouring locked/visual order. */
export const elementAtPoint = (
  elements: BoardElement[],
  point: Point,
  options: { tolerance?: number; ignoreIds?: string[]; includeLocked?: boolean } = {},
): BoardElement | null => {
  const { tolerance = 6, ignoreIds = [], includeLocked = false } = options;
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const element = elements[i];
    if (ignoreIds.includes(element.id)) continue;
    if (element.locked && !includeLocked) continue;
    if (hitTest(point, element, tolerance)) return element;
  }
  return null;
};

/** All elements intersecting a marquee rectangle. */
export const elementsInRect = (
  elements: BoardElement[],
  rect: { x: number; y: number; width: number; height: number },
): BoardElement[] =>
  elements.filter((element) => {
    if (element.locked) return false;
    if (element.type === 'connector') {
      const start = resolveEndpoint(element.start, { x: element.x, y: element.y }, elements);
      const end = resolveEndpoint(element.end, { x: element.x + element.width, y: element.y + element.height }, elements);
      return pointInRect(start, rect) || pointInRect(end, rect) || segmentIntersectsRect(start, end, rect);
    }
    if (element.angle) {
      const corners = rotatedCorners(element);
      return corners.some((corner) => pointInRect(corner, rect)) || rectsIntersect(rect, elementRect(element));
    }
    return rectsIntersect(rect, elementRect(element));
  });

const segmentsCross = (p1: Point, p2: Point, p3: Point, p4: Point) => {
  const orient = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
};

export const segmentIntersectsRect = (
  a: Point,
  b: Point,
  rect: { x: number; y: number; width: number; height: number },
) => {
  if (pointInRect(a, rect) || pointInRect(b, rect)) return true;
  const corners: Point[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
  for (let i = 0; i < 4; i += 1) {
    if (segmentsCross(a, b, corners[i], corners[(i + 1) % 4])) return true;
  }
  return false;
};

/** Find a connectable anchor for the connector tool. */
export const connectorTargetAt = (
  elements: BoardElement[],
  point: Point,
  radius = 28,
): { element: BoardElement; binding: ElementBinding } | null => {
  let best: { element: BoardElement; binding: ElementBinding; distance: number } | null = null;
  for (const element of elements) {
    if (element.locked) continue;
    if (['connector', 'line', 'arrow', 'draw', 'highlighter'].includes(element.type)) continue;
    const anchor = closestAnchor(element, point);
    if (anchor.distance <= radius && (!best || anchor.distance < best.distance)) {
      best = {
        element,
        binding: { elementId: element.id, side: anchor.side, offset: anchor.offset },
        distance: anchor.distance,
      };
    }
  }
  return best ? { element: best.element, binding: best.binding } : null;
};

/** Bounding area of a freehand path in world space. */
export const freehandBounds = (element: BoardElement) => {
  const points = (element.points ?? []).map((p) => fromLocal({ x: p.x + element.x, y: p.y + element.y }, element));
  return boundsOfPoints(points);
};
