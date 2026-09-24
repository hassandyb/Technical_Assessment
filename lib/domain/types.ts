/**
 * The Atlas Fresh business vocabulary.
 *
 * Read this file to understand the domain: apples arrive from farms sorted into
 * four quality segments, a station can export a limited tonnage per day, and
 * clients buy on quality rules at different prices. Anything that cannot be
 * exported falls back to the local market at a fraction of its value.
 */

/** Quality segments, ordered best first. A is the highest quality, D the lowest. */
export const SEGMENTS = ['A', 'B', 'C', 'D'] as const;

export type Segment = (typeof SEGMENTS)[number];

/** A quantity per quality segment, in tonnes or as a fraction depending on use. */
export type BySegment = Record<Segment, number>;

/**
 * How strict a client is about quality.
 * EXACT   — only the requested segment is acceptable.
 * MINIMUM — the requested segment or anything better (MINIMUM B accepts B or A).
 */
export type AcceptanceMode = 'EXACT' | 'MINIMUM';

// ---------------------------------------------------------------------------
// Source data — what the workbook says, never modified after validation
// ---------------------------------------------------------------------------

export interface Farm {
  id: string;
  name: string;
  /** What Production planned this farm would deliver today. */
  expectedCapacityT: number;
  /** Planned share of that capacity per segment. Fractions summing to 1. */
  expectedMix: BySegment;
  /** What actually arrived today. This, not the plan, is what can be sold. */
  actualT: BySegment;
}

export interface Client {
  id: string;
  name: string;
  acceptanceMode: AcceptanceMode;
  requestedSegment: Segment;
  /** A maximum, not a commitment: serving less than this is allowed. */
  demandT: number;
  exportPricePerT: number;
}

export interface Station {
  id: string;
  /** Hard daily ceiling on everything exported. */
  exportCapacityT: number;
  /** Local fruit is worth this share of its export price. 0.1 means 10%. */
  localMarketRatio: number;
  /** Used only to value the local residual, never to rank clients. */
  referencePrices: BySegment;
}

/** The validated contents of the workbook. */
export interface PlanInput {
  farms: Farm[];
  clients: Client[];
  station: Station;
}

// ---------------------------------------------------------------------------
// Computed results — produced by the engine, never stored in the workbook
// ---------------------------------------------------------------------------

/** One traceable decision: this farm's fruit of this segment went to this client. */
export interface AllocationRow {
  farmId: string;
  segment: Segment;
  clientId: string;
  tonnes: number;
  /**
   * How many grades better than requested this fruit is, 0 when it matches.
   * Serving A to a client who asked for B satisfies the order but spends
   * scarce quality, so the plan prefers the smallest upgrade available.
   */
  qualityUpgrade: number;
  revenueEur: number;
}

export type ClientStatus = 'COMPLETE' | 'PARTIAL' | 'UNSERVED';

/**
 * Why a client did not get everything it asked for. The distinction matters to
 * the business: a segment shortage is a production problem, a capacity ceiling
 * is a station problem, and they call for different decisions.
 */
export type ShortageReason =
  | 'STATION_CAPACITY_REACHED'
  | 'INSUFFICIENT_COMPATIBLE_SEGMENT';

export interface ClientResult {
  client: Client;
  allocatedT: number;
  remainingT: number;
  revenueEur: number;
  status: ClientStatus;
  /** Null when the client is COMPLETE. */
  reason: ShortageReason | null;
}

/** Plan versus actual for one farm, plus what of its fruit ended up local. */
export interface FarmResult {
  farm: Farm;
  /** expectedCapacityT x expectedMix, the tonnage Production promised per segment. */
  expectedT: BySegment;
  /** actual - expected. Negative means the farm came up short. */
  varianceT: BySegment;
  exportedT: BySegment;
  localT: BySegment;
}

/** The headline numbers for the committee. */
export interface Kpis {
  expectedT: number;
  actualT: number;
  capacityT: number;
  exportedT: number;
  localT: number;
  /** exportedT / actualT, between 0 and 1. */
  exportRate: number;
  exportRevenueEur: number;
  localValueEur: number;
  totalValueEur: number;
  /** What the local residual would have earned at full export price. */
  forgoneValueEur: number;
  /** Clients that are PARTIAL or UNSERVED. */
  atRiskClientCount: number;
}

/** Everything the engine produces for one day. */
export interface PlanResult {
  allocations: AllocationRow[];
  clients: ClientResult[];
  farms: FarmResult[];
  kpis: Kpis;
}
