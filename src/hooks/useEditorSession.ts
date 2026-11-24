'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { debounce } from '@/lib/debounce';
import { saveBoard, getBoard } from '@/lib/db';
import { useEditor } from '@/lib/store';
import type { Board, SharedBoardPayload } from '@/lib/types';
import { parseSharePayload } from '@/lib/share';

/**
 * Owns the board lifecycle: loading, autosave, and share-link hydration.
 * Returns whether the current document is read-only.
 */
export function useEditorSession(boardId: string, shareHash: string) {
  const hydrate = useEditor((state) => state.hydrate);
  const setSaveState = useEditor((state) => state.setSaveState);
  const markSaved = useEditor((state) => state.markSaved);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [shared, setShared] = useState<SharedBoardPayload | null>(null);
  const createdAt = useRef<number>(Date.now());
  const saveRef = useRef<((board: Board) => void) | null>(null);

  // Persist with a short debounce so drags don't hammer IndexedDB.
  useEffect(() => {
    const persist = debounce(async (board: Board) => {
      try {
        setSaveState('saving');
        await saveBoard(board);
        markSaved();
      } catch (error) {
        console.error('Autosave failed', error);
        setSaveState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'error');
      }
    }, 450);

    saveRef.current = (board: Board) => persist(board);

    const unsubscribe = useEditor.subscribe((state, previous) => {
      if (state.readOnly) return;
      const contentChanged =
        state.elements !== previous.elements ||
        state.title !== previous.title ||
        state.background !== previous.background;
      const cameraChanged = state.camera !== previous.camera;
      if (!contentChanged && !cameraChanged) return;
      // Panning/zooming is persisted, but it is not "unsaved work".
      if (contentChanged) setSaveState('dirty');
      persist({ ...state.getBoardSnapshot(), createdAt: createdAt.current });
    });

    return () => {
      unsubscribe();
      persist.cancel();
    };
  }, [markSaved, setSaveState]);

  useEffect(() => {
    let cancelled = false;

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

  const saveNow = useCallback(async () => {
    const state = useEditor.getState();
    if (state.readOnly) return;
    try {
      setSaveState('saving');
      await saveBoard({ ...state.getBoardSnapshot(), createdAt: createdAt.current });
      markSaved();
    } catch {
      setSaveState('error');
    }
  }, [markSaved, setSaveState]);

  return { status, shared, saveNow };
}
