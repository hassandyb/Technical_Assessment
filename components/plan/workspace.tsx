'use client';

/**
 * Holds the one piece of state the workspace needs: which client is being
 * traced. Selecting a client links the Commercial question to the Production
 * answer, which is the join the committee otherwise makes by eye across two
 * spreadsheets.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { AllocationTrace } from '@/components/plan/allocation-trace';
import { ClientTable } from '@/components/plan/client-table';
import { ProductionTable } from '@/components/plan/production-table';
import type { PlanResult } from '@/lib/domain/types';
import { describeShortage, describeRule } from '@/lib/explain';
import { signedTonnes, tonnes } from '@/lib/format';
import { traceClient } from '@/lib/trace';

export function Workspace({ plan }: { plan: PlanResult }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const trace = selectedId ? traceClient(plan, selectedId) : null;
  const entry = selectedId
    ? (plan.clients.find((candidate) => candidate.client.id === selectedId) ?? null)
    : null;

  return (
    <div className="space-y-8">
      <ClientTable
        plan={plan}
        selectedId={selectedId}
        onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
      />

      {trace && entry && (
        <aside
          aria-live="polite"
          className="rounded-lg border border-sky-300 bg-sky-50 p-4 dark:border-sky-900/70 dark:bg-sky-950/40"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="font-medium text-sky-950 dark:text-sky-100">
                {entry.client.id} · {entry.client.name} — {describeRule(entry.client)}
              </p>
              <p className="text-sm text-sky-900 dark:text-sky-200/90">
                Served {tonnes(entry.allocatedT)} of {tonnes(entry.client.demandT)} by{' '}
                {new Set(trace.suppliers.map((s) => s.farmId)).size} farm(s).{' '}
                {describeShortage(entry, plan.kpis.capacityT) ?? 'Order filled in full.'}
              </p>
              <p className="text-sm text-sky-900 dark:text-sky-200/90">
                Acceptable grades ({trace.segments.join(', ')}) arrived{' '}
                <strong className="font-semibold">{signedTonnes(trace.segmentVarianceT)}</strong>{' '}
                against plan
                {trace.shortfalls.length > 0 && (
                  <>
                    {' '}
                    — {trace.shortfalls.length} farm(s) missed target, worst:{' '}
                    {trace.shortfalls
                      .slice(0, 3)
                      .map((farm) => `${farm.farmId} ${signedTonnes(farm.varianceT)}`)
                      .join(', ')}
                  </>
                )}
                . Highlighted below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="shrink-0 rounded p-1 text-sky-900 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-sky-200 dark:hover:bg-sky-900"
            >
              <X className="size-4" aria-hidden />
              <span className="sr-only">Clear selection</span>
            </button>
          </div>
        </aside>
      )}

      <ProductionTable plan={plan} trace={trace} />

      <AllocationTrace plan={plan} selectedId={selectedId} />
    </div>
  );
}
