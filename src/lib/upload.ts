'use client';

import { createElement } from './elements';
import { uid } from './geometry';
import type { Board, BoardElement, BoardFile } from './types';
import { BOARD_SCHEMA_VERSION } from './types';

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // 6 MB per image
export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;

export interface UploadResult {
  element: BoardElement;
  width: number;
  height: number;
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });

const loadImageSize = (src: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('That image could not be decoded.'));
    image.src = src;
  });

/**
 * Some browsers and OS drag sources hand over an empty or generic MIME type
 * (notably Linux/webview drops, and clipboard images from macOS Preview).
 * Sniff the magic bytes so a valid PNG is not rejected for a missing label.
 */
const readHead = async (file: File): Promise<Uint8Array> => {
  const slice = file.slice(0, 16);
  if (typeof slice.arrayBuffer === 'function') return new Uint8Array(await slice.arrayBuffer());
  // Older Safari lacks Blob.arrayBuffer.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array((reader.result as ArrayBuffer) ?? new ArrayBuffer(0)));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsArrayBuffer(slice);
  });
};

const sniffImageType = async (file: File): Promise<string | null> => {
  try {
    const head = await readHead(file);
    const starts = (bytes: number[], at = 0) => bytes.every((byte, index) => head[at + index] === byte);
    if (starts([0x89, 0x50, 0x4e, 0x47])) return 'image/png';
    if (starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
    if (starts([0x47, 0x49, 0x46, 0x38])) return 'image/gif';
    if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
    if (starts([0x3c, 0x3f, 0x78, 0x6d, 0x6c]) || starts([0x3c, 0x73, 0x76, 0x67])) return 'image/svg+xml';
    return null;
  } catch {
    return null;
  }
};

const typeOf = async (file: File): Promise<string> => {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  return (await sniffImageType(file)) ?? file.type;
};

export const validateImageFile = (file: File, resolvedType?: string): string | null => {
  const type = resolvedType ?? file.type;
  if (!ACCEPTED_IMAGE_TYPES.includes(type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    if (type === 'image/svg+xml') {
      return `${file.name}: SVG uploads are disabled for safety. Export it as PNG first.`;
    }
    if (!type) {
      return `${file.name}: that file has no recognizable image format. Use PNG, JPEG, WebP, or GIF.`;
    }
    return `${file.name}: unsupported file type (${type}). Use PNG, JPEG, WebP, or GIF.`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)} MB is too large. The limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`;
  }
  if (file.size === 0) return `${file.name}: the file is empty.`;
  return null;
};

export const createImageElement = async (
  file: File,
  position: { x: number; y: number },
  maxWidth = 520,
): Promise<UploadResult> => {
  // Resolve the type first: some sources hand over an empty MIME type even for
  // a perfectly good PNG, so validate the real content rather than the label.
  const type = await typeOf(file);
  const typeError = validateImageFile(file, type);
  if (typeError) throw new Error(typeError);

  const src = await readAsDataUrl(file);
  const natural = await loadImageSize(src).catch(() => {
    throw new Error(`${file.name}: the image is corrupt or uses an unsupported codec.`);
  });
  if (!natural.width || !natural.height) {
    throw new Error(`${file.name}: the image has no dimensions.`);
  }
  const scale = Math.min(1, maxWidth / natural.width, 620 / natural.height);
  const width = Math.round(natural.width * scale);
  const height = Math.round(natural.height * scale);

  const element = createElement('image', position.x, position.y, width, height, {
    src,
    imageName: file.name,
    stroke: 'transparent',
    strokeWidth: 0,
    fill: 'transparent',
    fillStyle: 'none',
    // Round to avoid extremely long coordinates from fractional drops.
  });
  return { element, width, height };
};

export interface ImportedBoard {
  board: Board;
  warnings: string[];
}

/** Parse and validate an exported board JSON file. */
export const parseBoardFile = (raw: string): ImportedBoard => {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  if (!json || typeof json !== 'object') throw new Error('That file is empty or malformed.');
  const file = json as Partial<BoardFile> & { board?: unknown; elements?: unknown };

  const candidate = (file.board ?? file) as Partial<Board>;
  if (!Array.isArray(candidate.elements)) {
    throw new Error('No board data found. Import a JSON file exported from Whiteboard Studio.');
  }
  if (file.version && Number(file.version) > BOARD_SCHEMA_VERSION) {
    throw new Error('This file was created by a newer version of Whiteboard Studio.');
  }

  const warnings: string[] = [];
  const ids = new Set<string>();
  const elements: BoardElement[] = [];

  for (const item of candidate.elements as unknown[]) {
    if (!item || typeof item !== 'object') {
      warnings.push('Skipped a malformed element.');
      continue;
    }
    const element = item as Partial<BoardElement>;
    if (typeof element.type !== 'string' || !VALID_TYPES.has(element.type)) {
      warnings.push(`Skipped an element with unknown type "${String(element.type)}".`);
      continue;
    }
    if (typeof element.x !== 'number' || typeof element.y !== 'number') {
      warnings.push('Skipped an element with invalid coordinates.');
      continue;
    }
    const id = typeof element.id === 'string' && !ids.has(element.id) ? element.id : uid(element.type);
    ids.add(id);
    elements.push({
      id,
      type: element.type,
      x: element.x,
      y: element.y,
      width: Number.isFinite(element.width) ? Math.max(Number(element.width), 1) : 100,
      height: Number.isFinite(element.height) ? Math.max(Number(element.height), 1) : 100,
      angle: Number.isFinite(element.angle) ? Number(element.angle) : 0,
      opacity: Number.isFinite(element.opacity) ? Math.min(Math.max(Number(element.opacity), 0), 1) : 1,
      locked: Boolean(element.locked),
      groupId: typeof element.groupId === 'string' ? element.groupId : null,
      stroke: typeof element.stroke === 'string' ? element.stroke : '#1e293b',
      strokeWidth: Number.isFinite(element.strokeWidth) ? Math.max(0, Number(element.strokeWidth)) : 2,
      strokeStyle: ['solid', 'dashed', 'dotted'].includes(String(element.strokeStyle))
        ? (element.strokeStyle as BoardElement['strokeStyle'])
        : 'solid',
      fill: typeof element.fill === 'string' ? element.fill : 'transparent',
      fillStyle: ['solid', 'none', 'hachure'].includes(String(element.fillStyle))
        ? (element.fillStyle as BoardElement['fillStyle'])
        : 'none',
      textStyle: element.textStyle
        ? {
            text: typeof element.textStyle.text === 'string' ? element.textStyle.text.slice(0, 4000) : '',
            fontSize: Number.isFinite(element.textStyle.fontSize) ? Number(element.textStyle.fontSize) : 20,
            fontFamily: ['sans', 'hand', 'mono'].includes(element.textStyle.fontFamily)
              ? element.textStyle.fontFamily
              : 'sans',
            textAlign: ['left', 'center', 'right'].includes(element.textStyle.textAlign)
              ? element.textStyle.textAlign
              : 'center',
            bold: Boolean(element.textStyle.bold),
            italic: Boolean(element.textStyle.italic),
          }
        : undefined,
      points: Array.isArray(element.points)
        ? element.points
            .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
            .map((point) => ({ x: point.x, y: point.y }))
        : undefined,
      src: typeof element.src === 'string' && element.src.startsWith('data:image/') ? element.src : undefined,
      imageName: typeof element.imageName === 'string' ? element.imageName : undefined,
      start: element.start,
      end: element.end,
      arrowStart: element.arrowStart === 'arrow' ? 'arrow' : 'none',
      arrowEnd: element.arrowEnd === 'arrow' ? 'arrow' : 'none',
      shadow: element.shadow !== false,
    });
  }

  if (!elements.length && (candidate.elements as unknown[]).length) {
    throw new Error('No valid elements were found in that file.');
  }

  const board: Board = {
    id: uid('board'),
    title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title.slice(0, 120) : 'Imported board',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    elements,
    background:
      candidate.background && typeof candidate.background.color === 'string'
        ? candidate.background
        : { kind: 'grid', color: '#f8fafc' },
    camera: { x: 0, y: 0, zoom: 1 },
  };

  if (!elements.length) warnings.push('The board contained no objects. Starting with an empty canvas.');

  return { board, warnings };
};

const VALID_TYPES = new Set([
  'rect',
  'ellipse',
  'diamond',
  'line',
  'arrow',
  'draw',
  'highlighter',
  'sticky',
  'text',
  'image',
  'connector',
]);
