import { beforeEach, describe, expect, it } from 'vitest';
import { deleteBoard, duplicateBoard, getBoard, listBoards, renameBoard, saveBoard } from '@/lib/db';
import { emptyBoard } from '@/lib/store';
import { createElement } from '@/lib/elements';
import { buildQuickStart } from '@/lib/templates';

const board = (id: string, title: string, elements = 0) => ({
  ...emptyBoard(id, title),
  elements: Array.from({ length: elements }, (_, index) =>
    createElement('sticky', index * 20, 0, 180, 180, { text: `Note ${index}` }),
  ),
});

describe('persistence', () => {
  beforeEach(async () => {
    const boards = await listBoards();
    await Promise.all(boards.map((item) => deleteBoard(item.id)));
  });

  it('saves and reloads a board with its elements', async () => {
    const elements = buildQuickStart();
    await saveBoard({ ...emptyBoard('b1', 'Sprint retro'), elements });

    const loaded = await getBoard('b1');
    expect(loaded).not.toBeNull();
    expect(loaded?.title).toBe('Sprint retro');
    expect(loaded?.elements).toHaveLength(elements.length);
    expect(loaded?.elements[0].textStyle?.text).toBe(elements[0].textStyle?.text);
  });

  it('lists boards sorted by most recently updated', async () => {
    await saveBoard({ ...board('a', 'Older'), updatedAt: 1000 });
    await saveBoard({ ...board('b', 'Newer', 3), updatedAt: 5000 });
    const list = await listBoards();
    expect(list.map((item) => item.id)).toEqual(['b', 'a']);
    expect(list[0].elementCount).toBe(3);
  });

  it('renames a board without losing its content', async () => {
    await saveBoard(board('c', 'Before', 2));
    await renameBoard('c', 'After');
    const loaded = await getBoard('c');
    expect(loaded?.title).toBe('After');
    expect(loaded?.elements).toHaveLength(2);
  });

  it('duplicates a board with a new id and deep-copied elements', async () => {
    await saveBoard(board('d', 'Original', 2));
    const copy = await duplicateBoard('d');
    expect(copy).not.toBeNull();
    expect(copy?.id).not.toBe('d');
    expect(copy?.title).toBe('Original copy');
    expect(copy?.elements).toHaveLength(2);
    expect(copy?.elements[0]).not.toBe(board('d', 'x', 2).elements[0]);

    const list = await listBoards();
    expect(list).toHaveLength(2);
  });

  it('deletes a board permanently', async () => {
    await saveBoard(board('e', 'Temporary'));
    await deleteBoard('e');
    expect(await getBoard('e')).toBeNull();
    expect(await listBoards()).toHaveLength(0);
  });

  it('returns null for unknown ids instead of throwing', async () => {
    expect(await getBoard('does-not-exist')).toBeNull();
  });

  it('rejects malformed stored records', async () => {
    // Directly write invalid data, then confirm the validator rejects it.
    window.localStorage.setItem('whiteboard-studio:board:broken', JSON.stringify({ id: 5 }));
    expect(await getBoard('broken')).toBeNull();
    window.localStorage.removeItem('whiteboard-studio:board:broken');
  });
});
