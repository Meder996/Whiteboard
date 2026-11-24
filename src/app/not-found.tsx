import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--surface-sunken)] p-6">
      <div className="panel max-w-sm p-6 text-center">
        <p className="text-4xl font-bold tracking-tight">404</p>
        <h1 className="mt-2 text-lg font-semibold">We couldn&apos;t find that page</h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          The board may have been deleted, or the link is incomplete.
        </p>
        <Link href="/" className="btn-primary mt-4">
          Back to boards
        </Link>
      </div>
    </main>
  );
}
