# Technical Specification: Monthly Detail Table

- **Functional Specification:** `context/spec/002-monthly-detail-table/functional-spec.md`
- **Status:** Draft
- **Author(s):** Alexander Shleyko (lead); the frontend plan comes from the specialist consultation quoted verbatim in `consults/react-frontend-table-sections-20260922-145932.md`, which prototyped the real DOM and measured every claim below in Chrome 153 (Playwright MCP) — measurements are cited, not assumed.

---

## 1. High-Level Technical Approach

One stack: `apps/web`. The API, `packages/contracts` and `apps/api` are untouched; `childrenOf` already exists in contracts and stays the single definition of "children".

Three layers, exactly as architecture §6 requires:

- **`shared/ui/tree-grid`** — a headless engine plus a compound surface, knowing nothing about clients: a pure keyboard reducer, a `useTreeGrid` hook owning the cursor, roving `tabindex`, focus and scroll-into-view, and `TreeGrid` / `.Row` / `.RowHeader` / `.Cell` / `.Head` / `.ColumnHeader` / `.Toggle` components that render what they are given.
- **`entities/clients`** — the pure transform from the served tree to a flat list of visible rows, plus initials. No DOM, no React.
- **`widgets/clients-table`** — the only place those two meet: it holds the expanded ids, flattens, and renders the grid with a client-specific name cell (chevron, avatar, indent, ellipsis) and twelve figure cells.

`pages/dashboard` swaps the table card's placeholder summary for the widget; the loading, failed and empty behaviour from spec 001 is untouched.

### Decisions and assumptions

| # | Decision | Why | Rejected |
|---|---|---|---|
| D-1 | **The scroll container is a `<div>` inside the `Card`, never the `Card` itself.** `overflow-x: auto; overflow-y: hidden` on that div; the `Card` keeps `overflow: clip` and its 8 px radius, unchanged. | Measured: making the `Card` the scroller works, but `overflow-x: auto` forces `overflow-y` away from `visible` (`auto/visible → auto/auto`), which would turn *every* card into a scroll container — including the chart's — and break "the card grows, the page scrolls". Sticky still resolves correctly because the `Card` is an ancestor *of* the scroller, not between the sticky cell and its scrollport (name cell pinned at exactly 0 px from the card edge at `scrollLeft = 400`). | `Card` as scroller; a wrapper outside the card (loses the radius clip). |
| D-2 | **`border-collapse: separate; border-spacing: 0; table-layout: fixed`**, and the row divider lives on the **cells** (`th, td { border-block-end }`), dropped on the last row. | With `collapse`, sticky cells lose their borders in Blink. `fixed` is also what keeps departing rows' geometry during the collapse animation. | `border-collapse: collapse` with borders on `tr`. |
| D-3 | **Sticky name column**: `position: sticky; left: 0; z-index: 2` on the name `th` in **both** `thead` and `tbody`, each with an opaque background. | The months are unpositioned, so `z-index: 2` suffices. Measured at 375: scroller `clientWidth 343 / scrollWidth 1133`, page `scrollWidth === clientWidth === 375` — no page-level horizontal scrollbar (FR6-AC1/AC4). | |
| D-4 | **The focus ring is painted on the cells, not the row.** `tr:focus-visible { outline: none }` plus `inset` box-shadows on its children (extra inset on first/last child); a focused cell uses `outline` with `outline-offset: -2px`. | Measured: an outline on the `<tr>` is painted *over* by the opaque sticky name cell — the ring visibly starts at x = 280. Inset painting also means the scroller's `overflow-y: hidden` never clips the ring on the first or last row. | `outline` on `tr`. |
| D-5 | **Row hover is applied to the cells, and the sticky cell gets a pre-composited opaque twin**: `--color-row-hover: rgba(20,20,19,0.04)` for normal cells, `--color-row-hover-solid: color-mix(in srgb, var(--color-text) 4%, var(--color-surface))` for the sticky one. | A translucent hover on an opaque sticky column lets scrolled month cells show through it. The hover value itself is **measured from the owner's export of Figma node `0:1533`** (`context/inbox/design/tokens.md` § Row states) — and an **opened row has no background change at all**; opening rotates the chevron and nothing else. | A translucent background on `tr`. |
| D-6 | **Expansion state is controlled by the widget.** `useExpandedIds` ships from `shared/ui/tree-grid` (generic `Set<string>` + toggle), but the widget owns the value, seeded `new Set([company.id])`. **Collapsing prunes the descendants' ids.** | Flattening needs the ids *before* the grid renders, so an internal-only hook cannot work. Pruning is what makes FR2-AC3 true (re-opening a branch shows its advisers closed). **Amends architecture §1**, which says the ids live in the hook. | Uncontrolled state inside `useTreeGrid`. |
| D-7 | **Scroll-into-view is `focus({ preventScroll: true })` + `scrollIntoView({ block: 'nearest', inline: 'nearest' })`, with `scroll-padding-inline-start: var(--table-name-col-w)` on the scroller.** The guarantee is precise: **no vertical movement while the row is fully visible**, and a minimal nudge when it is not (`nearest` scrolls just far enough to show the row) — which is the wanted behaviour, not a defect, and FR3 now says so. Review 2 F2 asked for horizontal-only `scrollLeft` arithmetic instead; **rejected**, because it would leave a row the user has just moved onto sitting half off-screen with no way to see it, and because `nearest` is the only variant that does nothing when nothing is needed. The test it asked for is **adopted**: enter a month on a partly-visible row and assert the page scrolled only far enough to reveal that row. | Measured with the page pre-scrolled to `scrollY = 300`: the page never moved vertically across a full 12-step walk on a fully visible row, but walking **left** the focused cell landed *under* the sticky column (`cellLeft 215 → 16` against an edge at 280). With the one scroll-padding line every cell lands at exactly 280. Plain `focus()` oscillates — Blink's focus-scroll path ignores `scroll-padding` — hence `preventScroll` always. | `scrollLeft` arithmetic (leaves a partly-visible row unreachable visually); bare `focus()`. |
| D-8 | **`@formkit/auto-animate` 0.10.0**, one `useAutoAnimate` hook on `<tbody>`, with the `translateY` plugin from D-16. | Measured both directions at 1440 and at 375 mid-scroll: insertion and removal both animate; `table-layout: fixed` keeps departing rows' geometry; the sticky column, avatar and edge shadow hold during a collapse; under `prefers-reduced-motion: reduce` there are **zero** animations and rows leave the DOM within 50 ms. Caveat: the media query is read once at init, so flipping the OS setting needs a reload — documented, not fixed. | Hand-rolled exit animation; entry-only (kept as the contingency if the reconciler and the library ever fight under rapid toggling). |
| D-9 | **Roving `tabindex` by props, not by imperative writes.** One `cursor` in `useTreeGrid`; each `memo`'d row receives `activeColIndex: number \| null`; focus is applied in a `useLayoutEffect` keyed on the cursor, resolving the element by the deterministic `cellId(rowId, colIndex)`. A `hasMovedRef` guard stops the table stealing focus on mount. | Two rows re-render per keystroke instead of 44 (≈572 cells). Verified: at every step of a 19-key walk exactly one element in the grid had `tabindex="0"`. | A context value carrying the cursor; a ref registry. |
| D-10 | **On collapse, if the cursor's row is gone, the cursor becomes `{ rowId: toggledId, colIndex: -1 }`.** | FR2's focus recovery. Verified in the browser: focus on a channel's June figure → click Branch 1's name → `document.activeElement` is the Branch 1 `<tr>`, rows 12 → 4, one `tabindex="0"`, and ↓ moves to Branch 2. | |
| D-11 | **Explicit `headers` on every figure** (`headers="col-2024-06 row-<id>-name"`), with ids on each month `th` and each row header. | `role="treegrid"` overrides the implicit table association, so FR4-AC2's "Anna Blackwood, Jun 2024, 32" needs the explicit form. Verified: axe's `td-headers-attr`, `th-has-data-cells`, `aria-required-children`, `aria-allowed-attr`, `aria-valid-attr-value`, `empty-table-header` all pass, and Chrome's AX tree reads `treegrid → rowgroup → row [expanded][level=1] → rowheader "Company" + gridcell "250"`. | Implicit `scope` association alone. |
| D-12 | **Avatar: initials on a light tint** — `hsl(hash(id) % 360, 62%, 88%)` with `--color-text` initials, `aria-hidden`. | Contrast is safe at every hue because the foreground is near-black on an 88 %-lightness tint. Measured: axe flagged `color-contrast serious` on the first attempt (white initials on a 38 %-lightness hue) and reported **zero violations** after the swap. | White initials on a saturated hue. |
| D-13 | **The full name reveals on hover *and* keyboard focus via a CSS overlay** inside the sticky cell (absolutely positioned, above the month cells), in addition to `title`. | `title` does not appear on keyboard focus, so FR5-AC4 needs the overlay. With the shipped data nothing truncates anyway — longest label "Existing clients" measures 96 px in a 116 px slot at level 4 — so the e2e asserts `scrollWidth <= clientWidth` rather than eyeballing it. | `title` alone. |
| D-14 | **The root ESLint config gains `treegrid` to `jsx-a11y`'s allowlist for `table`**, as a **lead task before the lane starts** _(owner's decision 2026-09-22)_. | Verified against the repo's own flat config: `<table role="treegrid">` raises `jsx-a11y/no-noninteractive-element-to-interactive-role`, whose allowlist is `table: ['grid']` — the plugin's list is simply incomplete; WAI-ARIA permits `treegrid` on `table`. Doing it first keeps the lane's first commit green, and fixes it for every future table. | A scoped `eslint-disable` in the widget (hides the same rule from everything else in that file). |
| D-15 | **Verify the sticky column, scroll-padding and inset focus ring in WebKit too**: `pnpm exec playwright install webkit`, run the two browser-only specs there once. | Everything so far is Chrome-only (the cache has no WebKit), and the owner's device check is Safari + VoiceOver — the same engine. Five minutes to de-risk it. | Chromium only. |
| D-15a | **Departing rows are hidden from assistive technology the moment they start leaving**: the same auto-animate plugin sets `aria-hidden="true"` and `inert` on a node whose action is `remove`. _(Review 2 F3.)_ | Without it the collapsed descendants stay in the accessibility tree for ~250 ms carrying stale `aria-level` / `aria-posinset`, so a screen reader's virtual cursor can land on rows that are logically gone. `pointer-events: none` and `tabindex="-1"` do not hide a row from AT. The plugin from D-16 already receives every leaving node, so this is two lines in code we are writing anyway. | Leaving them exposed ("harmless"); a `MutationObserver` to catch the re-inserted nodes. |
| D-16 | **Rows literally slide**: pass auto-animate a plugin returning `translateY` keyframes for the entering and leaving rows, so the motion matches FR2's wording rather than the library's default scale-and-fade. The plugin is ~10 lines and carries its own test; under `prefers-reduced-motion` the library still skips animation entirely (measured, D-8). _(Owner's decision 2026-09-22.)_ | FR2 says "slide", and a reviewer reading the spec beside the app would notice scale-and-fade. | Accepting the default and softening FR2's wording. |
| D-17 | **`--table-month-col-min-w: 88px`**, and the last column widened by the row's end padding. _(Re-measured by the slice-1 lane; the original 72 px was wrong.)_ | At 72 px every month heading wrapped to two lines at 375 and the header row stood at 61 px against the design's 56. Two causes: a month column carries the design's 16 px inter-column gap as its own padding (leaving a 56 px box where the widest heading, "May 2024", needs 66.85 px), and the last column additionally carries the row's 24 px end padding. At 88 px all twelve content boxes are 72 px, every heading is on one line, and the divider still runs the full width of the card. **Scroll width at 375 is therefore ≈1344, not 1128** — the sticky spec must assert *that* it scrolls, never by how much. | 72 px (measured wrong). |

---

## 2. Proposed Solution & Implementation Plan (The "How")

### 2.1 `shared/ui/tree-grid` (headless engine + compound surface)

| Path | Responsibility |
|---|---|
| `index.ts` | the only import path: components, `useTreeGrid`, `useExpandedIds`, the types |
| `model/types.ts` | `TreeGridRow { id, parentId, level, posInSet, setSize, hasChildren }` (1-based level/position), `TreeGridCursor { rowId, colIndex }` (`-1` = the row itself), `UseTreeGridOptions { rows, columnCount, expandedIds, onToggle, cellId }`, `TreeGridApi` |
| `model/keyboard.ts` | **pure** `(cursor, key, rows, expandedIds) → { cursor } \| { toggle: id } \| null` — no DOM, no React; the whole §2.2 key table |
| `model/use-tree-grid.ts` | cursor state, `getTreeGridProps` / `getRowProps` / `getRowHeaderProps` / `getCellProps` / `moveTo`, the focus `useLayoutEffect` (D-9), scroll-into-view (D-7), collapse recovery (D-10) |
| `model/use-expanded-ids.ts` | generic `Set<string>` + `toggle` with descendant pruning (D-6) |
| `ui/tree-grid.tsx` | the scroller `<div>` + `<table role="treegrid">` + a context of **stable** values only (`columnCount`, `cellId`, `onToggle`, the keydown handler) — never the cursor (D-9) |
| `ui/tree-grid-row.tsx` | `<tr>` with `aria-level` / `aria-posinset` / `aria-setsize`, and `aria-expanded` **only when `hasChildren`** |
| `ui/tree-grid-row-header.tsx` | the sticky `<th scope="row">`; sets `--tree-grid-level` for the indent |
| `ui/tree-grid-cell.tsx` | `<td>` with `headers` (D-11) |
| `ui/tree-grid-head.tsx` | `TreeGrid.Head` / `TreeGrid.ColumnHeader` (`<th scope="col">` with ids) |
| `ui/tree-grid-toggle.tsx` | the chevron — "expandable" is a tree concept, so it belongs here |
| `ui/tree-grid.module.css` | sticky, borders, focus ring, hover, scroll-padding, the edge shadow |

### 2.2 The keyboard model (FR3), verified as a 19-step browser walk

| Key | On a row (`colIndex === -1`) | On a figure (`colIndex ≥ 0`) |
|---|---|---|
| ↓ | next visible row, else stay | same column, next visible row, else stay |
| ↑ | previous visible row, else stay | same column, previous row, else stay |
| → | closed + has children → **expand**; open, or **leaf** → `colIndex 0` | next column, stop at 11 |
| ← | open → **collapse**; closed or leaf → **parent row**, else stay | `colIndex 0` → **back to the row**; else previous column |
| Home | first visible row | `colIndex 0` |
| End | last visible row | `colIndex 11` |
| Enter / Space | toggle if it has children, else nothing | **nothing** |
| Tab | not handled — leaves the grid | not handled |

Nothing wraps at any edge.

### 2.3 `entities/clients` (pure)

`model/flatten-rows.ts` — `ClientRow = TreeGridRow & { kind: 'company' \| 'branch' \| 'adviser' \| 'channel'; name: string; values: readonly number[] }`, and `flattenVisibleRows(company, expandedIds): ClientRow[]`: one depth-first walk over `childrenOf`, `level` 1-based, `posInSet`/`setSize` from the child array, `hasChildren` true only when `childrenOf` is non-empty (a missing *or* empty list is a leaf). `kind` comes from the level so "advisers get an avatar" is a business fact here, not `level === 3` guessed in the widget. `model/initials.ts` — `toInitials(name)`: first letter of the first two words, uppercased.

### 2.4 `widgets/clients-table`

Owns: `useClientsQuery` → tree; `useExpandedIds(new Set([company.id]))`; `useMemo(flattenVisibleRows)`; `useTreeGrid`. Renders `<TreeGrid>` with a `NameCell` of its own (chevron slot always reserved so names and figures line up; `Avatar` for advisers; indent via `--tree-grid-level`; ellipsis + reveal overlay) and twelve `TreeGrid.Cell`s. **Only the name `th` carries `onClick`** (D3 in the grill); figure cells carry nothing — verified to raise no `jsx-a11y` error. `pages/dashboard` replaces the placeholder summary with this widget and changes nothing else.

### 2.5 Tokens (`shared/styles/tokens.css`)

Geometry, all from Figma `1:2901`: `--table-row-h: 56px`, `--table-header-h: 56px`, `--table-name-col-w: 264px`, `--table-indent-step: 28px`, `--table-cell-pad-inline-start: 16px`, `--table-cell-pad-inline-end: 24px`, `--table-chevron-size: 16px`, `--table-chevron-gap: 8px`, `--table-avatar-size: 20px`, plus `--table-month-col-min-w: 88px` _(D-17, re-measured in the browser)_.

Row states, measured from Figma `0:1533`: `--color-row-hover: rgba(20,20,19,0.04)` and its opaque twin `--color-row-hover-solid` (D-5). No token for the opened row — it has no background change.

Ours to define, because the design shows only mouse states and uses photographs: `--shadow-sticky-edge: 6px 0 8px -6px rgba(20,20,19,0.24)`, `--color-avatar-s: 62%`, `--color-avatar-l: 88%`, `--color-avatar-fg: var(--color-text)` — each marked `/* proposal */` like `--color-skeleton`, so a real value is a one-line swap. `--focus-ring` / `--focus-ring-offset` are reused from spec 001; only the painting changes (D-4).

Indent check, measured against both design frames: text offsets inside the 264 px cell are Company 40, Branch 68, Adviser 124, Channel 124 — a channel aligns with its adviser because its extra 28 px of indent replaces the adviser's 28 px avatar slot. `tokens.md`'s 0 / 28 / 56 / 84 is correct as written, and grill risk R5 is closed.

---

## 3. Impact and Risk Analysis

- **System dependencies.** `pages/dashboard` (the card's contents), `shared/styles/tokens.css` (additive), the root `eslint.config.js` (D-14, lead). Spec 003's chart consumes `entities/clients` but not this widget; the chart stays company-wide (FR out-of-scope).
- **Grill R1 (sticky column) — closed** by D-1…D-3, with measurements at both widths.
- **Grill R2 (scroll-into-view) — closed** by D-7, one CSS line after a measured failure.
- **Grill R3 (animation) — closed** by D-8 and D-16 (sliding keyframes); the entry-only fallback stays documented. Cheap early check if the reconciler and the library ever fight: an e2e that toggles Branch 1 ten times quickly and asserts the final row count.
- **Grill R4 (announcement quality) — open by nature.** The markup is right and axe is clean, but "level 2, 1 of 3, expanded" and "Anna Blackwood, Jun 2024, 32" are claims no automated check can make. The owner's device check is the proof; spec 001 taught that this feedback arrives late and changes markup, so it should happen **as soon as the widget renders**, not at the end.
- **Grill R5 (design details) — closed**: hover measured, opened-row confirmed identical, channel indent explained.
- **New — one engine verified only.** Chrome 153 alone; the cache has no WebKit. D-15 fixes it, and the owner's Safari/VoiceOver pass rides on the same engine.
- **Leaving rows linger ~250 ms** in the DOM. They are `aria-hidden` and `inert` from the moment they start leaving (D-15a), so assistive technology never sees them; but they are still *in* the DOM, so every test must `waitFor` their removal rather than count rows immediately after a collapse.
- **New — the `prefers-reduced-motion` media query is read once** by auto-animate at init; changing the OS setting needs a page reload. Documented in the README, not worked around.

---

## 4. Testing Strategy

**Vitest + RTL + user-event (`react-frontend`)**

| File | Proves |
|---|---|
| `shared/ui/tree-grid/model/keyboard.test.ts` | the whole §2.2 table as a pure reducer — every key, both modes, every edge (FR3-AC2…AC13) |
| `shared/ui/tree-grid/ui/tree-grid.test.tsx` | Tab in once / Tab out (FR3-AC1); exactly one `tabindex="0"`; the three level attributes; `aria-expanded` absent on leaves (FR4-AC5); Enter/Space (FR3-AC12); Left on the closed Company row stays put (FR3-AC15, review 2 F1); focus recovery on collapse (FR2-AC6/AC7); departing rows carry `aria-hidden`+`inert` while leaving (D-15a); `jest-axe` |
| `entities/clients/model/flatten-rows.test.ts` | levels, position and set size, leaf detection, descendant pruning on collapse (FR2-AC3), a company with no branches (FR7-AC3) |
| `entities/clients/model/initials.test.ts` | "Anna Blackwood" → "AB" (FR5-AC1), one-word and accented names |
| `entities/clients/model/format-month.test.ts` | extended: the twelve headings "Feb 2024"…"Jan 2025" (FR1-AC3) |
| `widgets/clients-table/ui/clients-table.test.tsx` | figures verbatim — with a fixture whose **parent value deliberately differs from the sum of its children** (the shipped data cannot prove this, since spec 001 made every parent equal its children's sum — review 2 F4), asserting the stored value renders (FR1-AC2); the blank first header announced as "Name" (FR4-AC3); `headers` on every figure (FR4-AC2 at DOM level); clicking a figure changes nothing (FR2-AC5); mouse expand/collapse (FR2-AC1/AC2/AC4); `jest-axe` on an expanded table |
| `pages/dashboard/ui/dashboard-page.test.tsx` | extended: the table replaces the summary; skeleton and error+Retry unchanged (FR7-AC1/AC2) |

**Playwright (`testing-expert`)** — browser-only because jsdom has no layout: `e2e/table-sticky.spec.ts` (FR6-AC1…AC5), `e2e/table-keyboard-scroll.spec.ts` (FR3-AC14: `window.scrollY` unchanged on a fully visible row, the cell never left of the sticky edge; **and FR3-AC15: entering a month on a partly-visible row scrolls the page only far enough to reveal that row** — review 2 F2), `e2e/table-animation.spec.ts` (FR2-AC8 under both motion settings, and that the revealed rows move vertically — D-16), `e2e/table-truncation.spec.ts` (FR5-AC3/AC4 with a routed long-name fixture, FR5-AC5 with the shipped data), and `e2e/a11y.spec.ts` extended with expanded states at 1440 and 375. Run the sticky and keyboard-scroll specs in WebKit once (D-15). The axe audit must tolerate `color-contrast` **incomplete** on the month headers — `--color-text-muted` has alpha; flattened it is ≈ 4.7 : 1 on white, so it passes.

**`[User]` device check** — FR4-AC1, AC2 and AC4 can only be confirmed by a screen reader (VoiceOver + Safari first). Scheduled as early as the widget renders, not at the end.

**Gates** unchanged: `pnpm check:web` for the lane, `pnpm check` on the merged tree.
