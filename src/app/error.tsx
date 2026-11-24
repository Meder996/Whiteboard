'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the failure in the console for support, and keep a copy on the
    // window object so it can be inspected without the React overlay.
    console.error('[Whiteboard Studio] render error', error);
    (window as unknown as { __LAST_ERROR__?: unknown }).__LAST_ERROR__ = {
      message: error?.message,
      stack: error?.stack?.slice(0, 2000),
      digest: error?.digest,
      at: new Date().toISOString(),
    };
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--surface-sunken)] p-6">
      <div className="panel max-w-lg p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
          Your boards are saved locally, so nothing was lost. Reloading usually fixes this.
        </p>
        <p className="mt-2 text-xs text-[var(--ink-faint)]" data-testid="error-detail">
          {error?.message ? error.message.slice(0, 300) : 'Unknown error'}
          {error?.digest ? ` · ${error.digest}` : ''}
        </p>
        <button type="button" className="btn-primary mt-4" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
