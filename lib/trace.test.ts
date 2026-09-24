import { describe, expect, it } from 'vitest';
import { readWorkbook } from '@/lib/data/read-workbook';
import { validateWorkbook } from '@/lib/data/validate';
import { plan } from '@/lib/engine/plan';
import { traceClient } from '@/lib/trace';

const result = plan(validateWorkbook(readWorkbook()));

describe('tracing a client back to the farms', () => {
  it('names only the grades that could have served the order', () => {
    // C02 is MINIMUM A, and nothing outranks A.
    expect(traceClient(result, 'C02')?.segments).toEqual(['A']);
    // C06 is MINIMUM C, so B and A would also have done.
    expect(traceClient(result, 'C06')?.segments).toEqual(['A', 'B', 'C']);
    // C09 is EXACT B and accepts nothing else.
    expect(traceClient(result, 'C09')?.segments).toEqual(['B']);
  });

  it('reports the segment gap and the farms that caused it', () => {
    const trace = traceClient(result, 'C02');

    // Segment A arrived below plan, which is why C02 could not be finished.
    expect(trace!.segmentVarianceT).toBeLessThan(0);
    expect(trace!.shortfalls.length).toBeGreaterThan(0);
    // Worst offender first.
    expect(trace!.shortfalls[0].varianceT).toBeLessThanOrEqual(
      trace!.shortfalls[1].varianceT,
    );
    // Every implicated farm really did miss its target.
    for (const farm of trace!.shortfalls) {
      expect(farm.varianceT).toBeLessThan(0);
    }
  });

  it('lists the farms that did supply the client', () => {
    const trace = traceClient(result, 'C01');
    const supplied = trace!.suppliers.reduce((sum, row) => sum + row.tonnes, 0);

    expect(supplied).toBe(50);
    expect(trace!.suppliers.every((row) => row.segment === 'A')).toBe(true);
  });

  it('returns null for a client that does not exist', () => {
    expect(traceClient(result, 'C99')).toBeNull();
  });
});
