'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--surface-sunken)] p-6">
      <div className="panel max-w-md p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-[var(--ink-muted)]">
          Your boards are saved locally, so nothing was lost. Reloading usually fixes this.
        </p>
        <button type="button" className="btn-primary mt-4" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
