import { describe, expect, it } from 'vitest';
import { readWorkbook } from '@/lib/data/read-workbook';
import { ValidationError, validateWorkbook } from '@/lib/data/validate';
import type { RawWorkbook } from '@/lib/data/read-workbook';

/** A fresh, deep copy of the real workbook that a test can safely corrupt. */
function corruptible(): RawWorkbook {
  return structuredClone(readWorkbook());
}

/** Runs validation and returns the issues, failing if the input was accepted. */
function rejectionOf(raw: RawWorkbook) {
  try {
    validateWorkbook(raw);
  } catch (error) {
    if (error instanceof ValidationError) return error.issues;
    throw error;
  }
  throw new Error('expected the workbook to be rejected, but it was accepted');
}

describe('validation', () => {
  it('accepts the supplied workbook', () => {
    const input = validateWorkbook(readWorkbook());

    expect(input.farms).toHaveLength(20);
    expect(input.clients).toHaveLength(10);
    expect(input.station.exportCapacityT).toBe(500);
    expect(input.station.referencePrices).toEqual({ A: 1500, B: 1250, C: 1000, D: 750 });
  });

  it('rejects quantities that are not whole 5 t lots', () => {
    const raw = corruptible();
    raw.farms[2].actual_A_t = 22;

    expect(rejectionOf(raw)).toContainEqual({
      sheet: 'Farms',
      id: 'F03',
      field: 'actual_A_t',
      message: 'must be a multiple of 5 t',
    });
  });

  it('rejects an expected mix that does not sum to 1.0', () => {
    const raw = corruptible();
    raw.farms[4].expected_B_pct = 0.9;

    expect(rejectionOf(raw)).toContainEqual(
      expect.objectContaining({ sheet: 'Farms', id: 'F05', field: 'expected_mix' }),
    );
  });

  it('rejects duplicate identifiers', () => {
    const raw = corruptible();
    raw.farms[6].farm_id = 'F01';

    expect(rejectionOf(raw)).toContainEqual(
      expect.objectContaining({ sheet: 'Farms', message: 'duplicate farm_id "F01"' }),
    );
  });

  it('rejects an unknown acceptance mode and a negative demand', () => {
    const raw = corruptible();
    raw.clients[1].acceptance_mode = 'MAYBE';
    raw.clients[3].demand_t = -10;

    const issues = rejectionOf(raw);
    expect(issues).toContainEqual(
      expect.objectContaining({ sheet: 'Clients', id: 'C02', field: 'acceptance_mode' }),
    );
    expect(issues).toContainEqual({
      sheet: 'Clients',
      id: 'C04',
      field: 'demand_t',
      message: 'must not be negative',
    });
  });

  it('rejects a missing reference price and an unusable capacity', () => {
    const raw = corruptible();
    raw.referencePrices = raw.referencePrices.filter((row) => row.segment !== 'C');
    raw.station[0].export_conditioning_capacity_t = 0;

    const issues = rejectionOf(raw);
    expect(issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Station',
        message: 'missing reference export price for segment "C"',
      }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        sheet: 'Station',
        field: 'export_conditioning_capacity_t',
      }),
    );
  });

  it('reports every problem at once rather than stopping at the first', () => {
    const raw = corruptible();
    raw.farms[0].actual_A_t = 7;
    raw.clients[0].export_price_per_t_eur = -1;
    raw.station[0].local_market_ratio = 5;

    const issues = rejectionOf(raw);
    expect(issues.length).toBeGreaterThanOrEqual(3);
    expect(new Set(issues.map((issue) => issue.sheet))).toEqual(
      new Set(['Farms', 'Clients', 'Station']),
    );
  });
});
