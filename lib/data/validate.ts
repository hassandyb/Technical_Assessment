/**
 * Validates the raw workbook and turns it into trusted domain objects.
 *
 * Nothing is repaired or guessed. A planner acting on a quietly corrected
 * number is worse off than one told exactly which cell is wrong, so every
 * problem is reported with its sheet and row identifier, and all problems are
 * collected before failing rather than stopping at the first.
 */

import { z } from 'zod';
import {
  SEGMENTS,
  type BySegment,
  type Client,
  type Farm,
  type PlanInput,
  type Segment,
  type Station,
} from '@/lib/domain/types';
import type { RawRow, RawWorkbook } from '@/lib/data/read-workbook';

export interface ValidationIssue {
  sheet: 'Farms' | 'Clients' | 'Station';
  /** The farm or client the problem belongs to, when it can be identified. */
  id?: string;
  field?: string;
  message: string;
}

export class ValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(`The workbook has ${issues.length} problem(s) and was not loaded.`);
    this.name = 'ValidationError';
  }
}

// --- Shared cell rules -----------------------------------------------------

/** Receipts, demand and capacity are all handled in 5 t lots at the station. */
const tonnes = z
  .number()
  .nonnegative('must not be negative')
  .refine((n) => n % 5 === 0, 'must be a multiple of 5 t');

/** Planned capacity is an estimate, so the brief allows one decimal place. */
const plannedCapacity = z
  .number()
  .nonnegative('must not be negative')
  .refine((n) => Number.isInteger(n * 10), 'may use at most one decimal place');

const mixFraction = z
  .number()
  .min(0, 'must be between 0 and 1')
  .max(1, 'must be between 0 and 1');

const price = z.number().positive('must be a positive price');

const segment = z.enum(SEGMENTS);
const acceptanceMode = z.enum(['EXACT', 'MINIMUM']);
const identifier = z.string().trim().min(1, 'is required');

// --- Row schemas -----------------------------------------------------------

const farmRow = z
  .object({
    farm_id: identifier,
    farm_name: identifier,
    expected_daily_capacity_t: plannedCapacity,
    expected_A_pct: mixFraction,
    expected_B_pct: mixFraction,
    expected_C_pct: mixFraction,
    expected_D_pct: mixFraction,
    actual_A_t: tonnes,
    actual_B_t: tonnes,
    actual_C_t: tonnes,
    actual_D_t: tonnes,
  })
  .refine(
    (row) => {
      const sum =
        row.expected_A_pct + row.expected_B_pct + row.expected_C_pct + row.expected_D_pct;
      // Tolerance guards against binary floating point, not against real errors.
      return Math.abs(sum - 1) < 1e-9;
    },
    { message: 'expected mix must sum to exactly 1.0', path: ['expected_mix'] },
  );

const clientRow = z.object({
  client_id: identifier,
  client_name: identifier,
  acceptance_mode: acceptanceMode,
  requested_segment: segment,
  demand_t: tonnes,
  export_price_per_t_eur: price,
});

const stationRow = z.object({
  station_id: identifier,
  export_conditioning_capacity_t: tonnes.refine(
    (n) => n > 0,
    'must be greater than zero',
  ),
  local_market_ratio: z
    .number()
    .min(0, 'must be between 0 and 1')
    .max(1, 'must be between 0 and 1'),
});

const priceRow = z.object({
  segment,
  reference_export_price_per_t_eur: price,
});

// --- Helpers ---------------------------------------------------------------

/** Turns Zod's report into issues that name the sheet and the offending row. */
function issuesFrom(
  error: z.ZodError,
  sheet: ValidationIssue['sheet'],
  id: string | undefined,
): ValidationIssue[] {
  return error.issues.map((issue) => ({
    sheet,
    id,
    field: issue.path.join('.') || undefined,
    message: issue.message,
  }));
}

function rowId(row: RawRow, key: string): string | undefined {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function duplicateIds(
  ids: (string | undefined)[],
  sheet: ValidationIssue['sheet'],
  label: string,
): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];
  for (const id of ids) {
    if (!id) continue;
    if (seen.has(id)) {
      issues.push({ sheet, id, message: `duplicate ${label} "${id}"` });
    }
    seen.add(id);
  }
  return issues;
}

// --- Entry point -----------------------------------------------------------

/**
 * @throws {ValidationError} carrying every problem found, so the interface can
 * show them all at once instead of one per attempt.
 */
export function validateWorkbook(raw: RawWorkbook): PlanInput {
  const issues: ValidationIssue[] = [];

  const farms: Farm[] = [];
  for (const row of raw.farms) {
    const id = rowId(row, 'farm_id');
    const parsed = farmRow.safeParse(row);
    if (!parsed.success) {
      issues.push(...issuesFrom(parsed.error, 'Farms', id));
      continue;
    }
    const data = parsed.data;
    farms.push({
      id: data.farm_id,
      name: data.farm_name,
      expectedCapacityT: data.expected_daily_capacity_t,
      expectedMix: {
        A: data.expected_A_pct,
        B: data.expected_B_pct,
        C: data.expected_C_pct,
        D: data.expected_D_pct,
      },
      actualT: {
        A: data.actual_A_t,
        B: data.actual_B_t,
        C: data.actual_C_t,
        D: data.actual_D_t,
      },
    });
  }
  issues.push(...duplicateIds(raw.farms.map((r) => rowId(r, 'farm_id')), 'Farms', 'farm_id'));
  if (raw.farms.length === 0) {
    issues.push({ sheet: 'Farms', message: 'no farm rows were found' });
  }

  const clients: Client[] = [];
  for (const row of raw.clients) {
    const id = rowId(row, 'client_id');
    const parsed = clientRow.safeParse(row);
    if (!parsed.success) {
      issues.push(...issuesFrom(parsed.error, 'Clients', id));
      continue;
    }
    const data = parsed.data;
    clients.push({
      id: data.client_id,
      name: data.client_name,
      acceptanceMode: data.acceptance_mode,
      requestedSegment: data.requested_segment,
      demandT: data.demand_t,
      exportPricePerT: data.export_price_per_t_eur,
    });
  }
  issues.push(
    ...duplicateIds(raw.clients.map((r) => rowId(r, 'client_id')), 'Clients', 'client_id'),
  );
  if (raw.clients.length === 0) {
    issues.push({ sheet: 'Clients', message: 'no client rows were found' });
  }

  // The reference-price table must cover every segment, or local fruit that
  // falls into a missing segment could not be valued at all.
  const referencePrices = {} as BySegment;
  const pricedSegments = new Set<Segment>();
  for (const row of raw.referencePrices) {
    const parsed = priceRow.safeParse(row);
    if (!parsed.success) {
      issues.push(...issuesFrom(parsed.error, 'Station', rowId(row, 'segment')));
      continue;
    }
    if (pricedSegments.has(parsed.data.segment)) {
      issues.push({
        sheet: 'Station',
        id: parsed.data.segment,
        message: `duplicate reference price for segment "${parsed.data.segment}"`,
      });
      continue;
    }
    pricedSegments.add(parsed.data.segment);
    referencePrices[parsed.data.segment] = parsed.data.reference_export_price_per_t_eur;
  }
  for (const value of SEGMENTS) {
    if (!pricedSegments.has(value)) {
      issues.push({
        sheet: 'Station',
        id: value,
        message: `missing reference export price for segment "${value}"`,
      });
    }
  }

  let station: Station | undefined;
  if (raw.station.length !== 1) {
    issues.push({
      sheet: 'Station',
      message: `expected exactly one station row, found ${raw.station.length}`,
    });
  } else {
    const parsed = stationRow.safeParse(raw.station[0]);
    if (!parsed.success) {
      issues.push(...issuesFrom(parsed.error, 'Station', rowId(raw.station[0], 'station_id')));
    } else {
      station = {
        id: parsed.data.station_id,
        exportCapacityT: parsed.data.export_conditioning_capacity_t,
        localMarketRatio: parsed.data.local_market_ratio,
        referencePrices,
      };
    }
  }

  if (issues.length > 0 || !station) {
    throw new ValidationError(issues);
  }

  return { farms, clients, station };
}

/** Renders an issue the way it should read to a planner looking at the sheet. */
export function describeIssue(issue: ValidationIssue): string {
  const where = [issue.sheet, issue.id, issue.field].filter(Boolean).join(' / ');
  return `${where}: ${issue.message}`;
}
