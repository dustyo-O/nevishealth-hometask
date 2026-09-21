# <Project> — agent entry point

Read this first. It is the map; the details live in the linked files.

## What this is
<One paragraph: what the product is, for whom. Then the layout: which directories hold what.>

Product truth: `context/product/{product-definition,roadmap,architecture}.md` (AWOS).
Feature truth: `context/spec/NNN-slug/{functional-spec,technical-considerations,tasks}.md`.
Gates: see `harness.json` → `lanes.<agent>.gate` — identical to CI, run them before claiming done.

<!-- harness:start — managed by harness-kit; `install.sh --update` replaces this block, everything outside it is yours -->
## How work flows (the harness)
Every feature goes through the same pipeline. Do not skip stages; each one is a gate.

| Stage | Command | Who | Output |
|---|---|---|---|
| 0. Interrogate | `/harness:grill <idea or TKT-n>` | lead model + you | `context/inbox/<slug>.md` — decisions, not prose |
| 1. Spec | `/awos:spec` | lead model | `functional-spec.md` |
| 2. Second opinion | `/harness:review-spec NNN` | **other vendor** (Codex) → lead triages | `reviews/spec-*.md`, spec patched |
| 3. Tech | `/awos:tech` → `/harness:review-spec NNN` (again, for the tech doc) → `/awos:tasks` | lead, other vendor on the tech doc | `technical-considerations.md`, `tasks.md` with `[Agent: …]` + `[Lane: …]`; `[Lead]` for merge/review/PR steps; `[User]` / "Verify — device" for humans |
| 4. Implement | `/harness:swarm NNN` | parallel **real `claude` sessions**, one per lane, own worktree + own herdr pane | commits on `lane/NNN-*` branches, merged by the lead |
| 5. Second opinion | `/harness:review-code NNN` | other vendor → lead triages | `reviews/code-*.md`, fixes |
| 6. Verify | `/awos:verify` | lead | acceptance criteria ticked, Status: Completed |

`/harness:feature <idea>` runs 0→6 end to end, pausing at every gate for a human answer.
`/harness:lead` is the autonomous version: reads the backlog, swarms slice after slice, stops only for a human step or a red gate. Run it in a herdr pane.

## Tickets
A ticket is the **intent**, written short by the user; the spec is the **contract**. Never rewrite a ticket's description — comment and move it. Capture with `/harness:ticket bug|idea <line>` (adds the context the user would lose: spec, slice, branch, repro). Bugs take the fast lane `/harness:fix TKT-n` (failing test → fix → review → PR, spec amended if it was wrong); features take `/harness:feature TKT-n`. Branch names carry the id. `TKT` = `harness.json → ticket_prefix`.

## Non-negotiables
- The spec is the contract. If the code disagrees with the spec, fix the spec first (with the user), then the code.
- One vendor never reviews its own work. Review stages call `bin/harness/second-opinion.sh`, which runs the reviewer in its own herdr pane; if it is missing it falls back to the `reviewer` agent, but says so loudly.
- Every review finding gets a verdict in writing: `accepted` / `rejected: <why>` / `deferred: <ticket>`. Silence is not a verdict.
- Lanes are sibling sessions spawned by `bin/harness/swarm.sh`, not subagents: each has its own worktree, pane, permissions and the same hooks. They never work on `main`. `.claude/hooks/guard.sh` blocks force-pushes, `rm -rf`, and writes to `main`.
- `tasks.md` is the ledger: every sub-task ends with `_(Done <date>: what actually happened, incl. surprises)_`. Future agents read those notes.
- "Verify — device" / `[User]` sub-tasks belong to the human. Ask; never pretend.
- Sibling sessions (lanes, reviewers) close their panes when done. Whatever they produced, the lead **quotes verbatim** in its report — findings, lane reports, verdicts. A summary is not a report; the raw files stay under `context/spec/NNN-*/reviews/` and `lanes/logs/`.
<!-- harness:end -->

## Domain agents (`.claude/agents/`)
<List them. `/awos:hire` creates one; every agent named in a `[Agent: …]` tag needs an entry in `harness.json → lanes` (owned dirs + gate).>
`reviewer` (fallback second opinion) and `developer` (generic single-lane implementer) ship with the harness.

## Conventions the gates enforce
<Formatters, linters, test commands, branch naming, things never to touch (test accounts, prod).>
