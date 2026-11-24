'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Copy, MoreHorizontal, Pencil, Trash2, Share2, Check, X } from 'lucide-react';

export interface BoardCardData {
  id: string;
  title: string;
  updatedAt: number;
  elementCount: number;
  preview: string | null;
  accent: string;
}

const relativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

interface BoardCardProps {
  board: BoardCardData;
  onRename: (id: string, title: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function BoardCard({ board, onRename, onDuplicate, onDelete }: BoardCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(board.title);

  const commitRename = async () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== board.title) await onRename(board.id, next);
    else setDraft(board.title);
  };

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] transition-shadow hover:shadow-float focus-within:shadow-float">
      <Link
        href={`/board/${board.id}`}
        className="relative block aspect-[16/10] overflow-hidden"
        style={{ background: board.accent }}
        aria-label={`Open ${board.title}`}
      >
        {board.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={board.preview}
            alt=""
            className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[var(--ink-faint)]">
            <div className="h-8 w-8 rounded-lg border border-dashed border-current" aria-hidden />
            <span className="text-[11px] font-medium">Empty board</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
          {board.elementCount} object{board.elementCount === 1 ? '' : 's'}
        </span>
      </Link>

      <div className="flex items-start justify-between gap-2 p-3">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename();
                  if (event.key === 'Escape') {
                    setDraft(board.title);
                    setRenaming(false);
                  }
                }}
                maxLength={120}
                className="field px-1.5 py-1 text-sm font-semibold"
                aria-label="Board title"
              />
              <button type="button" onClick={commitRename} className="btn-ghost p-1" aria-label="Save title">
                <Check className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(board.title);
                  setRenaming(false);
                }}
                className="btn-ghost p-1"
                aria-label="Cancel rename"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <Link href={`/board/${board.id}`} className="block truncate text-sm font-semibold hover:underline">
              {board.title}
            </Link>
          )}
          <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">Edited {relativeTime(board.updatedAt)}</p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            className="btn-ghost p-1.5"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={`Actions for ${board.title}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
          {menuOpen ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-30 cursor-default"
                aria-label="Close actions menu"
                onClick={() => setMenuOpen(false)}
              />
              <div role="menu" className="panel absolute right-0 top-full z-40 mt-1 w-44 animate-pop-in p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setRenaming(true);
                    setMenuOpen(false);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> Rename
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    void onDuplicate(board.id);
                    setMenuOpen(false);
                  }}
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden /> Duplicate
                </button>
                <Link
                  role="menuitem"
                  href={`/board/${board.id}`}
                  className="menu-item"
                  onClick={() => setMenuOpen(false)}
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden /> Open & share
                </Link>
                <div className="my-1 border-t border-[var(--line)]" />
                <button
                  type="button"
                  role="menuitem"
                  className={clsx('menu-item text-[var(--danger)] hover:bg-red-500/10')}
                  onClick={() => {
                    void onDelete(board.id);
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}
