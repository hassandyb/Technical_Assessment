/**
 * The facts behind each answer, and the answer the app gives without a model.
 *
 * Two jobs, deliberately together: this module decides the *minimum* set of
 * numbers a question needs, and writes the sentence those numbers support. The
 * model, when configured, is given nothing beyond what is here — it rephrases
 * evidence, it never gathers it.
 *
 * Every figure comes from the engine result. Nothing is recomputed differently
 * for the assistant, so the panel can never contradict the tables.
 */

import { SEGMENTS, type PlanResult, type Segment } from '@/lib/domain/types';
import { describeRule, describeShortage } from '@/lib/explain';
import { euros, percent, signedTonnes, tonnes } from '@/lib/format';
import type { QuestionId } from '@/lib/assistant/questions';

export interface Evidence {
  /** Compact facts, safe to send to a model. */
  facts: Record<string, unknown>;
  /** The answer when no model is configured, or when one cannot be trusted. */
  summary: string;
  /** Identifiers an answer is allowed to mention. */
  citations: string[];
}

function segmentTotals(plan: PlanResult) {
  return SEGMENTS.map((segment) => ({
    segment,
    expectedT: Number(
      plan.farms.reduce((sum, farm) => sum + farm.expectedT[segment], 0).toFixed(1),
    ),
    actualT: plan.farms.reduce((sum, farm) => sum + farm.farm.actualT[segment], 0),
    varianceT: Number(
      plan.farms.reduce((sum, farm) => sum + farm.varianceT[segment], 0).toFixed(1),
    ),
  }));
}

function clientsAtRisk(plan: PlanResult): Evidence {
  const atRisk = plan.clients.filter((entry) => entry.status !== 'COMPLETE');

  const rows = atRisk.map((entry) => ({
    clientId: entry.client.id,
    rule: describeRule(entry.client),
    demandT: entry.client.demandT,
    allocatedT: entry.allocatedT,
    shortT: entry.remainingT,
    pricePerT: entry.client.exportPricePerT,
    missedRevenueEur: entry.remainingT * entry.client.exportPricePerT,
    reason: entry.reason,
    explanation: describeShortage(entry, plan.kpis.capacityT),
  }));

  const missed = rows.reduce((sum, row) => sum + row.missedRevenueEur, 0);

  const summary =
    rows.length === 0
      ? 'Every client was served in full today.'
      : [
          `${rows.length} of ${plan.clients.length} clients were short-served, leaving ${euros(missed)} of revenue uncaptured.`,
          ...rows.map(
            (row) =>
              `${row.clientId} (${row.rule}) received ${tonnes(row.allocatedT)} of ${tonnes(row.demandT)}, short ${tonnes(row.shortT)} worth ${euros(row.missedRevenueEur)}. ${row.explanation}`,
          ),
        ].join(' ');

  return {
    facts: { capacityT: plan.kpis.capacityT, clientCount: plan.clients.length, atRisk: rows },
    summary,
    citations: rows.map((row) => row.clientId),
  };
}

function farmGaps(plan: PlanResult): Evidence {
  const totals = segmentTotals(plan);
  const worst = [...totals].sort((a, b) => a.varianceT - b.varianceT)[0];

  // Only the farms that actually missed the worst grade are worth naming.
  const offenders = plan.farms
    .map((farm) => ({
      farmId: farm.farm.id,
      varianceT: Number(farm.varianceT[worst.segment].toFixed(1)),
    }))
    .filter((farm) => farm.varianceT < -0.05)
    .sort((a, b) => a.varianceT - b.varianceT)
    .slice(0, 5);

  const summary = [
    `Against plan, the segments came in ${totals.map((row) => `${row.segment} ${signedTonnes(row.varianceT)}`).join(', ')}.`,
    `Segment ${worst.segment} has the largest gap at ${signedTonnes(worst.varianceT)} (${tonnes(worst.actualT)} arrived against ${tonnes(worst.expectedT)} planned).`,
    offenders.length > 0
      ? `The farms furthest below target on Segment ${worst.segment} are ${offenders.map((farm) => `${farm.farmId} (${signedTonnes(farm.varianceT)})`).join(', ')}.`
      : `No individual farm missed its Segment ${worst.segment} target.`,
    `Overall, ${tonnes(plan.kpis.actualT)} arrived against ${tonnes(plan.kpis.expectedT)} planned.`,
  ].join(' ');

  return {
    facts: {
      segments: totals,
      worstSegment: worst.segment,
      worstFarms: offenders,
      expectedT: plan.kpis.expectedT,
      actualT: plan.kpis.actualT,
    },
    summary,
    citations: [...offenders.map((farm) => farm.farmId), worst.segment],
  };
}

function localResidual(plan: PlanResult): Evidence {
  const { localMarketRatio, referencePrices } = plan.station;

  const rows = plan.farms.flatMap((farm) =>
    SEGMENTS.filter((segment) => farm.localT[segment] > 0).map((segment: Segment) => ({
      farmId: farm.farm.id,
      segment,
      tonnesT: farm.localT[segment],
      localValueEur: farm.localT[segment] * referencePrices[segment] * localMarketRatio,
    })),
  );

  const capacityBound = plan.kpis.actualT > plan.kpis.capacityT;

  const summary = [
    `${tonnes(plan.kpis.localT)} could not be exported, so it goes to the local market at ${percent(localMarketRatio)} of its export reference price.`,
    capacityBound
      ? `${tonnes(plan.kpis.actualT)} arrived but the station can only condition ${tonnes(plan.kpis.capacityT)} for export, so ${tonnes(plan.kpis.actualT - plan.kpis.capacityT)} could never be exported today whatever the clients wanted.`
      : `The fruit left over had no compatible client order to serve.`,
    `It is worth ${euros(plan.kpis.localValueEur)} locally instead of ${euros(plan.kpis.localValueEur + plan.kpis.forgoneValueEur)} at export prices, destroying ${euros(plan.kpis.forgoneValueEur)} of value.`,
    rows.length > 0
      ? `It comes from ${rows.map((row) => `${row.farmId} (${tonnes(row.tonnesT)} of Segment ${row.segment})`).join(', ')}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    facts: {
      localT: plan.kpis.localT,
      localValueEur: plan.kpis.localValueEur,
      forgoneValueEur: plan.kpis.forgoneValueEur,
      localMarketRatio,
      capacityT: plan.kpis.capacityT,
      actualT: plan.kpis.actualT,
      rows,
    },
    summary,
    citations: rows.map((row) => row.farmId),
  };
}

export function evidenceFor(plan: PlanResult, question: QuestionId): Evidence {
  switch (question) {
    case 'CLIENTS_AT_RISK':
      return clientsAtRisk(plan);
    case 'FARM_GAPS':
      return farmGaps(plan);
    case 'LOCAL_RESIDUAL':
      return localResidual(plan);
  }
}

/** Every identifier that exists today; anything else in an answer is invented. */
export function knownIdentifiers(plan: PlanResult): Set<string> {
  return new Set<string>([
    ...plan.farms.map((farm) => farm.farm.id),
    ...plan.clients.map((entry) => entry.client.id),
    ...SEGMENTS,
    plan.station.id,
  ]);
}
