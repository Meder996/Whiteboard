import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Suspense, act } from 'react';
import { render } from '@testing-library/react';
import BoardPage from '@/app/board/[id]/page';
import { ToastProvider } from '@/components/Toast';
import { deleteBoard, getBoard, listBoards, saveBoard } from '@/lib/db';
import { emptyBoard, useEditor } from '@/lib/store';
import { createSticky } from '@/lib/elements';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/board/test',
}));

const renderBoard = async (id: string) => {
  let utils: ReturnType<typeof render> | null = null;
  await act(async () => {
    utils = render(
      <ToastProvider>
        <Suspense fallback={<p>loading</p>}>
          <BoardPage params={Promise.resolve({ id })} />
        </Suspense>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  return utils as unknown as ReturnType<typeof render>;
};

const settle = async (ms = 120) => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

describe('Word-style saving', () => {
  beforeEach(async () => {
    const boards = await listBoards();
    await Promise.all(boards.map((item) => deleteBoard(item.id)));
  });

  it('marks edits as unsaved without writing them on every change', async () => {
    await saveBoard({ ...emptyBoard('board_save', 'Saving'), elements: [] });
    await renderBoard('board_save');
    expect(useEditor.getState().saveState).toBe('saved');

    act(() => {
      useEditor.getState().addElement(createSticky(0, 0, 'Draft idea'));
    });
    await settle(150);

    // Dirty immediately, and the stored board still has no elements because
    // the quiet autosave only fires after a pause in editing.
    expect(useEditor.getState().saveState).toBe('dirty');
    const stored = await getBoard('board_save');
    expect(stored?.elements).toHaveLength(0);
  });

  it('saves on demand and reports Saved', async () => {
    await saveBoard({ ...emptyBoard('board_save2', 'Saving'), elements: [] });
    await renderBoard('board_save2');

    act(() => {
      useEditor.getState().addElement(createSticky(10, 10, 'Keep me'));
    });
    await act(async () => {
      await useEditor.getState().getBoardSnapshot(); // no-op read to flush act queue
    });

    await act(async () => {
      const saveButton = document.querySelector('[data-testid="save-button"]') as HTMLButtonElement;
      saveButton.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    expect(useEditor.getState().saveState).toBe('saved');
    const stored = await getBoard('board_save2');
    expect(stored?.elements.some((element) => element.textStyle?.text === 'Keep me')).toBe(true);
  });

  it('flushes pending edits when the board page is left', async () => {
    await saveBoard({ ...emptyBoard('board_save3', 'Leaving'), elements: [] });
    const utils = await renderBoard('board_save3');

    act(() => {
      useEditor.getState().addElement(createSticky(0, 0, 'Saved on exit'));
    });
    await settle(100);

    // Unmounting = navigating back to the dashboard.
    await act(async () => {
      utils.unmount();
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    const stored = await getBoard('board_save3');
    expect(stored?.elements.some((element) => element.textStyle?.text === 'Saved on exit')).toBe(true);
  });
});
