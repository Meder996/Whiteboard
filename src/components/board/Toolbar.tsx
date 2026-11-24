'use client';

import { useMemo } from 'react';
import clsx from 'clsx';
import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  Highlighter,
  ImagePlus,
  Lock,
  LockOpen,
  MousePointer2,
  Minus,
  Pencil,
  Redo2,
  Spline,
  Square,
  StickyNote,
  Trash2,
  Type,
  Undo2,
  Copy,
  Group,
  Ungroup,
  MoveUpRight,
} from 'lucide-react';
import { useEditor } from '@/lib/store';
import { useToast } from '@/components/Toast';
import { STROKE_COLORS, STROKE_WIDTHS, FILL_COLORS, LINE_STYLES, FONT_SIZES, FONT_FAMILIES, STICKY_COLORS } from '@/lib/palette';
import type { Tool } from '@/lib/types';
import { Popover } from '@/components/ui/Popover';

interface ToolDef {
  id: Tool;
  label: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  group: number;
}

export const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2, group: 0 },
  { id: 'hand', label: 'Hand / pan', shortcut: 'H', icon: Hand, group: 0 },
  { id: 'pen', label: 'Pen', shortcut: 'P', icon: Pencil, group: 1 },
  { id: 'highlighter', label: 'Highlighter', shortcut: 'M', icon: Highlighter, group: 1 },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser, group: 1 },
  { id: 'sticky', label: 'Sticky note', shortcut: 'N', icon: StickyNote, group: 2 },
  { id: 'text', label: 'Text', shortcut: 'T', icon: Type, group: 2 },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', icon: Square, group: 3 },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: Circle, group: 3 },
  { id: 'diamond', label: 'Diamond', shortcut: 'D', icon: Diamond, group: 3 },
  { id: 'line', label: 'Line', shortcut: 'L', icon: Minus, group: 3 },
  { id: 'arrow', label: 'Arrow', shortcut: 'A', icon: ArrowUpRight, group: 3 },
  { id: 'connector', label: 'Connector', shortcut: 'C', icon: Spline, group: 3 },
];

interface ToolbarProps {
  onUploadClick: () => void;
}

export function Toolbar({ onUploadClick }: ToolbarProps) {
  const tool = useEditor((state) => state.tool);
  const setTool = useEditor((state) => state.setTool);
  const selectedIds = useEditor((state) => state.selectedIds);
  const elements = useEditor((state) => state.elements);
  const undo = useEditor((state) => state.undo);
  const redo = useEditor((state) => state.redo);
  const canUndo = useEditor((state) => state.past.length > 0);
  const canRedo = useEditor((state) => state.future.length > 0);
  const duplicateSelection = useEditor((state) => state.duplicateSelection);
  const removeElements = useEditor((state) => state.removeElements);
  const lockSelection = useEditor((state) => state.lockSelection);
  const groupSelection = useEditor((state) => state.groupSelection);
  const ungroupSelection = useEditor((state) => state.ungroupSelection);
  const readOnly = useEditor((state) => state.readOnly);

  const selected = elements.filter((element) => selectedIds.includes(element.id));
  const allLocked = selected.length > 0 && selected.every((element) => element.locked);
  const anyGrouped = selected.some((element) => element.groupId);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center px-1.5 pt-2 sm:px-2 sm:pt-3">
      {/* Phones get a wrapping, two-row bar so every tool is reachable with a
          thumb and the row never hides behind a horizontal scroller. */}
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)]/95 p-1 shadow-float backdrop-blur-md sm:flex-nowrap sm:gap-1 sm:p-1.5">
        {TOOLS.map((item, index) => {
          const previous = TOOLS[index - 1];
          const showDivider = previous && previous.group !== item.group;
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex items-center">
              {showDivider ? <span className="mx-1 h-6 w-px shrink-0 bg-[var(--line)]" aria-hidden /> : null}
              <button
                type="button"
                className="tool-btn shrink-0"
                aria-pressed={tool === item.id}
                aria-label={`${item.label} (${item.shortcut})`}
                title={`${item.label} — ${item.shortcut}`}
                disabled={readOnly}
                onClick={() => setTool(item.id)}
              >
                <Icon className="h-[18px] w-[18px]" aria-hidden />
                <span className="pointer-events-none absolute -bottom-1 right-0.5 hidden text-[8px] font-semibold text-[var(--ink-faint)] lg:block">
                  {item.shortcut}
                </span>
              </button>
            </div>
          );
        })}

        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--line)]" aria-hidden />

        <button
          type="button"
          className="tool-btn shrink-0"
          onClick={onUploadClick}
          disabled={readOnly}
          aria-label="Insert image"
          title="Insert image — upload or drag & drop"
        >
          <ImagePlus className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--line)]" aria-hidden />

        <button
          type="button"
          className="tool-btn shrink-0"
          onClick={undo}
          disabled={!canUndo || readOnly}
          aria-label="Undo"
          title="Undo — ⌘Z"
        >
          <Undo2 className="h-[18px] w-[18px]" aria-hidden />
        </button>
        <button
          type="button"
          className="tool-btn shrink-0"
          onClick={redo}
          disabled={!canRedo || readOnly}
          aria-label="Redo"
          title="Redo — ⇧⌘Z"
        >
          <Redo2 className="h-[18px] w-[18px]" aria-hidden />
        </button>

        <span className="mx-1 h-6 w-px shrink-0 bg-[var(--line)]" aria-hidden />

        <button
          type="button"
          className="tool-btn shrink-0"
          onClick={duplicateSelection}
          disabled={!selected.length || readOnly}
          aria-label="Duplicate selection"
          title="Duplicate — ⌘D"
        >
          <Copy className="h-[18px] w-[18px]" aria-hidden />
        </button>
        <button
          type="button"
          className="tool-btn shrink-0"
          onClick={() => lockSelection(!allLocked)}
          disabled={!selected.length || readOnly}
          aria-label={allLocked ? 'Unlock selection' : 'Lock selection'}
          title={allLocked ? 'Unlock — ⌥⌘L' : 'Lock — ⌥⌘L'}
        >
          {allLocked ? <LockOpen className="h-[18px] w-[18px]" aria-hidden /> : <Lock className="h-[18px] w-[18px]" aria-hidden />}
        </button>
        <button
          type="button"
          className="tool-btn shrink-0"
          onClick={() => (anyGrouped ? ungroupSelection() : groupSelection())}
          disabled={selected.length < 2 || readOnly}
          aria-label={anyGrouped ? 'Ungroup selection' : 'Group selection'}
          title={anyGrouped ? 'Ungroup — ⌘⇧G' : 'Group — ⌘G'}
        >
          {anyGrouped ? <Ungroup className="h-[18px] w-[18px]" aria-hidden /> : <Group className="h-[18px] w-[18px]" aria-hidden />}
        </button>
        <button
          type="button"
          className="tool-btn shrink-0 text-[var(--danger)] hover:bg-red-500/10"
          onClick={() => removeElements(selectedIds)}
          disabled={!selected.length || readOnly}
          aria-label="Delete selection"
          title="Delete — ⌫"
        >
          <Trash2 className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function StyleControls({ compact = false }: { compact?: boolean } = {}) {
  const style = useEditor((state) => state.style);
  const setStyle = useEditor((state) => state.setStyle);
  // Select primitives, then derive: returning a fresh array from a Zustand
  // selector causes an infinite re-render loop.
  const elements = useEditor((state) => state.elements);
  const selectedIds = useEditor((state) => state.selectedIds);
  const selected = useMemo(
    () => elements.filter((element) => selectedIds.includes(element.id)),
    [elements, selectedIds],
  );
  const updateElements = useEditor((state) => state.updateElements);
  const readOnly = useEditor((state) => state.readOnly);
  const { toast } = useToast();

  const hasSelection = selected.length > 0;
  const hasSticky = selected.some((element) => element.type === 'sticky');
  const hasText = selected.some((element) => element.textStyle);

  const applyToSelection = (patch: Record<string, unknown>) => {
    if (!hasSelection) return;
    updateElements(Object.fromEntries(selectedIds.map((id) => [id, patch])));
  };

  const stroke = hasSelection ? selected[0].stroke : style.stroke;
  const strokeWidth = hasSelection ? selected[0].strokeWidth : style.strokeWidth;
  const strokeStyle = hasSelection ? selected[0].strokeStyle : style.strokeStyle;
  const fill = hasSelection ? selected[0].fill : style.fill;
  const fillStyle = hasSelection ? selected[0].fillStyle : style.fillStyle;
  const fontSize = hasSelection ? selected[0].textStyle?.fontSize ?? style.fontSize : style.fontSize;
  const fontFamily = hasSelection ? selected[0].textStyle?.fontFamily ?? style.fontFamily : style.fontFamily;

  return (
    <div
      className={clsx(
        'pointer-events-auto flex gap-1 bg-[var(--surface-raised)]',
        compact
          ? 'flex-row items-center gap-0.5 rounded-xl border border-[var(--line)] px-1 py-0.5 shadow-float'
          : 'flex-col border-r border-[var(--line)] p-2',
      )}
    >
      <Popover
        label="Stroke color"
        align="start"
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-[var(--surface-sunken)]"
            aria-label="Stroke color"
            disabled={readOnly}
          >
            <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-white shadow-sm ring-1 ring-slate-900/10" style={{ background: stroke }} />
            <span className="text-[9px] font-medium text-[var(--ink-faint)]">Stroke</span>
          </button>
        )}
      >
        {({ close }) => (
          <div className="panel w-56 p-3">
            <p className="label mb-2">Stroke</p>
            <div className="grid grid-cols-6 gap-1.5">
              {STROKE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={clsx(
                    'h-7 w-7 rounded-full border border-slate-900/10 transition-transform hover:scale-110',
                    stroke === color && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-raised)]',
                  )}
                  style={{ background: color }}
                  aria-label={`Stroke color ${color}`}
                  onClick={() => {
                    setStyle({ stroke: color });
                    applyToSelection({ stroke: color });
                  }}
                />
              ))}
            </div>
            <label className="label mt-3 flex items-center justify-between">
              Custom
              <input
                type="color"
                value={stroke.startsWith('#') ? stroke : '#000000'}
                onChange={(event) => {
                  setStyle({ stroke: event.target.value });
                  applyToSelection({ stroke: event.target.value });
                }}
                className="h-7 w-12 cursor-pointer rounded border border-[var(--line)] bg-transparent"
                aria-label="Custom stroke color"
              />
            </label>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-1 py-0.5">
              <button
                type="button"
                className="btn-ghost p-1"
                onClick={() => {
                  const next = Math.max(1, strokeWidth - 1);
                  setStyle({ strokeWidth: next });
                  applyToSelection({ strokeWidth: next });
                }}
                aria-label="Decrease stroke width"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-xs font-semibold tabular-nums">{strokeWidth}px</span>
              <button
                type="button"
                className="btn-ghost p-1"
                onClick={() => {
                  const next = Math.min(16, strokeWidth + 1);
                  setStyle({ strokeWidth: next });
                  applyToSelection({ strokeWidth: next });
                }}
                aria-label="Increase stroke width"
              >
                <MoveUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {STROKE_WIDTHS.map((width) => (
                <button
                  key={width.value}
                  type="button"
                  onClick={() => {
                    setStyle({ strokeWidth: width.value });
                    applyToSelection({ strokeWidth: width.value });
                  }}
                  aria-label={`${width.label} stroke`}
                  className={clsx(
                    'grid h-8 place-items-center rounded-md border transition-colors',
                    strokeWidth === width.value
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-[var(--line)] hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  <span className="w-6 rounded-full bg-current" style={{ height: width.value }} />
                </button>
              ))}
            </div>
            <p className="label mt-3 mb-1.5">Line style</p>
            <div className="grid grid-cols-3 gap-1.5">
              {LINE_STYLES.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => {
                    setStyle({ strokeStyle: line.id });
                    applyToSelection({ strokeStyle: line.id });
                  }}
                  aria-label={line.label}
                  className={clsx(
                    'grid h-8 place-items-center rounded-md border text-[10px] font-medium',
                    strokeStyle === line.id
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--line)] hover:bg-[var(--surface-sunken)]',
                  )}
                >
                  {line.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </Popover>

      <Popover
        label="Fill color"
        align="start"
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-[var(--surface-sunken)]"
            aria-label="Fill color"
            disabled={readOnly}
          >
            <span
              className="h-6 w-6 rounded-md border-2 border-white shadow-sm ring-1 ring-slate-900/10"
              style={{
                background:
                  fillStyle === 'none' || fill === 'transparent'
                    ? 'repeating-linear-gradient(45deg, #e2e8f0 0 4px, #ffffff 4px 8px)'
                    : fill,
              }}
            />
            <span className="text-[9px] font-medium text-[var(--ink-faint)]">Fill</span>
          </button>
        )}
      >
        {() => (
          <div className="panel w-56 p-3">
            <p className="label mb-2">Fill</p>
            <div className="grid grid-cols-6 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setStyle({ fillStyle: 'none' });
                  applyToSelection({ fill: 'transparent', fillStyle: 'none' });
                }}
                aria-label="No fill"
                className={clsx(
                  'h-7 w-7 rounded-md border border-slate-900/10 bg-[repeating-linear-gradient(45deg,#e2e8f0_0_4px,#fff_4px_8px)]',
                  fillStyle === 'none' && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-raised)]',
                )}
              />
              {FILL_COLORS.filter((color) => color !== 'transparent').map((color) => (
                <button
                  key={color}
                  type="button"
                  className={clsx(
                    'h-7 w-7 rounded-md border border-slate-900/10 transition-transform hover:scale-110',
                    fill === color && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-raised)]',
                  )}
                  style={{ background: color }}
                  aria-label={`Fill color ${color}`}
                  onClick={() => {
                    setStyle({ fill: color, fillStyle: 'solid' });
                    applyToSelection({ fill: color, fillStyle: 'solid' });
                  }}
                />
              ))}
            </div>
            <label className="label mt-3 flex items-center justify-between">
              Custom
              <input
                type="color"
                value={fill.startsWith('#') ? fill : '#ffffff'}
                onChange={(event) => {
                  setStyle({ fill: event.target.value, fillStyle: 'solid' });
                  applyToSelection({ fill: event.target.value, fillStyle: 'solid' });
                }}
                className="h-7 w-12 cursor-pointer rounded border border-[var(--line)] bg-transparent"
                aria-label="Custom fill color"
              />
            </label>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-2 py-1.5">
              <span className="text-xs font-medium">Transparency</span>
              <input
                type="range"
                min={10}
                max={100}
                value={Math.round((hasSelection ? selected[0].opacity : style.opacity) * 100)}
                onChange={(event) => {
                  const opacity = Number(event.target.value) / 100;
                  setStyle({ opacity });
                  applyToSelection({ opacity });
                }}
                className="w-24 accent-[var(--accent)]"
                aria-label="Opacity"
              />
            </div>
            <button
              type="button"
              className="mt-2 w-full rounded-md border border-[var(--line)] py-1.5 text-xs font-medium hover:bg-[var(--surface-sunken)]"
              onClick={() => {
                setStyle({ fillStyle: 'hachure' });
                applyToSelection({ fillStyle: 'hachure' });
                toast({ title: 'Hachure fill applied', variant: 'info' });
              }}
            >
              Sketch (hachure) fill
            </button>
          </div>
        )}
      </Popover>

      {hasSticky ? (
        <Popover
          label="Sticky color"
          align="start"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-[var(--surface-sunken)]"
              aria-label="Sticky note color"
            >
              <span
                className="h-6 w-6 rounded-sm border-2 border-white shadow-sm ring-1 ring-slate-900/10"
                style={{ background: selected.find((element) => element.type === 'sticky')?.fill ?? style.stickyColor }}
              />
              <span className="text-[9px] font-medium text-[var(--ink-faint)]">Note</span>
            </button>
          )}
        >
          {() => (
            <div className="panel w-52 p-3">
              <p className="label mb-2">Sticky color</p>
              <div className="grid grid-cols-4 gap-2">
                {STICKY_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => {
                      setStyle({ stickyColor: color.value });
                      applyToSelection({ fill: color.value });
                    }}
                    aria-label={color.name}
                    title={color.name}
                    className="h-8 w-full rounded-sm border border-slate-900/10 transition-transform hover:scale-105"
                    style={{ background: color.value }}
                  />
                ))}
              </div>
            </div>
          )}
        </Popover>
      ) : null}

      {hasText ? (
        <Popover
          label="Text style"
          align="start"
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className="flex flex-col items-center gap-1 rounded-lg p-1.5 hover:bg-[var(--surface-sunken)]"
              aria-label="Text style"
            >
              <Type className="h-5 w-5 text-[var(--ink-muted)]" aria-hidden />
              <span className="text-[9px] font-medium text-[var(--ink-faint)]">Text</span>
            </button>
          )}
        >
          {() => (
            <div className="panel w-56 p-3">
              <p className="label mb-2">Font</p>
              <div className="grid grid-cols-3 gap-1.5">
                {FONT_FAMILIES.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => {
                      setStyle({ fontFamily: font.id });
                      updateElements(
                        Object.fromEntries(
                          selectedIds.map((id) => {
                            const element = selected.find((item) => item.id === id);
                            return [id, { textStyle: { ...element?.textStyle, fontFamily: font.id, fontSize: element?.textStyle?.fontSize ?? 20, text: element?.textStyle?.text ?? '', textAlign: element?.textStyle?.textAlign ?? 'center', bold: element?.textStyle?.bold ?? false, italic: element?.textStyle?.italic ?? false } }];
                          }),
                        ),
                      );
                    }}
                    className={clsx(
                      'rounded-md border py-1.5 text-[11px]',
                      font.className,
                      fontFamily === font.id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)]',
                    )}
                  >
                    {font.label}
                  </button>
                ))}
              </div>
              <p className="label mb-2 mt-3">Size</p>
              <div className="grid grid-cols-4 gap-1.5">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setStyle({ fontSize: size });
                      updateElements(
                        Object.fromEntries(
                          selectedIds.map((id) => {
                            const element = selected.find((item) => item.id === id);
                            return [id, { textStyle: { ...element?.textStyle, fontSize: size, fontFamily: element?.textStyle?.fontFamily ?? 'sans', text: element?.textStyle?.text ?? '', textAlign: element?.textStyle?.textAlign ?? 'center', bold: element?.textStyle?.bold ?? false, italic: element?.textStyle?.italic ?? false } }];
                          }),
                        ),
                      );
                    }}
                    className={clsx(
                      'rounded-md border py-1 text-[11px] tabular-nums',
                      fontSize === size ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)]',
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  className="rounded-md border border-[var(--line)] py-1.5 text-xs font-bold"
                  onClick={() => {
                    const bold = !(selected[0]?.textStyle?.bold ?? false);
                    updateElements(
                      Object.fromEntries(
                        selectedIds.map((id) => {
                          const element = selected.find((item) => item.id === id);
                          return [id, { textStyle: { ...element?.textStyle, bold, fontSize: element?.textStyle?.fontSize ?? 20, fontFamily: element?.textStyle?.fontFamily ?? 'sans', text: element?.textStyle?.text ?? '', textAlign: element?.textStyle?.textAlign ?? 'center', italic: element?.textStyle?.italic ?? false } }];
                        }),
                      ),
                    );
                  }}
                >
                  Bold
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[var(--line)] py-1.5 text-xs italic"
                  onClick={() => {
                    const italic = !(selected[0]?.textStyle?.italic ?? false);
                    updateElements(
                      Object.fromEntries(
                        selectedIds.map((id) => {
                          const element = selected.find((item) => item.id === id);
                          return [id, { textStyle: { ...element?.textStyle, italic, fontSize: element?.textStyle?.fontSize ?? 20, fontFamily: element?.textStyle?.fontFamily ?? 'sans', text: element?.textStyle?.text ?? '', textAlign: element?.textStyle?.textAlign ?? 'center', bold: element?.textStyle?.bold ?? false } }];
                        }),
                      ),
                    );
                  }}
                >
                  Italic
                </button>
              </div>
            </div>
          )}
        </Popover>
      ) : null}
    </div>
  );
}
