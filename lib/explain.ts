/**
 * Turns the engine's codes into sentences a planner would actually say.
 *
 * `INSUFFICIENT_COMPATIBLE_SEGMENT` is the right label in an API payload and
 * the wrong thing to put in front of someone deciding what to do about it. The
 * two shortage causes are worded to point at different fixes: one is a
 * production problem, the other is a station problem.
 *
 * Shared by the interface and the assistant so both explain the plan the same way.
 */

import type { Client, ClientResult } from '@/lib/domain/types';
import { tonnes } from '@/lib/format';

/** The client's quality rule, written the way Commercial words it. */
export function describeRule(client: Client): string {
  return client.acceptanceMode === 'EXACT'
    ? `Segment ${client.requestedSegment} only`
    : `Segment ${client.requestedSegment} or better`;
}

/** Null when the client was served in full. */
export function describeShortage(entry: ClientResult, capacityT: number): string | null {
  if (entry.reason === null) return null;

  if (entry.reason === 'STATION_CAPACITY_REACHED') {
    return `The station reached its ${tonnes(capacityT)} limit before this order was filled.`;
  }

  const quality =
    entry.client.acceptanceMode === 'EXACT'
      ? `Segment ${entry.client.requestedSegment}`
      : `Segment ${entry.client.requestedSegment} or better`;

  return `Not enough ${quality} was left once higher-paying orders had been served.`;
}

/** One line summarising how a client ended up, for lists and the assistant. */
export function describeClientOutcome(entry: ClientResult, capacityT: number): string {
  if (entry.status === 'COMPLETE') {
    return `${entry.client.id} received its full ${tonnes(entry.client.demandT)}.`;
  }
  const verb = entry.status === 'UNSERVED' ? 'received nothing' : `received ${tonnes(entry.allocatedT)}`;
  return `${entry.client.id} ${verb} of ${tonnes(entry.client.demandT)}. ${describeShortage(entry, capacityT)}`;
}
