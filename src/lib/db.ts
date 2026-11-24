'use client';

import type { Board, BoardElement, BoardMeta } from './types';
import { BOARD_SCHEMA_VERSION } from './types';

/**
 * Local-first persistence.
 *
 * Boards live in IndexedDB (with a localStorage fallback for browsers where
 * IndexedDB is unavailable). This keeps the app fully functional without any
 * backend account, but it also means boards are stored per browser profile:
 * they survive reloads and browser restarts on the same device, and are not
 * synced across devices. Cloud sync would require a database + auth provider.
 */

const DB_NAME = 'whiteboard-studio';
const DB_VERSION = 1;
const STORE = 'boards';
const META_KEY = 'whiteboard-studio:meta';
const LS_PREFIX = 'whiteboard-studio:board:';

interface StoredBoard {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  background: Board['background'];
  camera: Board['camera'];
  elements: BoardElement[];
  templateId?: string | null;
}

let dbPromise: Promise<IDBDatabase> | null = null;

const hasIndexedDb = () => typeof window !== 'undefined' && 'indexedDB' in window;

const openDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Could not open local database'));
    });
  }
  return dbPromise;
};

const withStore = async <T,>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = action(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local storage operation failed'));
  });
};

const readAllLocal = (): StoredBoard[] => {
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return [];
    const ids: string[] = JSON.parse(raw);
    return ids
      .map((id) => {
        const item = window.localStorage.getItem(LS_PREFIX + id);
        return item ? (JSON.parse(item) as StoredBoard) : null;
      })
      .filter((item): item is StoredBoard => Boolean(item));
  } catch {
    return [];
  }
};

const writeLocalIndex = (boards: StoredBoard[]) => {
  window.localStorage.setItem(META_KEY, JSON.stringify(boards.map((board) => board.id)));
};

const toMeta = (board: StoredBoard): BoardMeta => ({
  id: board.id,
  title: board.title,
  createdAt: board.createdAt,
  updatedAt: board.updatedAt,
  elementCount: board.elements?.length ?? 0,
  preview: null,
  background: board.background,
});

export const listBoards = async (): Promise<BoardMeta[]> => {
  const boards = await fetchAllBoards();
  return boards
    .map(toMeta)
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

const fetchAllBoards = async (): Promise<StoredBoard[]> => {
  if (hasIndexedDb()) {
    try {
      const boards = await withStore<StoredBoard[]>('readonly', (store) => store.getAll() as IDBRequest<StoredBoard[]>);
      return boards;
    } catch {
      // fall through to localStorage
    }
  }
  return readAllLocal();
};

export const getBoard = async (id: string): Promise<Board | null> => {
  let stored: StoredBoard | null = null;
  if (hasIndexedDb()) {
    try {
      stored = await withStore<StoredBoard | undefined>('readonly', (store) => store.get(id) as IDBRequest<StoredBoard | undefined>) ?? null;
    } catch {
      stored = null;
    }
  }
  if (!stored) {
    const local = readAllLocal();
    stored = local.find((board) => board.id === id) ?? null;
  }
  return stored ? validateBoard(stored) : null;
};

export const saveBoard = async (board: Board): Promise<void> => {
  const stored: StoredBoard = {
    id: board.id,
    title: board.title,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    background: board.background,
    camera: board.camera,
    elements: board.elements,
    templateId: board.templateId ?? null,
  };
  if (hasIndexedDb()) {
    try {
      await withStore('readwrite', (store) => store.put(stored));
      return;
    } catch {
      // fall through
    }
  }
  window.localStorage.setItem(LS_PREFIX + stored.id, JSON.stringify(stored));
  const index = readAllLocal().map((item) => item.id);
  if (!index.includes(stored.id)) window.localStorage.setItem(META_KEY, JSON.stringify([...index, stored.id]));
};

export const deleteBoard = async (id: string): Promise<void> => {
  if (hasIndexedDb()) {
    try {
      await withStore('readwrite', (store) => store.delete(id));
    } catch {
      // fall through
    }
  }
  window.localStorage.removeItem(LS_PREFIX + id);
  const remaining = readAllLocal().filter((board) => board.id !== id);
  writeLocalIndex(remaining);
};

export const renameBoard = async (id: string, title: string): Promise<void> => {
  const board = await getBoard(id);
  if (!board) return;
  await saveBoard({ ...board, title, updatedAt: Date.now() });
};

export const duplicateBoard = async (id: string): Promise<Board | null> => {
  const board = await getBoard(id);
  if (!board) return null;
  const copy: Board = {
    ...board,
    id: `board_${Math.random().toString(36).slice(2, 10)}`,
    title: `${board.title} copy`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    elements: board.elements.map((element) => ({ ...element })),
  };
  await saveBoard(copy);
  return copy;
};

/** Defensive validation so a malformed record cannot crash the editor. */
const validateBoard = (input: unknown): Board | null => {
  if (!input || typeof input !== 'object') return null;
  const board = input as Partial<StoredBoard>;
  if (typeof board.id !== 'string') return null;
  if (!Array.isArray(board.elements)) return null;
  return {
    id: board.id,
    title: typeof board.title === 'string' ? board.title : 'Untitled board',
    createdAt: typeof board.createdAt === 'number' ? board.createdAt : Date.now(),
    updatedAt: typeof board.updatedAt === 'number' ? board.updatedAt : Date.now(),
    elements: board.elements.filter(
      (element): element is BoardElement =>
        Boolean(element) && typeof element.id === 'string' && typeof element.type === 'string',
    ),
    background: board.background ?? { kind: 'grid', color: '#f8fafc' },
    camera: board.camera ?? { x: 0, y: 0, zoom: 1 },
    templateId: board.templateId ?? null,
  };
};

export const SCHEMA = BOARD_SCHEMA_VERSION;
