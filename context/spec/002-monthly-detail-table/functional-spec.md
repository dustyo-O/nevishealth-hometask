# Functional Specification: Monthly Detail Table

- **Roadmap Item:** Phase 1 — Monthly Detail Table: one column per month, one row per part of the company, with rows that open to reveal the level beneath, operable from the keyboard and understandable to a screen reader.
- **Status:** Completed
- **Author:** Alexander Shleyko
- **Sources:** `context/inbox/monthly-detail-table.md` (grill decisions D1–D16), `context/product/product-definition.md`, the design ("Web engineer home task": the table frames and row variants, screenshots in `context/inbox/design/`), spec 001 (Completed) for the page around it

---

## 1. Overview and Rationale (The "Why")

A manager looking at the Clients dashboard can see the company's monthly totals, but not who they are made of. The brief's core promise — "drill from the whole company down to a single branch, advisor or acquisition channel" — is kept by this table: every month as a column, every part of the company as a row, and a row that opens to show the level beneath it.

The table is where the reviewer of this project will look hardest, because the brief asks for two things that are easy to fake and hard to do: rows that open and close **from the keyboard**, and a hierarchy that **reaches assistive technology**. So the requirements below describe not just what appears on screen but what a keyboard user can do and what a screen reader says.

Success looks like: a manager finds the branch that explains a good month in two clicks; a keyboard user does the same without reaching for a mouse; a screen-reader user hears which level they are on, how many siblings the row has, whether it is open, and — on any figure — whose row and which month it belongs to.

---

## 2. Functional Requirements (The "What")

### FR1 — The table, its columns and its levels

The table fills the lower card of the dashboard. It has one column for each of the twelve months (February 2024 to January 2025, in that order) and a first column for the name of the company, branch, adviser or acquisition channel the row describes. The first column's heading is deliberately blank in the design, so it carries no visible title.

Rows follow the shape of the business: the **Company** row first, already open when the page appears, showing its **branches**; a branch opens to its **advisers**; an adviser opens to their **acquisition channels**. Each level is indented one step further than its parent. A row with nothing beneath it is simply a row: it shows its figures and offers nothing to open.

Every row shows the figures recorded for it, exactly as they are, right-aligned, with digits that line up in columns. A figure is never recalculated from the rows beneath it.

- **Acceptance Criteria:**
  - [x] When the page has loaded, then the table shows a Company row followed by its three branch rows, each indented one step, and each showing twelve figures that match the data for those months.
  - [x] When the user reads the Company row, then its figures for February 2024 and January 2025 are 250 and 350, matching the data rather than the sum of the branches shown beneath it.
  - [x] When the user looks at the first column's heading, then it is blank, and the other twelve headings read "Feb 2024" through "Jan 2025" in order.
  - [x] Given a row has nothing beneath it (an acquisition channel, or a branch with no advisers), when the user looks at it, then it shows no control to open it.

### FR2 — Opening and closing a row with the mouse

Clicking a row's **name** — the first cell, including the arrow in front of it — opens that row, and the rows one level beneath it appear directly below it. Clicking the name again closes it, and those rows disappear along with anything opened inside them. The arrow turns to show which way the row stands.

Only the name opens and closes the row. Clicking a figure does nothing; those cells are reserved for a later feature.

Opening a row that sits low on the screen would otherwise reveal its rows below the fold, where the user cannot see what their click did. So when a row opens, the page scrolls by the smallest amount that brings the opened row and as many of its new rows as will fit into view. If more rows appear than the screen can hold, the opened row and the first of them stay in view — the user is never carried past the row they clicked.

Closing a row scrolls nothing. The one exception is not ours to control: at the very bottom of a page, closing removes the rows that were beneath the fold, and the browser moves the view up because the old position no longer exists.

Rows can be open independently: opening one branch never closes another, and any number can be open at once.

If closing a row hides whatever the user's outline is on — a row or a figure somewhere inside it — the outline moves to the row that was just closed, so the keyboard user is never left with nothing selected.

Rows slide in when they appear and slide out when they disappear. A viewer whose system is set to reduce motion sees them appear and disappear immediately instead.

- **Acceptance Criteria:**
  - [x] When the user clicks the name of Branch 1, then its five adviser rows appear directly beneath it, indented one step further, and the arrow on Branch 1 turns to its open position.
  - [ ] Given a row sits low enough on the screen that its new rows would appear below the fold, when the user opens it, then the page scrolls just enough to bring the opened row and as many of its new rows as fit into view.
  - [ ] Given a row reveals more rows than the screen can hold, when the user opens it, then the opened row is still on screen with the first of its new rows beneath it.
  - [ ] When the user closes a row, then nothing scrolls the page — though at the very bottom of a page the view still shifts, because the rows that were beneath simply no longer exist and the browser has nowhere to hold the old position.
  - [x] Given Branch 1 is open, when the user clicks its name again, then its adviser rows disappear and the arrow returns to its closed position.
  - [x] Given Branch 1 is open and Anna Blackwood inside it is open, when the user closes Branch 1, then both the advisers and Anna's channels disappear; when the user opens Branch 1 again, then Anna's row is shown closed.
  - [x] Given Branch 1 is open, when the user opens Anna Blackwood inside it, then Branch 1 stays open.
  - [x] Given a branch has no advisers recorded, when the user looks at it, then it shows no control to open it and clicking it changes nothing.
  - [x] When the user clicks a monthly figure in any row, then nothing opens, closes or changes.
  - [x] Given the outline is on one of Anna Blackwood's channel figures inside an open Branch 1, when the user closes Branch 1 by clicking its name, then the outline moves to the Branch 1 row.
  - [x] Given the outline is on an adviser row inside an open Branch 1, when the user closes Branch 1, then the outline moves to the Branch 1 row and pressing Down moves it to Branch 2.
  - [x] When a row opens or closes, then the affected rows slide in or out; given the viewer's system is set to reduce motion, when a row opens or closes, then the rows appear or disappear without movement.

### FR3 — Operating the table from the keyboard

The whole table is one stop in the page's tab order: pressing Tab moves into the table once, and pressing Tab again leaves it. Inside, the arrow keys move and open:

- Up and Down move between the rows that are currently visible, skipping anything hidden inside a closed row.
- Right moves into that row's first monthly figure, whatever state the row is in.
- Left moves to the row it belongs to, one level up; on the Company row it stays put.
- Home moves to the Company row, End to the last visible row.
- Enter or Space opens or closes the current row.

**The arrow keys never open or close anything.** Only Enter and Space do. This is a deliberate departure from the usual tree-table convention, where Right expands a closed row: with the figures reachable by keyboard as well, Right would mean two different things depending on whether the row happened to be open, and a user walking the table could not predict which. The owner found exactly that confusing when using the table with a screen reader on 2026-09-22, so the table trades convention for predictability: arrows move, Enter and Space change.

Once the user is on a figure, Left and Right move along that row's months, Left from the first figure returns to the row's name, and Up and Down move to the same month in the row above or below. Home and End move to that row's first and last month. Enter and Space do nothing on a figure — a row is opened and closed from its name, never from its figures.

Movement stops at the edges rather than wrapping: Up on the Company row, Down on the last visible row, Right on the last month, and Left on the Company row — it has nothing above it — all leave the outline where it is. Whatever the user is on carries a visible outline. Moving to a figure that is out of view brings it into view sideways; the page itself does not move up or down when the row is already fully visible, and when the row is only partly visible it scrolls just far enough to show that row and no further.

- **Acceptance Criteria:**
  - [x] When the user presses Tab from the page heading, then the outline appears on the Company row, and pressing Tab again moves out of the table entirely.
  - [x] Given the outline is on the Company row and Branch 1 is closed, when the user presses Down then Right, then the outline moves to Branch 1 and then to Branch 1's figure for February 2024, and Branch 1 stays closed.
  - [x] Given the outline is on an open Branch 1, when the user presses Right, then the outline moves to Branch 1's figure for February 2024 and Branch 1 stays open.
  - [x] Given the outline is on a row with nothing beneath it (an acquisition channel), when the user presses Right, then the outline moves to that row's figure for February 2024.
  - [x] Given the outline is on Branch 1's figure for February 2024, when the user presses Right twice then Left once, then the outline is on the figure for March 2024.
  - [x] Given the outline is on Branch 1's figure for February 2024, when the user presses Left, then the outline returns to Branch 1's name.
  - [x] Given the outline is on Branch 1's figure for June 2024, when the user presses Down, then the outline moves to the June 2024 figure of the row beneath.
  - [x] Given the outline is on Branch 1's figure for June 2024, when the user presses Home, then the outline moves to that row's February 2024 figure, and pressing End moves it to January 2025.
  - [x] Given the outline is on any figure, when the user presses Enter or Space, then nothing opens or closes and the outline stays where it is.
  - [x] Given the outline is on the last visible row's figure for January 2025, when the user presses Down and then Right, then the outline stays on that same figure.
  - [x] Given the outline is on the Company row, when the user presses Left, then the outline stays on the Company row.
  - [x] Given the outline is on an open Branch 1, when the user presses Left, then the outline moves to the Company row and Branch 1 stays open.
  - [x] Given the outline is on one of Branch 1's advisers, when the user presses Left, then the outline moves to the Branch 1 row.
  - [x] Given the outline is on any row that has children, when the user presses Enter, then the row opens, and pressing Space closes it again.
  - [x] Given the outline is on a row with nothing beneath it, when the user presses Enter or Space, then nothing opens and the outline stays where it is.
  - [x] Given the outline is on a row deep in the table, when the user presses Home, then the outline moves to the Company row, and pressing End moves it to the last visible row.
  - [x] Given the row is fully visible and the window is narrow enough that later months are out of sight, when the user moves the outline onto one of them, then it scrolls into view sideways and the page does not scroll up or down.
  - [x] Given a row is only partly visible because the page is scrolled, when the user moves the outline onto one of that row's months, then the month scrolls into view sideways and the page scrolls only as far as needed to bring that row fully into view.
  - [ ] When the outline moves to a row or a month that the page must scroll to reach, then it comes to rest clear of the window's edge rather than flush against it.

### FR4 — What a screen reader reports

A screen reader reading a row says which level it is on, its position among the rows at that level, and — when the row can open — whether it is open or closed. Moving between rows and levels therefore tells the user where they are in the hierarchy without them having to guess from indentation they cannot see.

On a monthly figure, the reader announces whose row it belongs to and which month it is, so a figure is never read as a bare number. The blank first heading is still named for assistive technology, as "Name".

When a row opens or closes, the reader says so as part of announcing the row — the table adds no separate message of its own.

- **Acceptance Criteria:**
  - [x] When a screen reader reads Branch 1, then it reports the row's name, that it is at level 2, that it is row 1 of 3 at that level, and whether it is open or closed.
  - [x] When a screen reader reads Anna Blackwood's figure for June 2024, then it announces the adviser's name and "Jun 2024" along with the figure.
  - [x] When a screen reader reads the first column's heading, then it is announced as "Name".
  - [x] When the user opens a row with the keyboard, then the screen reader announces that the row is now open, and no other message is added.
  - [x] When a screen reader reads a row that has nothing beneath it, then it reports no open-or-closed state for that row.

### FR5 — Reading a row

An adviser's row carries a circle with that adviser's initials before the name — the design shows a photograph there, and the data holds no photographs, so initials stand in. The circle is decoration: a screen reader passes over it and reads the name.

A name too long for its column is shortened with an ellipsis on a single line, so every row keeps the same height; the full name appears when the user hovers over it **or moves the outline onto it**, and it is what a screen reader reads. When a name is revealed this way it is shown whole and legible: it sits on the row's own background, so nothing behind it shows through. On a touch screen there is no hover and no outline, so a tapped name opens its row rather than revealing itself — at the design's width none of the names in this data is shortened at all, and on a phone, where the first column is narrower, the deeper names are shortened and are reached by the means above.

- **Acceptance Criteria:**
  - [x] When the user opens Branch 1, then each adviser row shows a circle with that adviser's initials — "AB" for Anna Blackwood — followed by the name.
  - [x] When a screen reader reads an adviser row, then it reads the adviser's name without mentioning the circle.
  - [x] Given a name is wider than the first column, when the user looks at the row, then the name is shortened with an ellipsis on one line and the row is the same height as every other row; when the user hovers over it, then the full name appears.
  - [x] Given a name is wider than the first column, when the user moves the outline onto that name with the keyboard, then the full name appears.
  - [x] When the table shows the supplied data at 1440 px, then no name is shortened, because the first column is wide enough for every name at every level.
  - [x] Given the table is viewed at 375 px, where the name column is narrower, when a deep name does not fit, then it is shortened with an ellipsis and the full name is still available on hover, on keyboard focus and to a screen reader.

### FR6 — Narrow screens

Thirteen columns cannot fit on a phone. On a narrow screen the months scroll sideways **inside the table**, while the name column stays in place so the user always knows whose row they are reading. The name column itself narrows on a small screen, so that whole months fit beside it rather than a sliver of one: at the design's width it is wide enough for the deepest name, and on a phone it gives up room to the figures, which is what the user came to read. A shadow appears along the name column's edge while the months are scrolled, as the sign that there is more to see; at full width, where nothing scrolls, no shadow appears.

The page itself never scrolls sideways, at any width.

- **Acceptance Criteria:**
  - [x] When the table is viewed at 375 px wide, then the name column and at least two whole month columns are visible — no month is cut off at the right edge — and the page has no horizontal scrollbar.
  - [x] Given the table is viewed at 375 px wide, when the user scrolls the table sideways, then the month columns move while the name column stays in place, and a shadow appears along its edge.
  - [x] Given the table is viewed at 375 px wide and scrolled back to the start, when the user looks at the name column's edge, then no shadow is shown.
  - [x] When the table is viewed at 1440 px wide, then all twelve months and the names are visible at once, nothing scrolls sideways and no shadow is shown.
  - [x] When rows are opened at 375 px wide until the table is taller than the screen, then the page scrolls down normally and still never scrolls sideways.

### FR7 — While loading, and when something is wrong

The table appears inside the card that spec 001 already fills: the placeholder blocks while the figures are loading, and the error message with its Retry button if they cannot be loaded. Nothing about those states changes here — the table simply takes the place of the summary line once the figures arrive.

If the company has no branches at all, the table shows the Company row alone with its figures and nothing to open.

- **Acceptance Criteria:**
  - [x] Given the figures are slow to arrive, when the user opens the page, then the table's card shows the placeholder blocks exactly as before, and the table replaces them once the figures arrive.
  - [x] Given the figures cannot be loaded, when the user opens the page, then the error message with its Retry button appears in place of the table, and clicking Retry shows the table once the figures arrive.
  - [x] Given a company with no branches, when the figures load, then the table shows the Company row with its twelve figures and no control to open it.

---

## 3. Scope and Boundaries

### In-Scope

- The monthly table with its four levels, in the lower card of the Clients dashboard.
- Opening and closing rows by mouse and keyboard, independently, with movement when they appear and disappear.
- The full keyboard model over rows and figures, including moving into an out-of-view month.
- What assistive technology reports: level, position, open state, and the row and month behind every figure.
- Initials in place of the design's adviser photographs; shortened long names.
- Sideways scrolling of months with the name column held in place on narrow screens.

### Out-of-Scope

- The stacked monthly chart (roadmap: "Clients Trend Chart") — the next specification — and any link between the table and the chart: opening or selecting a row does not change the chart, which stays company-wide.
- Clicking a monthly figure to select or inspect it. The figures' cells are deliberately left free for that later feature, but it is not built here.
- Sorting, filtering, searching, resizing or hiding columns, paging, and any handling for very large tables (roadmap Phase 3).
- Remembering which rows were open between visits, and any other persistence — spec 001 settled that the dashboard remembers nothing.
- Exporting or printing the table.
- Any change to the data or to how it is served (spec 001, Completed).
- The README's assumptions and next-steps sections (roadmap: "Ship-Ready").
- Any other roadmap item.

### Assumptions to challenge

- _(assumption)_ Figures appear exactly as recorded, with no thousands separators and no totals calculated from the rows beneath.
- _(settled 2026-09-23, was an assumption)_ Opening a row brings what it reveals into view: the page scrolls the least it can so the opened row and as many of its new rows as fit are on screen. Closing a row still moves nothing, except when it would hide the outline, which moves to the row just closed (FR2).
- _(assumption)_ The card grows as rows open, and the page scrolls; the table never scrolls up and down inside its own box.

---

## Change Log

- [2026-09-23] — the owner using the finished table — **FR2: opening a row brings what it reveals into view, and FR3: the outline never rests flush against the window's edge.** The spec had recorded "nothing jumps into the newly revealed rows" as an assumption to challenge, and the owner challenged it: measured at 1440×700, opening Branch 1 while it sat low on the screen left three of its five advisers below the fold and scrolled nothing, so the click appeared to do very little. Opening now scrolls the least it can to show the opened row and as many new rows as fit; closing still scrolls nothing. Separately, the outline already scrolled itself into view but came to rest exactly on the window's edge, which reads as cut off — it now stops clear of it.

- [2026-09-23] — spec 004, which restores the payload the brief supplies — **FR2: independence is shown with a row that still has children.** The criterion read "when the user opens Branch 2, then Branch 1 stays open", and in the supplied data Branch 2 has no advisers and cannot be opened at all. It now opens Anna Blackwood inside Branch 1, which tests the same independence. A second criterion is added for what a childless branch does — nothing — which the table already did correctly; it had simply never been stated, because the data we had invented gave every branch children.


- [2026-09-22] — the acceptance suite's 375-px run — **FR5: a revealed name is shown whole, on its own background.** The prose still claimed no name is ever shortened "at either width", which the narrower phone column had made untrue; it now says which width is which. The same run found the reveal painting no background at all, so the figure behind it showed through ("Anna Blackwood25") — FR5's text now states that a revealed name covers what is behind it, and the criteria test for it.
- [2026-09-22] — the acceptance suite's 375-px run, and the owner's decision — **FR6: the name column narrows on a small screen.** It had kept the design's 1440-px width of 264 px, leaving 79 px beside it — less than one month column — so a figure was always clipped whatever the scroll position. The design only ever specified 1440. The name column now gives up room on a phone so whole months fit; the consequence is that the deepest names can be shortened there, which FR5's ellipsis and reveal already cover, and the criterion claiming nothing is ever shortened now applies to the design width alone.
- [2026-09-22] — the owner's screen-reader check of slice 3 — **FR3: the arrow keys no longer open or close rows.** Right moved into the figures on an open row but expanded a closed one, so its meaning depended on state and the owner found it confusing to navigate with VoiceOver; Left had the mirror problem. Right now always moves into the figures, Left always moves to the parent, and Enter/Space are the only keys that change the table's shape. This departs from the usual tree-table convention, deliberately and for a tested reason.

_Dated amendments made after the spec was first written — typically by `/awos:spec` in Update Mode when a bug fix changed documented behavior. Each entry records the date, the source reference (bug id or fix description), and what behavior changed and why. Leave empty until the first amendment._
