/**
 * The allocation policy: which farm's fruit serves which client.
 *
 * The rule the business agreed on is to protect revenue first. Clients are
 * served in descending price order, so when fruit is scarce the money that is
 * lost is the cheapest money. Within a client, the smallest acceptable quality
 * upgrade is used first, so premium grades stay available for the premium
 * orders that still need them.
 *
 * This is a fixed recipe, not an optimiser: the same input always produces the
 * same plan, which is what lets the committee trust and re-run it.
 */

import type {
  AllocationRow,
  Client,
  ClientResult,
  ShortageReason,
  Station,
} from '@/lib/domain/types';
import { isCompatible, qualityUpgrade } from '@/lib/engine/compatibility';
import type { SupplyLot } from '@/lib/engine/supply';

/** The station conditions fruit in 5 t lots, so no partial lot is ever planned. */
export const ALLOCATION_STEP_T = 5;

export interface AllocationOutcome {
  allocations: AllocationRow[];
  /** In the order they were served, which is the order the policy decided. */
  clients: ClientResult[];
  /** Lots with their leftover balances; whatever remains here goes local. */
  remainingLots: SupplyLot[];
}

/** Highest price first; client_id breaks a tie so the order is never ambiguous. */
export function byPriceThenId(clients: Client[]): Client[] {
  return [...clients].sort(
    (a, b) => b.exportPricePerT - a.exportPricePerT || a.id.localeCompare(b.id),
  );
}

/** Usable lots for one client, cheapest quality sacrifice first. */
function compatibleLots(lots: SupplyLot[], client: Client): SupplyLot[] {
  return lots
    .filter(
      (lot) =>
        lot.availableT > 0 &&
        isCompatible(lot.segment, client.acceptanceMode, client.requestedSegment),
    )
    .sort(
      (a, b) =>
        qualityUpgrade(a.segment, client.requestedSegment) -
          qualityUpgrade(b.segment, client.requestedSegment) ||
        a.farmId.localeCompare(b.farmId),
    );
}

export function allocate(
  clients: Client[],
  lots: SupplyLot[],
  station: Station,
): AllocationOutcome {
  // Work on a copy so callers keep an untouched view of the day's supply.
  const remainingLots = lots.map((lot) => ({ ...lot }));
  const allocations: AllocationRow[] = [];
  const results: ClientResult[] = [];

  let capacityLeftT = station.exportCapacityT;

  for (const client of byPriceThenId(clients)) {
    let remainingT = client.demandT;
    let allocatedT = 0;
    let revenueEur = 0;

    for (const lot of compatibleLots(remainingLots, client)) {
      if (remainingT === 0 || capacityLeftT === 0) break;

      const tonnes =
        Math.floor(
          Math.min(remainingT, lot.availableT, capacityLeftT) / ALLOCATION_STEP_T,
        ) * ALLOCATION_STEP_T;
      // Nothing left that fills a whole lot, so no later lot can help either.
      if (tonnes === 0) break;

      lot.availableT -= tonnes;
      remainingT -= tonnes;
      allocatedT += tonnes;
      capacityLeftT -= tonnes;

      const lineRevenue = tonnes * client.exportPricePerT;
      revenueEur += lineRevenue;

      allocations.push({
        farmId: lot.farmId,
        segment: lot.segment,
        clientId: client.id,
        tonnes,
        qualityUpgrade: qualityUpgrade(lot.segment, client.requestedSegment),
        revenueEur: lineRevenue,
      });
    }

    const status =
      allocatedT === 0 ? 'UNSERVED' : allocatedT >= client.demandT ? 'COMPLETE' : 'PARTIAL';

    // A full station is the more urgent explanation, so it is reported first:
    // nothing about quality can be fixed while there is no capacity to use it.
    const reason: ShortageReason | null =
      status === 'COMPLETE'
        ? null
        : capacityLeftT === 0
          ? 'STATION_CAPACITY_REACHED'
          : 'INSUFFICIENT_COMPATIBLE_SEGMENT';

    results.push({
      client,
      allocatedT,
      remainingT: client.demandT - allocatedT,
      revenueEur,
      status,
      reason,
    });
  }

  return { allocations, clients: results, remainingLots };
}
