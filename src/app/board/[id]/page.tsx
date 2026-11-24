'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Copy, Loader2, Sparkles } from 'lucide-react';
import { BoardCanvas } from '@/components/board/BoardCanvas';
import { BoardHeader } from '@/components/board/BoardHeader';
import { ContextMenu, type ContextMenuState } from '@/components/board/ContextMenu';
import { Minimap } from '@/components/board/Minimap';
import { ShareDialog } from '@/components/board/ShareDialog';
import { ShortcutsDialog } from '@/components/board/ShortcutsDialog';
import { StyleControls, Toolbar } from '@/components/board/Toolbar';
import { ZoomControls } from '@/components/board/ZoomControls';
import { useToast } from '@/components/Toast';
import { useEditorSession } from '@/hooks/useEditorSession';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useEditor } from '@/lib/store';
import { saveBoard } from '@/lib/db';
import { buildSvg, exportJson, exportPng, exportSvg, slugify } from '@/lib/exporters';
import { buildQuickStart } from '@/lib/templates';
import { parseBoardFile } from '@/lib/upload';
import { elementAtPoint } from '@/lib/hit';
import { uid } from '@/lib/geometry';
import type { Board } from '@/lib/types';

export default function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [hash, setHash] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showMinimap, setShowMinimap] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { status, shared } = useEditorSession(id, hash);

  const elements = useEditor((state) => state.elements);
  const title = useEditor((state) => state.title);
  const camera = useEditor((state) => state.camera);
  const viewport = useEditor((state) => state.viewport);
  const background = useEditor((state) => state.background);
  const selectedIds = useEditor((state) => state.selectedIds);
  const readOnly = useEditor((state) => state.readOnly);
  const setCamera = useEditor((state) => state.setCamera);
  const setSelection = useEditor((state) => state.setSelection);
  const setEditing = useEditor((state) => state.setEditing);
  const addElements = useEditor((state) => state.addElements);
  const setTitle = useEditor((state) => state.setTitle);
  const setBackground = useEditor((state) => state.setBackground);

  useEffect(() => {
    const read = () => setHash(window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  useKeyboardShortcuts({ onShortcuts: () => setShortcutsOpen(true) });

  const currentBoard = useCallback(
    (): Board => ({
      id,
      title,
      createdAt: useEditor.getState().lastSavedAt ?? Date.now(),
      updatedAt: Date.now(),
      elements,
      background,
      camera,
    }),
    [background, camera, elements, id, title],
  );

  const handleRename = async (next: string) => {
    setTitle(next);
    await saveBoard({ ...currentBoard(), title: next });
  };

  const handleExportPng = async () => {
    setBusy(true);
    try {
      await exportPng(currentBoard());
      toast({ title: 'PNG downloaded', description: 'Rendered at 2× the content bounds.', variant: 'success' });
    } catch (error) {
      toast({
        title: 'PNG export failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleExportSvg = () => {
    try {
      exportSvg(currentBoard());
      toast({ title: 'SVG downloaded', variant: 'success' });
    } catch {
      toast({ title: 'SVG export failed', variant: 'error' });
    }
  };

  const handleExportJson = () => {
    try {
      exportJson(currentBoard());
      toast({ title: 'Board JSON downloaded', description: 'Use Import JSON to restore it later.', variant: 'success' });
    } catch {
      toast({ title: 'JSON export failed', variant: 'error' });
    }
  };

  const handleImportJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Import JSON files up to 20 MB.', variant: 'error' });
        return;
      }
      try {
        const text = await file.text();
        const { board, warnings } = parseBoardFile(text);
        addElements(board.elements, { select: false });
        if (board.background) setBackground(board.background);
        toast({
          title: `Imported ${board.elements.length} object${board.elements.length === 1 ? '' : 's'}`,
          description: warnings.length ? warnings[0] : 'Objects were added to the current board.',
          variant: warnings.length ? 'warning' : 'success',
        });
      } catch (error) {
        toast({
          title: 'Import failed',
          description: error instanceof Error ? error.message : 'That file could not be read.',
          variant: 'error',
        });
      }
    };
    input.click();
  };

  const handleUpload = async (files: FileList | File[]) => {
    if (!files || readOnly) return;
    const { createImageElement } = await import('@/lib/upload');
    const state = useEditor.getState();
    const center = {
      x: (state.viewport.width / 2 - state.camera.x) / state.camera.zoom,
      y: (state.viewport.height / 2 - state.camera.y) / state.camera.zoom,
    };
    const added = [];
    const errors: string[] = [];
    let offset = 0;
    for (const file of Array.from(files)) {
      try {
        const result = await createImageElement(file, {
          x: center.x - 200 + offset,
          y: center.y - 150 + offset,
        });
        added.push(result.element);
        offset += 24;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${file.name} could not be uploaded.`);
      }
    }
    if (added.length) {
      addElements(added);
      toast({
        title: `Added ${added.length} image${added.length === 1 ? '' : 's'}`,
        description: 'Drag to move, use the handles to resize.',
        variant: 'success',
      });
    }
    if (errors.length) {
      toast({ title: errors[0], description: errors.length > 1 ? `${errors.length - 1} more file(s) skipped.` : undefined, variant: 'error' });
    }
  };

  const onDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.files?.length) await handleUpload(event.dataTransfer.files);
  };

  const loadExample = () => {
    addElements(buildQuickStart(), { select: false });
    toast({ title: 'Example board added', description: 'Explore the stickies and connectors, then clear it any time.', variant: 'success' });
    setTimeout(() => useEditor.getState().fitToScreen(), 60);
  };

  const startFreshBoard = async () => {
    const newId = uid('board');
    const board: Board = {
      id: newId,
      title: 'Untitled board',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      elements: [],
      background: { kind: 'grid', color: '#f8fafc' },
      camera: { x: 0, y: 0, zoom: 1 },
    };
    await saveBoard(board);
    window.location.href = `/board/${newId}`;
  };

  if (status === 'loading') {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--surface-sunken)] p-6">
        <div className="flex flex-col items-center gap-3 text-[var(--ink-muted)]">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p className="text-sm font-medium">Opening your board…</p>
        </div>
      </main>
    );
  }

  if (status === 'missing') {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--surface-sunken)] p-6">
        <div className="panel w-full max-w-md p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
            <AlertTriangle className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="mt-4 text-lg font-semibold">This board isn&apos;t on this device</h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Boards are stored in your browser. If you opened this from another device, hold the full
            share link, or import a JSON backup you exported earlier.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/" className="btn-outline">
              All boards
            </Link>
            <button type="button" className="btn-primary" onClick={startFreshBoard}>
              <Sparkles className="h-4 w-4" aria-hidden /> New board
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--surface-sunken)] p-6">
        <div className="panel w-full max-w-md p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-[var(--danger)]" aria-hidden />
          <h1 className="mt-3 text-lg font-semibold">Couldn&apos;t load the board</h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Your browser blocked local storage, or the saved data is corrupt. Try reloading, or
            import a JSON backup.
          </p>
          <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </main>
    );
  }

  return (
    <div
      className="flex h-dvh flex-col overflow-hidden bg-[var(--surface-sunken)]"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={onDrop}
    >
      {shared ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs">
          <p className="font-medium text-[var(--accent)]">
            You&apos;re viewing a shared snapshot ({shared.permission === 'view' ? 'view only' : shared.permission}).
            Nothing you do here changes the owner&apos;s board.
          </p>
          <Link href="/" className="btn-outline px-2 py-1 text-[11px]">
            <Copy className="h-3 w-3" aria-hidden /> Save a copy
          </Link>
        </div>
      ) : null}

      <BoardHeader
        onShare={() => setShareOpen(true)}
        onExportPng={handleExportPng}
        onExportSvg={handleExportSvg}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onPrint={() => window.print()}
        onShortcuts={() => setShortcutsOpen(true)}
        onRename={handleRename}
        collaboratorCount={0}
      />

      <main className="relative flex min-h-0 flex-1">
        <div className="no-print hidden sm:block">
          <StyleControls />
        </div>

        <div className="relative min-h-0 flex-1">
          <div className="no-print pointer-events-none absolute inset-x-0 top-0 z-20">
            <Toolbar onUploadClick={() => fileInputRef.current?.click()} />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            className="sr-only"
            aria-label="Upload images"
            onChange={(event) => {
              if (event.target.files) handleUpload(event.target.files);
              event.target.value = '';
            }}
          />

          <div
            className="absolute inset-0"
            onContextMenu={(event) => {
              if (readOnly) return;
              event.preventDefault();
              const state = useEditor.getState();
              const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
              const world = {
                x: (event.clientX - rect.left - state.camera.x) / state.camera.zoom,
                y: (event.clientY - rect.top - state.camera.y) / state.camera.zoom,
              };
              const hit = elementAtPoint(state.elements, world, { includeLocked: true });
              if (hit && !state.selectedIds.includes(hit.id)) setSelection([hit.id]);
              setContextMenu({ x: event.clientX, y: event.clientY, elementId: hit?.id ?? null });
            }}
          >
            <BoardCanvas />
          </div>

          {elements.length === 0 && status === 'ready' ? (
            <div className="no-print pointer-events-none absolute inset-0 z-10 grid place-items-center p-6">
              <div className="pointer-events-auto panel max-w-md animate-pop-in p-6 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Sparkles className="h-6 w-6" aria-hidden />
                </div>
                <h2 className="mt-4 text-lg font-semibold">A blank canvas, infinite possibilities</h2>
                <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
                  Start with a sticky note, sketch an idea, or load a quick-start tour with
                  connectors and shapes.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <button type="button" className="btn-primary" onClick={loadExample}>
                    <Sparkles className="h-4 w-4" aria-hidden /> Load example
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => useEditor.getState().setTool('sticky')}
                  >
                    Place a sticky
                  </button>
                  <Link href="/?templates=1" className="btn-outline">
                    Browse templates
                  </Link>
                </div>
                <p className="mt-3 text-[11px] text-[var(--ink-faint)]">
                  Tip: press <kbd className="rounded border border-[var(--line)] px-1">?</kbd> to see every shortcut.
                </p>
              </div>
            </div>
          ) : null}

          <div className="no-print pointer-events-auto absolute bottom-[3.9rem] left-2 max-w-[calc(100%-1rem)] overflow-x-auto sm:hidden no-scrollbar">
            <StyleControls compact />
          </div>

          <div className="no-print pointer-events-none absolute bottom-3 left-0 right-0 flex items-end justify-between gap-2 px-3">
            <div className="pointer-events-auto flex items-end gap-2">
              <div className="hidden md:block">
                <Minimap
                  elements={elements}
                  camera={camera}
                  viewport={viewport}
                  selectedIds={selectedIds}
                  collapsed={!showMinimap}
                  onToggle={() => setShowMinimap((value) => !value)}
                  onNavigate={(world) =>
                    setCamera({
                      ...camera,
                      x: viewport.width / 2 - world.x * camera.zoom,
                      y: viewport.height / 2 - world.y * camera.zoom,
                    })
                  }
                />
              </div>
            </div>
            <div className="pointer-events-auto flex items-center gap-2">
              {selectedIds.length > 0 ? (
                <button
                  type="button"
                  className="panel px-2.5 py-1.5 text-xs font-medium text-[var(--ink-muted)]"
                  onClick={() => useEditor.getState().clearSelection()}
                >
                  {selectedIds.length} selected · Clear
                </button>
              ) : null}
              <ZoomControls />
            </div>
          </div>

          {busy ? (
            <div className="absolute inset-0 z-40 grid place-items-center bg-slate-900/10 backdrop-blur-[1px]">
              <span className="panel flex items-center gap-2 px-3 py-2 text-xs font-medium">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Rendering export…
              </span>
            </div>
          ) : null}
        </div>
      </main>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} board={currentBoard()} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <ContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(null)}
        onEdit={(elementId) => {
          setSelection([elementId]);
          setEditing(elementId);
        }}
      />

      {/* Hidden printable board */}
      <div className="hidden print:block print-board">
        <PrintBoard />
      </div>
    </div>
  );
}

function PrintBoard() {
  const elements = useEditor((state) => state.elements);
  const background = useEditor((state) => state.background);
  const title = useEditor((state) => state.title);

  const { inner } = useMemo(() => {
    const { svg } = buildSvg(
      {
        id: 'print',
        title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        elements,
        background,
        camera: { x: 0, y: 0, zoom: 1 },
      },
      elements,
    );
    const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
    return { inner: match ? match[1] : '' };
  }, [background, elements, title]);

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">{title}</h1>
      <div className="max-h-[88vh] overflow-hidden" style={{ background: background.color }} dangerouslySetInnerHTML={{ __html: inner }} />
      <p className="mt-3 text-xs text-[var(--ink-faint)]">
        {slugify(title)} · printed {new Date().toLocaleDateString()}
      </p>
    </div>
  );
}
