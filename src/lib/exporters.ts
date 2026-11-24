'use client';

import { elementRect, selectionBounds } from './geometry';
import type { Board, BoardElement, BoardFile, ElementBinding } from './types';
import { BOARD_SCHEMA_VERSION } from './types';
import { renderElementsToSvg } from './svg';

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'board';

export const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const exportableElements = (elements: BoardElement[]) => elements.filter((element) => element.type !== 'connector' || isConnectorValid(element, elements));

const isConnectorValid = (element: BoardElement, elements: BoardElement[]) => {
  const refs = [element.start, element.end].filter(
    (endpoint): endpoint is ElementBinding =>
      Boolean(endpoint && typeof endpoint === 'object' && 'elementId' in endpoint),
  );
  return refs.every((ref) => elements.some((target) => target.id === ref.elementId));
};

/**
 * Compute the tight bounds of a board's content plus a padded background
 * rectangle, so exports are zoom-independent and framed nicely.
 */
export const exportFrame = (elements: BoardElement[], padding = 64) => {
  if (!elements.length) {
    return { x: 0, y: 0, width: 1280, height: 800, padding };
  }
  const bounds = selectionBounds(elements);
  const extra = Math.max(bounds.width, bounds.height) * 0.02;
  return {
    x: bounds.x - padding - extra,
    y: bounds.y - padding - extra,
    width: Math.max(bounds.width + (padding + extra) * 2, 200),
    height: Math.max(bounds.height + (padding + extra) * 2, 200),
    padding,
  };
};

export const buildSvg = (
  board: Board,
  elements: BoardElement[] = board.elements,
): { svg: string; frame: ReturnType<typeof exportFrame>; inner: string } => {
  const frame = exportFrame(elements);
  const width = Math.round(frame.width);
  const height = Math.round(frame.height);
  const content = renderElementsToSvg(elements, board.background);
  const background = `<rect x="0" y="0" width="${width}" height="${height}" fill="${board.background.color}" />`;
  const inner = `${defs}
  ${background}
  <g transform="translate(${-frame.x} ${-frame.y})">${content}</g>`;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${escapeXml(board.title)}</title>
  ${inner}
</svg>`;
  return { svg, frame, inner };
};

const defs = `<defs>
  <pattern id="hachure" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="8" stroke="#475569" strokeWidth="1.5" opacity="0.55" />
  </pattern>
</defs>`;

export const exportSvg = (board: Board) => {
  const { svg } = buildSvg(board);
  download(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${slugify(board.title)}.svg`);
};

export const exportJson = (board: Board) => {
  const file: BoardFile = {
    format: 'whiteboard-studio',
    version: BOARD_SCHEMA_VERSION,
    exportedAt: Date.now(),
    board: { ...board, elements: exportableElements(board.elements) },
  };
  download(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }), `${slugify(board.title)}.json`);
};

export const exportPng = async (board: Board, scale = 2): Promise<void> => {
  const elements = board.elements;
  const frame = exportFrame(elements);
  const width = Math.round(frame.width);
  const height = Math.round(frame.height);

  if (!elements.length) {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = board.background.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const blob = await canvasToBlob(canvas);
    download(blob, `${slugify(board.title)}.png`);
    return;
  }

  const { svg } = buildSvg(board);
  const image = await loadSvgImage(svg);
  const maxDimension = 8192;
  const clampedScale = Math.min(scale, maxDimension / Math.max(width, height, 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * Math.max(clampedScale, 0.25)));
  canvas.height = Math.max(1, Math.round(height * Math.max(clampedScale, 0.25)));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not create an export canvas.');
  ctx.fillStyle = board.background.color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas);
  download(blob, `${slugify(board.title)}.png`);
};

export const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Could not encode the PNG. Try a smaller board.'));
    }, 'image/png');
  });

export const loadSvgImage = (svg: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The board could not be rendered for export.'));
    };
    image.src = url;
  });

/** Minimal thumbnail for board cards. */
export const boardThumbnail = (elements: BoardElement[]): string | null => {
  if (!elements.length) return null;
  const frame = exportFrame(elements, 32);
  const width = Math.round(frame.width);
  const height = Math.round(frame.height);
  const content = renderElementsToSvg(elements, { kind: 'plain', color: '#f8fafc' });
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fafc"/><g transform="translate(${-frame.x} ${-frame.y})">${content}</g></svg>`,
  )}`;
};

export const contentBounds = (elements: BoardElement[]) =>
  elements.length ? selectionBounds(elements) : { x: 0, y: 0, width: 0, height: 0 };

export const elementArea = (element: BoardElement) => {
  const rect = elementRect(element);
  return rect.width * rect.height;
};
