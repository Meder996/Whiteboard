'use client';

import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { Check, Copy, ExternalLink, Link2, Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/Toast';
import { buildShareUrl, PERMISSION_LABELS, sharePermissionHint, type SharePermission } from '@/lib/share';
import type { Board } from '@/lib/types';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  board: Board;
}

export function ShareDialog({ open, onClose, board }: ShareDialogProps) {
  const [permission, setPermission] = useState<SharePermission>('view');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const link = useMemo(() => {
    if (!open) return '';
    try {
      setError(null);
      return buildShareUrl(board, permission);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a share link.');
      return '';
    }
  }, [board, permission, open]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: 'Link copied', description: sharePermissionHint(permission), variant: 'success' });
    } catch {
      // Clipboard access can fail without permission; fall back to selecting.
      toast({
        title: 'Copy failed',
        description: 'Select the link and copy it manually (Ctrl/Cmd + C).',
        variant: 'error',
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this board"
      description="Link sharing works without an account. Anyone with the link opens a snapshot of this board."
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>
            Done
          </button>
          <button type="button" className="btn-primary" onClick={copy} disabled={!link}>
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="label mb-2">Access level</legend>
          <div className="grid gap-2">
            {(Object.keys(PERMISSION_LABELS) as SharePermission[]).map((key) => (
              <label
                key={key}
                className={clsx(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors',
                  permission === key
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-[var(--line)] hover:bg-[var(--surface-sunken)]',
                )}
              >
                <input
                  type="radio"
                  name="permission"
                  value={key}
                  checked={permission === key}
                  onChange={() => setPermission(key)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-sm font-medium">{PERMISSION_LABELS[key].label}</span>
                  <span className="block text-xs text-[var(--ink-muted)]">{PERMISSION_LABELS[key].description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="share-link" className="label mb-1.5 block">
            Share link
          </label>
          <div className="flex gap-2">
            <input
              id="share-link"
              readOnly
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              className="field font-mono text-[11px]"
              placeholder={error ? 'Unavailable' : 'Creating link…'}
              aria-describedby="share-link-help"
            />
            <a
              href={link || '#'}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => {
                if (!link) event.preventDefault();
              }}
              className={clsx('btn-outline shrink-0', !link && 'pointer-events-none opacity-40')}
              aria-label="Open share link in a new tab"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </div>
          {error ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--danger)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {error}
            </p>
          ) : (
            <p id="share-link-help" className="mt-2 text-xs text-[var(--ink-muted)]">
              The board snapshot is embedded in the link fragment, so it never reaches a server.
              Recipients see the state at the time you copied it.
            </p>
          )}
        </div>

        <div className="rounded-lg bg-[var(--surface-sunken)] p-3 text-xs text-[var(--ink-muted)]">
          <p className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> What works today
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Anyone with the link can open, pan, zoom, and export the board.</li>
            <li>Edits recipients make stay in their own browser workspace.</li>
            <li>Live multiplayer cursors need a realtime backend (see README → Collaboration).</li>
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] p-3">
          <div className="flex items-center gap-2 text-xs text-[var(--ink-muted)]">
            <Mail className="h-4 w-4" aria-hidden />
            <span>No email invites yet — copy the link and send it directly.</span>
          </div>
          <Link2 className="h-4 w-4 shrink-0 text-[var(--ink-faint)]" aria-hidden />
        </div>
      </div>
    </Modal>
  );
}
