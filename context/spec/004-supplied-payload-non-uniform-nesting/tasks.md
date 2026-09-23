# Tasks — 004 The Data As Supplied, And An Uneven Company

Spec: `functional-spec.md` (FR1–FR6, 27 acceptance criteria) · How: `technical-considerations.md` (§1–§4) · Reviews: `reviews/TRIAGE.md` (spec review F1, F2) · Grill: `context/inbox/supplied-payload-non-uniform-nesting.md` (D1–D19).

**Read the slice order before starting.** Slice 1 teaches the chart to account for unattributed clients while the data is still complete, so nothing changes on screen. Slice 2 swaps the data, and the remainder appears the same moment the gaps do. Built the other way round, the app would sit between slices with a chart showing a tenth of the table's figures — the exact contradiction this spec exists to remove.

## Standing rules

- Read `CLAUDE.md`, then `functional-spec.md`, then `technical-considerations.md`, then the grill notes. The tech doc's numbers were measured, not guessed. Do not "improve" a value without re-measuring and saying so in your ledger note.
- `type` aliases over `interface`, everywhere. CSS Modules with tokens. FSD import direction downward only; every slice exposes `index.ts`.
- `recharts` stays imported in exactly one file, `ui/bar-plot.tsx`.
- **Do not count bar segments in any test.** A zero-valued channel may render no rectangle — the real payload drew 31 where the current tests expect 36. Assert per month and per series, by colour and value.
- **Never make the data uniform again.** The gaps are the requirement. If a test is awkward because a branch has no advisers, the test changes, not the data.
- Tests are written with the change and proven RED first (temporarily revert, watch it fail, restore). Never delete or skip a test to make a gate green. A completion claim cites fresh output from this run.
- Gate before you finish: your lane's gate from `harness.json`. Not green → `PARTIAL`, with the failure quoted. The e2e server is on **5273**; if you start a dev server for your own exploration, use another port.
- Every finished sub-task ends with `_(Done <date>: what actually happened, incl. surprises)_`.

---

- [ ] **Slice 1: The chart can account for clients nobody attributed**

  > All of the chart work, while the served data is still complete — so `shown` is false throughout and **nothing changes on screen**. Everything here is proven against a routed fixture with deliberate gaps (FR3, FR4, FR5, FR6).
  - [ ] `entities/clients/model/monthly-series.ts`: make sure the series carries the **company's own monthly figures** alongside the channel series, since the remainder is company minus channels. The entity gains nothing about "Not recorded" — it reports what the data says, and the data does not say this. Tests for the company totals surviving the mapping. **[Agent: react-frontend]**
  - [ ] `widgets/clients-chart/lib/not-recorded.ts` per §2.3: `notRecorded(series)` → `{ values, shown }`, where `values[m] = max(0, total[m] − Σ channels[m])` and **`shown` is `values.some(v => v > 0)` — one decision for the whole series, never per month** (spec review F2). Pure, no Recharts, no DOM. Tests RED first: a complete series gives `shown: false`; a series with gaps gives the right figures; a month whose channels exceed the total gives 0, not a negative (spec review F1); `shown` stays true when only one month has a remainder. **[Agent: react-frontend]**
  - [ ] Add `--color-channel-not-recorded` to `shared/styles/tokens.css` and map it in `widgets/clients-chart/model/channels.ts`. It must read as **absence, not a fourth channel**: no hue, clearly distinct from the three channel colours, light enough that ~90% of a bar in it does not overwhelm the colours above. The existing greys were chosen for hairlines — pick the mix and **check it in a browser against the card**. `channels.ts` must keep throwing on a genuinely unknown name. **[Agent: react-frontend]**
  - [ ] Render the not-recorded `Bar` **first** in the stack so it sits at the base with the three channels above in the design's order (FR3), and give the legend, the month panel, the hidden data table and the announcement the single `shown` flag (FR4, FR5). When `shown` is true every month lists the segment, **including months where it is zero**; when false, none of them mention it. **[Agent: react-frontend]**
  - [ ] Verify — browser, with a routed fixture whose channels cover only part of the company: the bar heights still equal the Company row, the base segment is the neutral grey, the legend names four entries, a zero month still lists "Not recorded" reading 0, and the legend does not change while the pointer moves across months. Then load the **current** complete data and confirm **nothing has changed** — three segments, three legend entries, no zero line anywhere. Delete the fixture route and any screenshots. **[Agent: react-frontend]**
  - [ ] Merge the lane, run `pnpm check`, push, confirm CI green, record ledger notes, `swarm.sh clean 004`. **[Lead]**

- [ ] **Slice 2: Serve the payload the brief actually supplied**

  > The swap. Two lanes, different directories, no collision: the API's data and assertions, and the web's fixtures and expectations (FR1, FR2).
  - [ ] Replace `apps/api/src/clients/data/clients.json` with the payload exactly as the brief supplies it (it is in `context/inbox/data.original.json` today). Then make the inbox copy match and **delete `data.original.json`** — with the completed variant gone it is a duplicate, and git history holds what we discarded. Change no figure, including the ones that do not add up. **[Agent: nest-backend]**
  - [ ] The API's assertions, per §2.2 — no production code changes, the guard already does the right thing. `scripts/smoke.mjs` asserts `0 discrepancies`; it must assert the guard reports **exactly seven** and print them in its summary. `consistency.spec.ts` asserts `Checked 44 nodes`; the tree is now **12**. Add a test pinning all seven by path, month, expected and actual — Company May (301 vs 279), Branch 1 Aug (214 vs 216), Anna May (31 vs 30), Jun (32 vs 33), Jul (34 vs 35), Aug (38 vs 36), Sep (27 vs 28) — so a later data edit cannot silently change what we claim. **[Agent: nest-backend]**
  - [ ] The web's expectations follow the data (§2.7). `src/test/fixtures/shipped-clients.ts` reads the served file so it follows automatically, but everything derived from the completed tree changes: the chart's February figures become 225 / 25 / 0 / 0, the legend gains its fourth entry, the hidden table gains its column. Give the **e2e double a non-uniform shape** too, so the acceptance tests exercise leaves rather than only the shipped data. Replace any segment-count assertion with per-month, per-series checks. **[Agent: react-frontend]**
  - [ ] Verify — browser on the real data: the table shows Branch 2 and Branch 3 with no control to open them and only Anna expandable inside Branch 1; the Company row reads **301** for May above branches totalling 279, with no warning anywhere on the page; every bar's height equals its Company row **with the remainder counted in**; February reads 225 not recorded, 25 existing, 0 new organic, 0 new paid. Confirm the API's boot log reports seven discrepancies and serves the data anyway. Delete the check's artifacts. **[Agent: react-frontend]**
  - [ ] Merge both lanes, run `pnpm check`, push, confirm CI green, record ledger notes, `swarm.sh clean 004`. **[Lead]**
  - [ ] Verify — look and feel: open the dashboard and judge the chart now that nine-tenths of every bar is grey (tech doc R-1). No test can make this call. If it reads badly, say so — the alternatives were weighed in the grill and reopening the decision is yours. **[User]**

- [ ] **Slice 3: The record catches up**

  > The documents that now describe behaviour the app no longer has. Audited in §2.6, not guessed — one criterion in 002, eight in 003.
  - [ ] Amend **spec 002** in place with a Change Log entry: rewrite "Given Branch 1 is open, when the user opens Branch 2, then Branch 1 stays open" against a row that still has children, and add one criterion asserting a childless branch offers nothing to open. Touch nothing else — the rest of 002 survives, including the criterion that moves the outline *to* Branch 2, which is still a row. It keeps its `Completed` status. **[Lead]**
  - [ ] Amend **spec 003** in place with a Change Log entry, for the eight criteria §2.6 lists: three parts → four, February's figures, the stack order, the legend's entries, the hidden table's columns. Leave the two that look affected but are not — August and January are still the tallest at 350. It keeps its `Completed` status. **[Lead]**
  - [ ] Amend **spec 001**'s Change Log: the data decision it records — completing the payload — is reversed, with the reason. Then `product-definition.md` §4 ("we completed the data rather than change the chart") and `architecture.md` §2's consistency invariant, which no longer holds. **[Lead]**

- [ ] **Slice 4: Feature Testing & Regression**

  > Verifies the whole feature end-to-end against functional-spec.md, run after all implementation slices are complete.
  - [ ] Read functional-spec.md acceptance criteria in full. Generate acceptance-level tests that verify the entire feature as a whole — not individual slices. Cover applicable layers (unit for pure logic, integration for service interactions, e2e for user flows) based on the project's testing stack. Write tests with RED validation (must fail before implementation is confirmed done). Annotate each test with `@spec: 004-supplied-payload-non-uniform-nesting` and `@regression` if suitable for long-term regression. **[Agent: testing-expert]**
  - [ ] Run all generated tests. All must pass. Fix any failures before proceeding. **[Agent: testing-expert]**
  - [ ] **The regression this spec exists to prevent** (§4): a test that fails if the served data is ever made uniform again — read the served file and assert that Branch 2 has no children and that at least one adviser has none. Without it, a future tidy-up quietly re-creates the mistake this spec corrects, and every other test would still pass. **[Agent: testing-expert]**
  - [ ] Re-run spec 003's swept label test and the axis assertions against the new figures (tech doc R-4). The company's maximum is still 350 so the scale should return to 0–400 — but that is a consequence of the numbers, not a guarantee, so measure it rather than assume it. Run the chart and table specs in **WebKit** as well as Chromium. **[Agent: testing-expert]**
  - [ ] Merge the lane, run `pnpm check`, push, confirm CI green on the PR, record ledger notes, `swarm.sh clean 004`. **[Lead]**
