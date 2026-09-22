# react-frontend — spec 002 table sections

**How this was verified.** A throwaway prototype of the real DOM (Card → scroller → `<table role="treegrid">`, the shipped `data.json`, the tokens from `tokens.md`) served from the scratchpad on **port 5373** and driven with the Playwright MCP (Chrome 153). Port 5273 was deliberately avoided: `apps/web/e2e/playwright.config.ts` runs its own server there with `reuseExistingServer: false`, so a stray process would fail the web gate. Server stopped, `git status` clean, no project files touched. ESLint claims were checked by running `linter.verify` against the repo's own `eslint-plugin-jsx-a11y` flat config; axe claims by loading `axe-core@4.11.0` into the prototype.

---

## 1. The DOM shape (R1) — proven

**The structure that works** — the scroll container is a plain `<div>` *inside* the Card, not the Card itself:

```
<Card label="Monthly detail">           section, overflow: clip, border-radius: 8px   ← unchanged shared/ui
  <div class={scroller}>                overflow-x: auto; overflow-y: hidden
    <table role="treegrid">             border-collapse: separate; border-spacing: 0; table-layout: fixed
      <thead><tr><th scope="col" class={name}>…      position: sticky; left: 0; z-index: 2
      <tbody><tr aria-level …><th scope="row" class={name}>  position: sticky; left: 0; z-index: 2
```

Requirements, each one load-bearing:

- **`border-collapse: separate; border-spacing: 0`.** With `collapse`, sticky cells lose their borders in Blink. Consequence: `tr` borders are never painted, so the row divider goes on the **cells** (`th, td { border-block-end: 1px solid var(--color-line) }`, dropped on `tbody tr:last-child`).
- **`position: sticky; left: 0` on the name `th` in both `thead` and `tbody`**, each with an **opaque** background and `z-index: 2`. The months are unpositioned, so 2 is enough; nothing else in the table is positioned.
- **The Card's `overflow: clip` must stay clip.** It is an ancestor *of* the scroller, not between the sticky cell and its scrollport, so stickiness resolves against the scroller. The radius survives because the Card still clips (measured: `border-radius: 8px`, name cell pinned at exactly `0 px` from the card's left edge at `scrollLeft = 400`).
- **Do not make the Card the scroller.** It *works* (measured: `overflow: auto / hidden`, radius kept, sticky holds, `scrollWidth 1133 / clientWidth 343`), but `overflow-x: auto` forces `overflow-y` to compute away from `visible` — measured `auto/visible → auto/auto` and `auto/clip → auto/hidden`. That would make every Card a scroll container, including the chart's, and break D15's "card grows, page scrolls". `Card` stays a dumb shell; the scroller is `widgets/clients-table`'s concern.

**Measurements.** 1440: card 1408, name column **264.0**, twelve months **95.3** each, row **56**, header **56**, `scrollWidth === clientWidth === 1408` (nothing scrolls), page `scrollWidth 1440 === clientWidth 1440`. 375: card 343, scroller `clientWidth 343 / scrollWidth 1133`, page `scrollWidth 375 === clientWidth 375` — **no page horizontal scrollbar** (FR6-AC1/AC4).

**Two non-obvious consequences.**

1. **The focus ring cannot live on the `<tr>`.** Screenshot `shot-1440-row-focus.png`: the outline on a focused row is painted, but the opaque `z-index: 2` sticky name cell paints *over* it — the ring visibly starts at x = 280. Draw it on the cells instead (verified in `shot-1440-row-focus-fixed.png`):
   ```css
   tbody tr:focus-visible { outline: none }
   tbody tr:focus-visible > *              { box-shadow: inset 0 2px 0 var(--c), inset 0 -2px 0 var(--c) }
   tbody tr:focus-visible > *:first-child  { …, inset  2px 0 0 var(--c) }
   tbody tr:focus-visible > *:last-child   { …, inset -2px 0 0 var(--c) }
   tbody :is(th, td):focus-visible         { outline: var(--focus-ring); outline-offset: -2px }
   ```
   Inset/negative-offset also means `overflow-y: hidden` on the scroller never clips the ring on the first or last row.
2. **Row hover must be pre-composited on the sticky cell.** A translucent `background: var(--color-row-hover)` on an opaque sticky column lets the scrolled month cells show through it. Measured equivalent: `color-mix(in srgb, var(--color-text) 4%, var(--color-surface))` → `color(srgb 0.9631 0.9631 0.9630)`. Apply hover to the **cells** (`tr:hover > th, tr:hover > td`), never to the `tr`.

**Sticky-edge shadow (FR6-AC2/AC3).** `box-shadow` on the sticky cell itself, gated by a data attribute set from a passive `onScroll` — `.scroller[data-scrolled='true'] th.name { box-shadow: var(--shadow-sticky-edge) }`. A `::after` ledge with `translateX(100%)` was tried first and is invisible; the direct box-shadow renders (`shot-375-shadow.png`) and is trivially assertable in Playwright.

---

## 2. Component boundaries and APIs

**Recommendation: both, layered** — one headless engine plus a compound surface built on it, with the `TreeGridApi` type as the seam. A props-getter hook alone makes every consumer re-derive the markup and re-discover that `aria-expanded` must be *absent* on leaves; compound components alone bury the engine where it can only be tested through a DOM. Layering gives one exhaustively unit-tested reducer and one ergonomic JSX surface, and it is the answer that reads as a real team's.

```
shared/ui/tree-grid/
  index.ts                     public API (the only import path)
  model/types.ts               TreeGridRow, TreeGridCursor, TreeGridApi
  model/keyboard.ts            pure reducer (cursor, key, rows) → next cursor | toggle   ← no DOM
  model/use-tree-grid.ts       cursor state, roving tabindex, focus effect, scroll-into-view
  model/use-expanded-ids.ts    generic Set<string> state + toggle
  ui/tree-grid.tsx             TreeGrid (scroller + table + stable context)
  ui/tree-grid-row.tsx         TreeGrid.Row       (tr, the four ARIA attributes)
  ui/tree-grid-row-header.tsx  TreeGrid.RowHeader (sticky th, sets --tree-grid-level)
  ui/tree-grid-cell.tsx        TreeGrid.Cell      (td + headers)
  ui/tree-grid-head.tsx        TreeGrid.Head / TreeGrid.ColumnHeader
  ui/tree-grid-toggle.tsx      TreeGrid.Toggle    (the chevron — "expandable" is a tree concept)
  ui/tree-grid.module.css
```

```ts
export type TreeGridRow = {
  id: string; parentId: string | null;
  level: number; posInSet: number; setSize: number;   // 1-based
  hasChildren: boolean;
};
export type TreeGridCursor = { rowId: string; colIndex: number };   // -1 = the row itself
export type UseTreeGridOptions = {
  rows: readonly TreeGridRow[];            // already flattened to the VISIBLE rows
  columnCount: number;
  expandedIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  cellId: (rowId: string, colIndex: number) => string;   // also the `headers` ids
};
export type TreeGridApi = {
  cursor: TreeGridCursor;
  getTreeGridProps: () => { role: 'treegrid'; onKeyDown: KeyboardEventHandler };
  getRowProps: (row: TreeGridRow) => { … };
  getRowHeaderProps: (row: TreeGridRow) => { … };
  getCellProps: (row: TreeGridRow, colIndex: number) => { … };
  moveTo: (cursor: TreeGridCursor) => void;
};
```

The context carries only **stable** values (columnCount, `cellId`, `onToggle`, the keydown handler). The cursor is **not** in context — see §10. `shared/ui/tree-grid` never imports a client type; it takes `TreeGridRow` and renders what it is given, exactly as architecture §6 requires.

**The widget** (`widgets/clients-table`) owns: `useClientsQuery` → tree; `useExpandedIds([company.id])`; `flattenVisibleRows`; `useTreeGrid`; and it renders `<TreeGrid>` with a `<NameCell>` of its own (chevron slot, `Avatar` for advisers, indent, ellipsis) plus twelve `<TreeGrid.Cell>`. It is the only place `entities/clients` and `shared/ui/tree-grid` meet.

**One deviation to rule on.** Architecture §1 says "expanded row ids live in the tree-grid hook". Flattening needs those ids *before* the grid renders, so the hook must be **controlled**: `useExpandedIds` ships from `shared/ui/tree-grid` (generic), but the value is held by the widget. Same layer, clearer data flow, testable without a DOM — please confirm rather than let the lane decide silently.

---

## 3. The row model

`entities/clients/model/flatten-rows.ts` — pure, no DOM, no React:

```ts
export type ClientRowKind = 'company' | 'branch' | 'adviser' | 'channel';
export type ClientRow = TreeGridRow & { kind: ClientRowKind; name: string; values: readonly number[] };
export const flattenVisibleRows = (company: TreeNode, expandedIds: ReadonlySet<string>): ClientRow[];
```

One depth-first walk using `childrenOf` from `@nevis/contracts` — the single definition of "children". `level` is 1-based (Company = 1); `posInSet`/`setSize` come from the child array being walked, so the Company row is 1 of 1. `hasChildren = childrenOf(node).length > 0`; a node is a leaf whether its list is missing or empty. `kind` is `LEVEL_KIND[level - 1] ?? 'channel'`, so "advisers get an avatar" is a business fact in `entities`, not `level === 3` guessed in the widget.

`expandedIds` is a `Set<string>` in the **widget**, seeded `new Set([company.id])` (FR1: the Company row is open on load), toggled by id. Independent by construction (D2); collapsing a branch leaves its descendants' ids in the set but they stop being reachable, and re-opening shows them closed — which is FR2-AC3 only if the descendants are *pruned* on collapse. They must be: `toggle` deletes the id **and** every descendant id, or `flattenVisibleRows` stops descending at a closed ancestor and the stale ids resurface on re-open. Prune on collapse; it is one line and it is what the criterion asks for.

ARIA derivation, all in `TreeGrid.Row`, all from `TreeGridRow`:

| Attribute | Value |
|---|---|
| `aria-level` | `row.level` |
| `aria-posinset` | `row.posInSet` |
| `aria-setsize` | `row.setSize` |
| `aria-expanded` | `row.hasChildren ? String(expandedIds.has(row.id)) : undefined` — **absent** on leaves (FR4-AC5) |

---

## 4. The keyboard model (FR3)

`model/keyboard.ts` is a pure function `(cursor, key, rows, expandedIds) → { cursor } | { toggle: string } | null`. Everything below is verified in the browser as one 19-step run; at every step exactly **one** element in the grid had `tabindex="0"`.

| Key | On a row (`colIndex === -1`) | On a figure (`colIndex ≥ 0`) |
|---|---|---|
| ↓ | next visible row, else stay | same column, next visible row, else stay |
| ↑ | previous visible row, else stay | same column, previous row, else stay |
| → | closed + `hasChildren` → **expand**; open, or leaf → **colIndex 0** | next column, stop at 11 |
| ← | open → **collapse**; closed or leaf → **parent row** (`parentId`), else stay | colIndex 0 → **back to the row**; else previous column |
| Home | first visible row (Company) | colIndex 0 |
| End | last visible row | colIndex 11 |
| Enter / Space | toggle if `hasChildren`, else nothing | **nothing** |
| Tab | not handled — leaves the grid | not handled |

Nothing wraps. Verified transitions include: ↑ on Company stays; ↓→ expands Branch 1; → again lands on "147"; →→← lands on Mar 2024 (FR3-AC5); Home/End within the row; → on the last month stays; Enter on a figure is inert (FR3-AC9); ← ← from an open Branch 1 collapses then goes to Company (FR3-AC11); End then ↓ stays on the last row.

**Roving `tabindex` without churn.** Do not write `tabindex` imperatively across 44 × 13 elements. Keep one `cursor` in `useTreeGrid`, pass **`activeColIndex: number | null`** down to each `memo`'d row (null when the row is not the cursor's). Only the previously-active and newly-active rows get a changed prop, so React re-renders **two rows** per keystroke and patches `tabindex` only where the value actually differs. Focus is applied declaratively in a `useLayoutEffect` keyed on the cursor, resolving the element by the deterministic id `cellId(rowId, colIndex)` — the same ids used for `headers` (§9), so no ref registry is needed. **Guard the effect with a `hasMovedRef`** so mounting the table does not steal focus and scroll the page on load.

**Focus restoration on collapse (FR2).** After a toggle, if the cursor's `rowId` is no longer in the freshly flattened rows, set the cursor to `{ rowId: toggledId, colIndex: -1 }`. Verified in the browser: focus on "New organic"'s Jun figure inside an open Branch 1 → click Branch 1's name → `document.activeElement` is the **Branch 1 `<tr>`**, row count 12 → 4, one `tabindex="0"`, and ↓ then moves to Branch 2 (FR2-AC6 and FR2-AC7).

---

## 5. Scrolling a focused cell into view (R2) — the sticky column defeats `scrollIntoView` alone

Measured, with the page pre-scrolled to `scrollY = 300`:

- `focus({ preventScroll: true })` + `scrollIntoView({ block: 'nearest', inline: 'nearest' })` **never moved the page vertically** — `scrollY` stayed 300 across a full 12-step walk right and back. `block: 'nearest'` is the right choice: it still scrolls a row that is genuinely below the fold, which is wanted.
- But walking **left**, the focused cell landed **underneath the sticky name column** — `cellLeft 215 / 143 / 71 / 16` against a sticky edge at 280. `inline: 'nearest'` measures the scrollport, which does not know its first 264 px are covered.

**The fix is one CSS line, verified:** `scroll-padding-inline-start: var(--tree-grid-sticky-col-w)` on the scroller. Re-running the same walk: every cell landed at exactly `left: 280` — flush with the sticky edge, never under it — and `scrollY` still never moved. No `scrollLeft` arithmetic anywhere.

**Do not rely on plain `focus()`.** Measured with the same scroll-padding in place, the default focus scroll oscillated (`215` hidden, `283` fine, `211` hidden, …): Blink's focus-scroll path does not honour `scroll-padding` the way `scrollIntoView` does. So: **`preventScroll: true` + explicit `scrollIntoView`**, always, for cells and rows alike.

---

## 6. Animation (R3) — `@formkit/auto-animate` works; the spec's word "slide" does not

Tested against **0.10.0** (current latest; `@formkit/auto-animate/react` exports `useAutoAnimate`), one hook on `<tbody>`, expanding and collapsing Branch 1 (five advisers), at 1440 and at 375 mid-scroll.

- **Insertion animates.** All five new `<tr>` carried one WAAPI animation; `position` stayed `static`; column geometry held.
- **Removal animates.** The leaving rows are re-inserted and given `position: absolute; width; height; z-index: 100; pointer-events: none`. Feared column collapse **did not happen** — with `table-layout: fixed` and explicit cell widths the departing rows kept their geometry (name cell 262 vs 264, first figure 283 vs 280 — the `scale(.98)` keyframe).
- **The sticky column survives it.** At 375 with `scrollLeft = 420`, the `th` inside an absolutely-positioned leaving `<tr>` still computed `position: sticky` at `left: 17` (vs 16) with `z-index: 2` — see `shot-375-mid-collapse.png`: the name column, the avatar and the edge shadow all hold while the rows fade.
- **`prefers-reduced-motion` is honoured, and completely.** Under `reduce`: `tbody` stayed `position: static`, **zero** animations, and collapsed rows left the DOM within 50 ms (4 rows) where the animated path still showed 9. That is FR2-AC8 exactly. Caveat found in the source: the media query is read **once**, at `autoAnimate()` time, with no `change` listener — flipping the OS setting needs a reload. Acceptable; worth one line in the doc.

**Two things to decide, not defects.**

1. FR2 says rows "slide in" and "slide out". The default keyframes are **scale + fade**; the rows *below* slide (the FLIP translate). If "slide" is to be literal for the revealed rows, pass a plugin returning `translateY` keyframes. My recommendation: accept scale+fade and soften FR2's wording, or take the plugin — do not ship a mismatch silently.
2. Leaving rows stay in the DOM for ~250 ms with stale `aria-posinset` and `tabindex="-1"`. Harmless in practice (`pointer-events: none`, and AT reads on cursor movement) but **RTL and Playwright must `waitFor` their removal** rather than counting rows immediately after a collapse.

**Verdict: adopt it.** No fallback needed. Keep the entry-only CSS fallback in the doc as the contingency if React's reconciler and auto-animate's re-insertion ever fight under rapid toggling — the cheap check is an e2e that toggles Branch 1 ten times fast and asserts the final row count.

---

## 7. The name cell

- **Indent.** `--tree-grid-level` is set on the sticky `th` as a custom property; `padding-inline-start: calc(var(--table-cell-pad-inline-start) + (var(--tree-grid-level) - 1) * var(--table-indent-step))`. Every row reserves the chevron slot (16 + 8 gap) whether or not it has children, so figures and names line up.
- **R5's open question is closed by the design itself.** Measured text offsets inside the 264 px cell: Company **40**, Branch **68**, Adviser **124**, Channel **124**. The channel's name lands on the adviser's name exactly because the channel's extra 28 px of indent replaces the adviser's 28 px avatar slot — which is what both shipped frames show ("Attribute" aligned with "Adviser", "Existing clients" aligned with "Anna Blackwood"). `tokens.md`'s 0 / 28 / 56 / 84 is correct as written.
- **Chevron.** Inline the asset as a React component with `stroke="currentColor"` (the file hard-codes `#141413`), `aria-hidden`, 16 × 16, `transform: rotate(-90deg)` when closed, transition disabled under `prefers-reduced-motion`. It lives inside the name cell and is part of the same click target (D3).
- **Avatar.** `shared/ui/avatar` — `toInitials(name)` (first letter of the first two words, uppercased) on a **light tint with `--color-text` initials**: `hsl(var(--h) var(--color-avatar-s) var(--color-avatar-l))` with `--h` from `hash(id) % 360`. Deterministic per node id, and contrast is safe for *every* hue because the foreground is near-black on an 88 %-lightness tint. This is measured, not assumed: axe flagged **`color-contrast serious`** on my first attempt (white initials on a 38 %-lightness hue) and reported **zero violations** after the swap. `aria-hidden` (D9) — the name sits beside it.
- **Truncation.** `.label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap }` plus `title={name}`. With the shipped data nothing truncates at either width — longest label "Existing clients" measures **96 px** in a 116 px slot at level 4 (FR5-AC5 holds, and the e2e should assert `scrollWidth <= clientWidth` rather than eyeball it). Note `title` on the label gives the span an accessible name; Chrome's AX tree showed `rowheader "Company"` — one announcement, not two. **`title` does not appear on keyboard focus**, so FR5-AC4 needs a CSS reveal: an absolutely-positioned full-text overlay inside the sticky cell, shown on `:hover` and `:focus-visible`, above the month cells.
- **Only the name cell toggles.** `onClick` on the `th`; the `td`s carry nothing. Verified against the repo's own lint config: `<th scope="row" onClick>` raises **no** `jsx-a11y` error (neither `click-events-have-key-events` nor `no-noninteractive-element-interactions`).

---

## 8. Tokens

Row states are now **confirmed**, not proposed — the lead's decode of node `0:1533` matches the value I had derived from `--color-text`, and `tokens.md` § "Row states" records it. Geometry from `tokens.md`; only focus and avatar remain ours to define, exactly as that section says.

```css
/* table geometry — Figma Table 1:2901 (confirmed) */
--table-row-h: 56px;
--table-header-h: 56px;
--table-name-col-w: 264px;
--table-indent-step: 28px;
--table-cell-pad-inline-start: 16px;
--table-cell-pad-inline-end: 24px;
--table-chevron-size: 16px;
--table-chevron-gap: 8px;
--table-avatar-size: 20px;
--table-month-col-min-w: 72px;          /* proposal — the only geometry not in Figma; sets the
                                           scroll width at 375 (264 + 12x72 = 1128) */

/* row states — Figma 0:1533, decoded 2026-09-22 (confirmed) */
--color-row-hover: rgba(20, 20, 19, 0.04);                        /* = half --color-line */
--color-row-hover-solid: color-mix(in srgb, var(--color-text) 4%, var(--color-surface));
                                        /* the opaque twin, required on the sticky cell — §1 */
/* opened row: no token; opening changes only the chevron's rotation */

/* ours to define — the design shows mouse states only (0:1533) and photographs (0:1414) */
--shadow-sticky-edge: 6px 0 8px -6px rgba(20, 20, 19, 0.24);       /* proposal */
--color-avatar-s: 62%;                                             /* proposal */
--color-avatar-l: 88%;                                             /* proposal */
--color-avatar-fg: var(--color-text);
```

`--focus-ring` / `--focus-ring-offset` already exist from spec 001 and are reused; only the *painting* changes (cell box-shadow, not row outline — §1). Each proposal carries the same `/* proposal */` comment style `--color-skeleton` already uses, so a real value is a one-line swap. Nothing further is needed from Figma for this feature: `0:1533` is decoded and `0:1414`'s open question (the channel indent) is answered by the two shipped PNG frames.

Small aside, not a change: axe reports `color-contrast` **incomplete** (not failing) on the twelve month headers, because `--color-text-muted` has alpha. Its flattened value `#727271` on white is ≈ 4.7 : 1, so it passes; the e2e audit must tolerate incompletes or the token be flattened one day.

---

## 9. Tests

**Vitest + RTL + user-event (mine).**

| File | Proves |
|---|---|
| `shared/ui/tree-grid/model/keyboard.test.ts` | the whole §4 table as a pure reducer — every key, both modes, every edge. FR3-AC2…AC13 |
| `shared/ui/tree-grid/ui/tree-grid.test.tsx` | Tab in once / Tab out (FR3-AC1); exactly one `tabindex="0"`; `aria-level`/`posinset`/`setsize`; `aria-expanded` **absent** on leaves (FR4-AC5); Enter/Space toggle (FR3-AC12); focus restoration on collapse (FR2-AC6/AC7); `jest-axe` |
| `entities/clients/model/flatten-rows.test.ts` | levels, position/setsize, leaf detection, descendant pruning on collapse (FR2-AC3), company-with-no-branches (FR7-AC3) |
| `entities/clients/model/initials.test.ts` | "Anna Blackwood" → "AB" (FR5-AC1), one-word and accented names |
| `entities/clients/model/format-month.test.ts` | extend: twelve headings "Feb 2024"…"Jan 2025" (FR1-AC3) |
| `widgets/clients-table/ui/clients-table.test.tsx` | figures verbatim, Company = 250 / 350 not a sum (FR1-AC2); blank first header announced "Name" (FR4-AC3); `headers` on every figure (FR4-AC2 as DOM association); clicking a figure changes nothing (FR2-AC5); mouse expand/collapse (FR2-AC1/AC2/AC4); `jest-axe` on an expanded table |
| `pages/dashboard/ui/dashboard-page.test.tsx` | extend: the table replaces the summary; skeleton and error+Retry unchanged (FR7-AC1/AC2) |

**Playwright — `testing-expert`'s, named here so the lane brief can carry them.** `e2e/table-sticky.spec.ts` (FR6-AC1…AC5: no page h-scrollbar at 375, name column pinned while `scrollLeft > 0`, shadow on and off, nothing scrolls at 1440); `e2e/table-keyboard-scroll.spec.ts` (FR3-AC14: `window.scrollY` unchanged and the cell never left of the sticky edge); `e2e/table-animation.spec.ts` (FR2-AC8, both motion settings); `e2e/table-truncation.spec.ts` (FR5-AC3/AC4 with a routed long-name fixture; FR5-AC5 with the shipped data); extend `e2e/a11y.spec.ts` with expanded states at 1440 and 375. jsdom has no layout, so truncation and sticky are genuinely browser-only.

**`[User]` device check — only a screen reader can confirm (R4).** FR4-AC1 (level, "1 of 3", expanded/collapsed read on the row), FR4-AC2 (row name + month announced with the figure), FR4-AC4 (no extra message on toggle). VoiceOver + Safari first, NVDA + Firefox if available. To make AC2 as provable as it can be short of that, give every month `th` an `id` (`col-2024-06`) and every row header an `id` (`row-<nodeId>-name`), and set `headers="col-2024-06 row-<nodeId>-name"` on each figure — explicit association that survives the `role="treegrid"` override. Verified: axe's `td-headers-attr`, `th-has-data-cells`, `aria-required-children`, `aria-allowed-attr`, `aria-valid-attr-value` and `empty-table-header` all **pass** with it, and Chrome's AX tree reads `treegrid → rowgroup → row [expanded] [level=1] → rowheader "Company" + gridcell "250"`.

One risk removed: axe's **`scrollable-region-focusable` passes** on the scroller (the `tabindex="-1"` cells inside satisfy it), so the scroll container needs no `tabindex="0"` and FR3's single tab stop is safe.

---

## 10. Performance sanity

**Memoise:** `flattenVisibleRows` (`useMemo` on `[company, expandedIds]`); the row component (`memo`, receiving `row`, `activeColIndex: number | null`, `isExpanded`, and a `useCallback`-stable `onToggle`); the month header array. **Keep the cursor out of context** — a context value that changes per keystroke re-renders all 44 rows and reconciles ~572 cells; passing `activeColIndex` as a prop from the widget's `.map` re-renders exactly **two** rows instead.

**Deliberately not:** the key reducer (pure, microseconds); `toInitials` and the tint lookup (cheaper than a cache); per-cell `memo` inside a row (the row is already the gate); `useSyncExternalStore` for the cursor (right answer at 10 000 rows, theatre at 44); and **no virtualisation** — 44 nodes today, and roadmap Phase 3 owns large tables.

---

## Risks I see

1. **FR2's "slide" vs auto-animate's scale + fade.** The spec's wording and the library's default disagree; someone will notice in review. *Cheapest check:* run the prototype's expand once and show the lead — then either take the `translateY` plugin or amend FR2 in one sentence. Decide before the lane starts, not after.
2. **`<table role="treegrid">` fails the repo's own lint.** Verified: `jsx-a11y/no-noninteractive-element-to-interactive-role` errors, because its allowlist is `table: ['grid']`. The fix belongs in the root `eslint.config.js` (`table: ['grid', 'treegrid']`) — which `react-frontend` **does not own**. *Cheapest check:* the lead adds the option to the `developer`/root lane's brief, or the lane ships one scoped `eslint-disable-next-line` with a comment. Either way it must be decided up front, or the web gate goes red on the first commit.
3. **Only Chromium was verified.** `~/Library/Caches/ms-playwright` has Chromium 1234/1243 and no WebKit or Firefox, so sticky + `scroll-padding` + the inset focus ring are proven in Chrome 153 alone. *Cheapest check:* `pnpm exec playwright install webkit` and re-run the sticky and keyboard-scroll specs once — five minutes, and it de-risks the owner's Safari/VoiceOver pass at the same time.
4. **Screen-reader announcement quality (R4 stands).** The markup is right and axe is clean, but "level 2, 1 of 3, expanded" and "Anna Blackwood, Jun 2024, 32" are claims no automated check can make. *Cheapest check:* the owner's 10-minute VoiceOver pass on the prototype-equivalent build, before the widget is polished — spec 001 already taught that this feedback arrives late and changes markup.
5. **Leaving rows linger ~250 ms in the tree.** Stale `aria-posinset` and focusable `tabindex="-1"` rows for a quarter second after a collapse; flaky row counts in tests, and a small chance a virtual cursor lands on a ghost. *Cheapest check:* one RTL test that collapses Branch 1 and asserts `findAllByRole('row')` settles to 4 — it will fail immediately if the lane forgets the `waitFor`, and it documents the window.

CONSULT react-frontend table-sections: DONE

---
_consult: react-frontend · perms: auto · model: default · 2026-09-22T14:59:32+02:00_
