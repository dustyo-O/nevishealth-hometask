# Component Review — `apps/web/src/shared/` (react-frontend)

## Verdict

`shared/` mostly does what architecture §6 asks. The small primitives (`Button`, `Card`, `Skeleton`, `VisuallyHidden`, `Avatar`, `ErrorPanel`, `cx`, `range`) are each 10–40 lines, do one thing, have no business knowledge, and are used by more than one caller or are clearly generic. `shared/api` is a tidy error taxonomy around one `getJson`, with no React in it. The tree-grid keeps its boundary where it counts: no import from `entities`/`widgets`, no client types, and a test fixture that is deliberately free of domain words (`tree-grid.test.tsx:11-22`). The keyboard model is a pure reducer and the reveal maths is a pure function. What a reviewer would notice is all in `shared/ui/tree-grid`, in this order: (1) `useTreeGrid` is 220 lines doing five jobs; (2) the "knows nothing about months" boundary holds in the code but not in the CSS token names or the comments; (3) the comments are long and read like a changelog, so the files need scrolling to understand; (4) small API rough edges: a dead parameter, an id you must pass twice, public exports nobody imports. I found no `interface` in `shared/` (`grep -rn "interface " src/shared` returns nothing). Nothing is kept alive only by its tests. One test is tautological.

Method: I read every file under `apps/web/src/shared/` (source, tests, CSS). I checked usage with `grep -rlw <symbol> src e2e` for every export in each `index.ts`. I also compared against `context/product/architecture.md` §6 and `context/spec/002-monthly-detail-table/technical-considerations.md:54-55`.

## Findings, by what a reviewer would notice first

### F1. `useTreeGrid` is one 220-line hook doing five jobs
`shared/ui/tree-grid/model/use-tree-grid.ts` holds:
1. Cursor state plus a render-time correction when the cursor's row disappears (`:60-63`, `:85-89`).
2. Focus plus scroll, including a Blink sticky-column correction (`:95-124`).
3. Scroll-to-reveal after a row opens (`:129-149`).
4. Key dispatch (`:158-187`).
5. Cursor-follows-focus (`:194-207`).

These share two refs (`latest`, `hasMovedRef`) and a `lastToggled` state. To change any one job, a reader has to keep all five in mind, and jobs 2 and 3 are the ones that need browser knowledge. The pure parts are already split out (`keyboard.ts`, `reveal.ts`, `ids.ts`); what remains is effects.

- **Seam:** `useRevealOnOpen(ids, rows, expandedIds)` returns `markOpening(id)` and takes `:129-149` plus the `openingRef` line in `toggle` (`:153`). `useFocusCursor(ids, cursor, rows, hasMovedRef)` takes `:95-124`. What stays in `useTreeGrid` is cursor, keys and focus-follow, about 90 lines.
- **Same pattern, smaller, in `ui/tree-grid.tsx:70-76`:** the component registers `@formkit/auto-animate` itself, with an 11-line comment above it (`:59-69`). A `useRowMotion(ref)` next to `row-motion.ts` would leave `TreeGrid` as markup only.
- **Cost:** about 1 h, no behaviour change. It is covered by `tree-grid.test.tsx` (keyboard, FR2 recovery), `tree-grid-motion.test.tsx` (StrictMode double-mount) and the e2e suite.
- **Risk: medium this late.** Layout-effect order matters: the focus-scroll effect must still run before the reveal-scroll effect, so the extracted hooks have to be called in the same order. Re-run the WebKit e2e afterwards.

### F2. The boundary holds in code but leaks in CSS tokens and comments
Architecture §6: "`shared/ui/tree-grid` knows nothing about clients, months or channels." No import breaks this. But:

- **CSS:** `tree-grid.module.css:32` and `:60` size columns from `--table-month-col-min-w`. The geometry comes from app-global `--table-*` tokens (`tokens.css:42-70`), not from grid-scoped parameters, so a second grid could not have a different column width without overriding globals.
- **Comments:** "months" appears at `tree-grid.module.css:1,13,25,57,87,96,103,111`, `keyboard.ts:8,49,70`, `use-tree-grid.ts:110,171` and `tree-grid.tsx:42`. Data-specific counts appear too: "44 rows" (`context.ts:8`, `tree-grid.tsx:80`), "~570 cells" (`tree-grid.tsx:34`), "the Company row" (`tree-grid-row.tsx:23`), and the page's `Card` (`tree-grid.tsx:42`).

A reviewer who greps the "generic" layer for `month` gets 20 hits, and that undercuts the boundary the README claims.

- **Fix:** rename to grid-scoped properties (`--tree-grid-col-min-w`, `--tree-grid-name-col-w`, …) with fallbacks. `clients-table.module.css` (the widget, outside my slice) or `tokens.css` then sets them from the Figma tokens. Say "columns"/"figures" in the comments. Note that `clients-table.module.css:63` reads `--table-name-col-w`, so whoever owns the widget has to follow the rename.
- **Cost:** about 30 min, CSS and comments only.
- **Risk:** low. The 375 px overflow e2e and the sticky-column checks cover it.

### F3. Comments are a changelog, so files need scrolling to understand
The "why" comments are valuable. The problem is the measurement history mixed into them:
- `use-tree-grid.ts:108-118`: 11 lines on a Chrome 153 re-measurement on 2026-09-22, "At 72 px it fitted, so the original measurement was right when it was taken", guarding a 4-line `if`.
- `tree-grid.tsx`: 113 lines, about 35 of them comment.
- `row-motion.ts:46-60`, `tree-grid.module.css:64-73` and `:83-90`, and `tree-grid-row.tsx:20-28` are the same pattern.

Someone meeting `TreeGrid` for the first time reads a history of bugs before seeing the markup. That is question 1 of the brief ("needs scrolling to understand").

- **Fix:** keep the rule and the decision id (`D-7`, `D-15a`). Move the dated measurement stories into `tasks.md`, where the ledger already keeps them.
- **Cost:** 30–45 min, zero behaviour risk.
- **Keep:** the WebKit `tbody { position: sticky }` note (`css:64-73`) must survive in some form. Without it the next person "fixes" it back to `relative`.

### F4. Dead parameter kept "for the contract": `reduceKey(_expandedIds)`
`keyboard.ts:30-33` keeps an unread `_expandedIds` parameter "because it is the hook's documented call (tech doc §2.1)", and `use-tree-grid.ts:165` passes it on every keystroke. The tech doc has already diverged elsewhere:
- `technical-considerations.md:55` gives the signature as `(cursor, key, rows, expandedIds)`, while the code adds `columnCount`.
- `:54` lists `UseTreeGridOptions { …, cellId }`, while the code takes `id`.

So "the contract" is not being kept anyway. Per CLAUDE.md (spec first), amend lines 54-55 of the 002 tech doc, then drop the parameter and its argument in `keyboard.test.ts`.

- **Cost:** about 10 min.
- **Risk:** none (tsc and the unit tests prove it).

### F5. The grid and its hook are tied by a string you pass twice
The widget has to give the same `id` to `useTreeGrid({ id })` and `<TreeGrid id>`, and the same `columnCount` to both (`widgets/clients-table/ui/clients-table.tsx:46-61`). Each side rebuilds `treeGridIds(id)` independently (`use-tree-grid.ts:58`, `tree-grid.tsx:57`). If the ids differ, nothing throws: `document.getElementById` returns `null` (`use-tree-grid.ts:100-101`) and focus stops moving. The hook also returns `gridProps` (`:214-217`), but `TreeGrid` takes `onKeyDown`/`onFocus` as separate props, so the caller unpacks them by hand (`clients-table.tsx:60-61`).

- **Fix:** have `gridProps` carry `{ id, columnCount, onKeyDown, onFocus }` so the call site is `<TreeGrid {...grid.gridProps} label=… head=…>`. That leaves one source of truth.
- **Cost:** about 20 min, touching this slice, the widget and the test `Grid` helpers.
- **Risk:** low.

### F6. Public `index.ts` exports that no one outside the slice imports
`grep -rlw` over `src` and `e2e` finds no importer outside the slice for:
- **`shared/ui/tree-grid/index.ts`:** `reduceKey`, `ROW_COL_INDEX`, `TreeGridCursor`, `TreeGridApi`, `UseTreeGridOptions`, `UseExpandedIds`. Only internal files and their own tests use them; the widget imports only `TreeGrid`, `useExpandedIds` and `useTreeGrid`.
- **`shared/api/index.ts`:** `withTimeout`, `TimedSignal`, `isApiError`, `ApiErrorKind`, `QUERY_DEFAULTS`, `QueryDefaults`, `RETRY_DELAY_MS`, `REQUEST_TIMEOUT_MS`, `GetJsonOptions`, `ApiError`, `HttpError`, `NetworkError`, `TimeoutError`. Outside users exist only for `getJson`, `UnexpectedShapeError`, `describeError` and `createQueryClient`.

None of this is dead code, since everything is used inside its own slice. But a public surface twice the size of what is used makes it look like more API than there is.

- **Fix:** trim the two index files to what is imported, and keep the rest file-local. Leave the hook return and option types exported if you like, because they describe the public hooks.
- **Cost:** 10 min, zero risk (tsc proves it).

### F7. One tautological test
`shared/api/query-client.test.ts:27-30` ("exposes the spec numbers as constants") only asserts that `REQUEST_TIMEOUT_MS === 10_000` and `RETRY_DELAY_MS === 500`. The first test in the same file already pins `retryDelay: 500` through the real client. It guards nothing that the constants' definitions don't already say.

- **Fix:** delete the test.
- **Cost:** 1 min.

### F8. Small API naming: `TreeGrid.ColumnHeader name`
`tree-grid-head.tsx:20-31` uses a boolean discriminant called `name`, so the call site reads `<TreeGrid.ColumnHeader name>` (`clients-table.tsx:65`). That looks like a prop missing its value, and "name" already means the row label elsewhere in the grid.

- **Fix:** rename it to something like `rowHeaders` or `nameColumn`.
- **Cost:** 5 min, touching the widget and two tests.
- **Priority:** low; do it only if F5 is being done anyway.

### F9. Cosmetic inaccuracies in `avatar`
- `avatar/hue.ts:3` says "FNV-1a, unsigned", but `:17` folds with `Math.abs` on a signed Int32, so `h` and `-h` land on the same hue. `hash >>> 0` would make the comment true. This does not affect the visuals.
- `avatar.module.css:15` talks about "a 20 px circle" while the default at `:8` is 24 px. The 20 px comes from the widget's `--table-avatar-size`.
- **Cost:** 2 min. Optional.

### Not a finding, recorded so no one acts on it
- **`Button` has one caller** (`ErrorPanel`), and **`Avatar` has one** (`widgets/clients-table/ui/clients-row.tsx`). Neither is shaped by its caller: `Button` passes through native attributes, and `Avatar` takes `initials` + `seed` with no client knowledge. Architecture §6 lists both under `shared/ui`. Keep them.
- **`ErrorPanel` repeats `Card`'s surface** (`error-panel.module.css:1-10` vs `card.module.css`). Composing `<Card>` would need `Card` to accept `aria-labelledby`, since the panel names itself from its message (`error-panel.tsx:29-31`). The saving is five CSS lines against a small a11y change. Not worth it now; it could go on the README's "next" list.
- **`shared/lib` has no `index.ts`** (imports are `@/shared/lib/cx`). FSD allows segment-level imports in `shared`, so leave it.
- **`TreeGridRow`'s `onMouseDown` `preventDefault`** (`tree-grid-row.tsx:29`) blocks text selection in the grid, but FR2-AC5..AC7 and code-review F1 require it. It stays.

## Leave this alone
- `model/keyboard.ts`: the whole keyboard model as one pure reducer (apart from F4's parameter), with a test per AC.
- `model/reveal.ts`: pure `revealDelta` split from the DOM-touching `revealRows`, a textbook seam.
- `model/use-expanded-ids.ts`: small, generic, with state held by the caller for a stated reason (D-6); pruning is tested.
- `model/ids.ts` and `model/context.ts`: one function spells every id; stable grid context vs per-row context; `activeColIndex` passed as a prop so a keystroke re-renders two rows (D-9).
- The compound API `TreeGrid.Head/ColumnHeader/Row/RowHeader/Cell/Toggle`: composable, and each part is under 65 lines.
- The domain-free tree-grid test fixture (`tree-grid.test.tsx:11-60`): it proves the boundary.
- `shared/api`: the error taxonomy (`errors.ts`), `withTimeout` with its reason for existing (`http.ts:12-17`), `createQueryClient` with overrides for tests.
- `Skeleton`, `VisuallyHidden` (polymorphic, and all three tags are used: `span`, `p`, `div`), `Card`, `Button`, `cx`, `range` (two callers).
- `styles/reset.css` and `tokens.css` (apart from the naming in F2).

---
_consult: react-frontend · perms: auto · model: default · 2026-09-23T18:43:20+02:00_
