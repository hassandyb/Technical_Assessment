# Atlas Fresh — Daily Apple Export Planner

A decision-support workspace for the daily Production–Commercial committee. It reads the
supplied workbook, runs the deterministic allocation policy on the server, and shows what
arrived, who gets served, what falls back to the local market, and why.

It prepares the meeting. It does not contact farms or clients, confirm the plan, or write to
any external system — Production and Commercial still approve execution.

---

## Quick start

**Prerequisites:** Node.js **20.9 or newer** (required by Next.js 16) and npm. Nothing else —
no database, no API key, no paid service.

```bash
git clone <repository-url>
cd atlas-fresh-planner
npm install
npm run dev
```

Open <http://localhost:3000>. The workbook at `data/Atlas_Fresh_Production_Commercial_Data.xlsx`
is loaded automatically; there is nothing to upload.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000 |
| `npm test` | The test suite (33 tests) |
| `npm run build` | Production build, including a full type check |
| `npm run lint` | ESLint |
| `npm start` | Serve the production build (after `npm run build`) |

### Verifying the baseline

`npm test` asserts every published figure, computed from the workbook rather than hardcoded:

```
expected 600 t · actual 560 t · exported 500 t · local 60 t · export rate 89.3%
export revenue €549,500 · local value €4,500 · total €554,000 · 3 clients at risk
C02 and C09 partial on quality · C08 partial on station capacity
```

Two tests change an input (station capacity, one farm's receipts) and assert the outputs move,
so a hardcoded result would fail the suite.

---

## Architecture

One Next.js application. The browser never computes anything; it receives a finished plan.

```
data/…xlsx          the authoritative input, never modified
      ↓
lib/data/           read-workbook.ts   extract cells (SheetJS)
                    validate.ts        reject bad values, naming sheet + row (Zod)
      ↓
lib/engine/         compatibility.ts   the quality rules
                    supply.ts          one lot per farm × segment
                    allocate.ts        the policy loop
                    kpis.ts            headline figures
                    plan.ts            orchestration          ← pure TypeScript
      ↓
lib/plan-service.ts the single entry point used by both consumers
      ↓
app/page.tsx        server-rendered workspace
app/api/plan        the same plan as JSON
app/api/assistant   grounded explanations
```

**The engine is pure.** `lib/engine/` imports no framework, touches no filesystem, reads no
clock. Same input, same plan, always — which is what makes it testable and what lets the
committee re-run it and trust the answer.

**Source and computed data stay separate.** `PlanInput` is what the workbook says; `PlanResult`
is what the policy produced. The workbook is never written to (its checksum is unchanged
throughout development).

### The planning policy

Implemented exactly as specified, one small function per step:

1. Supply is built from **actual** receipts. Planned figures are only used to explain gaps.
2. Clients are served in **descending price** order, ties broken by `client_id`.
3. For each client, compatible lots are sorted by **smallest quality upgrade**, then `farm_id`.
4. Allocation proceeds in **5 t lots** until demand, compatible supply, or station capacity runs out.
5. Everything unexported goes local at 10% of its segment's reference price.

Shortage reasons distinguish two different business problems: `STATION_CAPACITY_REACHED` is a
station constraint, `INSUFFICIENT_COMPATIBLE_SEGMENT` is a production one. Capacity is checked
first — nothing about quality can be fixed while there is no capacity to use it.

---

## Technical choices

**Next.js 16 + TypeScript.** One repository, one command, one process. Route handlers provide
the required server-side execution without a separate backend, and the page is a Server
Component so the plan is computed before any HTML is sent.

`export const dynamic = 'force-dynamic'` on the page is deliberate: reading a file is not
something Next.js detects as dynamic, so without it the plan would be baked in at build time
and would not change when the workbook does.

**SheetJS from the vendor's CDN, not npm.** The `xlsx` package on the npm registry is frozen at
0.18.5 with two high-severity advisories marked *"No fix available"*. The official distribution
(`https://cdn.sheetjs.com/xlsx-0.20.3/…`) fixes both; `npm audit` reports zero vulnerabilities.
This is SheetJS's documented install path, and it is why `package.json` carries a URL dependency.

**Zod for validation**, because the brief's rejection rules map almost one-to-one onto schema
refinements, and because it makes "name the sheet and the row" straightforward.

**Vitest**, for a fast Node-environment runner that needs no browser for a pure engine.

---

## The assistant

A small panel answering three fixed questions about the computed plan.

It explains; it never calculates. The model receives a compact JSON facts object derived from
the engine result and is asked to rephrase it — no workbook, no engine internals, no history.
Every identifier in a reply is checked against today's plan, and an answer citing anything else
is **rejected** rather than shown. A confident, fluent, wrong answer is the dangerous failure
mode here, because a reader cannot catch it.

Without `ANTHROPIC_API_KEY` the panel says so plainly and shows a clearly-labelled summary
generated from the same figures. To enable the live model path:

```bash
echo 'ANTHROPIC_API_KEY=sk-ant-…' > .env.local   # .env* is gitignored
```

Three fallback paths — no key, provider unreachable, answer rejected — each state their reason
in the panel. None of them ever displays a fabricated answer.

---

## Assumptions

- **The workbook is the only input.** A corrected spreadsheet is picked up by reloading the page.
- **One station, one day.** The sheet is validated to contain exactly one station row.
- **A blank row ends a table.** Each sheet has decorative title rows above the header and, on the
  Station sheet, explanatory rows below the data. Tables are located by column name and read until
  the first fully blank row, so those decorations cannot shift the parse.
- **Quality substitution is free.** `MINIMUM B` accepts A at no modelled cost beyond the
  smallest-upgrade preference. Real grading loss is out of scope.
- **Money is presented in whole euros** and tonnages to one decimal; nothing is rounded before
  the calculation.
- The supplied workbook writes text cells with a non-standard type (`t="str"` with no formula),
  which is why strict viewers such as Google Sheets render it blank. SheetJS reads it correctly,
  so this affects reading the file by eye, not the application.

## Limitations

Known and deliberate, within the time box:

- **No browser-level testing.** The engine, validation, trace logic and assistant boundaries are
  covered by 33 tests; the React components were verified by inspecting rendered HTML and
  exercising the API, not by Playwright or Testing Library.
- **The live model path is unexercised.** It is implemented against the official SDK with a
  10-second timeout and typed error handling, but with no API key available it has only been
  tested through injected providers (success, hallucinated identifier, thrown error, empty reply).
- **The quality-upgrade display is dormant on this data.** Higher-paying clients drain the better
  grades first, so no upgrade ever fires. The column and the ordering rule are implemented and
  will render if an input changes.
- **No persistence, no auth, no audit trail** — all explicit non-requirements.
- **Charts, drag-and-drop and multi-page navigation** were skipped in favour of the mandatory
  journey, which the brief weights higher.

## The next three production steps

1. **A second day.** Everything is modelled around one snapshot. Persisting plans and comparing
   them is what turns this from a meeting aid into a record of decisions taken.
2. **Let the committee overrule the policy.** Today the plan is take-it-or-leave-it. Real value
   comes from editing an allocation, seeing the revenue consequence, and recording who approved
   the exception and why.
3. **Component and end-to-end tests.** The logic is well covered; the interface is not. Before
   anyone depends on this daily, the click-through from a client to its farms needs a test that
   fails when it breaks.

---

## AI assistance

Built with **Claude Code (Claude Opus 5)** used as a pair programmer throughout: scaffolding,
the engine, the components, the tests and this README.

**What I verified rather than accepted:**

- The allocation policy was traced by hand against the published baseline *before* any code was
  written, so the expected result existed independently of the implementation.
- Every task ended with a real `npm test`, `npm run build`, `npm run lint` and `npm audit` run.
- The test suite was **mutation-checked**: reversing the price ordering in the engine must fail
  exactly four tests. Tests that never fail are worse than no tests.
- API error paths were exercised against a running server by removing and corrupting a copy of
  the workbook, then restoring it and confirming the source file's checksum was unchanged.
- The page was checked to be dynamically rendered by changing the workbook and reloading without
  a rebuild — the first build silently produced a static page, which would have served a stale
  plan to anyone who edited the input.
- The Anthropic integration was written against the current SDK documentation rather than from
  memory, which corrected the model identifier and the client configuration.

**Approximate time spent: 7 hours.**
