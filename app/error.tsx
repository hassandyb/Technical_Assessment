'use client';

/**
 * The last line of defence: something failed that the plan service did not
 * anticipate. React's `reset` re-renders the route, which is the honest retry
 * here because the plan is rebuilt from the workbook on every request anyway.
 */

import { useEffect } from 'react';
import { RotateCcw, ServerCrash } from 'lucide-react';

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('The planning workspace failed to render', error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 py-8">
      <section
        aria-labelledby="error-heading"
        className="rounded-lg border border-destructive/40 bg-destructive/5 p-6"
      >
        <div className="flex items-start gap-3">
          <ServerCrash className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
          <div>
            <h1 id="error-heading" className="font-semibold">
              The plan could not be produced
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Nothing has been changed and no partial plan was saved. The workbook is read
              again from scratch on every attempt, so retrying is safe.
            </p>
            {error.digest && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                Reference: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
            >
              <RotateCcw className="size-4" aria-hidden />
              Try again
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
