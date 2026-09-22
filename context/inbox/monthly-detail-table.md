# Monthly Detail Table — grill notes 2026-09-22

Roadmap Phase 1, group 2 (`context/product/roadmap.md` L17–20). Builds on spec 001 (Completed): the page shell, `entities/clients` (query, `childrenOf`, `formatMonth`), the `Card` slots and the three states already exist. This feature replaces the table card's placeholder summary with the real thing. Sources: `context/product/{product-definition,architecture}.md`, `context/inbox/design/{tokens.md,table-levels-1-2-opened.png,table-level-3-opened.png,row-name-variants.png}`, `context/inbox/data.json`.

## Decisions

- D1: The table is a real `<table>` with `role="treegrid"` (architecture §1): one row per node, one column per month, the Company row first and expanded to its branches on load; a branch expands to its advisers, an adviser to their channels. A node with no children is a leaf — no chevron, still focusable.
- D2: Rows expand **independently** — any number open at once, matching the design's "first and second levels, opened" frame (Branch 1 open, Branches 2 and 3 closed). No accordion, no expand-all control.
- D3: **Only the name cell toggles** a row — not the whole row. The month cells stay free for a later click interaction (selecting a figure), so making the entire row a toggle would be ambiguous. The chevron sits inside that cell and is part of the same target.
- D4: Keyboard: the **full APG treegrid model, row *and* cell focus**. On a row: ↑↓ move between visible rows, → expands a collapsed row or moves into the first cell of an expanded one, ← collapses an expanded row or moves to its parent, Home/End first/last row, Enter/Space toggle. On a cell: ←→ move between cells, ← from the first cell returns to the row, ↑↓ move to the same column in the previous/next row. One tab stop for the whole table (roving `tabindex`); Tab leaves it.
- D5: Screen-reader semantics: the name cell is the **row header** (`th scope="row"`), each month is a **column header** (`th scope="col"`), so a focused figure announces as "Anna Blackwood, Jun 2024, 32". The design's blank first header carries a **visually-hidden "Name"**. Every row carries `aria-level`, `aria-posinset`, `aria-setsize`, and `aria-expanded` **only when it has children**.
- D6: Toggle feedback to assistive technology is **`aria-expanded` alone** — screen readers announce "expanded"/"collapsed" themselves. No live region; it would duplicate and talk over that.
- D7: At narrow widths the months **scroll horizontally inside the table card while the name column stays sticky**, so a row is always identifiable. The page itself never scrolls horizontally (spec 001 FR7 still holds at 375 px).
- D8: A **shadow appears on the sticky column's trailing edge only while the months are scrolled**, as the hint that there is more to the right; nothing shows at 1440 where nothing scrolls.
- D9: Adviser rows show **initials in a coloured circle** (colour derived from the node id, so it is stable), `aria-hidden` because the name sits beside it. The data carries no images; the design's avatar becomes initials rather than a fake photo. README notes it.
- D10: A name too long for its cell is **truncated to one line with an ellipsis**; the full name stays available to assistive technology and on hover (`title`). Row height stays 56 px so the table keeps its rhythm.
- D11: Rows **animate in and out** using `@formkit/auto-animate` (~2 kB, one hook on the table body), which holds exiting rows until the animation ends and honours `prefers-reduced-motion` by default.
- D12: The **chart stays company-wide** — expanding or focusing a row does not re-scope it. The table alone satisfies "drill from the whole company down"; re-scoping the chart is a README next-step, and coupling it to a chart that does not exist yet would spread this spec across two features. _(Closes product-definition open question 2.)_
- D13: Figures are shown exactly as stored, right-aligned, tabular figures (`--font-numeric`) — no thousands separators at this range, no derived totals (the parent's own stored value is what it shows). _(assumed)_
- D14: Focus stays where it was after a toggle — on the name cell (or row) that was toggled; nothing is auto-focused in the revealed rows. _(assumed)_
- D15: The card grows with the table and the page scrolls vertically; no fixed table height, no internal vertical scrolling. _(assumed)_
- D16: Loading, failed and empty behaviour is inherited from spec 001 — the skeleton, the error panel with Retry, and a company with no branches renders as the Company row alone. _(assumed)_

## Out of scope

- The stacked chart (roadmap "Clients Trend Chart" — spec 003) and any selection link between table and chart (D12).
- Sorting, filtering, search, column resizing, column hiding, pagination, virtualisation (roadmap Phase 3).
- Clicking a month cell to select or inspect a figure — the reason D3 keeps those cells free, but the behaviour itself is a later feature.
- Persisting which rows are open (across reloads, devices or sessions) — spec 001 decided against persistence of any kind.
- Exporting the table; printing.
- Changing the served data or the API contract in any way.

## Open risks

- R1: **Sticky first column inside a horizontally scrolling table, in a card with `overflow: clip`.** `position: sticky` on `th` needs the right containing block and z-index against row borders and the header row; the card's clipping has to become a scroll container without breaking the 8 px radius. Prove this first — it decides the table's DOM shape.
- R2: **Cell-level roving `tabindex` across a scroll container**: focusing an off-screen month cell must scroll it into view *horizontally only* — a naive `scrollIntoView` also scrolls the page vertically and fights the sticky column.
- R3: **`@formkit/auto-animate` on `<tbody>` rows**: it animates height and opacity on elements it owns; table rows are notorious for ignoring height transitions. Verify against a real expand of Branch 1 (five advisers) before committing to it — D11's fallback is entry-only animation.
- R4: **Announcement quality with 13 columns.** Row headers plus column headers is the right markup, but VoiceOver's reading order for a `treegrid` cell differs from a plain table; the owner's device check is the only real proof (spec 001 taught this).
- R5: **Design details not yet fetched from Figma**: row hover colours, the opened-row treatment, avatar background/ring, and the exact indent of the channel (attribute) level. `tokens.md` has the metrics but not these; fetch before the lane starts (Figma node `0:1533` Row hover states, `0:1414` Row name variants).

## Suggested acceptance criteria

- AC1: When the page has loaded, then the table shows the Company row and its three branch rows, each with its twelve monthly figures matching the data, and every branch shows a chevron because it has advisers.
- AC2: When the user clicks the name cell of Branch 1, then its five adviser rows appear directly beneath it, indented one level, and the chevron turns to its open position; when the user clicks it again, then those rows disappear.
- AC3: When the user clicks the name cell of Anna Blackwood, then her three channel rows appear, indented one further level, and clicking a month figure in any row changes nothing.
- AC4: Given focus is on the Company row, when the user presses ↓ then → then →, then focus moves to Branch 1, expands it, and lands on Branch 1's first month cell, which a screen reader announces with its row name and month.
- AC5: Given focus is on an expanded Branch 1 row, when the user presses ←, then the branch collapses; when the user presses ← again, then focus moves to the Company row.
- AC6: When the user presses Enter or Space on a row that has children, then it toggles, and a screen reader announces "expanded" or "collapsed" without any other message.
- AC7: When the table is viewed at 375 px, then the months scroll sideways inside the card while the name column stays in place with a shadow on its edge, and the page itself has no horizontal scrollbar.
- AC8: When a row is expanded or collapsed, then the affected rows animate in or out; when the viewer prefers reduced motion, then they appear and disappear instantly.
- AC9: When a screen reader reads any row, then it reports the row's level, its position among its siblings, and — if it has children — whether it is expanded.
- AC10: When an adviser row is shown, then it carries a circle with that adviser's initials, which assistive technology ignores, and the adviser's name beside it.
- AC11: When the data fails to load or is still loading, then the table card behaves exactly as spec 001 defined (skeleton, then either the table or the error panel with Retry).
