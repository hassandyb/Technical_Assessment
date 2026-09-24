/**
 * Small builders for engine tests.
 *
 * Policy rules are tested on tiny hand-made cases rather than the supplied
 * workbook, so each test states exactly the situation it is about and a change
 * to the real data cannot quietly invalidate it.
 */

import type {
  AcceptanceMode,
  BySegment,
  Client,
  Farm,
  PlanInput,
  Segment,
  Station,
} from '@/lib/domain/types';

const NOTHING: BySegment = { A: 0, B: 0, C: 0, D: 0 };

export function farm(
  id: string,
  actualT: Partial<BySegment>,
  options: { expectedCapacityT?: number; expectedMix?: BySegment } = {},
): Farm {
  return {
    id,
    name: `Farm ${id}`,
    expectedCapacityT: options.expectedCapacityT ?? 0,
    expectedMix: options.expectedMix ?? { A: 1, B: 0, C: 0, D: 0 },
    actualT: { ...NOTHING, ...actualT },
  };
}

export function client(
  id: string,
  acceptanceMode: AcceptanceMode,
  requestedSegment: Segment,
  demandT: number,
  exportPricePerT: number,
): Client {
  return {
    id,
    name: `Client ${id}`,
    acceptanceMode,
    requestedSegment,
    demandT,
    exportPricePerT,
  };
}

export function station(exportCapacityT: number, localMarketRatio = 0.1): Station {
  return {
    id: 'STATION-TEST',
    exportCapacityT,
    localMarketRatio,
    referencePrices: { A: 1500, B: 1250, C: 1000, D: 750 },
  };
}

export function input(farms: Farm[], clients: Client[], st: Station): PlanInput {
  return { farms, clients, station: st };
}
