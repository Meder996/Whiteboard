'use client';

import { useEffect, useRef } from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Clipboard,
  Copy,
  CopyPlus,
  Group,
  Lock,
  LockOpen,
  Pencil,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { useEditor } from '@/lib/store';

export interface ContextMenuState {
  x: number;
  y: number;
  elementId: string | null;
}

export function ContextMenu({
  state,
  onClose,
  onEdit,
}: {
  state: ContextMenuState | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const elements = useEditor((store) => store.elements);
  const selectedIds = useEditor((store) => store.selectedIds);
  const duplicateSelection = useEditor((store) => store.duplicateSelection);
  const removeElements = useEditor((store) => store.removeElements);
  const lockSelection = useEditor((store) => store.lockSelection);
  const groupSelection = useEditor((store) => store.groupSelection);
  const ungroupSelection = useEditor((store) => store.ungroupSelection);
  const reorderSelection = useEditor((store) => store.reorderSelection);
  const readOnly = useEditor((store) => store.readOnly);

  useEffect(() => {
    if (!state) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [state, onClose]);

  if (!state) return null;

  const selected = elements.filter((element) => selectedIds.includes(element.id));
  const hasSelection = selected.length > 0;
  const allLocked = hasSelection && selected.every((element) => element.locked);
  const anyGrouped = selected.some((element) => element.groupId);
  const editable = selected.length === 1 && ['sticky', 'text', 'rect', 'ellipse', 'diamond'].includes(selected[0].type);

  const run = (action: () => void) => () => {
    action();
    onClose();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Object actions"
      className="panel fixed z-[80] w-56 animate-pop-in p-1.5"
      style={{
        left: Math.min(state.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 240),
        top: Math.min(state.y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 340),
      }}
    >
      {hasSelection ? (
        <>
          {editable ? (
            <button type="button" role="menuitem" className="menu-item" onClick={run(() => onEdit(selected[0].id))}>
              <Pencil className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> Edit text
              <kbd>↵</kbd>
            </button>
          ) : null}
          <button type="button" role="menuitem" className="menu-item" disabled={readOnly} onClick={run(duplicateSelection)}>
            <CopyPlus className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> Duplicate
            <kbd>⌘D</kbd>
          </button>
          <button type="button" role="menuitem" className="menu-item" disabled={readOnly} onClick={run(() => navigator.clipboard?.writeText(JSON.stringify(selected))) }>
            <Copy className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> Copy JSON
            <kbd>⌘C</kbd>
          </button>
          <div className="my-1 border-t border-[var(--line)]" />
          <button type="button" role="menuitem" className="menu-item" disabled={readOnly} onClick={run(() => reorderSelection('front'))}>
            <ArrowUpToLine className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> Bring to front
            <kbd>⌥⌘]</kbd>
          </button>
          <button type="button" role="menuitem" className="menu-item" disabled={readOnly} onClick={run(() => reorderSelection('back'))}>
            <ArrowDownToLine className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> Send to back
            <kbd>⌥⌘[</kbd>
          </button>
          <div className="my-1 border-t border-[var(--line)]" />
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={readOnly}
            onClick={run(() => lockSelection(!allLocked))}
          >
            {allLocked ? (
              <LockOpen className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
            ) : (
              <Lock className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
            )}
            {allLocked ? 'Unlock' : 'Lock'}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={readOnly || selected.length < 2}
            onClick={run(() => (anyGrouped ? ungroupSelection() : groupSelection()))}
          >
            {anyGrouped ? (
              <Ungroup className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
            ) : (
              <Group className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden />
            )}
            {anyGrouped ? 'Ungroup' : 'Group'}
            <kbd>⌘G</kbd>
          </button>
          <div className="my-1 border-t border-[var(--line)]" />
          <button
            type="button"
            role="menuitem"
            className="menu-item text-[var(--danger)] hover:bg-red-500/10"
            disabled={readOnly}
            onClick={run(() => removeElements(selectedIds))}
          >
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
            <kbd>⌫</kbd>
          </button>
        </>
      ) : (
        <div className="px-2.5 py-2 text-xs text-[var(--ink-muted)]">
          <p className="flex items-center gap-2 font-medium text-[var(--ink)]">
            <Clipboard className="h-3.5 w-3.5" aria-hidden /> Nothing selected
          </p>
          <p className="mt-1 leading-relaxed">Select an object to duplicate, reorder, lock, or delete it.</p>
        </div>
      )}
    </div>
  );
}
