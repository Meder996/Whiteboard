'use client';

import { useEffect } from 'react';
import { useEditor } from '@/lib/store';
import type { Tool } from '@/lib/types';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  h: 'hand',
  p: 'pen',
  m: 'highlighter',
  e: 'eraser',
  n: 'sticky',
  t: 'text',
  r: 'rect',
  o: 'ellipse',
  d: 'diamond',
  l: 'line',
  a: 'arrow',
  c: 'connector',
};

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable ||
    element.getAttribute?.('role') === 'textbox'
  );
};

export function useKeyboardShortcuts({ onShortcuts }: { onShortcuts: () => void }) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const state = useEditor.getState();
      if (isTypingTarget(event.target) || state.editingId) return;

      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      // Modifier combos
      if (mod) {
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) state.redo();
          else state.undo();
          return;
        }
        if (key === 'y') {
          event.preventDefault();
          state.redo();
          return;
        }
        if (key === 'd') {
          event.preventDefault();
          state.duplicateSelection();
          return;
        }
        if (key === 'a') {
          event.preventDefault();
          state.setSelection(state.elements.map((element) => element.id));
          return;
        }
        if (key === 'g') {
          event.preventDefault();
          if (event.shiftKey) state.ungroupSelection();
          else state.groupSelection();
          return;
        }
        if (key === 'l' && event.altKey) {
          event.preventDefault();
          const selected = state.elements.filter((element) => state.selectedIds.includes(element.id));
          const allLocked = selected.length > 0 && selected.every((element) => element.locked);
          state.lockSelection(!allLocked);
          return;
        }
        if (key === '=' || key === '+') {
          event.preventDefault();
          state.zoomIn();
          return;
        }
        if (key === '-') {
          event.preventDefault();
          state.zoomOut();
          return;
        }
        if (key === '0') {
          event.preventDefault();
          state.resetZoom();
          return;
        }
        if ((key === ']' || key === '}') && event.shiftKey && event.altKey) {
          event.preventDefault();
          state.reorderSelection('front');
          return;
        }
        if ((key === '[' || key === '{') && event.shiftKey && event.altKey) {
          event.preventDefault();
          state.reorderSelection('back');
          return;
        }
        if (key === ']' || key === '}') {
          event.preventDefault();
          state.reorderSelection('forward');
          return;
        }
        if (key === '[' || key === '{') {
          event.preventDefault();
          state.reorderSelection('backward');
          return;
        }
        if (key === 's') {
          // Prevent the browser save dialog; autosave already handles it.
          event.preventDefault();
          return;
        }
        return;
      }

      if (event.shiftKey && event.key === '1') {
        event.preventDefault();
        state.fitToScreen();
        return;
      }
      if (event.shiftKey && event.key === '0') {
        event.preventDefault();
        state.resetView();
        return;
      }

      if (key === '?') {
        event.preventDefault();
        onShortcuts();
        return;
      }

      if (key === 'escape') {
        state.clearSelection();
        state.setEditing(null);
        if (state.tool !== 'select') state.setTool('select');
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        if (state.selectedIds.length) {
          event.preventDefault();
          state.removeElements(state.selectedIds);
        }
        return;
      }

      if (key.startsWith('arrow')) {
        if (!state.selectedIds.length || state.readOnly) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const delta = {
          arrowleft: [-step, 0],
          arrowright: [step, 0],
          arrowup: [0, -step],
          arrowdown: [0, step],
        }[key] ?? [0, 0];
        state.beginGesture();
        state.updateElements(
          Object.fromEntries(
            state.elements
              .filter((element) => state.selectedIds.includes(element.id) && !element.locked)
              .map((element) => [element.id, { x: element.x + delta[0], y: element.y + delta[1] }]),
          ),
        );
        state.endGesture();
        return;
      }

      if (key === 'enter' || key === 'f2') {
        const selected = state.elements.find((element) => element.id === state.selectedIds[0]);
        if (selected && !selected.locked && ['sticky', 'text', 'rect', 'ellipse', 'diamond'].includes(selected.type)) {
          event.preventDefault();
          state.setEditing(selected.id);
        }
        return;
      }

      if (TOOL_KEYS[key] && !state.readOnly) {
        event.preventDefault();
        state.setTool(TOOL_KEYS[key]);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onShortcuts]);
}
