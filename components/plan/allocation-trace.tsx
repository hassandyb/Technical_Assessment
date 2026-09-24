/**
 * The audit trail: every exported tonne resolved to one farm, one grade and one
 * client, and every unexported tonne resolved to the local market.
 *
 * Nothing here is summarised. This is the table a planner opens when they want
 * to check a number rather than believe it, so selecting a client narrows it
 * instead of hiding rows behind a filter nobody remembers to clear.
 */

import { SEGMENTS, type PlanResult } from '@/lib/domain/types';
import { euros, tonnes } from '@/lib/format';

interface LocalRow {
  farmId: string;
  segment: (typeof SEGMENTS)[number];
  tonnesT: number;
  localValueEur: number;
  forgoneEur: number;
}

function localRows(plan: PlanResult): LocalRow[] {
  const { localMarketRatio, referencePrices } = plan.station;
  const rows: LocalRow[] = [];

  for (const farm of plan.farms) {
    for (const segment of SEGMENTS) {
      const tonnesT = farm.localT[segment];
      if (tonnesT <= 0) continue;
      const atExportPrice = tonnesT * referencePrices[segment];
      const localValueEur = atExportPrice * localMarketRatio;
      rows.push({
        farmId: farm.farm.id,
        segment,
        tonnesT,
        localValueEur,
        forgoneEur: atExportPrice - localValueEur,
      });
    }
  }
  return rows;
}

export function AllocationTrace({
  plan,
  selectedId,
}: {
  plan: PlanResult;
  selectedId: string | null;
}) {
  const requestedBy = new Map(
    plan.clients.map((entry) => [entry.client.id, entry.client.requestedSegment]),
  );

  const visible = selectedId
    ? plan.allocations.filter((row) => row.clientId === selectedId)
    : plan.allocations;

  const shownT = visible.reduce((sum, row) => sum + row.tonnes, 0);
  const shownRevenue = visible.reduce((sum, row) => sum + row.revenueEur, 0);
  const local = localRows(plan);

  return (
    <section aria-labelledby="trace-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="trace-heading" className="text-lg font-semibold">
          Allocation trace
        </h2>
        <p className="text-sm text-muted-foreground">
          {selectedId ? (
            <>
              Showing <span className="font-medium text-foreground">{selectedId}</span> only —{' '}
              {visible.length} of {plan.allocations.length} rows
            </>
          ) : (
            <>{plan.allocations.length} export rows · {local.length} local rows</>
          )}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">
            Every export allocation: the farm and quality segment that served each client, with
            tonnage and revenue.
          </caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">Farm</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Segment</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Client</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Tonnes</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Quality upgrade</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No fruit was exported. Every tonne that arrived went to the local market.
                </td>
              </tr>
            )}
            {visible.map((row, index) => (
              <tr
                key={`${row.farmId}-${row.segment}-${row.clientId}-${index}`}
                className="border-b last:border-0"
              >
                <td className="px-4 py-2 font-medium">{row.farmId}</td>
                <td className="px-4 py-2">{row.segment}</td>
                <td className="px-4 py-2">{row.clientId}</td>
                <td className="px-4 py-2 text-right tabular-nums">{tonnes(row.tonnes)}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {row.qualityUpgrade === 0 ? (
                    '—'
                  ) : (
                    <>
                      +{row.qualityUpgrade} grade{row.qualityUpgrade > 1 ? 's' : ''}
                      <span className="ml-1 text-xs">
                        ({row.segment} used for a {requestedBy.get(row.clientId)} order)
                      </span>
                    </>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{euros(row.revenueEur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/40 font-medium">
              <td className="px-4 py-2.5" colSpan={3}>
                {selectedId ? `${selectedId} total` : 'Exported'}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{tonnes(shownT)}</td>
              <td />
              <td className="px-4 py-2.5 text-right tabular-nums">{euros(shownRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <h3 className="pt-2 text-sm font-semibold">
        Falling back to the local market — {tonnes(plan.kpis.localT)}
      </h3>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[620px] text-sm">
          <caption className="sr-only">
            Fruit that could not be exported, by farm and quality segment, with the value it
            fetches locally and the value lost.
          </caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">Farm</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Segment</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Tonnes</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Local value</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Value lost</th>
            </tr>
          </thead>
          <tbody>
            {local.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Nothing fell back to the local market: the whole crop was exported.
                </td>
              </tr>
            )}
            {local.map((row) => (
              <tr key={`${row.farmId}-${row.segment}`} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{row.farmId}</td>
                <td className="px-4 py-2">{row.segment}</td>
                <td className="px-4 py-2 text-right tabular-nums">{tonnes(row.tonnesT)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{euros(row.localValueEur)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-amber-700 dark:text-amber-400">
                  {euros(row.forgoneEur)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/40 font-medium">
              <td className="px-4 py-2.5" colSpan={2}>
                Local market
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{tonnes(plan.kpis.localT)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {euros(plan.kpis.localValueEur)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                {euros(plan.kpis.forgoneValueEur)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
