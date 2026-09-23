# Triage — spec 004, The Data As Supplied, And An Uneven Company

## Spec review 2026-09-23

Review: `reviews/spec-codex-20260923-1459.md` — reviewer **codex**, effort low, kind spec, base main. Cross-vendor, no same-vendor fallback. Verdict **SHIP WITH FIXES**.

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major | accepted | Correct, and the contradiction is mine. The grill raised the overshoot case and the owner chose "remainder is zero, the bar shows the channels" (D12) — then I wrote FR3's bar-height guarantee and FR4's summing guarantee as absolutes, so the spec contradicted both itself and the decision behind it. The case cannot arise from the supplied figures, which is exactly why it was easy to leave unstated. | FR3 — an explicit exception paragraph plus two criteria (the overshoot month's bar, and an assertion that the supplied figures never trigger it); FR4 — the panel's total exempted in the same case |
| F2 | minor | accepted | Correct: "the same rule as the legend" was doing work it could not do. A legend that appeared and vanished as the pointer moved between months would be absurd, but nothing in the spec said so, and QA had no way to tell whether a zero month keeps its line. | FR4 — visibility decided once across the twelve months, with zeros kept in the panel, the screen-reader table and the announcement, plus two criteria; FR5 — the zero row stated; FR6 — restated as the series-wide rule, plus a criterion for the complete-data panel |

**Reviewer's verdict:** SHIP WITH FIXES — "Resolve the excess-total contradiction and conditional visibility rules before implementation."

Both accepted; nothing rejected or deferred. Acceptance criteria went from 22 to 27.

Worth recording for the tech stage: F1's exempted case is unreachable with the supplied figures, so it is specified but must not grow a fourth visual state (grill D12). F2's rule — one decision across the series, zeros kept — is what makes the legend stable while the pointer moves.
