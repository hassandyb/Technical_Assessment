'use client';

/**
 * Re-runs the server render, which re-reads the workbook.
 *
 * A planner who has just corrected a cell should not have to know to press F5;
 * `router.refresh()` rebuilds the plan without losing the page.
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';

export function RetryButton({ label = 'Reload the workbook' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
    >
      <RotateCcw className={`size-4 ${pending ? 'animate-spin' : ''}`} aria-hidden />
      {pending ? 'Rereading…' : label}
    </button>
  );
}
