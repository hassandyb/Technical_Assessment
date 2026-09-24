/**
 * The one-minute answer.
 *
 * A manager should be able to read this strip and nothing else and still know
 * how the day went. It follows the crop from what was promised to what was
 * lost, because the tonnage gap only means something once the money is next to
 * it: "60 t" is a statistic, "€40,500 destroyed" is a decision.
 */

import { ArrowRight, TriangleAlert } from 'lucide-react';
import type { PlanResult } from '@/lib/domain/types';
import { euros, percent, signedTonnes, tonnes } from '@/lib/format';

function Step({
  label,
  value,
  note,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  note: string;
  tone?: 'neutral' | 'good' | 'loss';
}) {
  const valueTone =
    tone === 'loss'
      ? 'text-amber-700 dark:text-amber-400'
      : tone === 'good'
        ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-foreground';

  return (
    <div className="min-w-0 flex-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={`mt-1 text-3xl font-semibold tabular-nums ${valueTone}`}>{value}</dd>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`mt-0.5 tabular-nums ${
          emphasis ? 'text-lg font-semibold' : 'text-lg font-medium'
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function Headline({ plan }: { plan: PlanResult }) {
  const { kpis } = plan;
  const localAtExportPrice = kpis.localValueEur + kpis.forgoneValueEur;
  const shortfall = kpis.actualT - kpis.expectedT;
  const atRisk = kpis.atRiskClientCount;

  return (
    <section aria-labelledby="headline-heading" className="space-y-4">
      <h2 id="headline-heading" className="sr-only">
        Today at a glance
      </h2>

      {/* The verdict, stated before any table asks the reader to work it out. */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
        <TriangleAlert
          className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
          aria-hidden
        />
        <div>
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            {tonnes(kpis.localT)} never reached an export client.
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-300/90">
            Sold on the local market for {euros(kpis.localValueEur)} instead of{' '}
            {euros(localAtExportPrice)} —{' '}
            <strong className="font-semibold">{euros(kpis.forgoneValueEur)} of value destroyed</strong>
            {`. ${atRisk} ${atRisk === 1 ? 'client' : 'clients'} did not get everything they ordered.`}
          </p>
        </div>
      </div>

      {/* Where the crop went, in the order the business thinks about it. */}
      <dl className="flex flex-wrap items-start gap-x-2 gap-y-6 rounded-lg border bg-card p-5">
        <Step
          label="Planned"
          value={tonnes(kpis.expectedT)}
          note={`across ${plan.farms.length} farms`}
        />
        <ArrowRight className="mt-7 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <Step
          label="Arrived"
          value={tonnes(kpis.actualT)}
          note={`${signedTonnes(shortfall)} against plan`}
          tone={shortfall < 0 ? 'loss' : 'neutral'}
        />
        <ArrowRight className="mt-7 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <Step
          label="Exported"
          value={tonnes(kpis.exportedT)}
          note={`${percent(kpis.exportRate)} of the crop · station holds ${tonnes(kpis.capacityT)}`}
          tone="good"
        />
        <ArrowRight className="mt-7 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <Step
          label="Local market"
          value={tonnes(kpis.localT)}
          note={`worth ${euros(kpis.localValueEur)}, not ${euros(localAtExportPrice)}`}
          tone="loss"
        />
      </dl>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border bg-card p-5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Export revenue" value={euros(kpis.exportRevenueEur)} />
        <Stat label="Local value" value={euros(kpis.localValueEur)} />
        <Stat label="Total value" value={euros(kpis.totalValueEur)} emphasis />
        <Stat label="Export rate" value={percent(kpis.exportRate)} />
        <Stat
          label="Clients at risk"
          value={`${kpis.atRiskClientCount} of ${plan.clients.length}`}
        />
      </dl>
    </section>
  );
}
