'use client';

import { create } from 'zustand';
import {
  getFitCamera,
  clamp,
  MIN_ZOOM,
  MAX_ZOOM,
  selectionBounds,
  uid,
  unionRects,
  elementRect,
  zoomAtPoint,
} from './geometry';
import type {
  Board,
  BoardBackground,
  BoardElement,
  Camera,
  ElementBinding,
  Point,
  Tool,
} from './types';
import { DEFAULT_STYLE, type ToolStyle } from './palette';

export type SaveState = 'saved' | 'saving' | 'dirty' | 'error' | 'offline';

interface HistoryEntry {
  elements: BoardElement[];
}

interface EditorState {
  boardId: string;
  title: string;
  elements: BoardElement[];
  background: BoardBackground;
  camera: Camera;
  viewport: { width: number; height: number };
  tool: Tool;
  style: ToolStyle;
  selectedIds: string[];
  editingId: string | null;
  saveState: SaveState;
  lastSavedAt: number | null;
  readOnly: boolean;

  past: HistoryEntry[];
  future: HistoryEntry[];
  gestureActive: boolean;

  hydrate: (board: Board, readOnly?: boolean) => void;
  setTool: (tool: Tool) => void;
  setStyle: (style: Partial<ToolStyle>) => void;
  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string, additive?: boolean) => void;
  clearSelection: () => void;
  setEditing: (id: string | null) => void;
  setSaveState: (state: SaveState) => void;
  markSaved: (at?: number) => void;
  setViewport: (width: number, height: number) => void;
  setTitle: (title: string) => void;
  setBackground: (background: BoardBackground) => void;

  beginGesture: () => void;
  endGesture: () => void;
  addElement: (element: BoardElement, options?: { select?: boolean }) => void;
  addElements: (elements: BoardElement[], options?: { select?: boolean }) => void;
  updateElement: (id: string, patch: Partial<BoardElement>) => void;
  updateElements: (patch: Record<string, Partial<BoardElement>>) => void;
  removeElements: (ids: string[]) => void;
  duplicateSelection: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  lockSelection: (locked: boolean) => void;
  reorderSelection: (direction: 'front' | 'back' | 'forward' | 'backward') => void;
  eraseAt: (point: Point, radius: number) => void;
  updateConnectors: () => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  setCamera: (camera: Camera) => void;
  panBy: (dx: number, dy: number) => void;
  zoomTo: (zoom: number, center?: Point) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: () => void;
  resetView: () => void;

  getBoardSnapshot: () => Board;
  groupElements: (ids: string[]) => BoardElement[];
}

const HISTORY_LIMIT = 100;

const snapshotOf = (elements: BoardElement[]): HistoryEntry => ({
  elements: elements.map((element) => ({ ...element, points: element.points?.map((p) => ({ ...p })) })),
});

export const emptyBoard = (id: string, title = 'Untitled board'): Board => ({
  id,
  title,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  elements: [],
  background: { kind: 'grid', color: '#f8fafc' },
  camera: { x: 0, y: 0, zoom: 1 },
});

/** Expand a selection to include every member of any group it touches. */
const expandGroups = (elements: BoardElement[], ids: string[]): string[] => {
  const groupIds = new Set(
    elements.filter((element) => ids.includes(element.id) && element.groupId).map((e) => e.groupId as string),
  );
  if (!groupIds.size) return ids;
  const expanded = new Set(ids);
  for (const element of elements) {
    if (element.groupId && groupIds.has(element.groupId)) expanded.add(element.id);
  }
  return Array.from(expanded);
};

export const useEditor = create<EditorState>((set, get) => ({
  boardId: '',
  title: 'Untitled board',
  elements: [],
  background: { kind: 'grid', color: '#f8fafc' },
  camera: { x: 0, y: 0, zoom: 1 },
  viewport: { width: 1200, height: 800 },
  tool: 'select',
  style: DEFAULT_STYLE,
  selectedIds: [],
  editingId: null,
  saveState: 'saved',
  lastSavedAt: null,
  readOnly: false,
  past: [],
  future: [],
  gestureActive: false,

  hydrate: (board, readOnly = false) =>
    set({
      boardId: board.id,
      title: board.title,
      elements: board.elements,
      background: board.background,
      camera: board.camera,
      selectedIds: [],
      editingId: null,
      past: [],
      future: [],
      saveState: 'saved',
      readOnly,
    }),

  setTool: (tool) => set({ tool, editingId: null }),
  setStyle: (style) => set((state) => ({ style: { ...state.style, ...style } })),
  setSelection: (ids) =>
    set((state) => {
      const valid = ids.filter((id) => state.elements.some((element) => element.id === id));
      return { selectedIds: expandGroups(state.elements, valid), editingId: null };
    }),
  toggleSelection: (id, additive = true) =>
    set((state) => {
      if (!additive) return { selectedIds: expandGroups(state.elements, [id]), editingId: null };
      const exists = state.selectedIds.includes(id);
      const next = exists
        ? state.selectedIds.filter((selected) => selected !== id)
        : expandGroups(state.elements, [...state.selectedIds, id]);
      return { selectedIds: next, editingId: null };
    }),
  clearSelection: () => set({ selectedIds: [], editingId: null }),
  setEditing: (id) => set({ editingId: id }),
  setSaveState: (saveState) => set({ saveState }),
  markSaved: (at = Date.now()) => set({ saveState: 'saved', lastSavedAt: at }),
  setViewport: (width, height) => set({ viewport: { width, height } }),
  setTitle: (title) => set({ title, saveState: 'dirty' }),
  setBackground: (background) =>
    set((state) => ({
      background,
      past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      future: [],
      saveState: 'dirty',
    })),

  beginGesture: () =>
    set((state) =>
      state.gestureActive
        ? state
        : {
            gestureActive: true,
            past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
            future: [],
          },
    ),

  endGesture: () => set({ gestureActive: false }),

  addElement: (element, options) => {
    const state = get();
    if (state.readOnly) return;
    const past = state.gestureActive ? state.past : [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT);
    set({
      elements: [...state.elements, element],
      selectedIds: options?.select === false ? state.selectedIds : [element.id],
      past,
      future: state.gestureActive ? state.future : [],
      saveState: 'dirty',
      editingId: null,
    });
  },

  addElements: (elements, options) => {
    const state = get();
    if (state.readOnly) return;
    const past = state.gestureActive ? state.past : [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT);
    set({
      elements: [...state.elements, ...elements],
      selectedIds: options?.select === false ? state.selectedIds : elements.map((element) => element.id),
      past,
      future: state.gestureActive ? state.future : [],
      saveState: 'dirty',
      editingId: null,
    });
  },

  updateElement: (id, patch) => {
    const state = get();
    if (state.readOnly) return;
    set({
      elements: state.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
      saveState: 'dirty',
    });
  },

  updateElements: (patch) => {
    const state = get();
    if (state.readOnly) return;
    set({
      elements: state.elements.map((element) => {
        const change = patch[element.id];
        return change ? { ...element, ...change } : element;
      }),
      saveState: 'dirty',
    });
  },

  removeElements: (ids) => {
    const state = get();
    if (state.readOnly || !ids.length) return;
    const idsToRemove = new Set(ids);
    const remaining = state.elements.filter((element) => !idsToRemove.has(element.id));
    const next = remaining.filter((element) => {
      if (element.type !== 'connector') return true;
      const start = element.start as ElementBinding | undefined;
      const end = element.end as ElementBinding | undefined;
      if (start && 'elementId' in start && idsToRemove.has(start.elementId)) return false;
      if (end && 'elementId' in end && idsToRemove.has(end.elementId)) return false;
      return true;
    });
    set({
      elements: next,
      selectedIds: state.selectedIds.filter((id) => !idsToRemove.has(id)),
      editingId: null,
      past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      future: [],
      saveState: 'dirty',
    });
  },

  duplicateSelection: () => {
    const state = get();
    if (state.readOnly || !state.selectedIds.length) return;
    const groupIdMap = new Map<string, string>();
    const clones = state.elements
      .filter((element) => state.selectedIds.includes(element.id))
      .map((element) => {
        let groupId: string | null = null;
        if (element.groupId) {
          if (!groupIdMap.has(element.groupId)) groupIdMap.set(element.groupId, uid('group'));
          groupId = groupIdMap.get(element.groupId) ?? null;
        }
        return {
          ...element,
          id: uid(element.type),
          x: element.x + 24,
          y: element.y + 24,
          groupId,
          locked: false,
          points: element.points?.map((point) => ({ ...point })),
        };
      });
    set({
      elements: [...state.elements, ...clones],
      selectedIds: clones.map((element) => element.id),
      past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      future: [],
      saveState: 'dirty',
    });
  },

  groupSelection: () => {
    const state = get();
    if (state.readOnly || state.selectedIds.length < 2) return;
    const groupId = uid('group');
    set({
      elements: state.elements.map((element) =>
        state.selectedIds.includes(element.id) ? { ...element, groupId } : element,
      ),
      past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      future: [],
      saveState: 'dirty',
    });
  },

  ungroupSelection: () => {
    const state = get();
    if (state.readOnly) return;
    set({
      elements: state.elements.map((element) =>
        state.selectedIds.includes(element.id) ? { ...element, groupId: null } : element,
      ),
      past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      future: [],
      saveState: 'dirty',
    });
  },

  lockSelection: (locked) => {
    const state = get();
    if (state.readOnly) return;
    set({
      elements: state.elements.map((element) =>
        state.selectedIds.includes(element.id) ? { ...element, locked } : element,
      ),
      past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      future: [],
      saveState: 'dirty',
    });
  },

  reorderSelection: (direction) => {
    const state = get();
    if (state.readOnly || !state.selectedIds.length) return;
    const selected = state.elements.filter((element) => state.selectedIds.includes(element.id));
    const others = state.elements.filter((element) => !state.selectedIds.includes(element.id));
    let next: BoardElement[];
    if (direction === 'front') next = [...others, ...selected];
    else if (direction === 'back') next = [...selected, ...others];
    else if (direction === 'forward') {
      next = [...state.elements];
      for (let i = next.length - 2; i >= 0; i -= 1) {
        if (state.selectedIds.includes(next[i].id) && !state.selectedIds.includes(next[i + 1].id)) {
          [next[i], next[i + 1]] = [next[i + 1], next[i]];
        }
      }
    } else {
      next = [...state.elements];
      for (let i = 1; i < next.length; i += 1) {
        if (state.selectedIds.includes(next[i].id) && !state.selectedIds.includes(next[i - 1].id)) {
          [next[i], next[i - 1]] = [next[i - 1], next[i]];
        }
      }
    }
    set({
      elements: next,
      past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      future: [],
      saveState: 'dirty',
    });
  },

  eraseAt: (point, radius) => {
    const state = get();
    if (state.readOnly) return;
    const hitIds = state.elements
      .filter((element) => {
        if (element.locked) return false;
        const rect = elementRect(element);
        const nearestX = clamp(point.x, rect.x, rect.x + rect.width);
        const nearestY = clamp(point.y, rect.y, rect.y + rect.height);
        return Math.hypot(point.x - nearestX, point.y - nearestY) <= radius + element.strokeWidth / 2;
      })
      .map((element) => element.id);
    if (hitIds.length) get().removeElements(hitIds);
  },

  updateConnectors: () => get().updateElements({}),

  undo: () => {
    const state = get();
    const previous = state.past[state.past.length - 1];
    if (!previous) return;
    set({
      elements: previous.elements,
      past: state.past.slice(0, -1),
      future: [...state.future, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      selectedIds: [],
      editingId: null,
      saveState: 'dirty',
    });
  },

  redo: () => {
    const state = get();
    const next = state.future[state.future.length - 1];
    if (!next) return;
    set({
      elements: next.elements,
      future: state.future.slice(0, -1),
      past: [...state.past, snapshotOf(state.elements)].slice(-HISTORY_LIMIT),
      selectedIds: [],
      editingId: null,
      saveState: 'dirty',
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  setCamera: (camera) => set({ camera }),
  panBy: (dx, dy) =>
    set((state) => ({ camera: { ...state.camera, x: state.camera.x + dx, y: state.camera.y + dy } })),
  zoomTo: (zoom, center) =>
    set((state) => {
      const viewportCenter = center ?? { x: state.viewport.width / 2, y: state.viewport.height / 2 };
      return { camera: zoomAtPoint(state.camera, zoom, viewportCenter) };
    }),
  zoomIn: () => get().zoomTo(clamp(get().camera.zoom * 1.2, MIN_ZOOM, MAX_ZOOM)),
  zoomOut: () => get().zoomTo(clamp(get().camera.zoom / 1.2, MIN_ZOOM, MAX_ZOOM)),
  resetZoom: () => get().zoomTo(1),
  fitToScreen: () => {
    const state = get();
    set({ camera: getFitCamera(state.elements, state.viewport) });
  },
  resetView: () => {
    const state = get();
    if (!state.elements.length) {
      set({ camera: { x: 0, y: 0, zoom: 1 } });
      return;
    }
    const bounds = selectionBounds(state.elements);
    set({
      camera: {
        zoom: 1,
        x: state.viewport.width / 2 - (bounds.x + bounds.width / 2),
        y: state.viewport.height / 2 - (bounds.y + bounds.height / 2),
      },
    });
  },

  getBoardSnapshot: () => {
    const state = get();
    return {
      id: state.boardId,
      title: state.title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      elements: state.elements,
      background: state.background,
      camera: state.camera,
    };
  },

  groupElements: (ids) => get().elements.filter((element) => ids.includes(element.id)),
}));

export const getSelectionBounds = () => {
  const state = useEditor.getState();
  return selectionBounds(state.elements.filter((element) => state.selectedIds.includes(element.id)));
};

export const getSelectedElements = () => {
  const state = useEditor.getState();
  return state.elements.filter((element) => state.selectedIds.includes(element.id));
};

export const getVisibleBounds = () => {
  const state = useEditor.getState();
  return unionRects(state.elements.map(elementRect));
};
