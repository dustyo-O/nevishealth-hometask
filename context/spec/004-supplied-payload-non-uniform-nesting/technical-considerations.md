# Technical Specification: The Data As Supplied, And An Uneven Company

- **Functional Specification:** `context/spec/004-supplied-payload-non-uniform-nesting/functional-spec.md`
- **Status:** Draft
- **Author(s):** Alexander Shleyko (lead)
- **Note on method:** no specialist consultation this time, deliberately. Spec 003 needed one because Recharts' behaviour was unknown; here every fact was measured during the grill and the audit below — the payload's real shape, the seven discrepancies, the remainder series, the table needing no change, and exactly which criteria in the completed specs stop being true. The one thing a consult could not settle is how a chart that is nine-tenths grey looks, and that can only be answered by building it (R-1).

---

## 1. High-Level Technical Approach

Three files of data change and one component gains a segment. Everything else in this spec is deletion of things we should never have written, and correction of documents that now describe the wrong behaviour.

The supplied payload replaces the completed one. The API needs **no code change**: its consistency check is already pure, already warns once per discrepancy, already logs a count, and already serves the data regardless — it simply has something real to report for the first time. Only its assertions move.

The table needs **no change**, measured: served the real payload it already renders every childless node as a row that does not open.

The chart is the whole of the work. Its series gain a fourth, synthesised member — the clients the data does not attribute — computed as the company's own figure minus everything the tree does attribute, floored at zero. Because that figure is derived rather than served, it is computed where presentation decisions belong (the widget), not where the data lives (the entity). The legend, the month panel and the screen-reader table then follow one predicate, decided once for the whole series.

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 The data

| Path | Change |
|---|---|
| `apps/api/src/clients/data/clients.json` | Replaced by the payload exactly as the brief supplies it |
| `context/inbox/data.json` | Same file, same content — it is the inbox copy of what we serve |
| `context/inbox/data.original.json` | Deleted. It was "the supplied payload" as distinct from our completed one; with the completed one gone it is a duplicate, and git history holds the variant we discarded |

`packages/contracts` needs nothing: `branches?`, `employees?` and `channels?` are already optional, and `childrenOf` already treats a missing or empty list as a leaf — the shape this spec restores is the shape the contract was written for.

**The tree shrinks from 44 nodes to 12** (Company + 3 branches + 5 advisers + 3 channels), which changes two log assertions (§2.2).

### 2.2 The API — assertions only

`findDiscrepancies` is pure, exact on integers, and depth-first over `childrenOf`; `reportConsistency` warns one line per discrepancy and logs the count, then the data is served either way. None of that changes. What changes:

- `apps/api/scripts/smoke.mjs` asserts `0 discrepancies` in the boot log. It becomes an assertion that the guard reports **exactly seven**, and the summary line it prints changes with it. This is a better test than the one it replaces: it proves the guard fires rather than proving it stays quiet.
- `src/clients/consistency.spec.ts` asserts `Checked 44 nodes`. That becomes 12.
- A test that pins the seven — each path, month, expected and actual — so a later data edit cannot silently change what we claim about the supplied figures. The seven: Company May (301 vs 279), Branch 1 Aug (214 vs 216), Anna May (31 vs 30), Jun (32 vs 33), Jul (34 vs 35), Aug (38 vs 36), Sep (27 vs 28).

### 2.3 Where the remainder is computed

`entities/clients/model/monthly-series.ts` keeps doing exactly what it does: walk the tree, group channels by name, return them in first-seen order. It gains nothing about "Not recorded" — the entity reports what the data says, and the data does not say this.

It must, however, expose the **company's own monthly figures** alongside the channel series if it does not already, because the remainder is `company[month] − Σ channels[month]`. That is data, not presentation.

The remainder itself is derived in `widgets/clients-chart/lib/not-recorded.ts`:

```
notRecorded(series) → { values: number[12], shown: boolean }
  values[m] = max(0, series.total[m] − sum of series.channels at m)
  shown     = values.some(v => v > 0)
```

Pure, no Recharts, no DOM, its own tests. `shown` is FR4's rule — **decided once across the twelve months**, so the legend cannot change while the pointer moves. Every consumer takes the same flag.

The zero floor is FR3's exception: when the recorded channels exceed the company's figure the remainder is 0, nothing is drawn for it, and the bar is as tall as the channels come to. **No fourth visual state is built for that case** (grill D12) — it cannot arise from the supplied figures, and the guard already reports the disagreement that would cause it.

### 2.4 The colour

```css
--color-channel-not-recorded: /* a neutral grey mixed from the text colour over the surface */
```

It must read as absence, not as a fourth channel: no hue, clearly distinct from the three channel colours, and light enough that ~90% of every bar in it does not overwhelm the coloured segments above. The lane picks the exact mix and **checks it in a browser against the card**, since the existing greys (`--color-line`, `--color-line-dotted`) were chosen for hairlines, not for large areas.

`widgets/clients-chart/model/channels.ts` maps a channel name to its token and **throws on an unknown name** — deliberately, from spec 003. It gains the not-recorded mapping. It must keep throwing for anything genuinely unrecognised; the point of that throw is that a new channel in the data cannot silently render colourless.

### 2.5 The chart, the legend, the panel, the hidden table

- **Stack order:** the not-recorded `Bar` is rendered **first**, so it sits at the base with the three channels above it in the design's order (FR3).
- **Legend, panel, screen-reader table** all take `shown` from §2.3. When it is true, every month lists the segment including months where it is zero; when false, none of them mention it and the chart is exactly what spec 003 built.
- **The panel's total** stays the month's total. In the exempted overshoot case it is what the recorded channels come to — the same number the bar is drawn to, so the panel never disagrees with the picture beside it.
- The hidden table gains a column; the announcement sentence from `describe-month.ts` gains a clause. Both follow `shown`.

### 2.6 The amendments this spec pays for

Measured by auditing every criterion in both completed specs, not by guessing:

| Spec | What changes |
|---|---|
| **001** | The data decision it records — completing the payload — is reversed, with the reason, in its Change Log |
| **002** | **Exactly one criterion**: "Given Branch 1 is open, when the user opens Branch 2, then Branch 1 stays open" — Branch 2 no longer opens. Rewritten against a row that still has children, plus one new criterion asserting a childless branch offers nothing to open. Everything else in 002 survives untouched, including the criterion that moves the outline *to* Branch 2, which is still a row |
| **003** | **Eight criteria**: FR1-AC1 and AC2 (three parts → four), FR1-AC3 and FR4-AC1 and FR6-AC1 (February's figures), FR1-AC5 (stack order), FR3-AC1 (the legend's entries), FR6-AC2 (the hidden table's columns). Two that look affected are not: August and January are still the tallest at 350, because the company's own figures never changed |
| **product-definition.md** | §4's "we completed the data rather than change the chart" reverses |
| **architecture.md** | §2's consistency invariant no longer claims every parent equals its children |

Each spec keeps its `Completed` status; the Change Log is what records the amendment, as it did for 002's three earlier ones.

### 2.7 Tests and fixtures

- `apps/web/src/test/fixtures/shipped-clients.ts` reads the served file through `?raw`, so it follows the data automatically — but every expectation derived from the completed tree changes with it.
- The e2e double (`e2e/support/clients-double.ts`) builds its own tree; it gains a non-uniform shape so the acceptance tests exercise leaves rather than only the shipped data.
- **Do not count bar segments.** Spec 003's tests assert 36 rectangles; with the real figures New organic and New paid are 0 in some months and a zero-height rectangle may not be rendered at all (measured: the real payload drew 31, not 36). Assert per month and per series by colour and value instead — which is also what the agreement test needs.

---

## 3. Impact and Risk Analysis

**System dependencies.** `apps/web` and the API's assertions. No contract change, no new dependency, no change to the table, the keyboard model, or the loading and failure states.

| # | Risk | Mitigation |
|---|---|---|
| R-1 | **The chart will not look like the mockup any more.** Nine-tenths of every bar is grey. This is the honest rendering of the supplied figures, but it is a visual judgement no test can make. | A `[User]` look-and-feel step before the spec is verified, with the chart in a browser at both widths. If it reads badly, the decision to reopen is the owner's — the alternatives were weighed in the grill. |
| R-2 | **Segment counting breaks.** Zero-valued channels may draw no rectangle, so any test asserting a fixed number of segments is unreliable with the real data. | §2.7: assert per month and per series, by colour and value. Rewrite spec 003's affected assertions rather than patching the counts. |
| R-3 | **The agreement test must include the remainder**, or it will pass while the chart disagrees with the table by 90%. | It is the one test a reviewer will look at: bar total = Company row, with the remainder counted in. |
| R-4 | **The axis.** The company's maximum is still 350, so the scale should return to 0–400 — but that is a consequence of the numbers, not a guarantee. | Spec 003's swept label test and the axis assertions must be re-run, not assumed. |
| R-5 | **The four advisers lose their avatars' purpose?** No — they keep their initials; only their expandability changes. Listed because it looks like a regression in a screenshot diff and is not. | Nothing to do; noted so a reviewer does not chase it. |
| R-6 | **The README's story.** The most valuable output of this spec is the honest account of the reversal, and it is written in a different roadmap item. | Ship-Ready quotes this spec's overview and the seven discrepancies; the spec exists so that account is accurate rather than remembered. |

---

## 4. Testing Strategy

- **Unit (Vitest), no DOM:** `notRecorded` — the arithmetic, the zero floor on overshoot, and `shown` computed across the series rather than per month; `toMonthlySeries` against the real tree, where only one adviser contributes channels; the seven discrepancies pinned by path, month, expected and actual.
- **Component (RTL + jest-axe):** the legend with four entries and with three; a zero month still listing "Not recorded"; the hidden table's extra column; the announcement's extra clause.
- **End-to-end (Playwright, mocked data):** the table showing Branch 2 and Branch 3 with no control to open them, and only Anna expandable inside Branch 1; the Company row reading 301 for May above branches totalling 279, with no warning anywhere; each bar's height matching its Company row **with the remainder included**; February reading 225 / 25 / 0 / 0 = 250; the legend stable while the pointer moves.
- **The regression this spec exists to prevent:** a test that fails if the served data is ever made uniform again — assert that Branch 2 has no children and that at least one adviser has none, read from the served file. Without it, a future "tidy-up" quietly re-creates the mistake this spec corrects.
- **Gate:** `pnpm check:web` for a web lane, `pnpm check:api` for the API's assertions, `pnpm check` on the merged tree.
