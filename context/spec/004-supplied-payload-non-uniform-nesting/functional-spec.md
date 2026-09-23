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

The chart is the hard half. It stacks each month by acquisition channel, but with the real figures only one adviser's clients are attributed to a channel at all — about a tenth of the company. Stacking only what is known would draw a chart whose bars are a tenth the height of the numbers in the table directly beneath it, and the two halves of the page would contradict each other. So the chart accounts for the rest: every bar still reaches the company's own figure, and the part of it nobody has attributed is shown as exactly that — **not recorded**. The reader sees the whole company, sees how little of it is explained, and is not misled about either.

Success looks like: a manager opening the dashboard sees three branches, two of which do not open, and is not confused by that; the figures in the table are the ones the business gave us, down to the ones that do not add up; and the chart's bars match the table month for month while being honest that most of the company's acquisition story is missing.

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

### FR3 — The chart accounts for every client

Each month's bar is as tall as the company's own figure for that month, so a bar and the Company row in the table always tell the same story. The bar is divided by how those clients were acquired, as far as anyone knows.

Because only one adviser's clients are attributed to a channel, most of each bar is made up of clients nobody has attributed. That part is shown as its own segment named **"Not recorded"**, in a neutral grey that is clearly not one of the three channel colours, and it sits at the **bottom** of the bar with the known channels stacked above it in their usual order.

"Not recorded" means only that: the data does not say. It is never treated as a fourth way of acquiring a client, and it never takes a channel's colour.

**One exception, and it cannot arise from the figures we have.** If a month's recorded channels ever came to *more* than the company's own figure for that month, there is nothing left over to show and no such thing as a negative amount of clients. In that month the bar is as tall as the recorded channels come to — taller than the Company row — and no "Not recorded" segment is drawn. The chart shows the recorded figures rather than trimming them to fit, and the disagreement is the data's, not the dashboard's. With the supplied figures this never happens: in all twelve months the company's figure exceeds its recorded channels.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then each bar's total height matches the figure the table shows on its Company row for that month.
  - [ ] When the user reads any bar from the bottom up, then its parts are Not recorded, Existing clients, New organic and New paid, in that order.
  - [ ] When the user reads February 2024 in the chart, then its parts are 225 not recorded, 25 existing clients, 0 new organic and 0 new paid, totalling 250.
  - [ ] When the user compares the "Not recorded" segment with the others, then it is a neutral grey plainly different from the three channel colours.
  - [ ] When the user looks at the chart's scale, then it still reaches at least the tallest month's total, as before.
  - [ ] Given a month whose recorded channels come to more than the company's figure for that month, when the chart is shown, then that bar is as tall as its recorded channels, no "Not recorded" segment is drawn for it, and no segment is drawn below zero.
  - [ ] When the user reads the supplied figures, then no month has recorded channels exceeding the company's figure, so every bar matches its Company row.

### FR4 — What the legend and the month panel say

The legend names every segment that is actually drawn, "Not recorded" included, in the same order as the bars. The panel that appears when the user points at, taps or moves to a month lists the same segments with their figures, and its total is the month's total — the figure the table shows, except in the exempted case above, where it is what the recorded channels come to.

Whether "Not recorded" appears at all is decided **once, across the whole twelve months** — not month by month. If any month has clients nobody has attributed, the segment is part of this chart: it is in the legend, it is a line in every month's panel and a column in every row a screen reader reads, and a month with nothing unattributed simply shows it as zero. A legend that changed as the pointer moved would be worse than a zero.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then the legend names Not recorded, Existing clients, New organic and New paid, each with its swatch.
  - [ ] When the user points at February 2024, then the panel lists 225 not recorded, 25 existing clients, 0 new organic and 0 new paid, and a total of 250.
  - [ ] When the user reads the panel for any month, then its four figures add up to the total it shows.
  - [ ] Given a month in which every client's channel is recorded while other months have clients unattributed, when the user points at that month, then the panel still lists "Not recorded", reading 0.
  - [ ] When the user moves the pointer from month to month, then the legend stays the same throughout.

### FR5 — What a screen reader reads

The chart's figures remain available to read as a table, one row per month, and that table now carries the not-recorded figure alongside the three channels and the total — so a screen-reader user gets exactly what a sighted user sees in the panel.

- **Acceptance Criteria:**
  - [ ] When a screen reader reads the chart's figures as a table, then each of the twelve rows gives not recorded, existing clients, new organic, new paid and the total, including any row whose not-recorded figure is 0.
  - [ ] When a screen-reader user moves to February 2024, then it announces the month with 225 not recorded, 25 existing clients, 0 new organic, 0 new paid and a total of 250.

### FR6 — A company whose clients are all accounted for

The "Not recorded" segment exists only while there is something unaccounted for **anywhere in the twelve months**. If every client in every month had their acquisition channel recorded, the chart would go back to three segments and a three-entry legend on its own, with nothing to configure and nothing left over — and no zero line would be left behind in the panel or in what a screen reader reads.

- **Acceptance Criteria:**
  - [ ] Given figures in which every client's acquisition channel is recorded, when the chart is shown, then no "Not recorded" segment is drawn and the legend names three entries.
  - [ ] Given figures in which every client's channel is recorded in every month, when the user points at a month, then the panel lists three figures and no "Not recorded" line.
  - [ ] Given figures in which the recorded channels come to more than the company's own figure for a month, when the chart is shown, then no negative segment is drawn.

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
- Showing a not-recorded share at any level other than the company as a whole.
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

_Dated amendments made after the spec was first written — typically by `/awos:spec` in Update Mode when a bug fix changed documented behavior. Each entry records the date, the source reference (bug id or fix description), and what behavior changed and why._
