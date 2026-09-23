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

The chart needed only one number redefined, though it took us two wrong turns to see it. The design stacks each month by the three acquisition channels and its bars reach the company's own figures exactly — so the chart is company-wide and channel-stacked, as it always was. What the supplied data lacks is the *recorded* channel for most clients: only one adviser's are broken down at all.

The three categories settle it between them. "New organic" and "New paid" are the clients newly acquired, and the data records those explicitly wherever they exist. Every other client is, by the meaning of the three names, an existing one. So the company's existing clients are its own figure less the newly acquired — which uses only supplied numbers, keeps every bar equal to the Company row, and needs no fourth category invented to hold the difference.

Success looks like: a manager opening the dashboard sees three branches, two of which do not open, and is not confused by that; the figures in the table are the ones the business gave us, down to the ones that do not add up; and the chart's bars match the table month for month while showing, honestly, that almost every client this company holds is one it already had.

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

### FR3 — The chart, its months and its three parts

The chart shows the whole company: one bar for each of the twelve months, divided into the three ways a client arrives — **Existing clients**, then **New organic**, then **New paid**, from the bottom up, each keeping the colour the design gives it.

The newly acquired are the figures the business records: every "New organic" and every "New paid" in the company, added together. The existing clients are everyone else — the company's own figure for that month, less those newly acquired. So every bar is exactly as tall as the figure the table shows on its Company row, and nothing in it is invented.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then the chart shows twelve bars labelled "Feb 2024" through "Jan 2025", each carrying its parts in the order Existing clients, New organic, New paid from the bottom up, and omitting any part with no clients in it.
  - [ ] When the user compares any bar with the table, then that bar's three figures add up to the figure the table shows on the Company row for the same month.
  - [ ] When the user reads February 2024, then its parts are 250 existing clients, 0 new organic and 0 new paid.
  - [ ] When the user reads July 2024, then its parts are 331 existing clients, 2 new organic and 1 new paid, totalling 334.
  - [ ] When the user reads any month, then its new organic and new paid figures are the ones the business records for that month, unchanged.
  - [ ] When the user looks at the legend, then it names exactly three parts, whatever the figures are.

### FR4 — Small parts stay visible

The newly acquired are a very small share of this company — never more than two clients in a month against two hundred and fifty or more. Drawn to scale they would be under two pixels and effectively invisible.

So a part with clients in it is drawn on a **stretched scale that gives the smallest numbers the most room**: one client is four pixels, two are about six, three are eight, and the gain tails off from there. A part is never drawn smaller than its true size — for a part big enough to be seen on its own, its true height wins and the stretch does nothing. A part with no clients in it is not drawn at all.

The height a stretched part gains is **taken from the largest part of the same bar**, so the bar's total height is still exactly the figure the table shows on its Company row. What gives way is the existing-clients part, by at most a few pixels out of two hundred and fifty. A month with no newly acquired clients is drawn exactly to its figures.

This is a deliberate distortion and it is worth naming: on the stretched scale two clients do not look twice one client, they look about one and a half times. It buys the only thing that matters here — that a month with new clients can be told from a month without. **Every figure the user reads is exact**: the stretch lives only in the drawing.

- **Acceptance Criteria:**
  - [ ] When the user looks at a month where one client was newly acquired, then that part is about four pixels tall.
  - [ ] When the user looks at a month where two clients were newly acquired, then that part is visibly taller than a part of one client, at about six pixels.
  - [ ] When the user looks at July 2024, where two clients were won organically and one was paid for, then both parts are visible and neither is covered by the other.
  - [ ] When the user looks at any month, then the bar's total height is the figure the table shows on its Company row, whether or not any part has been stretched.
  - [ ] When the user looks at February 2024, where no clients were newly acquired, then no new organic or new paid part is drawn at all.
  - [ ] When the user reads any month's figures, in the panel or as a screen reader, then they are the exact figures and are not adjusted for drawing.

### FR5 — The legend, the panel and what a screen reader reads

The legend names the three parts beneath the chart, always. The panel that appears when the user points at, taps or moves to a month lists the same three with their figures and the month's total. The same three, with the total, are what a screen reader reads as a table of twelve rows.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then the legend names Existing clients, New organic and New paid, each with its swatch.
  - [ ] When the user points at July 2024, then the panel reads "Jul 2024", existing clients 331, new organic 2, new paid 1, and a total of 334.
  - [ ] When a screen reader reads the chart's figures as a table, then each of the twelve rows gives existing clients, new organic, new paid and the total.
  - [ ] When the user reads the panel for any month, then its three figures add up to the total it shows, and that total is the figure the table shows on its Company row.

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
- The chart re-scoping to a selected branch or adviser — it stays company-wide, and "Chart Follows the Drill-Down" stays a Phase 2 item.
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

- [2026-09-23] — the owner judging the built chart a second time — **FR4: small parts are drawn on a stretched scale rather than lifted to one flat height.** A flat four-pixel floor made one client and two clients identical on screen, which threw away the only comparison the newly-acquired parts can offer. They are now drawn so that one client is four pixels, two about six and three about eight, tailing off, and never smaller than the part's true height. The borrowing is unchanged, so the bar's total still equals the Company row exactly. Stated plainly in the requirement: on that scale two clients look about one and a half times one client, not twice — the figures stay exact wherever they are read.

- [2026-09-23] — the owner looking at the built chart, and a measurement of how the parts paint — **FR4: the minimum height is four pixels, and it is borrowed from the largest part rather than added to the bar.** At two pixels the owner found the newly-acquired parts still too thin to read. Measured on July: a floored part is drawn from its own true base, so the part above begins where that part's *figure* ends and covers the difference — New organic showed 1.51 px of its 2 px, and would have shown 1.51 px however large the floor grew, because only the topmost part ever benefits. The height a lifted part needs now comes out of the existing-clients part of the same bar, so **the bar's total still equals the Company row exactly** and only the one part large enough not to notice gives way.

- [2026-09-23] — slice 3's measurements in the browser — **FR3-AC1 and FR4: what a bar with no newly-acquired clients looks like, and what happens when two lifted parts meet.** FR3-AC1 said every bar is divided into three parts while FR4-AC2 said a part with no clients is not drawn at all; with the supplied figures only 7 of the 12 months have all three, and February has one. FR3-AC1 now describes the order of the parts that are present rather than promising three. FR4 also records that when both newly-acquired parts are lifted to the minimum height the upper covers about half a pixel of the lower, measured in 8 of 12 months — accepted, because both stay visible and the alternative moves the whole bar further from its figures.

- [2026-09-23] — the design frame the owner found in Figma, which settles it — **FR3–FR5: the chart is company-wide and channel-stacked, and there is no "Not recorded".** The design's bars reach the Company row's own figures (250, 267, 284, 301 … 350) stacked by the three channels, so both of this spec's earlier chart models were wrong: the first invented a fourth category to hold the 90 % the data does not attribute, the second had the chart follow the table's drill-down. Neither was needed. The three category names are exhaustive between them — the data records the newly acquired, and everyone else is an existing client — so **Existing = company total − new organic − new paid**, which uses only supplied figures and equals the Company row in all twelve months. The drill-down model is withdrawn entirely and "Chart Follows the Drill-Down" returns to Phase 2. FR4 is new: the newly acquired are 0–2 clients a month, under two pixels drawn to scale, so a part with clients in it gets a minimum drawn height while the figures stay exact.

- [2026-09-23] — the owner's challenge to the premise, before any of the chart work was built — **FR3–FR7: the chart stacks the rows the table is showing, not acquisition channels.** The original requirements came from the design's legend rather than from the brief, which asks only for "a stacked bar chart showing the data over time" over a tree whose every node holds the level beneath. Measured: channel-stacking at company level is off by about 90 % every month against the supplied figures, while stacking by the level beneath is exact in 11 of 12 months at every level. The chart now divides the company by exactly the rows the table displays, colour carries the hierarchy, and "Not recorded" shrinks from most of every bar to a sliver where the supplied figures do not add up. This pulls the Phase 2 roadmap item "Chart Follows the Drill-Down" into Phase 1.

_Dated amendments made after the spec was first written — typically by `/awos:spec` in Update Mode when a bug fix changed documented behavior. Each entry records the date, the source reference (bug id or fix description), and what behavior changed and why._
