# Triage — spec 001

## Review `spec-codex-20260921-1837.md` (codex, effort low) — 2026-09-21

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major | accepted | Missing failure timing is a "missing state" class finding: no timeout, no retry delay, no anchor for the 2-second deadline, and `delay`+`fail` undefined. | functional-spec.md FR2 text + AC (combined switches), FR4 text (10 s timeout, retry within 0.5 s, deadline anchored to the second failure, worst case ≈21 s) + 3 ACs, FR6 text + AC |
| F2 | major | accepted | `architecture.md` §2 still said "serves it as-is" while the spec (grill D2) chose the `{ months, company }` envelope; two documents, one contract. | context/product/architecture.md §1 "Shared contracts", §2 "Data shape"; spec header Sources line |
| F3 | minor | accepted | "Failure switch removed" recovery is untestable without a reload; Retry keeps the switches it was opened with. | functional-spec.md FR4 text (Retry keeps address switches) + replaced AC (recover by restarting the service) + new AC (Retry with `?fail=1` fails again) |
| F4 | minor | accepted | Product definition §2.1 allows childless nodes; the spec never said whether they are valid or a wrong shape. | functional-spec.md FR2 text (leaf rule + precise wrong-shape definition) + AC, FR4 AC (childless level loads), FR5 AC ("Company · 0 branches") |
| F5 | minor | accepted | The "under 1 second" bound was a fix for "immediately" and asserts latency, not switch handling. | functional-spec.md FR2 production AC and FR6 production AC now check the switch is not honoured (`?delay=10000` does not wait) instead of an absolute time |

Reviewer verdict: **SHIP WITH FIXES** — all five fixes applied; no blockers; no user decision required.
