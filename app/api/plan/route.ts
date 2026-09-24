/**
 * The daily plan, computed on the server.
 *
 * Every request reads the workbook and re-runs the policy, so a corrected
 * spreadsheet is reflected by a refresh and no stale plan is ever served.
 * Route Handlers are uncached by default in Next.js, which is what we want
 * here, so no cache configuration is needed.
 */

import type { ApiError } from '@/lib/api/contract';
import { readWorkbook, WorkbookReadError } from '@/lib/data/read-workbook';
import { ValidationError, validateWorkbook } from '@/lib/data/validate';
import { plan } from '@/lib/engine/plan';

function fail(body: ApiError, status: number): Response {
  return Response.json(body, { status });
}

export async function GET(): Promise<Response> {
  try {
    return Response.json(plan(validateWorkbook(readWorkbook())));
  } catch (error) {
    // The planner can fix these: say exactly which cells are wrong.
    if (error instanceof ValidationError) {
      return fail(
        {
          error: 'INVALID_WORKBOOK',
          message: error.message,
          issues: error.issues,
        },
        422,
      );
    }

    if (error instanceof WorkbookReadError) {
      return fail({ error: 'WORKBOOK_UNREADABLE', message: error.message }, 500);
    }

    // Never leak an internal stack to the screen; log it for whoever operates this.
    console.error('Unexpected failure while building the plan', error);
    return fail(
      {
        error: 'UNEXPECTED',
        message: 'The plan could not be produced. Try again, or reload the workbook.',
      },
      500,
    );
  }
}
