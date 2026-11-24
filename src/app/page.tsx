'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
  FileJson,
  Keyboard,
  LayoutGrid,
  Loader2,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { BoardCard, type BoardCardData } from '@/components/dashboard/BoardCard';
import { TemplateGallery } from '@/components/dashboard/TemplateGallery';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/components/ThemeProvider';
import { deleteBoard, duplicateBoard, listBoards, renameBoard, saveBoard } from '@/lib/db';
import { getTemplate, TEMPLATES } from '@/lib/templates';
import { boardThumbnail, slugify } from '@/lib/exporters';
import { parseBoardFile } from '@/lib/upload';
import { uid } from '@/lib/geometry';
import type { Board, BoardMeta } from '@/lib/types';

const ACCENTS = ['#f8fafc', '#fdf8f3', '#f2fbf6', '#f6f1e7', '#f5f3ff'];

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [boards, setBoards] = useState<BoardMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'created' | 'name'>('recent');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BoardMeta | null>(null);
  const [creating, setCreating] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});

  const refresh = useCallback(async () => {
    try {
      const meta = await listBoards();
      setBoards(meta);
      // Lazily build thumbnails from the stored boards.
      const { getBoard } = await import('@/lib/db');
      const entries = await Promise.all(
        meta.map(async (item) => {
          const full = await getBoard(item.id);
          return [item.id, full ? boardThumbnail(full.elements) : null] as const;
        }),
      );
      setPreviews(Object.fromEntries(entries));
    } catch (error) {
      console.error(error);
      toast({ title: 'Could not read your boards', description: 'Local storage may be blocked in this browser.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('templates')) {
      setTemplateOpen(true);
    }
  }, []);

  const filtered = useMemo(() => {
    const list = boards.filter((board) => board.title.toLowerCase().includes(query.trim().toLowerCase()));
    const sorted = [...list];
    if (sort === 'recent') sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    if (sort === 'created') sorted.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'name') sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [boards, query, sort]);

  const createBoard = async (templateId = 'blank') => {
    setCreating(true);
    try {
      const template = getTemplate(templateId);
      const id = uid('board');
      const now = Date.now();
      const board: Board = {
        id,
        title: template.id === 'blank' ? 'Untitled board' : template.name,
        createdAt: now,
        updatedAt: now,
        elements: template.build(),
        background: { kind: 'grid', color: '#f8fafc' },
        camera: { x: 0, y: 0, zoom: 1 },
        templateId: template.id,
      };
      await saveBoard(board);
      router.push(`/board/${id}`);
    } catch (error) {
      console.error(error);
      toast({ title: 'Could not create the board', variant: 'error' });
      setCreating(false);
    }
  };

  const handleRename = async (id: string, title: string) => {
    await renameBoard(id, title);
    setBoards((current) => current.map((board) => (board.id === id ? { ...board, title } : board)));
    toast({ title: 'Board renamed', variant: 'success' });
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicateBoard(id);
    if (copy) {
      toast({ title: 'Board duplicated', description: copy.title, variant: 'success' });
      await refresh();
    } else {
      toast({ title: 'Could not duplicate board', variant: 'error' });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteBoard(deleteTarget.id);
    setBoards((current) => current.filter((board) => board.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast({ title: 'Board deleted', variant: 'success' });
  };

  const importBoard = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const { board, warnings } = parseBoardFile(await file.text());
        await saveBoard(board);
        await refresh();
        toast({
          title: `Imported “${board.title}”`,
          description: warnings[0] ?? `${board.elements.length} objects restored.`,
          variant: warnings.length ? 'warning' : 'success',
        });
      } catch (error) {
        toast({
          title: 'Import failed',
          description: error instanceof Error ? error.message : 'Unknown file format.',
          variant: 'error',
        });
      }
    };
    input.click();
  };

  const cardData: BoardCardData[] = filtered.map((board, index) => ({
    id: board.id,
    title: board.title,
    updatedAt: board.updatedAt,
    elementCount: board.elementCount,
    preview: previews[board.id] ?? null,
    accent: board.background?.color ?? ACCENTS[index % ACCENTS.length],
  }));

  return (
    <div className="min-h-dvh bg-[var(--surface-sunken)]">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface-raised)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">W</span>
            <span className="hidden sm:inline">Whiteboard Studio</span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={importBoard}
              className="btn-ghost px-2"
              aria-label="Import board JSON"
              title="Import board JSON"
            >
              <Upload className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-ghost px-2"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>
            <button type="button" className="btn-primary" onClick={() => setTemplateOpen(true)} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
              New board
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16">
        <section className="py-8 sm:py-12">
          <p className="chip mb-3 inline-flex">
            <Sparkles className="h-3 w-3" aria-hidden /> Local-first · no sign-up required
          </p>
          <h1 className="max-w-2xl text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Think together, visually.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--ink-muted)] sm:text-base">
            Brainstorm, map flows, run retros, and teach — on one infinite canvas with connectors,
            sticky notes, and pixel-perfect exports.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search boards…"
                className="field pl-8"
                aria-label="Search boards"
                type="search"
              />
            </div>
            <label className="sr-only" htmlFor="sort">
              Sort boards
            </label>
            <select
              id="sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as typeof sort)}
              className="field w-auto"
            >
              <option value="recent">Recently edited</option>
              <option value="created">Newest</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>
        </section>

        <section aria-labelledby="boards-heading">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="boards-heading" className="text-sm font-semibold">
              Your boards <span className="font-normal text-[var(--ink-faint)]">({filtered.length})</span>
            </h2>
            {query ? (
              <button type="button" className="btn-ghost px-1.5 py-1 text-xs" onClick={() => setQuery('')}>
                <X className="h-3 w-3" aria-hidden /> Clear search
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="relative h-56 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]">
                  <div className="h-32 animate-pulse bg-[var(--surface-sunken)]" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--surface-sunken)]" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-[var(--surface-sunken)]" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 && boards.length === 0 ? (
            <EmptyState onCreate={() => setTemplateOpen(true)} onImport={importBoard} />
          ) : filtered.length === 0 ? (
            <div className="panel p-10 text-center">
              <Search className="mx-auto h-6 w-6 text-[var(--ink-faint)]" aria-hidden />
              <h3 className="mt-3 text-sm font-semibold">No boards match “{query}”</h3>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">Try a different search term.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {cardData.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onRename={handleRename}
                  onDuplicate={handleDuplicate}
                  onDelete={async (id) => {
                    const target = boards.find((item) => item.id === id) ?? null;
                    setDeleteTarget(target);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => setTemplateOpen(true)}
                className="group flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line-strong)] text-[var(--ink-faint)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-current transition-transform group-hover:scale-110">
                  <Plus className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-medium">New board</span>
                <span className="text-xs">or pick a template</span>
              </button>
            </div>
          )}
        </section>

        <section className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Product highlights">
          {[
            { icon: LayoutGrid, title: '11 drawing tools', body: 'Stickies, shapes, freehand, connectors and text with full styling.' },
            { icon: FileJson, title: 'Own your data', body: 'Export PNG, SVG or JSON and re-import any time. No lock-in.' },
            { icon: Keyboard, title: 'Built for speed', body: 'Single-key tool switching, undo stacks, nudging, and snapping.' },
            { icon: Users, title: 'Share in one click', body: 'Send a link that opens a read-only snapshot — no account needed.' },
          ].map((feature) => (
            <div key={feature.title} className="panel p-4">
              <feature.icon className="h-5 w-5 text-[var(--accent)]" aria-hidden />
              <h3 className="mt-2 text-sm font-semibold">{feature.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--ink-muted)]">{feature.body}</p>
            </div>
          ))}
        </section>

        <footer className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--line)] pt-5 text-xs text-[var(--ink-faint)]">
          <span>Whiteboard Studio</span>
          <span className="inline-flex items-center gap-1">
            <Clock3 className="h-3 w-3" aria-hidden /> Boards autosave to this browser
          </span>
          <Link href="/board/example" className="hover:text-[var(--ink)]">
            Open a sample board
          </Link>
        </footer>
      </main>

      <TemplateGallery
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        templates={TEMPLATES}
        creating={creating}
        onCreate={async (templateId) => {
          setTemplateOpen(false);
          await createBoard(templateId);
        }}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this board?"
        description={deleteTarget ? `“${deleteTarget.title}” will be removed from this browser. You can re-import it from a JSON backup.` : undefined}
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="btn-danger" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete board
            </button>
          </>
        }
      >
        <p className="text-sm text-[var(--ink-muted)]">
          This action can&apos;t be undone. Export the board first if you want to keep a copy.
        </p>
      </Modal>
    </div>
  );
}

function EmptyState({ onCreate, onImport }: { onCreate: () => void; onImport: () => void }) {
  return (
    <div className="panel relative overflow-hidden p-8 text-center sm:p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, var(--line-strong) 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-md">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles className="h-7 w-7" aria-hidden />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Your first board is one click away</h3>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
          Start blank or with a template — brainstorm, flowchart, kanban, mind map, or meeting notes.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary" onClick={onCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Create a board
          </button>
          <button type="button" className="btn-outline" onClick={onImport}>
            <Upload className="h-4 w-4" aria-hidden /> Import JSON
          </button>
        </div>
        <p className="mt-4 inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]">
          <ArrowRight className="h-3 w-3" aria-hidden /> Boards live in this browser — export to move them.
        </p>
      </div>
    </div>
  );
}
