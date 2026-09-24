/**
 * The headline numbers the committee reads first.
 *
 * Everything here is derived from the allocation that was actually produced,
 * so changing an input changes the KPIs; none of these figures is fixed.
 */

import { SEGMENTS, type AllocationRow, type ClientResult, type Kpis, type PlanInput } from '@/lib/domain/types';
import type { SupplyLot } from '@/lib/engine/supply';

/** What Production promised across all farms, used only to size the gap. */
export function totalExpected(input: PlanInput): number {
  return input.farms.reduce((sum, farm) => sum + farm.expectedCapacityT, 0);
}

export function totalActual(input: PlanInput): number {
  return input.farms.reduce(
    (sum, farm) => sum + SEGMENTS.reduce((s, segment) => s + farm.actualT[segment], 0),
    0,
  );
}

export function computeKpis(
  input: PlanInput,
  allocations: AllocationRow[],
  remainingLots: SupplyLot[],
  clients: ClientResult[],
): Kpis {
  const { localMarketRatio, referencePrices, exportCapacityT } = input.station;

  const actualT = totalActual(input);
  const exportedT = allocations.reduce((sum, row) => sum + row.tonnes, 0);
  const exportRevenueEur = allocations.reduce((sum, row) => sum + row.revenueEur, 0);

  // Everything still in a lot after the last client was served goes local.
  const localT = remainingLots.reduce((sum, lot) => sum + lot.availableT, 0);
  const localValueEur = remainingLots.reduce(
    (sum, lot) => sum + lot.availableT * localMarketRatio * referencePrices[lot.segment],
    0,
  );
  const fullExportValueEur = remainingLots.reduce(
    (sum, lot) => sum + lot.availableT * referencePrices[lot.segment],
    0,
  );

  return {
    expectedT: totalExpected(input),
    actualT,
    capacityT: exportCapacityT,
    exportedT,
    localT,
    exportRate: actualT === 0 ? 0 : exportedT / actualT,
    exportRevenueEur,
    localValueEur,
    totalValueEur: exportRevenueEur + localValueEur,
    forgoneValueEur: fullExportValueEur - localValueEur,
    atRiskClientCount: clients.filter((entry) => entry.status !== 'COMPLETE').length,
  };
}
