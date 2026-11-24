'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { saveBoard } from '@/lib/db';
import { getTemplate } from '@/lib/templates';
import { uid } from '@/lib/geometry';

/**
 * `/board/example` seeds a sample board into local storage on first visit and
 * redirects to the editor. Useful for demos and for the empty dashboard.
 */
export default function ExampleBoardRedirect() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const id = uid('board');
        const template = getTemplate('quick-start');
        const now = Date.now();
        await saveBoard({
          id,
          title: 'Quick-start tour',
          createdAt: now,
          updatedAt: now,
          elements: template.build(),
          background: { kind: 'grid', color: '#f8fafc' },
          camera: { x: 0, y: 0, zoom: 1 },
          templateId: template.id,
        });
        router.replace(`/board/${id}`);
      } catch (error) {
        console.error(error);
        setFailed(true);
      }
    };
    void run();
  }, [router]);

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--surface-sunken)]">
      <div className="flex flex-col items-center gap-3 text-[var(--ink-muted)]">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <p className="text-sm font-medium">
          {failed ? 'Could not create the sample board — local storage is blocked.' : 'Preparing the sample board…'}
        </p>
      </div>
    </main>
  );
}
