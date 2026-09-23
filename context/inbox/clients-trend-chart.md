# Clients Trend Chart — grill notes 2026-09-22

_Roadmap: Phase 1 → "Clients Trend Chart". Grilled with the `grilling` skill (mattpocock-skills) under the house rules in `.claude/commands/harness/grill.md`. Facts marked **(measured)** were established from the mockup's pixels or the served payload during the grill, not assumed._

## Decisions

- **D1:** The chart is company-wide: one bar per month for the twelve served months (Feb 2024 – Jan 2025), each stacked by acquisition channel in the order Existing clients (bottom), New organic, New paid (top).
- **D2:** The segment values are the sum of every adviser's channel values over the whole tree. **(measured)** That sum equals the Company row's stored values in all twelve months — `[250, 267, 284, 301, 317, 334, 350, 250, 250, 250, 250, 350]` — so "the chart and the table agree" holds by construction, not by hope.
- **D3:** Channel colours **(measured from the mockup, legend swatch and bar body agree)**: Existing clients `#b29df8`, New organic `#f4beb4`, New paid `#a75e6e`. They become named tokens beside the existing design tokens.
- **D4:** The y-axis scales **automatically from the data**, always from a zero baseline — it is not pinned to the design's 0–400. For this payload it is expected to land on 0–400 in steps of 100 anyway, which is the design's axis; the tech stage confirms the real ticks in a browser rather than assuming them (see Risks).
- **D5:** Horizontal dotted gridlines at each tick, and **no vertical gridlines**. **(measured: a vertical scan of the gap between two bars finds only the gridline crossings.)**
- **D6:** Month labels use the same `formatMonth()` the table uses ("Feb 2024"), in the footnote font and the muted colour, so both cards name months identically.
- **D7:** The legend sits centred beneath the plot — 8 px swatch plus label — and is **static**. It does not toggle series: hiding one would silently re-stack every bar and break D2's promise.
- **D8:** Hovering a month, or reaching it from the keyboard, shows a tooltip naming the month, each of the three channel figures, and the total. The static mockup shows none only because a still frame cannot show hover, and the prototype was never played.
- **D9:** The hovered month's whole column is tinted with the table's own row-hover token (4 % of the text colour). No dimming of the other months.
- **D10:** The chart reaches assistive technology **two ways**: a visually-hidden data table — one row per month, columns Existing clients / New organic / New paid / Total — and Recharts' keyboard layer, where the chart is a single tab stop and Left/Right move between months. The SVG's own text is kept out of the accessibility tree so nothing is announced twice.
- **D11:** Bars grow from the baseline once when the data lands, and appear instantly under `prefers-reduced-motion` — the same rule the table's row slide already follows (spec 002 FR2-AC8).
- **D12:** At 375 px all twelve bars stay visible, squeezed to roughly 24 px each, and the month labels thin to every third month (Feb / May / Aug / Nov, plus Jan). **The chart never scrolls sideways** — the page keeps exactly one horizontal scroller, the table.
- **D13:** The plot keeps its ~320 px height at every width; only the bars get thinner. The label thinning uses the same ~600 px breakpoint the table's narrow name column already uses.
- **D14:** The placeholder line "12 months · Feb 2024 – Jan 2025" is removed — the chart replaces it, as `summaries.ts` always intended. The card keeps its accessible name "Clients chart".
- **D15:** Loading and failure are spec 001's and do not change. The existing `ChartCardSkeleton` already mimics axis, twelve bars, labels and legend; it moves into the chart widget and keeps its shape.
- **D16:** A bar is not clickable. The chart is read-only, like the table's monthly figures.
- **D17:** The served payload always carries a full channel split. **(measured: 3 branches, 10 advisers, three channels each, and `apps/api/.../clients.json` is byte-identical to `context/inbox/data.json`.)** So no "no channel data" state is built — the owner's call, explicitly against over-engineering. The chart must merely not crash on the no-branch fixture spec 002 already uses.
- **D18:** Recharts **3.10.1** is added to `apps/web`. The tree → series mapping is a pure function in `entities/clients/model` (`toMonthlySeries`), unit-tested with no Recharts in sight, per `architecture.md` §2.

## Out of scope

- The chart re-scoping to a selected branch or adviser — Phase 2, "Chart Follows the Drill-Down". Opening a table row changes nothing in the chart.
- Selecting or clicking a month, a bar or a segment.
- An interactive legend (toggling series).
- A "no channel data" empty state (D17).
- Playing the Figma prototype, and any hover or motion behaviour it might show that the static mockup does not.
- Any change to the API, the served data, or the table.
- Sorting, filtering or changing the period shown.

## Open risks

- **R1 — the automatic domain may not match the design's axis.** D4 assumes Recharts' "nice" domain lands on 0/100/200/300/400 for a 350 maximum. If it picks something else, the design's axis is lost. Confirm in a browser before the layout work, and pin explicit ticks if it does not.
- **R2 — double announcement.** Recharts 3's own ARIA plus our hidden table (D10) could make VoiceOver read each month twice. Needs a real device check, not a unit test; this is the same class of problem that amended spec 001 FR3.
- **R3 — the chart's tab stop sits before the table's.** Verify the treegrid's single-tab-stop behaviour and the Tab-out path are unaffected once a focusable chart precedes it.
- **R4 — the thin bands at 375 px.** At ~24 px wide, "New paid" is about 9 px of a 320 px plot. Check it stays visible and that the three colours remain distinguishable, including for a colour-blind reader.
- **R5 — `ResponsiveContainer` inside the card.** Recharts' responsive wrapper is known to collapse to zero height, or loop on resize, when its parent has no definite height. The card's height must be explicit — and this is exactly where a CSS Grid slot bites.
- **R6 — bundle size.** Recharts is a large dependency; check what it adds to the build and note it in the README if it dominates.

## Suggested acceptance criteria

- When the page has loaded, the chart card shows twelve bars labelled "Feb 2024" through "Jan 2025", each stacked in three segments, with a centred legend naming Existing clients, New organic and New paid.
- For every one of the twelve months, the three segment values sum to the figure the table shows on the Company row for that month.
- When the user hovers a month, a tooltip names that month, each channel's figure and the total, and that month's column is tinted.
- When the user tabs to the chart, it takes a single tab stop, and Left/Right move between months, each announcing its figures.
- When a screen reader reads the chart's hidden table, it reports twelve rows, one per month, each carrying Existing clients, New organic, New paid and Total.
- Given the system asks for reduced motion, when the data lands, then the bars appear without growing.
- When the page is viewed at 375 px, then all twelve bars are visible, every third month is labelled, the plot is still about 320 px tall, and the page has no horizontal scrollbar.
- Given the figures are slow or cannot be loaded, when the user opens the page, then the chart card shows the placeholder blocks, and the error message with its Retry button, exactly as spec 001 defines them.
