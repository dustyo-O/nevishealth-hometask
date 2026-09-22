# Triage — spec 003, Clients Trend Chart

## Spec review 2026-09-22

Review: `reviews/spec-codex-20260922-2342.md` — reviewer **codex**, effort low, kind spec, base main. Cross-vendor, no same-vendor fallback.

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major | accepted | Real ambiguity of my own making: FR6 asked for two reading paths and then forbade "announced twice", which reads as forbidding the second path. De-duplication was only ever meant to apply within one move of the outline. | FR6 — prose rewritten to say both paths are deliberate; the criterion now scopes de-duplication to a single move, and a second criterion covers the drawing shedding no loose text |
| F2 | major | accepted | Genuine gap. FR5 never said which month is active on arrival, so "press Right" had no defined starting point, and it never said whether the outline sits on the chart or on a bar. Both are observable behaviour a tester must be able to check. | FR5 — prose and four new criteria: the outline sits on the chart as a whole, February 2024 is read on arrival with its panel, Escape closes the panel, and re-entry starts at February again |
| F3 | minor | accepted | Straight wording bug: "tapping elsewhere or another month dismisses it" contradicts "tapping a month shows its panel". | FR4 — prose plus criteria splitting the three touch outcomes: tap opens, tap on another month replaces, tap outside dismisses |
| F4 | minor | accepted | Missing state, which this project's triage rules accept by default — and a stale panel left over the chart after Tab is exactly the kind of defect that ships. | FR4 — a criterion clearing the panel when the outline leaves; FR5 — Escape closes the panel while the outline stays |
| F5 | minor | accepted | "A round number" is not testable, and "at or above the largest month" did contradict "room to spare" — at a top of exactly 350 the tallest bar touches the ceiling. | FR2 — the scale is labelled in equal steps of one hundred, the top is the first step **above** the largest month, and for the supplied figures that is stated as 400 |

**Reviewer's verdict:** SHIP WITH FIXES — "Resolve the accessibility and interaction ambiguities so implementation and QA agree on observable behavior."

All five accepted; nothing rejected, nothing deferred, no blockers. Acceptance criteria went from 36 to 44.

**Consequence for the tech stage:** F5 turns the owner's "automatic axis" decision (grill D4) into a checkable outcome — the top must be the first hundred *above* the largest month, so 400 for these figures. If the charting library's own automatic domain picks something else (grill risk R1), the ticks have to be set explicitly to satisfy FR2. That is now a spec requirement, not a preference.

## Tech-doc review 2026-09-23

Review: `reviews/spec-codex-20260923-0053.md` — reviewer **codex**, effort low, kind spec (functional + technical), base main. Cross-vendor, no fallback. Verdict **DO NOT SHIP**.

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major | accepted | Correct, and the worst kind of mistake: I wrote "accepted as low severity" about something FR5-AC2 requires outright — February's column tinted the moment the outline arrives. A spec criterion is not mine to downgrade in a risk table. The tint must be driven by our own index, not Recharts' hover. | tech §2.7 (tint drawn by us from `index`, `cursor={false}`, with the geometry to place it), §3 R-4 rewritten, §4 (RED test: hover June → focus → February) |
| F2 | major | accepted | Correct that the listener contradicted the criterion — testing the widget root leaves a tap on our own legend or padding unhandled. It also exposed that the criterion itself was untestable: a tap inside a column but above the bar selects that month, which is the behaviour we want. So both sides moved. | tech §2.7 (the plot area is the hit area; everything else dismisses), functional FR4 prose + two criteria naming the legend and the surrounding space, Change Log |
| F3 | major | accepted | Correct, and it catches a layout that only held by luck: with `flex: 1 1 auto` the plot keeps its height at 375 solely because our three legend entries happen to fit one line. A longer name, larger type or a 320 px screen would break FR8-AC3. | tech §2.6 (the plot takes a fixed `--chart-plot-h`; the card may grow), §2.2 (new token), §4 (measure the plot at both widths with the real legend) |

**Reviewer's verdict:** DO NOT SHIP — "The technical plan contradicts required selection, touch-dismissal and responsive-layout behavior."

All three accepted; nothing rejected or deferred. Two are plan-only changes; F2 also amended the functional spec, which is why it carries a Change Log entry. Acceptance criteria went from 44 to 45.
