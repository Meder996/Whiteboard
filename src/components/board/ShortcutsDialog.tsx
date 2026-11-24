'use client';

import { Modal } from '@/components/ui/Modal';

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Tools',
    items: [
      ['V', 'Select / move'],
      ['H or Space', 'Pan canvas'],
      ['P', 'Pen'],
      ['M', 'Highlighter'],
      ['E', 'Eraser'],
      ['N', 'Sticky note'],
      ['T', 'Text'],
      ['R / O / D', 'Rectangle / Ellipse / Diamond'],
      ['L / A / C', 'Line / Arrow / Connector'],
    ],
  },
  {
    title: 'File',
    items: [
      ['⌘ / Ctrl + S', 'Save now'],
      ['← (header)', 'Save & exit to all boards'],
      ['⌘ / Ctrl + V', 'Paste an image from the clipboard'],
    ],
  },
  {
    title: 'Edit',
    items: [
      ['⌘ / Ctrl + Z', 'Undo'],
      ['⌘ / Ctrl + ⇧ + Z', 'Redo'],
      ['⌘ / Ctrl + D', 'Duplicate'],
      ['⌫ / Delete', 'Delete selection'],
      ['⌘ / Ctrl + A', 'Select all'],
      ['⌘ / Ctrl + G', 'Group'],
      ['⌘ / Ctrl + ⇧ + G', 'Ungroup'],
      ['⌥ / Alt + ⌘ + L', 'Lock / unlock'],
      ['Esc', 'Clear selection'],
      ['Enter / double-click', 'Edit text'],
    ],
  },
  {
    title: 'View',
    items: [
      ['⌘ / Ctrl + + / −', 'Zoom in / out'],
      ['⌘ / Ctrl + 0', 'Reset zoom'],
      ['⇧ + 1', 'Fit to screen'],
      ['⇧ + 0', 'Reset view'],
      ['Arrows', 'Nudge selection (⇧ = 10px)'],
      ['⌘ / Ctrl + scroll', 'Zoom at pointer'],
      ['?', 'This dialog'],
    ],
  },
  {
    title: 'Layers',
    items: [
      ['⌘ / Ctrl + ]', 'Bring forward'],
      ['⌘ / Ctrl + [', 'Send backward'],
      ['⌥ + ⌘ + ]', 'Bring to front'],
      ['⌥ + ⌘ + [', 'Send to back'],
    ],
  },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Everything you need to move fast without the mouse."
      size="lg"
      footer={
        <button type="button" className="btn-primary" onClick={onClose}>
          Got it
        </button>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="label mb-2">{group.title}</h3>
            <dl className="space-y-1.5">
              {group.items.map(([keys, label]) => (
                <div key={keys} className="flex items-center justify-between gap-3 text-sm">
                  <dt className="text-[var(--ink-muted)]">{label}</dt>
                  <dd className="shrink-0 rounded border border-[var(--line)] bg-[var(--surface-sunken)] px-1.5 py-0.5 font-mono text-[11px]">
                    {keys}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Modal>
  );
}
