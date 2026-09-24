/**
 * The shape of the planning API, shared by the route and the interface.
 *
 * Errors are typed rather than free text so the screen can react to each case:
 * a workbook the planner can fix reads differently from a server that fell over.
 */

import type { ValidationIssue } from '@/lib/data/validate';
import type { PlanResult } from '@/lib/domain/types';

export type ApiErrorCode =
  /** The workbook loaded but holds values the planner must correct. */
  | 'INVALID_WORKBOOK'
  /** The file is missing, unreadable, or not a workbook at all. */
  | 'WORKBOOK_UNREADABLE'
  /** Anything unforeseen; the interface offers a retry rather than an excuse. */
  | 'UNEXPECTED';

export interface ApiError {
  error: ApiErrorCode;
  message: string;
  /** Present for INVALID_WORKBOOK: one entry per cell the planner must fix. */
  issues?: ValidationIssue[];
}

/** A successful response is the plan itself. */
export type PlanResponse = PlanResult;
