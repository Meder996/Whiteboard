'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { Brain, CalendarCheck, GitBranch, KanbanSquare, LayoutTemplate, Lightbulb, Loader2, Route } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { TemplateDefinition } from '@/lib/types';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  brainstorm: Lightbulb,
  process: GitBranch,
  planning: KanbanSquare,
  teaching: Route,
  meeting: CalendarCheck,
};

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'brainstorm', label: 'Brainstorming' },
  { id: 'process', label: 'Flowcharts' },
  { id: 'planning', label: 'Planning' },
  { id: 'meeting', label: 'Meetings' },
  { id: 'teaching', label: 'Learning' },
];

export function TemplateGallery({
  open,
  onClose,
  templates,
  onCreate,
  creating,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateDefinition[];
  onCreate: (templateId: string) => Promise<void> | void;
  creating: boolean;
}) {
  const [category, setCategory] = useState('all');
  const filtered = useMemo(
    () => (category === 'all' ? templates : templates.filter((template) => template.category === category)),
    [category, templates],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start a new board"
      description="Pick a template — you can change everything later."
      size="lg"
      footer={
        <button type="button" className="btn-outline" onClick={onClose}>
          Cancel
        </button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            aria-pressed={category === item.id}
            className={clsx(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              category === item.id
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--ink-muted)] hover:bg-[var(--surface-sunken)]',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((template) => {
          const Icon = ICONS[template.category] ?? LayoutTemplate;
          return (
            <button
              key={template.id}
              type="button"
              disabled={creating}
              onClick={() => onCreate(template.id)}
              className="group flex h-full items-start gap-3 rounded-xl border border-[var(--line)] p-3 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-float disabled:opacity-60"
            >
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {template.name}
                  <Brain className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--ink-muted)]">
                  {template.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
