'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { saveBoard, getBoard } from '@/lib/db';
import { useEditor } from '@/lib/store';
import type { Board, SharedBoardPayload } from '@/lib/types';
import { parseSharePayload } from '@/lib/share';

/** How long a burst of edits must settle before we quietly save in the background. */
const IDLE_SAVE_MS = 6000;

type PersistReason = 'manual' | 'idle' | 'exit';

/**
 * Owns the board lifecycle: loading, saving, and share-link hydration.
 *
 * Saving is deliberately Word-like rather than "every keystroke":
 *  - ⌘/Ctrl+S (or the Save button) writes immediately and clears the dirty flag.
 *  - After a pause in editing we save quietly in the background so nothing is
 *    easily lost, but the UI only ever says "Unsaved changes" until then.
 *  - Leaving the page, hiding the tab, or pressing "Save & exit" flushes the
 *    document before navigating.
 * Read-only share snapshots never write anything.
 */
export function useEditorSession(boardId: string, shareHash: string) {
  const hydrate = useEditor((state) => state.hydrate);
  const setSaveState = useEditor((state) => state.setSaveState);
  const markSaved = useEditor((state) => state.markSaved);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [shared, setShared] = useState<SharedBoardPayload | null>(null);
  const createdAt = useRef<number>(Date.now());
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while a write is in flight so concurrent flushes never interleave. */
  const writing = useRef<Promise<void> | null>(null);
  const loaded = useRef(false);

  const persist = useCallback(
    async (reason: PersistReason = 'manual') => {
      const state = useEditor.getState();
      if (state.readOnly || !loaded.current) return;
      if (writing.current) {
        await writing.current.catch(() => undefined);
      }
      if (reason !== 'exit') setSaveState('saving');
      const board: Board = { ...state.getBoardSnapshot(), createdAt: createdAt.current };
      const task = saveBoard(board)
        .then(() => {
          markSaved();
        })
        .catch((error) => {
          console.error('Save failed', error);
          setSaveState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
          throw error;
        })
        .finally(() => {
          writing.current = null;
        });
      writing.current = task;
      await task.catch(() => undefined);
    },
    [markSaved, setSaveState],
  );

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }, []);

  // Track dirtiness and schedule the quiet background save.
  useEffect(() => {
    const unsubscribe = useEditor.subscribe((state, previous) => {
      if (state.readOnly) return;
      const contentChanged =
        state.elements !== previous.elements ||
        state.title !== previous.title ||
        state.background !== previous.background;
      const cameraChanged = state.camera !== previous.camera;
      if (!contentChanged && !cameraChanged) return;
      if (contentChanged) setSaveState('dirty');
      clearIdleTimer();
      idleTimer.current = setTimeout(() => {
        idleTimer.current = null;
        void persist('idle');
      }, IDLE_SAVE_MS);
    });
    return () => {
      unsubscribe();
      clearIdleTimer();
    };
  }, [clearIdleTimer, persist, setSaveState]);

  // Flush on exit: before unload, when the tab is hidden/switched away, and
  // when the component unmounts (i.e. navigating to the dashboard).
  useEffect(() => {
    const flush = () => {
      if (useEditor.getState().readOnly) return;
      void persist('exit');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      clearIdleTimer();
      flush();
    };
  }, [clearIdleTimer, persist]);

  useEffect(() => {
    let cancelled = false;
    loaded.current = false;

    const load = async () => {
      setStatus('loading');
      try {
        // A share link always wins: it opens a snapshot in a read-only view.
        if (shareHash) {
          const payload = parseSharePayload(shareHash);
          if (payload) {
            if (cancelled) return;
            setShared(payload);
            hydrate(
              {
                id: boardId,
                title: payload.title,
                createdAt: payload.sharedAt,
                updatedAt: payload.sharedAt,
                elements: payload.elements,
                background: payload.background,
                camera: { x: 0, y: 0, zoom: 1 },
              },
              payload.permission !== 'edit',
            );
            loaded.current = true;
            setStatus('ready');
            return;
          }
        }

        const board = await getBoard(boardId);
        if (cancelled) return;
        if (!board) {
          setStatus('missing');
          return;
        }
        createdAt.current = board.createdAt;
        hydrate(board, false);
        markSaved(board.updatedAt);
        loaded.current = true;
        setStatus('ready');
      } catch (error) {
        console.error('Failed to load board', error);
        if (!cancelled) setStatus('error');
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [boardId, shareHash, hydrate, markSaved]);

  /** Explicit save (⌘S / Save button). */
  const saveNow = useCallback(async () => {
    clearIdleTimer();
    await persist('manual');
  }, [clearIdleTimer, persist]);

  /** Save, then let the caller navigate (used by "Save & exit"). */
  const saveAndExit = useCallback(async () => {
    clearIdleTimer();
    await persist('manual');
  }, [clearIdleTimer, persist]);

  const hasUnsavedChanges = useEditor((state) => state.saveState !== 'saved');

  return { status, shared, saveNow, saveAndExit, hasUnsavedChanges };
}
