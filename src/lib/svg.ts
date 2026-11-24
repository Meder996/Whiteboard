/**
 * String-based SVG serialisation.
 *
 * The on-screen canvas renders through React (see lib/render.tsx) while
 * exports use this module. They share geometry helpers and text measuring so
 * exported output matches the visible board.
 */

import { anchorPoint, elementCenter, rotatePoint, smoothPath } from './geometry';
import { FONT_STACKS, LINE_HEIGHT_RATIO, layoutText, textPaddingFor } from './text';
import type { BoardElement, BoardBackground, ElementBinding, Point } from './types';

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const num = (value: number) => Math.round(value * 100) / 100;

const dashFor = (style: string) => (style === 'dashed' ? ' stroke-dasharray="10 7"' : style === 'dotted' ? ' stroke-dasharray="1.5 6"' : '');

const isBinding = (value: unknown): value is ElementBinding =>
  Boolean(value && typeof value === 'object' && 'elementId' in (value as object));

const resolve = (endpoint: ElementBinding | Point | undefined, fallback: Point, elements: BoardElement[]): Point => {
  if (!endpoint) return fallback;
  if (isBinding(endpoint)) {
    const target = elements.find((element) => element.id === endpoint.elementId);
    if (!target) return fallback;
    return anchorPoint(target, endpoint.side, endpoint.offset);
  }
  return endpoint;
};

const connectorPath = (start: Point, end: Point) => {
  const dx = end.x - start.x;
  if (Math.abs(dx) < 0.5 && Math.abs(end.y - start.y) < 0.5) return `M ${num(start.x)} ${num(start.y)}`;
  const sign = dx === 0 ? 1 : Math.sign(dx);
  const bend = Math.max(18, Math.min(120, Math.hypot(end.x - start.x, end.y - start.y) * 0.35));
  return `M ${num(start.x)} ${num(start.y)} C ${num(start.x + sign * bend)} ${num(start.y)}, ${num(end.x - sign * bend)} ${num(end.y)}, ${num(end.x)} ${num(end.y)}`;
};

const stickyTextColor = (fill: string) => {
  const hex = (fill || '').replace('#', '');
  if (hex.length !== 6) return '#1f2937';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1f2937' : '#0f172a';
};

const textMarkup = (element: BoardElement) => {
  const style = element.textStyle;
  if (!style || !style.text?.trim()) return '';
  const padding = textPaddingFor(element.type);
  const maxWidth = Math.max(element.width - padding * 2, style.fontSize);
  const layout = layoutText(style, maxWidth);

  const anchor = style.textAlign === 'center' ? 'middle' : style.textAlign === 'right' ? 'end' : 'start';
  let x = element.x + padding;
  if (style.textAlign === 'center') x = element.x + element.width / 2;
  if (style.textAlign === 'right') x = element.x + element.width - padding;

  const startY =
    element.type === 'sticky' || element.type === 'text'
      ? element.y + padding + style.fontSize
      : element.y + element.height / 2 - layout.height / 2 + style.fontSize;

  const color = element.type === 'sticky' ? stickyTextColor(element.fill) : element.stroke;
  const tspans = layout.lines
    .map(
      (line, index) =>
        `<tspan x="${num(x)}" y="${num(startY + index * style.fontSize * LINE_HEIGHT_RATIO)}">${escapeXml(line || ' ')}</tspan>`,
    )
    .join('');

  return `<text fill="${color}" font-family="${escapeXml(FONT_STACKS[style.fontFamily])}" font-size="${style.fontSize}" font-weight="${style.bold ? 700 : 400}" font-style="${style.italic ? 'italic' : 'normal'}" text-anchor="${anchor}" xml:space="preserve">${tspans}</text>`;
};

const transformFor = (element: BoardElement) => {
  const center = elementCenter(element);
  return element.angle
    ? ` transform="rotate(${num((element.angle * 180) / Math.PI)} ${num(center.x)} ${num(center.y)})"`
    : '';
};

const arrowHead = (from: Point, to: Point, color: string, size: number) => {
  if (Math.hypot(to.x - from.x, to.y - from.y) < 1) return '';
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  const points = [
    to,
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) },
  ]
    .map((point) => `${num(point.x)},${num(point.y)}`)
    .join(' ');
  return `<polygon points="${points}" fill="${color}" stroke="none" />`;
};

const elementToSvg = (element: BoardElement, elements: BoardElement[]): string => {
  const opacity = element.opacity !== 1 ? ` opacity="${num(element.opacity)}"` : '';
  const stroke = element.strokeWidth > 0 ? element.stroke : 'none';
  const fill = element.fillStyle === 'none' || element.fill === 'transparent'
    ? 'none'
    : element.fillStyle === 'hachure'
      ? 'url(#hachure)'
      : element.fill;
  const common = `fill="${fill}" stroke="${stroke}" stroke-width="${element.strokeWidth}"${dashFor(element.strokeStyle)} stroke-linecap="round" stroke-linejoin="round"`;

  if (element.type === 'connector') {
    const start = resolve(element.start, { x: element.x, y: element.y }, elements);
    const end = resolve(element.end, { x: element.x + element.width, y: element.y + element.height }, elements);
    const headSize = Math.max(10, element.strokeWidth * 3.4);
    const heads =
      (element.arrowEnd === 'arrow' ? arrowHead(start, end, element.stroke, headSize) : '') +
      (element.arrowStart === 'arrow' ? arrowHead(end, start, element.stroke, headSize) : '');
    return `<g${opacity}><path d="${connectorPath(start, end)}" fill="none" stroke="${element.stroke}" stroke-width="${element.strokeWidth}"${dashFor(element.strokeStyle)} stroke-linecap="round" />${heads}</g>`;
  }

  if (element.type === 'line' || element.type === 'arrow') {
    const points = element.points ?? [];
    const first = points[0] ?? { x: 0, y: 0 };
    const last = points[points.length - 1] ?? { x: element.width, y: element.height };
    const center = elementCenter(element);
    const a = rotatePoint({ x: element.x + first.x, y: element.y + first.y }, center, element.angle);
    const b = rotatePoint({ x: element.x + last.x, y: element.y + last.y }, center, element.angle);
    const headSize = Math.max(10, element.strokeWidth * 3.4);
    const heads =
      (element.type === 'arrow' || element.arrowEnd === 'arrow'
        ? arrowHead(a, b, element.stroke, headSize)
        : '') + (element.arrowStart === 'arrow' ? arrowHead(b, a, element.stroke, headSize) : '');
    return `<g${opacity}><line x1="${num(a.x)}" y1="${num(a.y)}" x2="${num(b.x)}" y2="${num(b.y)}" stroke="${element.stroke}" stroke-width="${element.strokeWidth}"${dashFor(element.strokeStyle)} stroke-linecap="round" />${heads}</g>`;
  }

  if (element.type === 'draw' || element.type === 'highlighter') {
    const points = element.points ?? [];
    if (points.length < 2) return '';
    const d = smoothPath(points);
    return `<g transform="translate(${num(element.x)} ${num(element.y)})"${transformFor(element)} opacity="${element.type === 'highlighter' ? 0.45 : element.opacity}"><path d="${d}" fill="none" stroke="${element.stroke}" stroke-width="${element.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" /></g>`;
  }

  let shape = '';
  if (element.type === 'image' && element.src) {
    shape = `<image href="${escapeXml(element.src)}" x="${num(element.x)}" y="${num(element.y)}" width="${num(element.width)}" height="${num(element.height)}" preserveAspectRatio="xMidYMid slice"${transformFor(element)}${opacity} />`;
    return shape;
  }
  if (element.type === 'sticky') {
    const shadow =
      element.shadow !== false
        ? `<rect x="${num(element.x + 3)}" y="${num(element.y + 4)}" width="${num(element.width)}" height="${num(element.height)}" fill="rgba(15,23,42,.10)"${transformFor(element)} />`
        : '';
    shape = `${shadow}<rect x="${num(element.x)}" y="${num(element.y)}" width="${num(element.width)}" height="${num(element.height)}" fill="${element.fill}" stroke="${stroke}" stroke-width="${element.strokeWidth}"${transformFor(element)}${opacity} />`;
  } else if (element.type === 'rect') {
    const radius = Math.min(16, element.width / 6, element.height / 6);
    shape = `<rect x="${num(element.x)}" y="${num(element.y)}" width="${num(element.width)}" height="${num(element.height)}" rx="${num(radius)}" ${common}${transformFor(element)}${opacity} />`;
  } else if (element.type === 'ellipse') {
    shape = `<ellipse cx="${num(element.x + element.width / 2)}" cy="${num(element.y + element.height / 2)}" rx="${num(element.width / 2)}" ry="${num(element.height / 2)}" ${common}${transformFor(element)}${opacity} />`;
  } else if (element.type === 'diamond') {
    const points = [
      `${num(element.x + element.width / 2)},${num(element.y)}`,
      `${num(element.x + element.width)},${num(element.y + element.height / 2)}`,
      `${num(element.x + element.width / 2)},${num(element.y + element.height)}`,
      `${num(element.x)},${num(element.y + element.height / 2)}`,
    ].join(' ');
    shape = `<polygon points="${points}" ${common}${transformFor(element)}${opacity} />`;
  } else if (element.type === 'text') {
    shape = '';
  }

  const text = element.type === 'image' ? '' : textMarkup(element);
  // Shapes rotate geometry around their centre; text is already placed in
  // board space, so it rotates around that same centre and stays aligned.
  const wrapped = text ? `<g${transformFor(element)}${opacity}>${text}</g>` : '';
  return shape + wrapped;
};

export const renderElementsToSvg = (elements: BoardElement[], _background?: BoardBackground): string =>
  elements.map((element) => elementToSvg(element, elements)).join('\n');
