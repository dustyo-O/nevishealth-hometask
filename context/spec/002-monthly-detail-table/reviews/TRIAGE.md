# Triage — spec 002

## Review `spec-codex-20260922-1451.md` (codex, effort low) — 2026-09-22

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major | accepted | A leaf row cannot open, so "Right opens it, or enters the figures if already open" left its twelve figures unreachable from the keyboard. The APG treegrid pattern moves focus to the first cell in exactly this case. | functional-spec.md FR3 key list + new AC (Right on a channel row → its February 2024 figure) |
| F2 | major | accepted | Missing state, which the triage rules accept by default: focus can sit on a descendant figure while the ancestor is closed by mouse, and the spec then required the user to "stay where they were" on an element that no longer exists. | functional-spec.md FR2 text (the outline moves to the row just closed) + 2 ACs; the assumption in §3 now carries the exception |
| F3 | minor | accepted | Home, End, Enter and Space were defined for rows only, so a tester could not say what they do on a figure; wrapping at the edges was equally undefined. | functional-spec.md FR3 (Home/End move within the row, Enter/Space do nothing, movement stops at the edges) + 3 ACs |
| F4 | minor | accepted (keyboard reveal); rejected (touch disclosure): a dedicated touch affordance would give the name cell a second interaction, which D3 deliberately keeps single-purpose — and it is unreachable code for this data: the longest name, "Existing clients" at the deepest level, needs ≈106 px of the 156 px available in the 264 px column, so nothing truncates at either width (checked against `context/inbox/data.json`). Documented in the spec instead. | functional-spec.md FR5 (full name on hover **or** keyboard focus; touch limitation stated) + 2 ACs, one asserting nothing truncates with the supplied data |

Reviewer verdict: **SHIP WITH FIXES** — all four addressed; no blockers; no user decision required (F4's touch half is a rejection with a checkable reason).
