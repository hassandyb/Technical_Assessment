/**
 * The Commercial view: who was served, who was not, and why.
 *
 * Rows are kept in the order the policy served them — highest price first —
 * because that order *is* the decision. Reading down the table shows revenue
 * being protected and then running out.
 *
 * Every shortfall carries both tonnes and the revenue behind them, so the cost
 * of being short is never left as an exercise for the reader.
 */

import type { PlanResult } from '@/lib/domain/types';
import { describeRule, describeShortage } from '@/lib/explain';
import { euros, tonnes } from '@/lib/format';

const STATUS_STYLES = {
  COMPLETE: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  PARTIAL: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  UNSERVED: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
} as const;

const STATUS_LABELS = {
  COMPLETE: 'Complete',
  PARTIAL: 'Partial',
  UNSERVED: 'Unserved',
} as const;

export function ClientTable({ plan }: { plan: PlanResult }) {
  const { capacityT } = plan.kpis;
  const atRisk = plan.clients.filter((entry) => entry.status !== 'COMPLETE');
  const revenueAtRisk = atRisk.reduce(
    (sum, entry) => sum + entry.remainingT * entry.client.exportPricePerT,
    0,
  );

  return (
    <section aria-labelledby="commercial-heading" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="commercial-heading" className="text-lg font-semibold">
          Commercial · client orders
        </h2>
        <p className="text-sm text-muted-foreground">
          {atRisk.length} of {plan.clients.length} short-served ·{' '}
          <span className="font-medium text-foreground">{euros(revenueAtRisk)}</span> of revenue
          not captured
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">
            Export clients in the order the policy served them, highest price first.
          </caption>
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Client
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Quality rule
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Price
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Demand
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Allocated
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Short by
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Revenue
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.clients.map((entry) => {
              const shortage = describeShortage(entry, capacityT);
              const missedRevenue = entry.remainingT * entry.client.exportPricePerT;

              return (
                <tr key={entry.client.id} className="border-b last:border-0 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium">{entry.client.id}</div>
                    <div className="text-xs text-muted-foreground">{entry.client.name}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {describeRule(entry.client)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {euros(entry.client.exportPricePerT)}/t
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {tonnes(entry.client.demandT)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {tonnes(entry.allocatedT)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {entry.remainingT === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        <div className="font-medium text-amber-700 dark:text-amber-400">
                          {tonnes(entry.remainingT)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {euros(missedRevenue)} lost
                        </div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {euros(entry.revenueEur)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLES[entry.status]
                      }`}
                    >
                      {STATUS_LABELS[entry.status]}
                    </span>
                    {shortage && (
                      <p className="mt-1 max-w-[22rem] text-xs text-muted-foreground">
                        {shortage}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
