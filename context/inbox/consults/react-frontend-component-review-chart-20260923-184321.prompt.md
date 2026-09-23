You are running as the **`react-frontend`** agent (`claude --agent react-frontend`): your instructions are `.claude/agents/react-frontend.md`; the skills it lists are in `.claude/skills/`. Read `CLAUDE.md` first.
This is a **consultation**, not a lane: answer the questions below in markdown. Read, search and run read-only commands as you need (verify versions and option names — do not guess). Create or edit **no files**, with one exception: when your answer is complete, write it in full to `context/inbox/consults/react-frontend-component-review-chart-20260923-184321.md` with the Write tool (that path is pre-approved), then end your turn with exactly this line:

    CONSULT react-frontend component-review-chart: DONE

The lead quotes the file verbatim — no preamble, no restating the questions; cite the files and commands you used to verify facts.

---

You are one of four reviewers reading this codebase in parallel for the **Component Review** — the last roadmap item before the take-home is sent. Each of us has a different slice; the lead collects all four reports and decides what changes. **You change nothing.**

## What you are judging against

The brief's own criterion: *"Design component APIs the way you would on a real team: composable, with clear boundaries."* The roadmap turns that into four questions:

1. **Is it concise, does it do one thing, and would someone meeting it for the first time understand it?** A component that needs scrolling to understand is a finding.
2. **Does anything render *and* decide?** If so, say where the seam is: the reusable part belongs in `shared/ui`, the feature-specific part stays with its widget.
3. **Is anything in `shared/` actually used once, and shaped by its single caller?** That is not shared; it should move back to the caller.
4. **Is any stateful or intricate logic sitting inside a component** that should be a named hook that can be read and tested on its own?

Plus: **is anything alive only because its own tests keep it alive?** That goes, and its tests with it.

## How to report

- **Evidence over opinion.** Every finding cites `file:line` and says what a reader would actually struggle with. "This is complex" is not a finding; "this component decides X, Y and Z and renders three layouts, so a reader must hold all six in mind" is.
- **Rank by what a reviewer of this take-home would notice**, most first. Be honest when a slice is fine — a short report that says "these five files are clean and here is why" is more useful than invented findings.
- **Say the cost of each fix** in a line, and flag anything that would be risky this late.
- Note where a boundary is good, not only where it is bad — the lead needs to know what not to touch.
- Do **not** propose changes that contradict a spec. The specs are in `context/spec/NNN-*/functional-spec.md`; if a boundary looks wrong but a spec requires it, say so and cite the spec.

## Rules

- **Read only. Change no file** except your own answer file. Do not run formatters or fixers.
- Read `CLAUDE.md` first, and `context/product/architecture.md` §6 for the intended FSD map.
- TypeScript house style here is `type` aliases, never `interface` — flag any `interface` you find.
- Structure your answer: a one-paragraph verdict on your slice, then findings in priority order, then a short "leave this alone" list.

## Your slice: the clients chart widget

Read **apps/web/src/widgets/clients-chart/** — every file in it, including its tests and stylesheets.

The other three reviewers have `shared/ui`, the table widget, the chart widget, and the entities/features/pages/API layers respectively, so stay inside yours; if a finding depends on something outside it, describe the dependency rather than reviewing their files.
