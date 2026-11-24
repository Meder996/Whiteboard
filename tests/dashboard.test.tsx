import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from '@/app/page';
import { deleteBoard, listBoards, saveBoard } from '@/lib/db';
import { emptyBoard } from '@/lib/store';
import { createElement } from '@/lib/elements';
import { ToastProvider } from '@/components/Toast';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: push, refresh: vi.fn() }),
  usePathname: () => '/',
}));

const renderDashboard = () =>
  render(
    <ToastProvider>
      <DashboardPage />
    </ToastProvider>,
  );

const seed = async () => {
  await saveBoard({
    ...emptyBoard('board_alpha', 'Alpha retro'),
    elements: [createElement('sticky', 0, 0, 180, 180, { text: 'a' })],
    updatedAt: Date.now() - 1000,
  });
  await saveBoard({
    ...emptyBoard('board_beta', 'Beta launch'),
    elements: [
      createElement('rect', 0, 0, 100, 100),
      createElement('ellipse', 120, 0, 100, 100),
    ],
    updatedAt: Date.now(),
  });
};

describe('dashboard', () => {
  beforeEach(async () => {
    push.mockClear();
    const boards = await listBoards();
    await Promise.all(boards.map((item) => deleteBoard(item.id)));
  });

  it('shows an empty state when there are no boards', async () => {
    renderDashboard();
    expect(await screen.findByText(/your first board is one click away/i)).toBeInTheDocument();
  });

  it('lists boards with object counts and most-recent ordering', async () => {
    await seed();
    renderDashboard();
    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Beta launch')).toBeInTheDocument();
    expect(within(cards[0]).getByText('2 objects')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Alpha retro')).toBeInTheDocument();
  });

  it('filters boards via search', async () => {
    await seed();
    renderDashboard();
    await screen.findByText('Beta launch');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Search boards'), 'alpha');
    await waitFor(() => expect(screen.queryByText('Beta launch')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha retro')).toBeInTheDocument();
  });

  it('renames a board from its actions menu', async () => {
    await seed();
    renderDashboard();
    const user = userEvent.setup();
    const card = (await screen.findByText('Beta launch')).closest('article') as HTMLElement;

    await user.click(within(card).getByLabelText('Actions for Beta launch'));
    await user.click(screen.getByRole('menuitem', { name: /rename/i }));
    const input = screen.getByLabelText('Board title');
    await user.clear(input);
    await user.type(input, 'Beta launch v2');
    await user.keyboard('{Enter}');

    await waitFor(async () => {
      const boards = await listBoards();
      expect(boards.find((board) => board.id === 'board_beta')?.title).toBe('Beta launch v2');
    });
  });

  it('duplicates a board into the list', async () => {
    await seed();
    renderDashboard();
    const user = userEvent.setup();
    const card = (await screen.findByText('Beta launch')).closest('article') as HTMLElement;
    await user.click(within(card).getByLabelText('Actions for Beta launch'));
    await user.click(screen.getByRole('menuitem', { name: /duplicate/i }));

    await waitFor(async () => {
      const boards = await listBoards();
      expect(boards).toHaveLength(3);
      expect(boards.some((board) => board.title === 'Beta launch copy')).toBe(true);
    });
  });

  it('creates a board from a template and navigates to it', async () => {
    renderDashboard();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /create a board/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^flowchart\s/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/board\/board_/)));
    const boards = await listBoards();
    expect(boards).toHaveLength(1);
    expect(boards[0].title).toBe('Flowchart');
    expect(boards[0].elementCount).toBeGreaterThan(5);
  });

  it('asks for confirmation before deleting a board', async () => {
    await seed();
    renderDashboard();
    const user = userEvent.setup();
    const card = (await screen.findByText('Alpha retro')).closest('article') as HTMLElement;
    await user.click(within(card).getByLabelText('Actions for Alpha retro'));
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/can’t be undone|can't be undone/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /delete board/i }));

    await waitFor(async () => {
      const boards = await listBoards();
      expect(boards.map((board) => board.id)).toEqual(['board_beta']);
    });
  });
});

describe('dashboard delete flow', () => {
  it('renders the actions menu outside the clipped card so delete is reachable', async () => {
    await seed();
    renderDashboard();
    const user = userEvent.setup();
    const card = (await screen.findByText('Alpha retro')).closest('article') as HTMLElement;
    await user.click(within(card).getByLabelText('Actions for Alpha retro'));

    const menu = await screen.findByRole('menu', { name: /actions for alpha retro/i });
    // The card frame is overflow-hidden; a menu inside it would be clipped and
    // unusable on touch devices. It must live in a portal on <body>.
    expect(card.contains(menu)).toBe(false);
    expect(document.body.contains(menu)).toBe(true);
    expect(within(menu).getByRole('menuitem', { name: /delete/i })).toBeVisible();
  });

  it('removes the card and the stored board after confirming delete', async () => {
    await seed();
    renderDashboard();
    const user = userEvent.setup();
    const card = (await screen.findByText('Alpha retro')).closest('article') as HTMLElement;
    await user.click(within(card).getByLabelText('Actions for Alpha retro'));
    await user.click(screen.getByRole('menuitem', { name: /delete/i }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /delete board/i }));

    await waitFor(() => expect(screen.queryByText('Alpha retro')).not.toBeInTheDocument());
    await waitFor(async () => {
      const boards = await listBoards();
      expect(boards.map((board) => board.id)).toEqual(['board_beta']);
    });
  });
});
