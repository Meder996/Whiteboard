import type { AnchorSide, BaseElement, Camera, Point } from './types';

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;
export const HANDLE_SIZE = 8;
export const ROTATE_HANDLE_DISTANCE = 26;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const roundTo = (value: number, step = 1) => Math.round(value / step) * step;

export const uid = (prefix = 'el') => {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
      : Math.random().toString(36).slice(2, 12);
  return `${prefix}_${random}`;
};

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const elementRect = (element: BaseElement): Rect => ({
  x: element.x,
  y: element.y,
  width: element.width,
  height: element.height,
});

export const elementCenter = (element: BaseElement): Point => ({
  x: element.x + element.width / 2,
  y: element.y + element.height / 2,
});

export const rotatePoint = (point: Point, center: Point, angle: number): Point => {
  if (!angle) return point;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
};

/** Rotate a screen/world point into the element's local (unrotated) space. */
export const toLocal = (point: Point, element: BaseElement): Point => {
  const center = elementCenter(element);
  return rotatePoint(point, center, -element.angle);
};

export const fromLocal = (point: Point, element: BaseElement): Point => {
  const center = elementCenter(element);
  return rotatePoint(point, center, element.angle);
};

export const rotatedCorners = (element: BaseElement): Point[] => {
  const center = elementCenter(element);
  const corners: Point[] = [
    { x: element.x, y: element.y },
    { x: element.x + element.width, y: element.y },
    { x: element.x + element.width, y: element.y + element.height },
    { x: element.x, y: element.y + element.height },
  ];
  return corners.map((corner) => rotatePoint(corner, center, element.angle));
};

export const boundsOfPoints = (points: Point[]): Rect => {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export const unionRects = (rects: Rect[]): Rect => {
  if (!rects.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    minX = Math.min(minX, rect.x);
    minY = Math.min(minY, rect.y);
    maxX = Math.max(maxX, rect.x + rect.width);
    maxY = Math.max(maxY, rect.y + rect.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};

export const selectionBounds = (elements: BaseElement[]): Rect => {
  if (!elements.length) return { x: 0, y: 0, width: 0, height: 0 };
  const rects = elements.map((element) => {
    if (!element.angle) return elementRect(element);
    return boundsOfPoints(rotatedCorners(element));
  });
  return unionRects(rects);
};

export const rectsIntersect = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const pointInRect = (point: Point, rect: Rect) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const distanceToSegment = (point: Point, a: Point, b: Point) => {
  const lengthSq = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (lengthSq === 0) return distance(point, a);
  let t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSq;
  t = clamp(t, 0, 1);
  return distance(point, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
};

export const pointInPolygon = (point: Point, polygon: Point[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

/** World-space anchor point for a binding on a side of an element. */
export const anchorPoint = (element: BaseElement, side: AnchorSide, offset = 0.5): Point => {
  const center = elementCenter(element);
  const local: Point =
    side === 'top'
      ? { x: element.x + element.width * offset, y: element.y }
      : side === 'bottom'
        ? { x: element.x + element.width * offset, y: element.y + element.height }
        : side === 'left'
          ? { x: element.x, y: element.y + element.height * offset }
          : { x: element.x + element.width, y: element.y + element.height * offset };
  return rotatePoint(local, center, element.angle);
};

/** The closest side/offset on an element for a connector endpoint. */
export const closestAnchor = (element: BaseElement, point: Point): { side: AnchorSide; offset: number; distance: number } => {
  const sides: AnchorSide[] = ['top', 'right', 'bottom', 'left'];
  let best = { side: 'top' as AnchorSide, offset: 0.5, distance: Infinity };
  for (const side of sides) {
    const steps = 17;
    for (let i = 0; i < steps; i += 1) {
      const offset = i / (steps - 1);
      const candidate = anchorPoint(element, side, offset);
      const d = distance(candidate, point);
      if (d < best.distance) best = { side, offset, distance: d };
    }
  }
  return best;
};

export const normalizeRect = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

export const screenToWorld = (point: Point, camera: Camera): Point => ({
  x: (point.x - camera.x) / camera.zoom,
  y: (point.y - camera.y) / camera.zoom,
});

export const worldToScreen = (point: Point, camera: Camera): Point => ({
  x: point.x * camera.zoom + camera.x,
  y: point.y * camera.zoom + camera.y,
});

export const zoomAtPoint = (camera: Camera, nextZoom: number, screenPoint: Point): Camera => {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const world = screenToWorld(screenPoint, camera);
  return {
    zoom,
    x: screenPoint.x - world.x * zoom,
    y: screenPoint.y - world.y * zoom,
  };
};

export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const HANDLE_IDS: HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const handlePoint = (rect: Rect, handle: HandleId): Point => {
  const xs: Record<HandleId, number> = {
    nw: rect.x,
    n: rect.x + rect.width / 2,
    ne: rect.x + rect.width,
    e: rect.x + rect.width,
    se: rect.x + rect.width,
    s: rect.x + rect.width / 2,
    sw: rect.x,
    w: rect.x,
  };
  const ys: Record<HandleId, number> = {
    nw: rect.y,
    n: rect.y,
    ne: rect.y,
    e: rect.y + rect.height / 2,
    se: rect.y + rect.height,
    s: rect.y + rect.height,
    sw: rect.y + rect.height,
    w: rect.y + rect.height / 2,
  };
  return { x: xs[handle], y: ys[handle] };
};

/**
 * Resize an element using a handle in the element's local coordinate space.
 * Keeps the opposite corner anchored and returns the new geometry.
 */
export const resizeElement = (
  element: BaseElement,
  handle: HandleId,
  pointerLocal: Point,
  options: { keepAspect?: boolean; minSize?: number; fromCenter?: boolean } = {},
): Pick<BaseElement, 'x' | 'y' | 'width' | 'height'> => {
  const minSize = options.minSize ?? 8;
  let left = element.x;
  let top = element.y;
  let right = element.x + element.width;
  let bottom = element.y + element.height;

  const movesLeft = handle.includes('w');
  const movesRight = handle.includes('e');
  const movesTop = handle.includes('n');
  const movesBottom = handle.includes('s');

  if (movesLeft) left = Math.min(pointerLocal.x, right - minSize);
  if (movesRight) right = Math.max(pointerLocal.x, left + minSize);
  if (movesTop) top = Math.min(pointerLocal.y, bottom - minSize);
  if (movesBottom) bottom = Math.max(pointerLocal.y, top + minSize);

  let width = right - left;
  let height = bottom - top;

  if (options.keepAspect && (movesLeft || movesRight) && (movesTop || movesBottom) && element.width && element.height) {
    const ratio = element.width / element.height;
    if (width / height > ratio) {
      width = height * ratio;
    } else {
      height = width / ratio;
    }
    if (movesLeft) left = right - width;
    if (movesTop) top = bottom - height;
  }

  if (options.fromCenter) {
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const halfW = (movesLeft || movesRight) ? Math.abs(pointerLocal.x - cx) : element.width / 2;
    const halfH = (movesTop || movesBottom) ? Math.abs(pointerLocal.y - cy) : element.height / 2;
    left = cx - halfW;
    top = cy - halfH;
    width = halfW * 2;
    height = halfH * 2;
  }

  return {
    x: left,
    y: top,
    width,
    height,
  };
};

/** Scale freehand/line local points when an element is resized. */
export const scaleLocalPoints = (
  element: BaseElement,
  next: Pick<BaseElement, 'width' | 'height'>,
): Point[] | undefined => {
  if (!element.points) return undefined;
  const scaleX = element.width ? next.width / element.width : 1;
  const scaleY = element.height ? next.height / element.height : 1;
  return element.points.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }));
};

export const getFitCamera = (elements: BaseElement[], viewport: { width: number; height: number }, padding = 96): Camera => {
  const content = elements.length
    ? selectionBounds(elements)
    : { x: -400, y: -300, width: 800, height: 600 };
  const width = Math.max(content.width, 1);
  const height = Math.max(content.height, 1);
  const zoom = clamp(
    Math.min((viewport.width - padding * 2) / width, (viewport.height - padding * 2) / height),
    MIN_ZOOM,
    1.5,
  );
  return {
    zoom,
    x: viewport.width / 2 - (content.x + width / 2) * zoom,
    y: viewport.height / 2 - (content.y + height / 2) * zoom,
  };
};
