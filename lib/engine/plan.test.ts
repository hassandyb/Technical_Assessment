/**
 * End-to-end checks against the supplied workbook.
 *
 * The published baseline is asserted here, and then deliberately broken by
 * changing an input, because a plan that cannot move is a plan that was
 * hard-coded.
 */

import { describe, expect, it } from 'vitest';
import { readWorkbook } from '@/lib/data/read-workbook';
import { validateWorkbook } from '@/lib/data/validate';
import { plan } from '@/lib/engine/plan';
import type { PlanResult } from '@/lib/domain/types';

const input = validateWorkbook(readWorkbook());
const baseline = plan(input);

function statusOf(result: PlanResult, id: string) {
  return result.clients.find((entry) => entry.client.id === id);
}

describe('published baseline', () => {
  it('reproduces every figure the brief publishes', () => {
    expect(baseline.kpis).toMatchObject({
      expectedT: 600,
      actualT: 560,
      capacityT: 500,
      exportedT: 500,
      localT: 60,
      exportRevenueEur: 549_500,
      localValueEur: 4_500,
      totalValueEur: 554_000,
      atRiskClientCount: 3,
    });
    expect(baseline.kpis.exportRate).toBeCloseTo(0.893, 3);
  });

  it('shorts C02 and C09 on quality but C08 on capacity', () => {
    expect(statusOf(baseline, 'C02')).toMatchObject({
      status: 'PARTIAL',
      allocatedT: 40,
      reason: 'INSUFFICIENT_COMPATIBLE_SEGMENT',
    });
    expect(statusOf(baseline, 'C09')).toMatchObject({
      status: 'PARTIAL',
      allocatedT: 30,
      reason: 'INSUFFICIENT_COMPATIBLE_SEGMENT',
    });
    // The station filled up, which is a different problem with a different fix.
    expect(statusOf(baseline, 'C08')).toMatchObject({
      status: 'PARTIAL',
      allocatedT: 20,
      reason: 'STATION_CAPACITY_REACHED',
    });
  });

  it('holds its invariants on the real data', () => {
    const { kpis, allocations, clients } = baseline;

    expect(kpis.exportedT).toBeLessThanOrEqual(kpis.capacityT);
    expect(kpis.exportedT + kpis.localT).toBe(kpis.actualT);

    for (const entry of clients) {
      expect(entry.allocatedT).toBeLessThanOrEqual(entry.client.demandT);
    }

    // No farm-segment lot was oversold.
    const takenPerLot = new Map<string, number>();
    for (const row of allocations) {
      const key = `${row.farmId}:${row.segment}`;
      takenPerLot.set(key, (takenPerLot.get(key) ?? 0) + row.tonnes);
    }
    for (const [key, taken] of takenPerLot) {
      const [farmId, segment] = key.split(':');
      const source = input.farms.find((entry) => entry.id === farmId);
      expect(taken).toBeLessThanOrEqual(source!.actualT[segment as 'A' | 'B' | 'C' | 'D']);
    }
  });
});

describe('the plan responds to its inputs', () => {
  it('produces different results when capacity changes', () => {
    const tighter = plan({
      ...input,
      station: { ...input.station, exportCapacityT: 300 },
    });

    expect(tighter.kpis.exportedT).toBe(300);
    expect(tighter.kpis.localT).toBe(260);
    expect(tighter.kpis.exportRevenueEur).toBeLessThan(baseline.kpis.exportRevenueEur);
    expect(tighter.kpis.atRiskClientCount).toBeGreaterThan(baseline.kpis.atRiskClientCount);
  });

  it('produces different results when a farm delivers more', () => {
    const farms = input.farms.map((entry) =>
      entry.id === 'F01' ? { ...entry, actualT: { ...entry.actualT, A: 50 } } : entry,
    );
    const richer = plan({ ...input, farms });

    // More Segment A means the A-hungry client C02 is no longer short.
    expect(statusOf(richer, 'C02')?.allocatedT).toBeGreaterThan(40);
  });
});
