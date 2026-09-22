You are running as the **`react-frontend`** agent (`claude --agent react-frontend`): your instructions are `.claude/agents/react-frontend.md`; the skills it lists are in `.claude/skills/`. Read `CLAUDE.md` first.
This is a **consultation**, not a lane: answer the questions below in markdown. Read, search and run read-only commands as you need (verify versions and option names — do not guess). Create or edit **no files**, with one exception: when your answer is complete, write it in full to `context/spec/003-clients-trend-chart/consults/react-frontend-chart-sections-20260922-234604.md` with the Write tool (that path is pre-approved), then end your turn with exactly this line:

    CONSULT react-frontend chart-sections: DONE

The lead quotes the file verbatim — no preamble, no restating the questions; cite the files and commands you used to verify facts.

---

You are the frontend specialist consulted by the lead while writing the **technical considerations** for spec 003, the Clients Trend Chart. Your answer becomes the evidence base for that document, and the lead will quote it verbatim.

## Read first
- `context/spec/003-clients-trend-chart/functional-spec.md` — 44 acceptance criteria, Status Draft. Read it in full; every question below traces to one.
- `context/inbox/clients-trend-chart.md` — the grill decisions D1–D18 and risks R1–R6.
- `context/product/architecture.md` §1 (charting, FSD, styling), §6 (the FSD map).
- `apps/web/src/pages/dashboard/ui/dashboard-page.tsx` and `chart-card-skeleton.tsx` — the card the chart lands in.
- `apps/web/src/widgets/clients-table/` and `shared/ui/tree-grid/` — the neighbour it must not disturb.

## Hard rules
- **Do not modify the repository.** Not one file, not `package.json`, not a lockfile. You may only write your answer file.
- **Measure, do not recall.** Every claim about Recharts must come from a prototype you actually ran in a browser this session. Recharts 3 is NOT installed in this repo and must not be installed. Build a throwaway prototype **outside the repo**, in your scratch directory, e.g. a single HTML file importing `react`, `react-dom/client` and `recharts@3` from a CDN (esm.sh or jsdelivr), rendered with the real twelve-month data below, and drive it with the Playwright MCP. If a CDN import will not work, say so and find another way — but do not guess.
- Where you cannot answer, write "unknown, and here is what I tried". A measured negative is worth more than a confident guess.
- TypeScript house style: `type` aliases, never `interface`.

## The real data (company totals per channel, in month order Feb 2024 → Jan 2025)
Existing clients: 221, 252, 261, 283, 289, 308, 324, 224, 226, 222, 228, 324
New organic:      15,   8,  18,   9,  16,  18,  17,  14,  16,  15,  12,  16
New paid:         14,   7,   5,   9,  12,   8,   9,  12,   8,  13,  10,  10
Totals:          250, 267, 284, 301, 317, 334, 350, 250, 250, 250, 250, 350

## Questions

**Q1 — the axis (FR2, risk R1).** With a stacked `BarChart` whose largest total is 350 and a `YAxis` left to its own devices, what tick labels does Recharts 3.10 actually render? Report the measured labels. FR2 requires: starts at 0, equal steps of **one hundred**, and a top at the **first step above** the largest month — so **400** for this data, with no bar touching the ceiling. If the default does not produce that, give the smallest set of props that does **while keeping the axis data-driven** (it must still adapt if the numbers change — a hardcoded `domain={[0,400]}` is not acceptable). Show the exact prop values you verified, and prove the adaptive case by re-rendering with a month raised to 420 and reporting the new labels.

**Q2 — the accessibility layer (FR5, FR6, risks R2 and R3).** With `accessibilityLayer` on, measure and report:
- exactly which element is focusable, and whether the chart is **one** tab stop (FR5) or several;
- what ARIA Recharts emits, and what the browser's accessibility tree shows for the chart and its bars;
- what happens on focus: is a month active immediately, and is its tooltip shown? FR5 requires February to be the month being read the moment the outline arrives;
- what Left/Right do, whether the ends wrap (FR5 forbids wrapping), and what Escape does;
- whether leaving and re-entering resets to the first month (FR5 requires February again);
- whether a screen reader would announce the month plus its four figures on each move — and if Recharts' own ARIA does not say that, what we must add.

Then recommend the concrete structure for the **visually-hidden data table** (FR6: twelve rows, one per month, columns Existing / New organic / New paid / Total) that does **not** double-announce with the SVG — say precisely where `aria-hidden` goes, what the chart's accessible name comes from, and how you verified nothing is read twice.

**Q3 — narrow screens (FR8).** At 375 px the card is ~343 px wide. FR8 requires all twelve bars visible, the plot the same height as at the design width, no sideways scrolling, and month labels reading exactly **Feb 2024, May 2024, Aug 2024, Nov 2024, Jan 2025** — note that is indices 0, 3, 6, 9 **and 11**, which `interval={2}` alone will not give you. Measure what `interval` does, and give the approach that produces exactly those five labels without overlap. Report the bar width you measured at 375.

**Q4 — the container (risk R5).** `ResponsiveContainer` is known to collapse to zero height or loop on resize when its parent has no definite height. The chart sits in a card inside a CSS Grid (see `dashboard-page.module.css`). Give the layout pattern you verified at both 1440 and 375 — where the definite height must be set, and whether `ResponsiveContainer` is needed at all or whether the chart can take explicit dimensions. Report any resize-observer loop error you saw and how you stopped it.

**Q5 — motion, pointer and touch (FR4, FR7).** How to honour `prefers-reduced-motion` (FR7: bars appear fully drawn, no growth) — which prop, and does it need a media-query hook or does Recharts respect the setting itself? For the pointer: how to restyle the tooltip cursor to the table's own hover tint `rgba(20, 20, 19, 0.04)`, and how to keep the tooltip and the tint from being left behind when focus leaves (FR4). For touch: does a tap open the tooltip, does tapping another month replace it, and does tapping outside dismiss it — measured, in a touch-emulating context.

**Q6 — shape and cost.** Where the pieces belong under FSD (`widgets/clients-chart/`, what stays in `entities/clients/model`), the component boundaries you would draw and why, and what Recharts adds to the production bundle (measure it — a CDN bundle size or a local build outside the repo, and say which).

## Answer format
Markdown, one `## Q<n>` section each, every claim followed by the measurement that supports it (numbers, tick labels, accessibility-tree excerpts, screenshots paths). End with `## What I would do differently` — anything in the functional spec you think is wrong or expensive, with the cheaper alternative. Do not write any file but your answer.
