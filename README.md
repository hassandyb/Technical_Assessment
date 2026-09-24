# Atlas Fresh — Daily Apple Export Planner

A decision-support workspace for the daily Production–Commercial committee. It reads the supplied
workbook, runs the deterministic allocation policy on the server, and shows what arrived, who gets
served, what falls back to the local market, and why.

It prepares the meeting. It does not contact farms or clients, confirm the plan, or write to any
external system — the teams still approve execution.

---

## Quick start

**Prerequisites:** Node.js **20.9+** (required by Next.js 16) and npm. No database, no API key, no
paid service.

```bash
git clone <repository-url>
cd atlas-fresh-planner
npm install
npm run dev
```

Open <http://localhost:3000>. The workbook in `data/` loads automatically — there is nothing to upload.

| Command | |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm test` | 33 tests |
| `npm run build` | Production build, including a full type check |
| `npm run lint` | ESLint |
| `npm start` | Serve the production build |

`npm test` asserts every published figure, computed rather than hardcoded:

```
expected 600 t · actual 560 t · exported 500 t · local 60 t · export rate 89.3%
revenue €549,500 · local value €4,500 · total €554,000 · 3 clients at risk
C02 and C09 partial on quality · C08 partial on station capacity
```

Two tests change an input and assert the outputs move, so a hardcoded result fails the suite.

---

## Architecture

```
data/…xlsx            the authoritative input, never modified
      ↓
lib/data/             read-workbook.ts  extract cells (SheetJS)
                      validate.ts       reject bad values, naming sheet + row (Zod)
      ↓
lib/engine/           compatibility · supply · allocate · kpis · plan
      ↓                                            ← pure TypeScript, no framework
lib/plan-service.ts   the single entry point both consumers use
      ↓
app/page.tsx          server-rendered workspace
app/api/plan          the same plan as JSON
app/api/assistant     grounded explanations
```

`lib/engine/` imports no framework, touches no filesystem and reads no clock — same input, same
plan, always. `PlanInput` (what the workbook says) stays separate from `PlanResult` (what the policy
produced), and the workbook itself is only ever read.

### The policy

1. Supply comes from **actual** receipts; planned figures only explain gaps.
2. Clients are served by **descending price**, ties broken by `client_id`.
3. Compatible lots are sorted by **smallest quality upgrade**, then `farm_id`.
4. Allocation proceeds in **5 t lots** until demand, supply, or capacity runs out.
5. Everything unexported goes local at 10% of its segment's reference price.

Shortage reasons separate two different problems: `STATION_CAPACITY_REACHED` is a station
constraint, `INSUFFICIENT_COMPATIBLE_SEGMENT` a production one. Capacity is checked first — nothing
about quality can be fixed while there is no capacity to use it.

---

## Technical choices

**Next.js 16 + TypeScript.** One repository, one command, one process. Route handlers give the
required server-side execution without a separate backend, and the page is a Server Component.

`export const dynamic = 'force-dynamic'` on the page is deliberate: reading a file is not something
Next.js detects as dynamic, so without it the plan would be baked in at build time and would not
change when the workbook does.

**SheetJS from the vendor's CDN, not npm.** The registry copy is frozen at 0.18.5 with two
high-severity advisories marked *"No fix available"*. The official distribution fixes both and
`npm audit` reports zero vulnerabilities — which is why `package.json` carries a URL dependency.

**Zod**, because the brief's rejection rules map almost one-to-one onto schema refinements.
**Vitest**, for a fast Node runner that needs no browser for a pure engine.

## The assistant

Three fixed questions about the computed plan. The model receives a compact JSON facts object
derived from the engine result and rephrases it — it never calculates. Every identifier in a reply
is checked against today's plan, and an answer citing anything else is **rejected**, because a
fluent wrong answer is the failure a reader cannot catch.

Without `ANTHROPIC_API_KEY` the panel says so and shows a labelled summary built from the same
figures. To enable the live path: `echo 'ANTHROPIC_API_KEY=…' > .env.local` (`.env*` is gitignored).
No key, provider unreachable, and answer rejected each state their reason; none shows a fabricated
answer.

---

## Assumptions

- The workbook is the only input; a corrected spreadsheet is picked up by reloading.
- One station, one day. The sheet is validated to contain exactly one station row.
- **A blank row ends a table.** Sheets carry decorative rows above the header and, on the Station
  sheet, explanatory rows below the data, so tables are found by column name and read to the first
  blank row.
- Quality substitution is free beyond the smallest-upgrade preference; grading loss is out of scope.
- The supplied workbook writes text cells with a non-standard type (`t="str"` with no formula),
  which is why strict viewers such as Google Sheets render it blank. SheetJS reads it correctly.

## Limitations

- **No browser-level testing.** Engine, validation, trace logic and assistant boundaries have 33
  tests; the React components were verified through rendered HTML and the API, not Playwright.
- **The live model path is unexercised** — implemented against the official SDK with a 10s timeout,
  but with no API key it has only been tested through injected providers.
- **The quality-upgrade column is dormant on this data**, since higher-paying clients drain the
  better grades first. The rule is implemented and renders if an input changes.
- No persistence, auth or audit trail; no charts or drag-and-drop — all non-requirements, skipped in
  favour of the mandatory journey.

## The next three production steps

1. **A second day.** Everything is modelled around one snapshot. Persisting plans and comparing them
   turns this from a meeting aid into a record of decisions taken.
2. **Let the committee overrule the policy.** Editing an allocation, seeing the revenue consequence,
   and recording who approved the exception is where the real value is.
3. **Component and end-to-end tests.** The logic is covered; the interface is not. The click-through
   from a client to its farms needs a test that fails when it breaks.

---

## AI assistance

Built with **Claude Code (Claude Opus 5)** as a pair programmer: scaffolding, engine, components,
tests and this README.

What I verified rather than accepted:

- The policy was traced **by hand** against the published baseline before any code existed, so the
  expected result was independent of the implementation.
- The suite was **mutation-checked**: reversing the price ordering must fail exactly four tests.
- API error paths were exercised against a running server by removing and corrupting a *copy* of the
  workbook, then confirming the source file's checksum was unchanged.
- The first build silently produced a **static** page, which would have served a stale plan to
  anyone who edited the input; caught by changing the workbook and reloading without a rebuild.
- The Anthropic integration was written against current SDK documentation, which corrected the model
  identifier and client configuration.

**Approximate time spent: 7 hours.**
