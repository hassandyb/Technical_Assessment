/**
 * Shown while the server reads the workbook and runs the policy.
 *
 * It mirrors the real layout rather than showing a spinner, so the page does
 * not jump when the numbers arrive and the reader already knows what is coming.
 */

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />;
}

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-6 py-8" aria-busy="true">
      <p className="sr-only" role="status">
        Reading the workbook and building today&apos;s plan.
      </p>

      <header className="mb-6 space-y-2">
        <Block className="h-4 w-56" />
        <Block className="h-7 w-64" />
      </header>

      <div className="space-y-8">
        <Block className="h-20 w-full" />
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap gap-8">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex-1 space-y-2">
                <Block className="h-3 w-20" />
                <Block className="h-8 w-28" />
                <Block className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
        <Block className="h-64 w-full" />
      </div>
    </main>
  );
}
