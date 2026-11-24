'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CloudOff,
  Download,
  FileJson,
  FileImage,
  FileCode2,
  HelpCircle,
  Loader2,
  Moon,
  Palette,
  Printer,
  Share2,
  Sun,
  Users,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { Popover } from '@/components/ui/Popover';
import { useEditor } from '@/lib/store';
import { BOARD_BACKGROUNDS } from '@/lib/palette';

interface BoardHeaderProps {
  onShare: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onPrint: () => void;
  onShortcuts: () => void;
  onRename: (title: string) => void;
  onSave: () => void;
  onSaveAndExit: () => void;
  collaboratorCount?: number;
}

const SAVE_LABELS = {
  saved: 'Saved',
  saving: 'Saving…',
  dirty: 'Unsaved changes',
  error: 'Save failed',
  offline: 'Offline — stored locally',
};

const SAVE_TITLES = {
  saved: 'All changes saved to this browser',
  saving: 'Saving to this browser…',
  dirty: 'Press ⌘/Ctrl+S or click Save to store your changes',
  error: 'The last save failed — click Save to retry',
  offline: 'Saved locally; the browser reports it is offline',
};

export function BoardHeader({
  onShare,
  onExportPng,
  onExportSvg,
  onExportJson,
  onImportJson,
  onPrint,
  onShortcuts,
  onRename,
  onSave,
  onSaveAndExit,
  collaboratorCount = 0,
}: BoardHeaderProps) {
  const title = useEditor((state) => state.title);
  const saveState = useEditor((state) => state.saveState);
  const readOnly = useEditor((state) => state.readOnly);
  const lastSavedAt = useEditor((state) => state.lastSavedAt);
  const background = useEditor((state) => state.background);
  const setBackground = useEditor((state) => state.setBackground);
  const { theme, toggleTheme } = useTheme();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(title), [title]);
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim() || 'Untitled board';
    if (next !== title) onRename(next);
    setDraft(next);
  };

  return (
    <header className="no-print z-30 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--surface-raised)] px-2 sm:px-3">
      <button
        type="button"
        className="btn-ghost shrink-0 px-2"
        aria-label="Save and return to all boards"
        title="Save & exit — all boards"
        onClick={onSaveAndExit}
        disabled={readOnly}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white shadow-sm">
          W
        </div>
        <div className="min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commit();
                }
                if (event.key === 'Escape') {
                  setDraft(title);
                  setEditing(false);
                }
              }}
              className="w-full max-w-[46vw] rounded-md border border-[var(--accent)] bg-transparent px-1.5 py-0.5 text-sm font-semibold outline-none sm:max-w-[320px]"
              aria-label="Board title"
              maxLength={120}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (!readOnly) setEditing(true);
              }}
              className="block max-w-[46vw] truncate rounded-md px-1.5 py-0.5 text-left text-sm font-semibold transition-colors hover:bg-[var(--surface-sunken)] sm:max-w-[320px]"
              title={readOnly ? title : 'Rename board'}
              disabled={readOnly}
            >
              {title}
            </button>
          )}
          <div className="flex items-center gap-1.5 px-1.5" aria-live="polite">
            <SaveBadge state={saveState} lastSavedAt={lastSavedAt} onSave={onSave} readOnly={readOnly} />
            {readOnly ? (
              <span className="text-[11px] font-medium text-[var(--warning)]">View only</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Popover
          label="Board background"
          align="end"
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} className="btn-ghost px-2" aria-label="Board background" title="Background">
              <Palette className="h-4 w-4" aria-hidden />
            </button>
          )}
        >
          {({ close }) => (
            <div className="panel w-64 p-3">
              <p className="label mb-2">Canvas background</p>
              <div className="grid grid-cols-4 gap-2">
                {BOARD_BACKGROUNDS.map((option) => {
                  const active =
                    background.kind === option.background.kind && background.color === option.background.color;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (readOnly) return;
                        setBackground(option.background);
                        close();
                      }}
                      className={clsx(
                        'group relative h-12 rounded-md border transition-shadow',
                        active ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/30' : 'border-[var(--line)]',
                      )}
                      style={{ background: option.background.color }}
                      aria-label={option.label}
                      aria-pressed={active}
                      title={option.label}
                    >
                      {active ? (
                        <Check className="absolute right-1 top-1 h-3 w-3 text-[var(--accent)]" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <label className="label mt-3 flex items-center justify-between">
                Custom color
                <input
                  type="color"
                  value={background.color}
                  onChange={(event) => setBackground({ ...background, color: event.target.value })}
                  className="h-7 w-12 cursor-pointer rounded border border-[var(--line)] bg-transparent"
                  aria-label="Custom background color"
                  disabled={readOnly}
                />
              </label>
            </div>
          )}
        </Popover>

        <Popover
          label="Export"
          align="end"
          trigger={({ toggle }) => (
            <button type="button" onClick={toggle} className="btn-ghost px-2" aria-label="Export board" title="Export">
              <Download className="h-4 w-4" aria-hidden />
            </button>
          )}
        >
          {({ close }) => (
            <div className="panel w-60 p-1.5">
              <p className="label px-2.5 pb-1 pt-1.5">Export</p>
              <button type="button" className="menu-item" onClick={() => { close(); onExportPng(); }}>
                <FileImage className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> PNG image <span className="ml-auto text-[10px] text-[var(--ink-faint)]">2×</span>
              </button>
              <button type="button" className="menu-item" onClick={() => { close(); onExportSvg(); }}>
                <FileCode2 className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> SVG vector
              </button>
              <button type="button" className="menu-item" onClick={() => { close(); onPrint(); }}>
                <Printer className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> Print / PDF
              </button>
              <div className="my-1 border-t border-[var(--line)]" />
              <p className="label px-2.5 pb-1">Data</p>
              <button type="button" className="menu-item" onClick={() => { close(); onExportJson(); }}>
                <FileJson className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden /> Download JSON
              </button>
              <button type="button" className="menu-item" onClick={() => { close(); onImportJson(); }}>
                <Download className="h-4 w-4 rotate-180 text-[var(--ink-muted)]" aria-hidden /> Import JSON…
              </button>
            </div>
          )}
        </Popover>

        <button
          type="button"
          onClick={onShortcuts}
          className="btn-ghost hidden px-2 sm:inline-flex"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="btn-ghost px-2"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        </button>

        <button
          type="button"
          onClick={onSave}
          className="btn-outline ml-1 px-2.5"
          aria-label="Save board"
          title="Save — ⌘/Ctrl+S"
          data-testid="save-button"
          disabled={readOnly}
        >
          <Check className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Save</span>
        </button>

        <button type="button" onClick={onShare} className="btn-primary ml-1 px-2.5 sm:px-3" aria-label="Share board">
          {collaboratorCount > 0 ? <Users className="h-4 w-4" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
          <span className="hidden sm:inline">Share</span>
          {collaboratorCount > 0 ? (
            <span className="hidden rounded-full bg-white/20 px-1.5 text-[10px] font-semibold sm:inline">
              {collaboratorCount}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  );
}

function SaveBadge({
  state,
  lastSavedAt,
  onSave,
  readOnly,
}: {
  state: keyof typeof SAVE_LABELS;
  lastSavedAt: number | null;
  onSave: () => void;
  readOnly: boolean;
}) {
  const Icon = state === 'saving' ? Loader2 : state === 'error' || state === 'offline' ? CloudOff : Check;
  const time = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  return (
    <button
      type="button"
      onClick={onSave}
      disabled={readOnly}
      title={SAVE_TITLES[state]}
      aria-label={`${SAVE_LABELS[state]}. Save now.`}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-0.5 text-[11px] font-medium transition-colors hover:underline disabled:no-underline',
        state === 'error' ? 'text-[var(--danger)]' : state === 'dirty' ? 'text-[var(--warning)]' : 'text-[var(--ink-faint)]',
      )}
      data-testid="save-status"
    >
      <Icon className={clsx('h-3 w-3', state === 'saving' && 'animate-spin')} aria-hidden />
      {SAVE_LABELS[state]}
      {state === 'saved' && time ? <span className="text-[var(--ink-faint)]">· {time}</span> : null}
    </button>
  );
}

export function ViewSwitcher({ onAllBoards }: { onAllBoards: () => void }) {
  return (
    <button type="button" className="btn-outline" onClick={onAllBoards}>
      <ChevronDown className="h-4 w-4" aria-hidden /> Boards
    </button>
  );
}
