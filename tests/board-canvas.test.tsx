import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { useEditor, emptyBoard } from '@/lib/store';
import { createElement, createSticky } from '@/lib/elements';
import { zoomAtPoint, screenToWorld } from '@/lib/geometry';

/**
 * The canvas uses pointer events + getBoundingClientRect for hit testing, so
 * these tests drive it the way a user would: pointerdown → pointermove → up.
 */
const setupCanvas = () => {
  useEditor.getState().hydrate(emptyBoard('canvas_board', 'Canvas test'));
  useEditor.getState().setViewport(800, 600);
  useEditor.getState().setCamera({ x: 0, y: 0, zoom: 1 });
  const utils = render(<BoardCanvas />);
  const svg = utils.container.querySelector('svg[role="application"]') as SVGSVGElement;
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON: () => ({}),
  } as DOMRect);
  return { ...utils, svg };
};

const pointer = (type: 'down' | 'move' | 'up', x: number, y: number, extra: Partial<PointerEventInit> = {}) => ({
  type,
  clientX: x,
  clientY: y,
  pointerId: 1,
  button: 0,
  ...extra,
});

describe('BoardCanvas interactions', () => {
  beforeEach(() => {
    useEditor.getState().setTool('select');
    useEditor.getState().clearSelection();
  });

  it('draws a rectangle by dragging with the rectangle tool', async () => {
    const { svg } = setupCanvas();
    act(() => useEditor.getState().setTool('rect'));

    fireEvent.pointerDown(svg, pointer('down', 100, 100));
    fireEvent.pointerMove(svg, pointer('move', 260, 220));
    fireEvent.pointerUp(svg, pointer('up', 260, 220));

    const elements = useEditor.getState().elements;
    expect(elements).toHaveLength(1);
    expect(elements[0].type).toBe('rect');
    expect(elements[0]).toMatchObject({ x: 100, y: 100, width: 160, height: 120 });
    // The tool returns to select so users can immediately style the shape.
    expect(useEditor.getState().tool).toBe('select');
  });

  it('creates a sticky note on click and opens the text editor', () => {
    const { svg } = setupCanvas();
    act(() => useEditor.getState().setTool('sticky'));

    fireEvent.pointerDown(svg, pointer('down', 320, 240));
    fireEvent.pointerUp(svg, pointer('up', 320, 240));

    const [sticky] = useEditor.getState().elements;
    expect(sticky.type).toBe('sticky');
    expect(sticky.fill).toBe('#fde68a');
    expect(useEditor.getState().editingId).toBe(sticky.id);
    expect(screen.getByLabelText('Edit text')).toBeInTheDocument();
  });

  it('commits text typed into a sticky and saves it on the element', () => {
    const { svg } = setupCanvas();
    act(() => useEditor.getState().setTool('sticky'));
    fireEvent.pointerDown(svg, pointer('down', 320, 240));
    fireEvent.pointerUp(svg, pointer('up', 320, 240));

    const textarea = screen.getByLabelText('Edit text');
    fireEvent.change(textarea, { target: { value: 'Ship the beta' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    const [sticky] = useEditor.getState().elements;
    expect(sticky.textStyle?.text).toBe('Ship the beta');
    expect(useEditor.getState().editingId).toBeNull();
    expect(screen.queryByLabelText('Edit text')).not.toBeInTheDocument();
  });

  it('selects and moves an element by dragging it', () => {
    const { svg } = setupCanvas();
    const rect = createElement('rect', 100, 100, 200, 120);
    act(() => useEditor.getState().addElement(rect));
    act(() => useEditor.getState().clearSelection());

    fireEvent.pointerDown(svg, pointer('down', 200, 160));
    fireEvent.pointerMove(svg, pointer('move', 260, 210));
    fireEvent.pointerUp(svg, pointer('up', 260, 210));

    const moved = useEditor.getState().elements[0];
    expect(useEditor.getState().selectedIds).toEqual([rect.id]);
    expect(moved.x).toBeGreaterThan(150);
    expect(moved.y).toBeGreaterThan(145);
  });

  it('marquee-selects multiple elements', () => {
    const { svg } = setupCanvas();
    const a = createElement('rect', 50, 50, 80, 80);
    const b = createElement('ellipse', 200, 60, 80, 80);
    const c = createElement('rect', 600, 400, 80, 80);
    act(() => useEditor.getState().addElements([a, b, c], { select: false }));
    act(() => useEditor.getState().clearSelection());

    fireEvent.pointerDown(svg, pointer('down', 20, 20));
    fireEvent.pointerMove(svg, pointer('move', 320, 200));
    fireEvent.pointerUp(svg, pointer('up', 320, 200));

    expect(useEditor.getState().selectedIds.sort()).toEqual([a.id, b.id].sort());
  });

  it('draws freehand strokes with the pen and drops single-point taps', () => {
    const { svg } = setupCanvas();
    act(() => useEditor.getState().setTool('pen'));

    fireEvent.pointerDown(svg, pointer('down', 100, 100));
    fireEvent.pointerMove(svg, pointer('move', 140, 130));
    fireEvent.pointerMove(svg, pointer('move', 180, 190));
    fireEvent.pointerUp(svg, pointer('up', 180, 190));

    const strokes = useEditor.getState().elements.filter((element) => element.type === 'draw');
    expect(strokes).toHaveLength(1);
    expect(strokes[0].points?.length).toBeGreaterThan(2);
    expect(strokes[0].width).toBeGreaterThan(50);
  });

  it('connects two shapes with the connector tool', () => {
    const { svg } = setupCanvas();
    const a = createElement('rect', 100, 100, 120, 80);
    const b = createElement('rect', 400, 100, 120, 80);
    act(() => useEditor.getState().addElements([a, b], { select: false }));
    act(() => useEditor.getState().clearSelection());
    act(() => useEditor.getState().setTool('connector'));

    // Start near the right edge of A, end near the left edge of B.
    fireEvent.pointerDown(svg, pointer('down', 220, 140));
    fireEvent.pointerMove(svg, pointer('move', 300, 140));
    fireEvent.pointerMove(svg, pointer('move', 400, 140));
    fireEvent.pointerUp(svg, pointer('up', 400, 140));

    const connectors = useEditor.getState().elements.filter((element) => element.type === 'connector');
    expect(connectors).toHaveLength(1);
    const [connector] = connectors;
    expect(connector.start).toMatchObject({ elementId: a.id });
    expect(connector.end).toMatchObject({ elementId: b.id });
  });

  it('erases an element when dragging the eraser over it', () => {
    const { svg } = setupCanvas();
    const sticky = createSticky(100, 100, 'Temporary');
    act(() => useEditor.getState().addElement(sticky));
    act(() => useEditor.getState().setTool('eraser'));

    fireEvent.pointerDown(svg, pointer('down', 190, 190));
    fireEvent.pointerUp(svg, pointer('up', 190, 190));

    expect(useEditor.getState().elements).toHaveLength(0);
  });

  it('pans with the hand tool without moving elements', () => {
    const { svg } = setupCanvas();
    const rect = createElement('rect', 100, 100, 100, 100);
    act(() => useEditor.getState().addElement(rect));
    act(() => useEditor.getState().setTool('hand'));

    fireEvent.pointerDown(svg, pointer('down', 300, 300));
    fireEvent.pointerMove(svg, pointer('move', 380, 340));
    fireEvent.pointerUp(svg, pointer('up', 380, 340));

    expect(useEditor.getState().camera).toMatchObject({ x: 80, y: 40 });
    expect(useEditor.getState().elements[0]).toMatchObject({ x: 100, y: 100 });
  });

  it('resizes with a corner handle', () => {
    const { container, svg } = setupCanvas();
    const rect = createElement('rect', 100, 100, 200, 100);
    act(() => useEditor.getState().addElement(rect));
    act(() => useEditor.getState().setSelection([rect.id]));

    const handle = container.querySelector('[data-handle="se"]') as SVGRectElement;
    expect(handle).toBeTruthy();

    fireEvent.pointerDown(handle, pointer('down', 300, 200));
    fireEvent.pointerMove(svg, pointer('move', 400, 260));
    fireEvent.pointerUp(svg, pointer('up', 400, 260));

    const resized = useEditor.getState().elements[0];
    expect(resized.width).toBeCloseTo(300, 0);
    expect(resized.height).toBeCloseTo(160, 0);
    expect(resized.x).toBeCloseTo(100, 0);
  });

  it('keeps the canvas usable in read-only mode', () => {
    const { svg } = setupCanvas();
    act(() => useEditor.getState().hydrate(emptyBoard('ro_canvas', 'Read only'), true));
    fireEvent.pointerDown(svg, pointer('down', 300, 300));
    fireEvent.pointerUp(svg, pointer('up', 300, 300));
    expect(useEditor.getState().elements).toHaveLength(0);
  });
});

describe('camera helpers used by the canvas', () => {
  it('maps a wheel zoom to the world point under the cursor', () => {
    const camera = { x: 0, y: 0, zoom: 1 };
    const cursor = { x: 400, y: 300 };
    const next = zoomAtPoint(camera, 2, cursor);
    expect(screenToWorld(cursor, next)).toEqual(screenToWorld(cursor, camera));
  });
});
