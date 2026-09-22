# Triage — spec 002

## Review `spec-codex-20260922-1451.md` (codex, effort low) — 2026-09-22

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major | accepted | A leaf row cannot open, so "Right opens it, or enters the figures if already open" left its twelve figures unreachable from the keyboard. The APG treegrid pattern moves focus to the first cell in exactly this case. | functional-spec.md FR3 key list + new AC (Right on a channel row → its February 2024 figure) |
| F2 | major | accepted | Missing state, which the triage rules accept by default: focus can sit on a descendant figure while the ancestor is closed by mouse, and the spec then required the user to "stay where they were" on an element that no longer exists. | functional-spec.md FR2 text (the outline moves to the row just closed) + 2 ACs; the assumption in §3 now carries the exception |
| F3 | minor | accepted | Home, End, Enter and Space were defined for rows only, so a tester could not say what they do on a figure; wrapping at the edges was equally undefined. | functional-spec.md FR3 (Home/End move within the row, Enter/Space do nothing, movement stops at the edges) + 3 ACs |
| F4 | minor | accepted (keyboard reveal); rejected (touch disclosure): a dedicated touch affordance would give the name cell a second interaction, which D3 deliberately keeps single-purpose — and it is unreachable code for this data: the longest name, "Existing clients" at the deepest level, needs ≈106 px of the 156 px available in the 264 px column, so nothing truncates at either width (checked against `context/inbox/data.json`). Documented in the spec instead. | functional-spec.md FR5 (full name on hover **or** keyboard focus; touch limitation stated) + 2 ACs, one asserting nothing truncates with the supplied data |

Reviewer verdict: **SHIP WITH FIXES** — all four addressed; no blockers; no user decision required (F4's touch half is a rejection with a checkable reason).

## Review `spec-codex-20260922-1523.md` (codex, effort low) — 2026-09-22, functional + technical

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major | accepted | The no-wrapping sentence added after review 1 said "Left on the row's name … leaves the outline where it is", which flatly contradicts "Left on an open row closes it; on a closed row it moves to the parent". The only true edge is the **closed Company row** — the root has nothing above it. | functional-spec.md FR3 edge sentence + new AC (Left on the closed Company row stays); technical-considerations.md §4 tree-grid test row |
| F2 | major | accepted in part; the proposed mechanism rejected: horizontal-only `scrollLeft` arithmetic would leave a row the user has just moved onto sitting half off-screen with no way to see it, and `block: 'nearest'` is the only variant that does nothing when nothing is needed (measured: zero vertical movement across a 12-step walk on a fully visible row). | The reviewer is right that the guarantee was imprecise and the test was missing — a row below the fold *will* nudge the page. FR3 now states both halves, and the test it asked for is adopted. | functional-spec.md FR3 text + AC split into fully-visible and partly-visible cases; technical-considerations.md D-7 (guarantee + rejection recorded) and §4 e2e row |
| F3 | major | accepted | Missing state, accepted by default under the triage rules: collapsed descendants stay in the accessibility tree for ~250 ms with stale hierarchy attributes, and neither `pointer-events: none` nor `tabindex="-1"` hides a row from a screen reader's virtual cursor. The D-16 plugin already receives every leaving node, so it is two lines. | technical-considerations.md new D-15a; §3 risk rewritten; §4 tree-grid test row |
| F4 | minor | accepted | Sharp catch: spec 001 made every parent equal the sum of its children, so asserting Company = 250/350 against the shipped fixture cannot distinguish "shows the stored value" from "sums the children". The test needs a fixture where the two differ. | technical-considerations.md §4 widget test row |

Reviewer verdict: **SHIP WITH FIXES** — all four addressed; no blockers; no user decision required (F2's rejected half has a reason a stranger can check).

## Code review 2026-09-22 — `code-codex-20260922-2234.md` (codex, effort low, base main)

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major (spec compliance, FR2/FR3) | accepted | Real divergence: a figure cell is natively focusable, so a click focuses it without moving the cursor, and the next key then acts on the stale cursor — Enter could toggle Company while the user is looking at a figure. FR2 says clicking a figure changes nothing, which must include not stealing the keyboard's place. The reviewer is also right that the existing mouse test compares HTML and so cannot see focus move. | Slice 6 — react-frontend: pointer clicks on figures no longer take focus, plus a defensive cursor sync if focus arrives another way, and a click-then-keyboard regression test |
| F2 | major (spec compliance, FR5-AC4) | accepted | The reveal is one line at `max-content`, so a name wider than what is left of the scrollport is clipped by the ancestor — and `shownWhole` compares the label against its own content, ignoring the clip, so the test passes while the text is invisible. Both the behaviour and its test are wrong. | Slice 6 — react-frontend: the reveal is constrained to the visible scrollport and wraps; testing-expert: `shownWhole` measures painted bounds against the clipping ancestor |

Reviewer verdict: **SHIP WITH FIXES** — both accepted; no blockers; no user decision required.
