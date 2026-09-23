# Component Review — `widgets/clients-table` (react-frontend)

## Verdict

This slice is small and mostly clean. It has 4 source files: `index.ts` (1 line), `ui/clients-table.tsx` (88), `ui/clients-row.tsx` (56) and `ui/clients-table.module.css` (75). There is also one test file of 500 lines (22 tests, green). It does what architecture §6 gives a widget to do. It is the only place `entities/clients` (`flattenVisibleRows`, `formatMonth`, `toInitials`, `ClientRow.kind`) meets `shared/ui/tree-grid` (`useExpandedIds`, `useTreeGrid`, the compound `TreeGrid.*`). Neither of those layers leaks into the other through it. The public API is one export, and it has no `interface` or inline `style={{}}`. The only business decisions in the widget are two one-line checks in the row: "advisers get an avatar" and "only rows with children listen for a click". Both read facts the entity has already worked out (`kind`, `hasChildren`), so the widget decides nothing it should hand off. A reviewer is most likely to notice three things:
1. The widget fetches its own data after the page has already fetched it and gated on it. That self-fetch is the only reason the file holds two components and a `return null` guard.
2. The comments carry the debugging history (incident dates, pixel measurements, review IDs), especially in the stylesheet.
3. The tests find elements by CSS-module class-name substrings.

None of these is a boundary violation. Finding 1 is required by the 002 tech doc as written.

## Findings, by what a take-home reviewer would notice first

### F1 — The widget fetches data the page already fetched, so `clients-table.tsx` holds two components and a guard that exists only for the fetch

- **Evidence:**
  - `clients-table.tsx:21-30`: `ClientsTable` calls `readDevSwitches(window.location.search)` and `useClientsQuery(switches)`, then `if (data === undefined) return null`, then renders `ClientsGrid`.
  - The page already makes the same two calls and mounts the table only once data exists: `pages/dashboard/ui/dashboard-page.tsx:33,35,87` (`{data ? <ClientsTable /> : <TableCardSkeleton />}`).
  - The chart widget repeats the pattern (`widgets/clients-chart/ui/clients-chart.tsx:93-94`). That makes three copies of `useState(() => readDevSwitches(window.location.search))`.
  - Found with `grep -rn 'readDevSwitches\|useClientsQuery(' apps/web/src`.
- **What a reader struggles with:**
  - Why does a table read the URL? `readDevSwitches` is a dev fault-injection concern (spec 001 FR4), and a table has no reason to know about it.
  - Why is there a `return null` that the comment itself calls a "belt to that braces" (`:26`)?
  - Why are there two components in one file? `ClientsGrid` (`:42`) exists only so that `useExpandedIds(() => [company.id])` can run after the data arrives.
  - Correctness depends on a coupling nobody can see: the page and the widget must derive the same query key from the same URL, or the table silently fires a second request.
  - The same seam shows in the tests: a unit test of a table has to stub `globalThis.fetch` and wrap everything in a `QueryClientProvider` (`clients-table.test.tsx:53-61`, repeated in all 22 tests).
- **Where the seam is:** the page owns server state, and the widget takes `data: ClientsData` as a prop. That leaves `ClientsTable = ({ data }) => …` (today's `ClientsGrid` body), removes `readDevSwitches` and `useClientsQuery` from the widget, and turns the test setup into a plain `render(<ClientsTable data={fixture()} />)`.
- **Spec constraint:** `context/spec/002-monthly-detail-table/technical-considerations.md:87` (§2.4) says the widget "Owns: `useClientsQuery` → tree". The code matches the tech doc. Changing it means amending §2.4 first (CLAUDE.md: "fix the spec first"). No functional spec requires self-fetching, so the functional contract is untouched.
- **Cost:** about 30 lines across the page, this widget and its test setup, plus the same change in the chart widget if done consistently (another reviewer's slice). Keyboard/ARIA behaviour does not change. **Moderate risk this late:** it touches the page and both widgets, and the page tests and Playwright e2e must be re-run. If it is not done, one sentence in the README ("widgets read the query themselves; TanStack dedupes by key") answers the reviewer's question at no cost.

### F2 — The comments carry decision history, which makes the files look harder than they are

- **Evidence:**
  - `clients-table.module.css:14-19`: an 11-line comment for a 7-line rule, including the incident `"Anna Blackwood25", found at 375 on 2026-09-22`.
  - `clients-table.module.css:36-53`: 18 lines for one selector block, including `code review F2` and `x 84…559 against a scrollport ending at 359`.
  - `clients-row.tsx:16-22`: a 7-line JSDoc on D-9.
  - `clients-table.tsx:15-20` and `:36-41`: two narrative JSDocs.
- **What a reader struggles with:** the stylesheet is 75 lines and about 40 of them are comments. The one rule that is genuinely tricky, the `max-inline-size: calc(100cqi - var(--table-name-col-w) + 100%)` at `:63`, is explained, but the explanation is buried in the history of how it was found. A first-time reader has to scroll past the story to get the "why".
- **What to keep:**
  - One line per non-obvious rule: why `.nameSlot` has `min-block-size: 1lh` (so it does not collapse when the label turns absolute), and what the `calc` means (the visible room between the slot and the scrollport's end).
  - The `ClientsRow` note that `memo` only pays off while `row`, `months` and `onToggle` stay stable. That one is load-bearing and should stay, shortened to about 3 lines.
  - The incident narrative belongs in `tasks.md` / the commit log, where it already is (`git log -- apps/web/src/widgets/clients-table`: 0d76772, 592e76b, 7f6347a).
- **Cost:** about 15 minutes, comments only, zero behaviour risk.

### F3 — Tests find elements by CSS-module class-name substrings

- **Evidence:**
  - `clients-table.test.tsx:88`: `expect(title?.className).toMatch(/visuallyHidden/i)`.
  - `:168` and `:335`: `querySelector('[class*="label"]')`.
  - `:297`: `querySelector('[class*="avatar"]')`. This matches both the widget's `.avatar` and `Avatar`'s own module class (`shared/ui/avatar/avatar.tsx:22`), so it passes by accident of naming.
- **What a reader struggles with:** these assertions depend on how CSS Modules generates class names (`[local]` must appear in the generated name), not on what a user or assistive technology sees. A change to `generateScopedName`, or renaming `.label` to `.text`, would break 6+ tests without any behaviour changing.
- **Better handles that already exist:**
  - Avatar: `aria-hidden="true"` inside the row header (`:325` already asserts it).
  - Label: the element carrying `title` (`[title]`).
  - Visually-hidden: the accessible name, which `:85` already proves via `getByRole('columnheader', { name: 'Name' })`. That makes `:86-88` redundant with `:85`.
- **Cost:** about 20 minutes, test-only, low risk. A RED check stays easy because the assertions keep their meaning.

### F4 — The test file is 500 lines, with the same 3-line setup in every test

- **Evidence:** `mockClients(...)` + `userEvent.setup()` + `renderTable()` + `await screen.findByRole('treegrid')` recurs through the file (19 `findByRole('treegrid')` waits, plus `enterTable()` for the rest). Counted with `grep -c`.
- **What a reader struggles with:** not much. The file is well organised by FR (`describe` per FR1/FR2/FR5/FR3), and the helpers (`rowNamed`, `figuresOf`, `press`, `expectFirstMonthOf`) read well. The `press` helper (`:378-382`), which asserts the single tab stop after every key, is a nice touch.
- **Fix:** a `renderLoaded(body?)` helper that returns `user` would cut about 60 lines. If F1 is done, the `await findByRole` disappears entirely because rendering becomes synchronous.
- **Cost:** 15 minutes, low risk. Optional.

### F5 — Minor: the grid's wiring is spelled out by hand

- **Evidence:**
  - `clients-table.tsx:60-61` passes `onKeyDown={grid.gridProps.onKeyDown}` and `onFocus={grid.gridProps.onFocus}` one at a time, where `{...grid.gridProps}` says "attach the hook's props" in one move. The name `gridProps` exists for exactly that.
  - `GRID_ID` and `months.length` are each passed twice: to `useTreeGrid` (`:47,49`) and to `<TreeGrid>` (`:57,59`). The reader has to see that they must agree.
  - `onToggle: (id) => toggle(id, rows)` (`:52`) makes the caller remember to hand `useExpandedIds` the current rows.
- **Dependency, not a finding here:** the duplicated `id`/`columnCount` and the `toggle(id, rows)` signature are shaped by the `shared/ui/tree-grid` API (`model/use-tree-grid.ts:15-50`, `model/use-expanded-ids.ts:12`), which belongs to the shared/ui reviewer. In this widget, only the spread is in scope.
- **Cost:** 2 minutes for the spread. The types are compatible (the handlers take `KeyboardEvent<HTMLElement>` / `FocusEvent<HTMLElement>`, which accept the table's events). Zero risk.

### Checked and not a finding

- **Render-and-decide (Q2):** `clients-row.tsx:33` (`hasChildren ? onClick : undefined`) and `:39` (`kind === 'adviser'`) are the only branches. Each reads one entity fact and picks what to render. Moving them into `shared/ui` would teach the grid about advisers. Tech doc §2.3 (`technical-considerations.md`, "`kind` comes from the level so 'advisers get an avatar' is a business fact here") put the decision in the entity on purpose, and the widget only consumes it.
- **Logic that should be a hook (Q4):** the stateful parts are already named hooks (`useExpandedIds`, `useTreeGrid`), and `ClientsGrid` (`:43-53`) just composes them in 10 lines. Wrapping that in a `useClientsTree(data)` hook would add a file without making anything easier to read or test. The hooks are already tested in `shared/ui/tree-grid`.
- **Kept alive only by its tests:** nothing. All 5 CSS classes are used (`name`, `avatar`, `nameSlot`, `label`, `figure`). `ClientsRow` is used by `ClientsTable`. `index.ts` exports only `ClientsTable`, which the page uses.
- **Spec divergence, cosmetic:** tech doc §2.4 names a `NameCell` component. The code inlines the name cell in `ClientsRow` (`:33-48`, 15 lines). Inlining is the better call at this size. If anyone touches §2.4 for F1, drop the `NameCell` mention there too.
- **`interface`:** none (`grep -rn "interface " apps/web/src/widgets/clients-table` returned nothing). **Inline static styles:** none.

## Leave this alone

- **The `ClientsRow` memo boundary** (`clients-row.tsx:23`, fed by `grid.activeColIndexOf(row.id)` at `clients-table.tsx:82`). This is D-9: two rows re-render per keystroke, not 44. It depends on `row`, `months` and `onToggle` staying stable, so do not inline the row back into the map or add a new inline prop to it.
- **`onClick` only on the name `th`, and only when `hasChildren`** (`clients-row.tsx:33`). Tech doc §2.4 requires this ("Only the name `th` carries `onClick`"), and FR2-AC5 / FR1-AC4 test it (`clients-table.test.tsx:254-282`).
- **The reveal overlay CSS** (`clients-table.module.css:54-70`). Its selectors and `calc` are the result of two device-found bugs (FR5-AC4, code review F2). Trim the comments (F2), not the rules.
- **Seeding the expanded set with `company.id` inside the widget** (`clients-table.tsx:44`). That is FR1, a business fact, and the generic hook correctly stays ignorant of it.
- **The keyboard-integration tests** (`clients-table.test.tsx:341-500`). Their own comment at `:342-345` says why they exist: the grid's unit tests stay green even if this widget forgot to wire `onKeyDown`. They are the only proof that the wiring is there.

Verified with:
- `cat -n` of all five files in the slice
- `grep -rn 'readDevSwitches\|useClientsQuery(' apps/web/src`
- `sed -n 75,100p context/spec/002-monthly-detail-table/technical-considerations.md`
- `sed -n 20,100p apps/web/src/pages/dashboard/ui/dashboard-page.tsx`
- `shared/ui/tree-grid/{index.ts,ui/tree-grid.tsx,model/use-tree-grid.ts,model/use-expanded-ids.ts}`, read for the API shapes
- `npx vitest run src/widgets/clients-table`: 1 file, **22 passed**

---
_consult: react-frontend · perms: auto · model: default · 2026-09-23T18:43:20+02:00_
