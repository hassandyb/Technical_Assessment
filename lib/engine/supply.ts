/**
 * Today's sellable fruit, split into one lot per farm and quality segment.
 *
 * Supply comes from what actually arrived. Planned figures describe what the
 * farms were asked for and are only ever used to explain the gap, never to
 * promise fruit that is not on site.
 */

import { SEGMENTS, type Farm, type Segment } from '@/lib/domain/types';

export interface SupplyLot {
  farmId: string;
  segment: Segment;
  /** Tonnes still unallocated. Decreases as clients are served. */
  availableT: number;
}

/**
 * Lots keep farm order and then quality order, which makes the later
 * farm_id tie-break deterministic without needing a second sort key.
 */
export function buildSupply(farms: Farm[]): SupplyLot[] {
  const lots: SupplyLot[] = [];
  for (const farm of farms) {
    for (const segment of SEGMENTS) {
      const availableT = farm.actualT[segment];
      if (availableT > 0) {
        lots.push({ farmId: farm.id, segment, availableT });
      }
    }
  }
  return lots;
}

export function totalAvailable(lots: SupplyLot[]): number {
  return lots.reduce((sum, lot) => sum + lot.availableT, 0);
}
