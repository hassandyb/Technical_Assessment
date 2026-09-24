/**
 * The Production–Commercial planning workspace.
 *
 * A Server Component: the workbook is read and the policy is run on the server,
 * and the browser only ever receives the finished plan.
 */

import { Headline } from '@/components/plan/headline';
import { WorkbookProblem } from '@/components/plan/workbook-problem';
import { tonnes } from '@/lib/format';
import { loadPlan } from '@/lib/plan-service';

/**
 * Reading a file is not something Next.js can detect as dynamic, so without
 * this the page would be prerendered once at build time and keep serving that
 * plan after the workbook changed. The plan must always reflect today's file.
 */
export const dynamic = 'force-dynamic';

export default function PlanningWorkspace() {
  const outcome = loadPlan();

  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 py-8">
      <header className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">
          Atlas Fresh · Production and Commercial
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Daily export plan</h1>
        {outcome.ok && (
          <p className="mt-2 text-sm text-muted-foreground">
            Workbook validated · {outcome.plan.farms.length} farms ·{' '}
            {outcome.plan.clients.length} clients · station capacity{' '}
            {tonnes(outcome.plan.kpis.capacityT)}
          </p>
        )}
      </header>

      {outcome.ok ? (
        <Headline plan={outcome.plan} />
      ) : (
        <WorkbookProblem failure={outcome.failure} />
      )}
    </main>
  );
}
