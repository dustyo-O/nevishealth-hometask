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

## Review `spec-codex-20260921-1942.md` (codex, effort low) — 2026-09-21, functional + technical

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major | accepted | FR4-AC4's "within 2 seconds" after Retry contradicted the 10 s timeout × 2 attempts and the 3 s delay switch; FR6's combined-switch timing ignored the automatic second attempt. | functional-spec.md FR4 text (Retry follows the same policy, three timings spelled out) + AC4 split into immediate-failure (3 s) and hang (~20 s); FR6 text + AC3 (≈ 6.5 s, two attempts); technical-considerations.md D-6, §4 retry/timeout specs |
| F2 | major | accepted | Schema accepted a node with two populated child lists while `childrenOf` returned only the first — silently lost data in the check, table and chart. | functional-spec.md FR2 wrong-shape rule ("more than one kind of list beneath it") + FR4 AC (two-lists fixture → "Unexpected data shape"); technical-considerations.md §2.2 `.superRefine` + `childrenOf` contract + contracts test, §2.3 fixture, §4 |
| F3 | major | accepted | `pnpm check` never built or booted the API, though R1 (contracts under type stripping) and the `assets` copy are exactly the runtime risks named. | technical-considerations.md §2.3 `scripts/smoke.mjs` + `build` + `smoke` in the api `check`; §2.1 root `check:api` note; §3 R3; §4 new smoke row |
| F4 | minor | accepted | "Without the content shifting" (FR3-AC2) had no measurement in any test. | technical-considerations.md §4 `loading.spec` captures both cards' bounding boxes while loading and after, must match within 1 px at 1440 and 375 |

Reviewer verdict: **SHIP WITH FIXES** — all four applied; no blockers; no user decision required.

## Code review 2026-09-22 — `code-codex-20260922-1152.md` (codex, effort low, base main)

| # | severity | verdict | rationale | applied in |
|---|---|---|---|---|
| F1 | major (spec compliance) | accepted | FR2 says an item "carries more than one kind of list beneath it … never two of these at once"; the schema counted only non-empty lists (review 2's "populated" wording), so `employees: […]` + `channels: []` passed. Spec is the contract; strict reading loses nothing in the supplied data. Owner may overrule by amending FR2 instead. | Slice 5 — nest-backend: `TreeNodeSchema.superRefine` counts defined child keys, contracts test flipped; react-frontend: `fetch-clients.test.ts` rejection case |
| F2 | major (spec compliance, FR3-AC1) | accepted | The `role="status"` node mounted with "Loading clients…" already present; live regions announce changes, so the first announcement is unreliable. | Slice 5 — react-frontend: mount the status region empty, set the text after mount (effect), RTL asserts empty on first paint then text; screen-reader confirmation is the owner's `[User]` step |

Reviewer verdict: **SHIP WITH FIXES** — both applied via Slice 5; no rejection; no user decision required (F1 overrulable).
