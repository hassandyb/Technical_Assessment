import { describe, expect, it } from 'vitest';
import { plan } from '@/lib/engine/plan';
import { client, farm, input, station } from '@/lib/test-support/fixtures';

/** Convenience: look one client's outcome up by id. */
function outcome(result: ReturnType<typeof plan>, id: string) {
  const found = result.clients.find((entry) => entry.client.id === id);
  if (!found) throw new Error(`no outcome for ${id}`);
  return found;
}

describe('order of service', () => {
  it('serves the higher-priced client first when supply is scarce', () => {
    const result = plan(
      input(
        [farm('F01', { A: 50 })],
        [client('C01', 'EXACT', 'A', 50, 1000), client('C02', 'EXACT', 'A', 50, 2000)],
        station(500),
      ),
    );

    // C02 pays more, so the only 50 t of A protects the larger revenue.
    expect(outcome(result, 'C02').allocatedT).toBe(50);
    expect(outcome(result, 'C01').allocatedT).toBe(0);
    expect(outcome(result, 'C01').status).toBe('UNSERVED');
  });

  it('breaks a price tie by client id so the plan is never ambiguous', () => {
    const result = plan(
      input(
        [farm('F01', { A: 50 })],
        [client('C02', 'EXACT', 'A', 50, 1000), client('C01', 'EXACT', 'A', 50, 1000)],
        station(500),
      ),
    );

    expect(outcome(result, 'C01').allocatedT).toBe(50);
    expect(outcome(result, 'C02').allocatedT).toBe(0);
  });
});

describe('quality compatibility', () => {
  it('EXACT refuses a better segment, MINIMUM accepts it', () => {
    const onlyA = [farm('F01', { A: 50 })];

    const exact = plan(
      input(onlyA, [client('C01', 'EXACT', 'B', 50, 1000)], station(500)),
    );
    expect(outcome(exact, 'C01').allocatedT).toBe(0);
    expect(outcome(exact, 'C01').reason).toBe('INSUFFICIENT_COMPATIBLE_SEGMENT');

    const minimum = plan(
      input(onlyA, [client('C01', 'MINIMUM', 'B', 50, 1000)], station(500)),
    );
    expect(outcome(minimum, 'C01').allocatedT).toBe(50);
    expect(minimum.allocations[0].segment).toBe('A');
    expect(minimum.allocations[0].qualityUpgrade).toBe(1);
  });

  it('spends the smallest quality upgrade before reaching for better fruit', () => {
    const result = plan(
      input(
        [farm('F01', { A: 50 }), farm('F02', { B: 50 }), farm('F03', { C: 50 })],
        [
          client('C01', 'MINIMUM', 'C', 50, 2000),
          client('C02', 'MINIMUM', 'C', 50, 1500),
          client('C03', 'MINIMUM', 'C', 50, 1000),
        ],
        station(500),
      ),
    );

    // Exact grade first, then one step better, then two.
    expect(result.allocations.map((row) => row.segment)).toEqual(['C', 'B', 'A']);
    expect(result.allocations.map((row) => row.qualityUpgrade)).toEqual([0, 1, 2]);
  });

  it('breaks an equal-upgrade tie by farm id', () => {
    const result = plan(
      input(
        [farm('F02', { C: 25 }), farm('F01', { C: 25 })],
        [client('C01', 'EXACT', 'C', 50, 1000)],
        station(500),
      ),
    );

    expect(result.allocations.map((row) => row.farmId)).toEqual(['F01', 'F02']);
  });
});

describe('hard limits', () => {
  it('never exceeds station capacity, and says so', () => {
    const result = plan(
      input(
        [farm('F01', { A: 100 })],
        [client('C01', 'EXACT', 'A', 100, 1000)],
        station(40),
      ),
    );

    expect(result.kpis.exportedT).toBe(40);
    expect(outcome(result, 'C01').status).toBe('PARTIAL');
    expect(outcome(result, 'C01').reason).toBe('STATION_CAPACITY_REACHED');
  });

  it('never exceeds client demand or a farm balance', () => {
    const result = plan(
      input(
        [farm('F01', { A: 30 })],
        [client('C01', 'EXACT', 'A', 20, 1000), client('C02', 'EXACT', 'A', 50, 900)],
        station(500),
      ),
    );

    expect(outcome(result, 'C01').allocatedT).toBe(20); // capped by demand
    expect(outcome(result, 'C02').allocatedT).toBe(10); // capped by what is left
    expect(result.kpis.exportedT).toBe(30);
  });

  it('allocates in whole 5 t lots and leaves the remainder unplanned', () => {
    const result = plan(
      input(
        [farm('F01', { A: 50 })],
        [client('C01', 'EXACT', 'A', 50, 1000)],
        station(12),
      ),
    );

    // 12 t of capacity only buys two whole lots; the station plans no part lot.
    expect(result.kpis.exportedT).toBe(10);
  });
});

describe('local residual', () => {
  it('values unexported fruit at the local ratio and reports the value destroyed', () => {
    const result = plan(
      input([farm('F01', { D: 60 })], [], station(500)),
    );

    expect(result.kpis.localT).toBe(60);
    // 60 t x 10% x EUR 750 reference price.
    expect(result.kpis.localValueEur).toBe(4_500);
    // The other 90% never reaches the business.
    expect(result.kpis.forgoneValueEur).toBe(40_500);
    expect(result.kpis.exportRate).toBe(0);
  });

  it('accounts for every tonne as either exported or local', () => {
    const result = plan(
      input(
        [farm('F01', { A: 50, D: 25 })],
        [client('C01', 'EXACT', 'A', 30, 1000)],
        station(500),
      ),
    );

    const { exportedT, localT, actualT } = result.kpis;
    expect(exportedT).toBe(30);
    expect(exportedT + localT).toBe(actualT);
  });
});
