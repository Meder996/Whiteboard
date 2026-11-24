import { beforeEach, describe, expect, it } from 'vitest';
import { useEditor, emptyBoard } from '@/lib/store';
import { createElement } from '@/lib/elements';
import type { BoardElement } from '@/lib/types';

const reset = () => {
  useEditor.getState().hydrate(emptyBoard('test_board', 'Test board'));
  useEditor.getState().setViewport(1000, 700);
};

const addRect = (overrides: Partial<BoardElement> = {}) => {
  const element = { ...createElement('rect', 0, 0, 100, 80, { text: 'Hello' }), ...overrides };
  useEditor.getState().addElement(element);
  return element;
};

describe('editor store', () => {
  beforeEach(reset);

  it('adds elements and selects them', () => {
    const element = addRect();
    const state = useEditor.getState();
    expect(state.elements).toHaveLength(1);
    expect(state.selectedIds).toEqual([element.id]);
  });

  it('undoes and redoes element mutations', () => {
    addRect();
    const store = useEditor.getState();
    expect(store.elements).toHaveLength(1);

    store.undo();
    expect(useEditor.getState().elements).toHaveLength(0);

    useEditor.getState().redo();
    expect(useEditor.getState().elements).toHaveLength(1);
  });

  it('groups multi-selection so clicking one member selects the group', () => {
    const a = addRect();
    const b = addRect({ y: 120 });
    const store = useEditor.getState();
    store.setSelection([a.id, b.id]);
    store.groupSelection();

    expect(useEditor.getState().elements.every((element) => element.groupId)).toBe(true);

    useEditor.getState().setSelection([a.id]);
    expect(useEditor.getState().selectedIds.sort()).toEqual([a.id, b.id].sort());

    useEditor.getState().ungroupSelection();
    expect(useEditor.getState().elements.every((element) => element.groupId === null)).toBe(true);
  });

  it('duplicates selected elements with new ids, offset by 24px', () => {
    const element = addRect({ x: 10, y: 10 });
    useEditor.getState().duplicateSelection();
    const [original, clone] = useEditor.getState().elements;
    expect(clone.id).not.toBe(original.id);
    expect(clone.x).toBe(element.x + 24);
    expect(useEditor.getState().selectedIds).toEqual([clone.id]);
  });

  it('removes connectors when their attached shape is deleted', () => {
    const a = addRect();
    const b = addRect({ x: 300, y: 0 });
    const connector = createElement('connector', 0, 0, 0, 0, {
      start: { elementId: a.id, side: 'right', offset: 0.5 },
      end: { elementId: b.id, side: 'left', offset: 0.5 },
    });
    useEditor.getState().addElement(connector);
    expect(useEditor.getState().elements).toHaveLength(3);

    useEditor.getState().removeElements([a.id]);
    const ids = useEditor.getState().elements.map((element) => element.id);
    expect(ids).not.toContain(a.id);
    expect(ids).not.toContain(connector.id);
  });

  it('locks elements so the eraser ignores them', () => {
    const element = addRect();
    useEditor.getState().setSelection([element.id]);
    useEditor.getState().lockSelection(true);
    expect(useEditor.getState().elements[0].locked).toBe(true);

    useEditor.getState().eraseAt({ x: 50, y: 40 }, 20);
    expect(useEditor.getState().elements).toHaveLength(1);
    useEditor.getState().undo();
  });

  it('erases unlocked elements under the pointer', () => {
    addRect();
    useEditor.getState().eraseAt({ x: 50, y: 40 }, 12);
    expect(useEditor.getState().elements).toHaveLength(0);
  });

  it('reorders elements to the front and back', () => {
    const a = addRect();
    const b = addRect({ x: 40 });
    useEditor.getState().setSelection([a.id]);
    useEditor.getState().reorderSelection('front');
    expect(useEditor.getState().elements.map((element) => element.id)).toEqual([b.id, a.id]);

    useEditor.getState().reorderSelection('back');
    expect(useEditor.getState().elements.map((element) => element.id)).toEqual([a.id, b.id]);
  });

  it('keeps camera math consistent across zoom presets', () => {
    useEditor.getState().zoomTo(0.5);
    expect(useEditor.getState().camera.zoom).toBeCloseTo(0.5);
    useEditor.getState().resetZoom();
    expect(useEditor.getState().camera.zoom).toBeCloseTo(1);
  });

  it('resets the view so content is centered', () => {
    addRect({ x: 1000, y: 1000, width: 100, height: 100 });
    useEditor.getState().resetView();
    const { camera, viewport } = useEditor.getState();
    expect(camera.zoom).toBe(1);
    expect(1000 * camera.zoom + camera.x).toBeCloseTo(viewport.width / 2 - 50);
  });

  it('blocks mutations in read-only mode', () => {
    useEditor.getState().hydrate(emptyBoard('ro', 'Read only'), true);
    useEditor.getState().addElement(createElement('rect', 0, 0, 10, 10));
    expect(useEditor.getState().elements).toHaveLength(0);
    reset();
  });

  it('snapshots the board with a stable shape', () => {
    addRect();
    const snapshot = useEditor.getState().getBoardSnapshot();
    expect(snapshot.title).toBe('Test board');
    expect(snapshot.elements).toHaveLength(1);
    expect(snapshot.background).toEqual({ kind: 'grid', color: '#f8fafc' });
  });
});
