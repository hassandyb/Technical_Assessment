/**
 * The quality rules that decide whether a farm's fruit may serve a client.
 *
 * Better fruit always satisfies a lesser order, never the other way round, so
 * these three functions are the whole of the compatibility question.
 */

import { SEGMENTS, type AcceptanceMode, type Segment } from '@/lib/domain/types';

/** Position in the quality order: 0 is the best grade. */
export function segmentRank(segment: Segment): number {
  return SEGMENTS.indexOf(segment);
}

export function isCompatible(
  supplySegment: Segment,
  mode: AcceptanceMode,
  requested: Segment,
): boolean {
  return mode === 'EXACT'
    ? supplySegment === requested
    : segmentRank(supplySegment) <= segmentRank(requested);
}

/**
 * How many grades better than requested the fruit is; 0 when it matches.
 *
 * Serving A to a client who asked for B fills the order but spends quality that
 * a higher-paying A client may still need, so the plan prefers small upgrades.
 */
export function qualityUpgrade(supplySegment: Segment, requested: Segment): number {
  return segmentRank(requested) - segmentRank(supplySegment);
}
