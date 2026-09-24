/**
 * The Production view: what each farm promised, what it delivered, and what of
 * its fruit is about to be sold locally.
 *
 * When a client is selected, the grades that would have served that client are
 * highlighted and the farms that missed them are marked, so the Commercial
 * question ("why is C02 short?") is answered in the Production table.
 */

import { SEGMENTS, type PlanResult, type Segment } from '@/lib/domain/types';
import { signedTonnes, tonnes } from '@/lib/format';
import type { ClientTrace } from '@/lib/trace';

function varianceTone(value: number): string {
  if (value < -0.05) return 'text-amber-700 dark:text-amber-400';
  if (value > 0.05) return 'text-emerald-700 dark:text-emerald-400';
  return 'text-muted-foreground';
}

export function ProductionTable({
  plan,
  trace,
}: {
  plan: PlanResult;
  trace: ClientTrace | null;
}) {
  const focused = new Set<Segment>(trace?.segments ?? []);
  const shortfallFarms = new Set(trace?.shortfalls.map((entry) => entry.farmId) ?? []);
  const supplierFarms = new Set(trace?.suppliers.map((entry) => entry.farmId) ?? []);

  const totals = SEGMENTS.map((segment) => ({
    segment,
    actualT: plan.farms.reduce((sum, farm) => sum + farm.farm.actualT[segment], 0),
    varianceT: plan.farms.reduce((sum, farm) => sum + farm.varianceT[segment], 0),
  }));

  return (
    <section aria-labelledby="production-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="production-heading" className="text-lg font-semibold">
          Production · farm receipts
        </h2>
        <p className="text-sm text-muted-foreground">
          {totals
            .map((entry) => `${entry.segment} ${signedTonnes(entry.varianceT)}`)
            .join(' · ')}{' '}
          against plan
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">
            Twenty farms with planned capacity, actual receipts by quality segment, variance
            against plan and tonnes falling back to the local market.
          </caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Farm
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Planned
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Arrived
              </th>
              {SEGMENTS.map((segment) => (
                <th
                  key={segment}
                  scope="col"
                  className={`px-3 py-2.5 text-right font-medium ${
                    focused.has(segment) ? 'bg-sky-100 dark:bg-sky-950/60' : ''
                  }`}
                >
                  {segment}
                  <span className="block text-[11px] font-normal text-muted-foreground">
                    actual / gap
                  </span>
                </th>
              ))}
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                To local
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.farms.map((farm) => {
              const arrived = SEGMENTS.reduce((sum, s) => sum + farm.farm.actualT[s], 0);
              const localT = SEGMENTS.reduce((sum, s) => sum + farm.localT[s], 0);
              const implicated = shortfallFarms.has(farm.farm.id);
              const supplied = supplierFarms.has(farm.farm.id);

              return (
                <tr
                  key={farm.farm.id}
                  className={`border-b last:border-0 ${
                    implicated
                      ? 'bg-amber-50 dark:bg-amber-950/25'
                      : supplied
                        ? 'bg-emerald-50 dark:bg-emerald-950/20'
                        : ''
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{farm.farm.id}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{farm.farm.name}</span>
                    {trace && implicated && (
                      <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                        missed target
                      </span>
                    )}
                    {trace && supplied && !implicated && (
                      <span className="ml-2 rounded bg-emerald-200 px-1.5 py-0.5 text-[11px] font-medium text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                        supplied
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {tonnes(farm.farm.expectedCapacityT)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{tonnes(arrived)}</td>
                  {SEGMENTS.map((segment) => (
                    <td
                      key={segment}
                      className={`px-3 py-2.5 text-right tabular-nums ${
                        focused.has(segment) ? 'bg-sky-50 dark:bg-sky-950/40' : ''
                      }`}
                    >
                      <div>{farm.farm.actualT[segment] || '–'}</div>
                      {farm.expectedT[segment] > 0 || farm.farm.actualT[segment] > 0 ? (
                        <div className={`text-[11px] ${varianceTone(farm.varianceT[segment])}`}>
                          {signedTonnes(farm.varianceT[segment])}
                        </div>
                      ) : null}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {localT > 0 ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {tonnes(localT)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/40 font-medium">
              <td className="px-4 py-2.5">All farms</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {tonnes(plan.kpis.expectedT)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{tonnes(plan.kpis.actualT)}</td>
              {totals.map((entry) => (
                <td
                  key={entry.segment}
                  className={`px-3 py-2.5 text-right tabular-nums ${
                    focused.has(entry.segment) ? 'bg-sky-100 dark:bg-sky-950/60' : ''
                  }`}
                >
                  <div>{entry.actualT}</div>
                  <div className={`text-[11px] ${varianceTone(entry.varianceT)}`}>
                    {signedTonnes(entry.varianceT)}
                  </div>
                </td>
              ))}
              <td className="px-3 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                {tonnes(plan.kpis.localT)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
