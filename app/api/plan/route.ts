/**
 * The daily plan, computed on the server.
 *
 * Every request re-reads the workbook and re-runs the policy, so a corrected
 * spreadsheet is reflected by a refresh and no stale plan is ever served.
 * Route Handlers are uncached by default in Next.js, so no cache configuration
 * is needed here.
 */

import { loadPlan } from '@/lib/plan-service';

export async function GET(): Promise<Response> {
  const outcome = loadPlan();

  return outcome.ok
    ? Response.json(outcome.plan)
    : Response.json(outcome.failure, { status: outcome.status });
}
