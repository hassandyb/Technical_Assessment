/**
 * What the planner sees when the workbook cannot be turned into a plan.
 *
 * Two different situations, deliberately shown differently: a spreadsheet the
 * planner can go and fix, listed cell by cell, versus a failure on our side
 * where the only useful action is to try again.
 */

import { FileWarning, ServerCrash } from 'lucide-react';
import { RetryButton } from '@/components/plan/retry-button';
import type { ApiError } from '@/lib/api/contract';
import { describeIssue } from '@/lib/data/validate';

export function WorkbookProblem({ failure }: { failure: ApiError }) {
  const fixable = failure.error === 'INVALID_WORKBOOK';
  const Icon = fixable ? FileWarning : ServerCrash;

  return (
    <section
      aria-labelledby="problem-heading"
      className="rounded-lg border border-destructive/40 bg-destructive/5 p-6"
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
        <div className="min-w-0">
          <h2 id="problem-heading" className="font-semibold">
            {fixable ? 'The workbook needs correcting' : 'The plan could not be produced'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{failure.message}</p>

          {fixable && failure.issues && (
            <>
              <p className="mt-4 text-sm">
                No plan was built, and nothing was corrected automatically. Fix these cells in
                the workbook and reload:
              </p>
              <ul className="mt-2 space-y-1">
                {failure.issues.map((issue, index) => (
                  <li
                    key={`${issue.sheet}-${issue.id ?? index}-${issue.field ?? index}`}
                    className="font-mono text-sm text-destructive"
                  >
                    {describeIssue(issue)}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5">
            <RetryButton
              label={fixable ? 'I have fixed the workbook — reload' : 'Try again'}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
