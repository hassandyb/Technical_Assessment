/**
 * Links a client's shortage back to the farms behind it.
 *
 * This is the join the committee currently makes by hand, reading a Production
 * spreadsheet next to a Commercial one. A client is short because a particular
 * quality did not arrive; naming the farms that missed that quality turns
 * "C02 is 10 t short" into something Production can act on tomorrow.
 */

import type { PlanResult, Segment } from '@/lib/domain/types';
import { compatibleSegments } from '@/lib/engine/compatibility';

export interface FarmShortfall {
  farmId: string;
  name: string;
  /** Negative: tonnes below plan across the segments this client needed. */
  varianceT: number;
}

export interface ClientTrace {
  clientId: string;
  /** The grades that could have served this order. */
  segments: Segment[];
  /** Plan versus actual across those grades, summed over every farm. */
  segmentVarianceT: number;
  /** Farms that delivered less of those grades than planned, worst first. */
  shortfalls: FarmShortfall[];
  /** Farms that did supply this client, so the trace runs both ways. */
  suppliers: { farmId: string; segment: Segment; tonnes: number }[];
}

export function traceClient(plan: PlanResult, clientId: string): ClientTrace | null {
  const entry = plan.clients.find((candidate) => candidate.client.id === clientId);
  if (!entry) return null;

  const segments = compatibleSegments(
    entry.client.acceptanceMode,
    entry.client.requestedSegment,
  );

  const shortfalls: FarmShortfall[] = [];
  let segmentVarianceT = 0;

  for (const farm of plan.farms) {
    const varianceT = segments.reduce((sum, segment) => sum + farm.varianceT[segment], 0);
    segmentVarianceT += varianceT;
    // Only farms that came up short explain a shortage; the rest are noise here.
    if (varianceT < -0.05) {
      shortfalls.push({ farmId: farm.farm.id, name: farm.farm.name, varianceT });
    }
  }

  shortfalls.sort((a, b) => a.varianceT - b.varianceT || a.farmId.localeCompare(b.farmId));

  const suppliers = plan.allocations
    .filter((row) => row.clientId === clientId)
    .map((row) => ({ farmId: row.farmId, segment: row.segment, tonnes: row.tonnes }));

  return { clientId, segments, segmentVarianceT, shortfalls, suppliers };
}
