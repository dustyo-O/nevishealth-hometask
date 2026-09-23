# Functional Specification: The Data As Supplied, And An Uneven Company

- **Roadmap Item:** Phase 1 — correction to "Clients Data & Dashboard Shell": serve the figures exactly as the brief supplies them, and let the dashboard handle a company whose parts are not all broken down to the same depth.
- **Status:** Draft
- **Author:** Alexander Shleyko
- **Sources:** `context/inbox/supplied-payload-non-uniform-nesting.md` (grill decisions D1–D19), the brief's own data section (`context/inbox/brief.md`), `context/product/product-definition.md`, and specs 001, 002 and 003 (all Completed) whose behaviour this one corrects

---

## 1. Overview and Rationale (The "Why")

The brief hands over a company that is deliberately uneven. Two of its three branches have no advisers listed at all, and of the five advisers in the branch that does, only one has her clients broken down by how they were acquired. The brief says so in as many words, and then says what it wants: **the dashboard has to handle that.**

We did the opposite. Reading the gaps as defects, we filled them in — inventing advisers for the two empty branches and acquisition channels for the four advisers without them — so that every part of the company looked the same depth as every other. The dashboard then had nothing uneven to handle, and the requirement quietly disappeared. This specification puts the supplied figures back and makes the dashboard meet them as they are.

Two things follow, and they pull in different directions.

The table turns out to need nothing: it was built to treat a row with nothing beneath it as a row with nothing beneath it, so the two branches and the four advisers simply appear as rows that do not open. That is the good half.

The chart is the hard half, and it turned out we had built the wrong thing. It stacked each month by acquisition channel — which is what the *design's legend* shows, not what the brief asks for. The brief asks only for "a stacked bar chart showing the data over time", over data that is a tree in which every part holds the parts beneath it. With the real figures only one adviser's clients are attributed to a channel at all, about a tenth of the company, so channel-stacking could not be drawn without inventing most of it.

So the chart shows the company sliced by **exactly the rows the table is currently showing**. On opening the page that is the three branches. Open Branch 1 and its slice divides into its five advisers; open Anna and hers divides into her three channels; close them and they merge back. "Expandable rows that reveal the level beneath" then reveals it in both halves of the page at once, which is the promise the brief opens with. The bar's height never changes as the user drills — it is always the whole company — so the scale stays still and only the composition moves.

Success looks like: a manager opening the dashboard sees three branches, two of which do not open, and is not confused by that; the figures in the table are the ones the business gave us, down to the ones that do not add up; and opening a row tells them something in the chart as well as in the table — which branch, which adviser, which channel is driving the year.

---

## 2. Functional Requirements (The "What")

### FR1 — The company as it really is

The table shows the company exactly as the business describes it. The Company row opens to three branches. **Branch 1** opens to its five advisers; **Branch 2 and Branch 3 have no advisers recorded**, so they are rows with figures and nothing to open. Inside Branch 1, only **Anna Blackwood** has her clients broken down by acquisition channel; **James Walker, Maria Gutierrez, Robert Chen and Sarah Smith** do not, so they too are rows with figures and nothing to open.

A row with nothing beneath it offers no control to open it and gives no sign that anything is hidden. Nothing about it is greyed out or marked as incomplete — it is simply a row that goes no deeper.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then the table shows a Company row followed by Branch 1, Branch 2 and Branch 3, each with twelve figures.
  - [ ] When the user looks at Branch 2 and Branch 3, then neither shows any control to open it.
  - [ ] When the user opens Branch 1, then five adviser rows appear — Anna Blackwood, James Walker, Maria Gutierrez, Robert Chen and Sarah Smith.
  - [ ] Given Branch 1 is open, when the user looks at its five advisers, then only Anna Blackwood shows a control to open her row.
  - [ ] When the user opens Anna Blackwood, then her three acquisition channels appear — Existing clients, New organic and New paid.
  - [ ] When the user tries to open Branch 2, Branch 3, or any adviser other than Anna Blackwood, then nothing opens and nothing changes.

### FR2 — The figures are the ones we were given

Every figure in the table is the one recorded for that row, shown exactly as supplied. A parent's figure is never recalculated from the rows beneath it, and the rows beneath are never adjusted to match their parent.

This matters here because the supplied figures do not always agree with each other: in several months a parent's figure differs from the sum of the rows inside it. The dashboard shows both as they are and does not choose between them. It also does not warn the user, mark the rows, or refuse to show the data — a person reading the dashboard sees the business's own numbers, and reconciling them is the business's job, not the dashboard's.

- **Acceptance Criteria:**
  - [ ] When the user reads the Company row for May 2024, then it shows 301 — the figure as supplied — even though the three branches beneath it show 76, 27 and 156, which come to 279.
  - [ ] Given Branch 1 is open, when the user reads its figure for August 2024, then it shows 214, even though its five advisers come to 216.
  - [ ] When the user looks anywhere on the page, then no warning, badge or message about figures disagreeing is shown.
  - [ ] Given figures that disagree with each other, when the user opens the page, then the dashboard loads and shows them normally rather than failing.

### FR3 — The chart shows what the table is showing

Every month's bar is the whole company, and it is divided into exactly the rows the table is displaying at their deepest open level. When the page opens, that is the three branches. When the user opens Branch 1, its slice divides into its five advisers and the other two branches are untouched. When the user opens Anna Blackwood, her slice divides into her three channels. Closing a row merges its slices back into one.

A row with nothing beneath it never divides — Branch 2, Branch 3 and the four advisers without channels each stay a single slice however much else is open.

The bar's height is the company's own figure for that month, so it does not change as the user drills, and the scale stays still. Where the displayed rows do not account for the whole company — which happens because the supplied figures do not always add up — the difference is shown as a slice named **"Not recorded"** in a neutral grey at the bottom of the bar. Where the displayed rows come to *more* than the company's figure, there is nothing left over: no "Not recorded" slice is drawn and the bar is as tall as its slices come to.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then each bar is divided into Branch 1, Branch 2 and Branch 3.
  - [ ] When the user opens Branch 1, then each bar divides that branch's slice into Anna Blackwood, James Walker, Maria Gutierrez, Robert Chen and Sarah Smith, while Branch 2 and Branch 3 each stay one slice.
  - [ ] Given Branch 1 is open, when the user opens Anna Blackwood, then her slice divides into Existing clients, New organic and New paid, and the bars now show nine slices.
  - [ ] Given Branch 1 is open, when the user closes it, then its five adviser slices merge back into one Branch 1 slice.
  - [ ] When the page has loaded, then each bar's height equals the figure the table shows on its Company row for that month.
  - [ ] When the user opens and closes rows, then the chart's scale does not change.
  - [ ] When the user reads May 2024 on opening the page, then the bar shows a "Not recorded" slice of 22 beneath Branch 1, Branch 2 and Branch 3, which come to 279 of the company's 301.
  - [ ] Given Branch 1 is open, when the user reads August 2024, then no "Not recorded" slice is drawn and the bar is 352 — its five advisers come to 216 where Branch 1's own figure is 214, so the rows shown exceed the company's 350.

### FR4 — Colour carries the hierarchy

Each branch takes one of the three colours the design uses, and everything inside that branch is a shade of its branch's colour. Opening Branch 1 divides its slice into five shades of the same colour rather than five unrelated colours, so a glance still shows which part of the bar belongs to which branch. "Not recorded" keeps its neutral grey and is never a shade of a branch.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then the three branch slices use the three colours the design gives the chart.
  - [ ] Given Branch 1 is open, when the user looks at a bar, then its five adviser slices are shades of Branch 1's own colour, and Branch 2 and Branch 3 keep theirs unchanged.
  - [ ] Given Anna Blackwood is open, when the user looks at a bar, then her three channel slices are shades of Branch 1's colour, distinguishable from each other and from her four colleagues.
  - [ ] When the user looks at a "Not recorded" slice, then it is the neutral grey and not a shade of any branch.

### FR5 — The legend and the month panel follow the chart

The legend names every slice that is drawn, in the same order as the bars, growing from three entries to nine as rows open and wrapping onto more lines as it needs to. The card grows to fit it rather than squeezing the chart.

The panel that appears when the user points at, taps or moves to a month lists the same slices with their figures, and its total is the bar's total.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then the legend names Branch 1, Branch 2 and Branch 3.
  - [ ] Given Branch 1 and Anna Blackwood are open, when the user looks at the legend, then it names all nine slices and no slice on screen is missing from it.
  - [ ] Given Branch 1 and Anna Blackwood are open, when the legend wraps onto more than one line, then the chart's plot is the same height as it was before.
  - [ ] When the user points at February 2024 on opening the page, then the panel lists Branch 1 147, Branch 2 76, Branch 3 27 and a total of 250.
  - [ ] When the user reads the panel for any month, then its figures add up to the total it shows.
  - [ ] When the user moves the pointer from month to month, then the legend does not change.

### FR6 — What a screen reader reads

The chart's figures remain available to read as a table, one row per month, whose columns are the slices currently drawn. Moving to a month announces the month, each slice with its figure, and the total.

- **Acceptance Criteria:**
  - [ ] When a screen reader reads the chart's figures as a table on opening the page, then each of the twelve rows gives Branch 1, Branch 2, Branch 3, any not-recorded figure, and the total.
  - [ ] Given Branch 1 is open, when a screen reader reads that table, then its columns are the five advisers together with Branch 2 and Branch 3.
  - [ ] When a screen-reader user moves to February 2024 on opening the page, then it announces the month with Branch 1 147, Branch 2 76, Branch 3 27 and a total of 250.

### FR7 — Rows that never divide, and data that adds up

A row with nothing beneath it is simply a slice: it cannot be opened in the table and it never divides in the chart. And if a company's figures ever added up exactly, no "Not recorded" slice would be drawn anywhere and nothing would be left over — the chart would be the rows and only the rows.

- **Acceptance Criteria:**
  - [ ] When the user looks at Branch 2 and Branch 3 in the chart at any level of opening, then each is a single slice.
  - [ ] Given Branch 1 is open, when the user looks at James Walker, Maria Gutierrez, Robert Chen and Sarah Smith, then each is a single slice that never divides.
  - [ ] Given figures in which every parent equals the rows beneath it, when the chart is shown, then no "Not recorded" slice is drawn and the legend names only the rows.

---

## 3. Scope and Boundaries

### In-Scope

- Serving and showing the figures exactly as the brief supplies them, including the months where they do not add up.
- The table meeting a company whose branches and advisers are not all broken down to the same depth.
- The chart accounting for clients whose acquisition channel is not recorded, and the legend, panel and screen-reader table that follow from it.
- Correcting specs 001, 002 and 003, and the product documents, where they describe the behaviour this specification changes.

### Out-of-Scope

- Any change to how rows open and close, to the keyboard model, or to what a screen reader is told about the table — specs 002 and 003 already cover them and the table needs no change to meet the real figures.
- Warning the user about figures that disagree, marking the rows involved, or refusing to show them.
- Changing any supplied figure, including where the design shows a different number from the data — the data wins, as it has since spec 001.
- Any way of choosing what the chart shows other than opening and closing rows in the table — there is no separate selection, and no control on a row for it.
- Designing for figures where the recorded channels exceed their parent beyond simply never drawing a negative segment.
- The README that explains this reversal (roadmap: "Ship-Ready") and the component review that follows it.
- Every other roadmap item, in every phase.

### Assumptions to challenge

- _(assumption)_ A reader seeing two branches that do not open will understand that nothing is being hidden from them, rather than assuming the dashboard is broken. No explanatory text is added on that assumption.
- _(assumption)_ "Not recorded" is clearer to a branch manager than "Unattributed" or "Other", and naming it plainly is better than leaving the gap out of the chart.
- _(assumption)_ Showing a chart that is nine-tenths grey is more useful than showing a chart of only the attributed tenth, because the first agrees with the table and the second does not.
- _(assumption)_ The figures that disagree are the business's own and not ours to correct — the same call, in reverse, as the one this specification exists to undo.

---

## Change Log

- [2026-09-23] — the owner's challenge to the premise, before any of the chart work was built — **FR3–FR7: the chart stacks the rows the table is showing, not acquisition channels.** The original requirements came from the design's legend rather than from the brief, which asks only for "a stacked bar chart showing the data over time" over a tree whose every node holds the level beneath. Measured: channel-stacking at company level is off by about 90 % every month against the supplied figures, while stacking by the level beneath is exact in 11 of 12 months at every level. The chart now divides the company by exactly the rows the table displays, colour carries the hierarchy, and "Not recorded" shrinks from most of every bar to a sliver where the supplied figures do not add up. This pulls the Phase 2 roadmap item "Chart Follows the Drill-Down" into Phase 1.

_Dated amendments made after the spec was first written — typically by `/awos:spec` in Update Mode when a bug fix changed documented behavior. Each entry records the date, the source reference (bug id or fix description), and what behavior changed and why._
