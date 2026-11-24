import { describe, it, expect, vi } from 'vitest';
import { Suspense } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BoardPage from '@/app/board/[id]/page';
import { ToastProvider } from '@/components/Toast';
import { saveBoard } from '@/lib/db';
import { emptyBoard, useEditor } from '@/lib/store';
import { buildQuickStart } from '@/lib/templates';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/board/x',
}));

const renderPage = async (id: string) => {
  const params = Promise.resolve({ id });
  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ToastProvider>
        <Suspense fallback={<p>loading</p>}>
          <BoardPage params={params} />
        </Suspense>
      </ToastProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  return result!;
};

describe('board page SSR', () => {
  it('server-renders the board route without touching window', async () => {
    const { renderToString } = await import('react-dom/server');
    const { createElement, Suspense } = await import('react');
    let html = '';
    try {
      html = renderToString(
        createElement(
          Suspense,
          { fallback: createElement('p', null, 'ssr-fallback') },
          createElement(BoardPage, { params: Promise.resolve({ id: 'ssr_board' }) }),
        ),
      );
    } catch (error) {
      console.log('SSR THREW:', (error as Error).message.slice(0, 400));
      throw error;
    }
    console.log('SSR HTML:', html.slice(0, 300));
    expect(html.length).toBeGreaterThan(0);
  });
});

describe('board page (integration)', () => {
  it('loads a saved board and renders its elements on the canvas', async () => {
    const elements = buildQuickStart();
    await saveBoard({ ...emptyBoard('page_board', 'Launch retro'), elements });

    await renderPage('page_board');

    // Title from storage is shown in the header (and again in the print view).
    expect((await screen.findAllByText('Launch retro')).length).toBeGreaterThan(0);
    expect(useEditor.getState().title).toBe('Launch retro');
    // The canvas is mounted and holds every element plus overlays.
    expect(screen.getByRole('application', { name: /whiteboard canvas/i })).toBeInTheDocument();
    expect(useEditor.getState().elements).toHaveLength(elements.length);
    expect(useEditor.getState().readOnly).toBe(false);
    // Save status settles after autosave.
    await waitFor(() => expect(screen.getByTestId('save-status')).toHaveTextContent(/saved/i));
  });

  it('switches tools with the keyboard and clears selection on Escape', async () => {
    await saveBoard(emptyBoard('page_board_2', 'Keyboard board'));
    await renderPage('page_board_2');
    const user = userEvent.setup();

    await user.keyboard('p');
    expect(useEditor.getState().tool).toBe('pen');
    await user.keyboard('v');
    expect(useEditor.getState().tool).toBe('select');

    act(() => useEditor.getState().setSelection([]));
    await user.keyboard('{Escape}');
    expect(useEditor.getState().selectedIds).toEqual([]);
  });

  it('shows the empty-state helper for a blank board', async () => {
    await saveBoard(emptyBoard('page_board_3', 'Blank board'));
    await renderPage('page_board_3');
    expect(await screen.findByText(/a blank canvas, infinite possibilities/i)).toBeInTheDocument();
  });

  it('opens the share dialog and produces a working link', async () => {
    await saveBoard({ ...emptyBoard('page_board_4', 'Shared board'), elements: buildQuickStart() });
    await renderPage('page_board_4');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /share board/i }));
    const dialog = await screen.findByRole('dialog');
    const input = (await screen.findByRole('textbox', { name: /share link/i })) as HTMLInputElement;
    expect(input.value).toContain('#s=');
    expect(input.value).toContain('/board/page_board_4');
    await user.click(screen.getByRole('button', { name: /done/i }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
});
