/**
 * Runs the whole daily policy: supply in, plan out.
 *
 * Pure by design — no filesystem, no network, no clock. The same workbook
 * always produces the same plan, which is what makes the result reproducible
 * in a meeting and testable in CI.
 */

import {
  SEGMENTS,
  type BySegment,
  type FarmResult,
  type PlanInput,
  type PlanResult,
} from '@/lib/domain/types';
import { allocate } from '@/lib/engine/allocate';
import { computeKpis } from '@/lib/engine/kpis';
import { buildSupply } from '@/lib/engine/supply';

function emptyBySegment(): BySegment {
  return { A: 0, B: 0, C: 0, D: 0 };
}

export function plan(input: PlanInput): PlanResult {
  const supply = buildSupply(input.farms);
  const { allocations, clients, remainingLots } = allocate(
    input.clients,
    supply,
    input.station,
  );

  // Fold the allocation back onto the farms so Production can see, per farm and
  // segment, what was promised, what arrived, what was exported and what is
  // about to be sold locally at a tenth of its value.
  const exported = new Map<string, BySegment>();
  for (const row of allocations) {
    const farm = exported.get(row.farmId) ?? emptyBySegment();
    farm[row.segment] += row.tonnes;
    exported.set(row.farmId, farm);
  }

  const local = new Map<string, BySegment>();
  for (const lot of remainingLots) {
    if (lot.availableT === 0) continue;
    const farm = local.get(lot.farmId) ?? emptyBySegment();
    farm[lot.segment] += lot.availableT;
    local.set(lot.farmId, farm);
  }

  const farms: FarmResult[] = input.farms.map((farm) => {
    const expectedT = emptyBySegment();
    const varianceT = emptyBySegment();
    for (const segment of SEGMENTS) {
      expectedT[segment] = farm.expectedCapacityT * farm.expectedMix[segment];
      varianceT[segment] = farm.actualT[segment] - expectedT[segment];
    }
    return {
      farm,
      expectedT,
      varianceT,
      exportedT: exported.get(farm.id) ?? emptyBySegment(),
      localT: local.get(farm.id) ?? emptyBySegment(),
    };
  });

  return {
    allocations,
    clients,
    farms,
    kpis: computeKpis(input, allocations, remainingLots, clients),
  };
}
