/**
 * The one way to produce a plan: read the workbook, validate it, run the policy.
 *
 * The page and the API route both go through here, so what the screen shows and
 * what the endpoint returns can never drift apart.
 *
 * Failures are returned rather than thrown. A workbook with a bad cell is an
 * ordinary outcome the interface must explain, not an exception, and Next.js
 * strips details from errors thrown during a server render — which would lose
 * exactly the cell references the planner needs.
 */

import type { ApiError } from '@/lib/api/contract';
import { readWorkbook, WorkbookReadError } from '@/lib/data/read-workbook';
import { ValidationError, validateWorkbook } from '@/lib/data/validate';
import type { PlanResult } from '@/lib/domain/types';
import { plan } from '@/lib/engine/plan';

export type PlanOutcome =
  | { ok: true; plan: PlanResult }
  | { ok: false; failure: ApiError; status: number };

export function loadPlan(): PlanOutcome {
  try {
    return { ok: true, plan: plan(validateWorkbook(readWorkbook())) };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        ok: false,
        status: 422,
        failure: {
          error: 'INVALID_WORKBOOK',
          message: error.message,
          issues: error.issues,
        },
      };
    }

    if (error instanceof WorkbookReadError) {
      return {
        ok: false,
        status: 500,
        failure: { error: 'WORKBOOK_UNREADABLE', message: error.message },
      };
    }

    // Never put an internal stack on a planner's screen; log it for operators.
    console.error('Unexpected failure while building the plan', error);
    return {
      ok: false,
      status: 500,
      failure: {
        error: 'UNEXPECTED',
        message: 'The plan could not be produced. Try again, or reload the workbook.',
      },
    };
  }
}
