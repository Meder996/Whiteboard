import { describe, expect, it } from 'vitest';
import { buildSvg, exportFrame, slugify } from '@/lib/exporters';
import { renderElementsToSvg } from '@/lib/svg';
import { createElement, createSticky } from '@/lib/elements';
import { buildQuickStart } from '@/lib/templates';
import { emptyBoard } from '@/lib/store';
import { parseBoardFile, validateImageFile, MAX_IMAGE_BYTES } from '@/lib/upload';
import { buildShareUrl, encodeSharePayload, parseSharePayload } from '@/lib/share';
import { BOARD_SCHEMA_VERSION } from '@/lib/types';
import type { Board } from '@/lib/types';

const testBoard = (): Board => {
  const sticky = createSticky(0, 0, 'Plan the launch', undefined);
  const shape = createElement('rect', 300, 0, 200, 120, { text: 'Milestone' });
  const connector = createElement('connector', 0, 0, 0, 0, {
    start: { elementId: sticky.id, side: 'right', offset: 0.5 },
    end: { elementId: shape.id, side: 'left', offset: 0.5 },
    arrowEnd: 'arrow',
  });
  return { ...emptyBoard('export_board', 'Launch plan'), elements: [sticky, shape, connector] };
};

describe('export', () => {
  it('frames content with padding and is zoom independent', () => {
    const board = testBoard();
    const frame = exportFrame(board.elements, 40);
    expect(frame.x).toBeLessThanOrEqual(-40);
    expect(frame.y).toBeLessThanOrEqual(-40);
    expect(frame.width).toBeGreaterThan(500);
    expect(frame.height).toBeGreaterThan(160);
  });

  it('produces well-formed SVG with escaped titles', () => {
    const board = { ...testBoard(), title: 'A <b>&"title"' };
    const { svg } = buildSvg(board);
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('<svg');
    expect(svg.endsWith('</svg>'));
    expect(svg).toContain('A &lt;b&gt;&amp;&quot;title&quot;');
    expect(svg).not.toContain('NaN');
    expect(svg).not.toContain('undefined');
  });

  it('serialises text, shapes and arrowheads', () => {
    const board = testBoard();
    const svg = renderElementsToSvg(board.elements);
    expect(svg).toContain('<text');
    expect(svg).toContain('Plan the launch');
    expect(svg).toContain('<rect');
    expect(svg).toContain('<polygon');
    expect(svg).toContain('<path');
  });

  it('creates safe download filenames', () => {
    expect(slugify('Q4 Strategy / Planning 🚀')).toBe('q4-strategy-planning');
    expect(slugify('   ')).toBe('board');
  });

  it('renders even an empty board', () => {
    const board = emptyBoard('empty', 'Nothing here');
    const { svg, frame } = buildSvg(board);
    expect(svg).toContain('<svg');
    expect(frame.width).toBeGreaterThan(0);
  });
});

describe('import validation', () => {
  it('round-trips an exported board file', () => {
    const board = testBoard();
    const file = JSON.stringify({
      format: 'whiteboard-studio',
      version: BOARD_SCHEMA_VERSION,
      exportedAt: Date.now(),
      board,
    });
    const { board: imported, warnings } = parseBoardFile(file);
    expect(imported.title).toBe('Launch plan');
    expect(imported.elements).toHaveLength(3);
    expect(warnings).toHaveLength(0);
  });

  it('rejects invalid JSON with a clear message', () => {
    expect(() => parseBoardFile('{not json')).toThrow(/valid JSON/i);
  });

  it('rejects unknown structures', () => {
    expect(() => parseBoardFile(JSON.stringify({ hello: 'world' }))).toThrow(/board data/i);
  });

  it('rejects files from a newer schema', () => {
    expect(() =>
      parseBoardFile(
        JSON.stringify({ version: BOARD_SCHEMA_VERSION + 5, board: { title: 'future', elements: [] } }),
      ),
    ).toThrow(/newer version/i);
  });

  it('skips malformed elements and reports warnings', () => {
    const { board: imported, warnings } = parseBoardFile(
      JSON.stringify({
        board: {
          title: 'Messy import',
          elements: [
            { id: 'ok', type: 'rect', x: 0, y: 0, width: 60, height: 60 },
            { type: 'not-a-real-shape', x: 0, y: 0 },
            { type: 'rect', x: 'nope', y: 0 },
          ],
        },
      }),
    );
    expect(imported.elements).toHaveLength(1);
    expect(warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('strips non-data image sources from imported files', () => {
    const { board: imported } = parseBoardFile(
      JSON.stringify({
        board: {
          title: 'Images',
          elements: [{ id: 'img', type: 'image', x: 0, y: 0, width: 10, height: 10, src: 'javascript:alert(1)' }],
        },
      }),
    );
    expect(imported.elements[0].src).toBeUndefined();
  });

  it('validates uploaded files by type and size', () => {
    const good = new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' });
    expect(validateImageFile(good)).toBeNull();

    const svg = new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' });
    expect(validateImageFile(svg)).toMatch(/SVG/i);

    const pdf = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
    expect(validateImageFile(pdf)).toMatch(/unsupported/i);

    const huge = new File([new Uint8Array(MAX_IMAGE_BYTES + 10)], 'big.png', { type: 'image/png' });
    expect(validateImageFile(huge)).toMatch(/too large/i);
  });
});

describe('share links', () => {
  it('encodes and decodes a board snapshot', () => {
    const board = testBoard();
    const url = buildShareUrl(board, 'view', 'https://example.com');
    expect(url.startsWith('https://example.com/board/export_board#s=')).toBe(true);

    const hash = url.slice(url.indexOf('#'));
    const payload = parseSharePayload(hash);
    expect(payload?.title).toBe('Launch plan');
    expect(payload?.permission).toBe('view');
    expect(payload?.elements).toHaveLength(3);
  });

  it('preserves unicode content through the hash encoding', () => {
    const board = { ...testBoard(), title: 'Планирование 🚀 — 你好' };
    const encoded = encodeSharePayload(board, 'edit');
    const payload = parseSharePayload(`#s=${encoded}`);
    expect(payload?.title).toBe('Планирование 🚀 — 你好');
    expect(payload?.permission).toBe('edit');
  });

  it('returns null for tampered or missing payloads', () => {
    expect(parseSharePayload('')).toBeNull();
    expect(parseSharePayload('#s=not-base64!!')).toBeNull();
    expect(parseSharePayload(`#s=${btoa('{"nope":true}')}`)).toBeNull();
  });
});
