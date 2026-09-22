# Functional Specification: Clients Trend Chart

- **Roadmap Item:** Phase 1 — Clients Trend Chart: one stacked bar per month, split by acquisition channel, on a clients scale, matching the design; totals agree with the table.
- **Status:** Draft
- **Author:** Alexander Shleyko
- **Sources:** `context/inbox/clients-trend-chart.md` (grill decisions D1–D18), `context/product/product-definition.md`, the design ("Web engineer home task": the dashboard mockup and its chart frame, screenshots in `context/inbox/design/`), spec 001 (Completed) for the card and its loading and failure states, spec 002 (Completed) for the table the chart must agree with

---

## 1. Overview and Rationale (The "Why")

The table tells a manager exactly how many clients each part of the company had in each month. It does not tell them the **shape** of the year. Twelve columns of numbers hide what one glance at a chart reveals: that the company grew steadily from February to a peak in August, dropped back in September, held flat through the autumn, and jumped again in January.

This chart is that glance. It fills the upper card of the Clients dashboard: one bar per month, each bar split into the three ways a client arrives — clients the company already had, clients won organically, and clients won through paid channels. Maya, the branch manager, sees the peak and the drop before she reads a single figure; the table beneath answers "who". The split answers the second half of her question: whether a good month came from keeping clients or from winning new ones.

The chart is company-wide and stays that way while the table is used. Opening a branch in the table does not re-draw the chart — the two cards answer different questions, and the design shows them side by side, not linked.

Two things decide whether this is done well rather than merely present. First, **the chart and the table must never disagree**: every bar's parts add up to the figure the table shows for the same month, and that is checkable, not a promise. Second, **a chart is the easiest thing on a dashboard to make unreadable to a screen reader** — so the same figures a sighted user reads by pointing must be reachable by keyboard and readable as text.

Success looks like: a manager names the best and worst month in the year without touching the table; a keyboard user hears every month's figures without a mouse; and nothing about the chart breaks when the page is 375 px wide.

---

## 2. Functional Requirements (The "What")

### FR1 — The chart, its months and its three parts

The chart fills the upper card of the dashboard. It shows one bar for each of the twelve months, February 2024 to January 2025, in that order, with the month named beneath each bar in the same wording the table uses ("Feb 2024").

Every bar is divided into three parts, always in the same order from the bottom up: **Existing clients**, then **New organic**, then **New paid**. Each part keeps the colour the design gives it, and the whole bar's height is the company's client count for that month.

The parts are the company's totals for each channel — every adviser's figures for that channel, added together. This is the only place in the dashboard where the company's split by channel appears: the table shows channels adviser by adviser, never added up.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then the chart shows twelve bars labelled "Feb 2024" through "Jan 2025" in order, each divided into three parts.
  - [ ] When the user compares any bar with the table, then that bar's three parts add up to the figure the table shows on the Company row for the same month.
  - [ ] When the user reads February 2024, then its parts are 221 existing clients, 15 new organic and 14 new paid, totalling 250.
  - [ ] When the user looks for the tallest bars, then August 2024 and January 2025 are the tallest, each totalling 350.
  - [ ] When the user reads the parts of any bar from the bottom up, then they are always Existing clients, New organic, New paid, in that order.

### FR2 — The scale and the grid

A scale runs up the left side of the chart in numbers of clients. It starts at zero and is labelled in equal steps of one hundred. Its top is the first step **above** the largest month, so the tallest bar never touches the ceiling — with the figures supplied, whose largest month is 350, the top is 400. The scale is read from the figures being shown rather than fixed in advance, so it still fits if the numbers change.

A faint dotted line runs across the plot at each labelled step of the scale, so a bar's height can be read against it. Nothing is drawn between the months.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then the scale starts at 0 and is labelled in equal steps of one hundred.
  - [ ] When the page has loaded with the supplied figures, then the scale's top label is 400 and no bar reaches the top of the plot.
  - [ ] When the user looks at the plot, then a faint dotted line runs across it at each labelled step of the scale.
  - [ ] When the user looks between two months, then no vertical line is drawn there.
  - [ ] Given a month's total is higher than the scale's top, when the chart is shown, then the top moves up to the first step above that month's total.

### FR3 — The legend

Beneath the plot, centred, a legend names the three parts — Existing clients, New organic, New paid — each with a small swatch in the colour that part has in the bars.

The legend explains the chart; it does not operate it. Clicking a legend entry changes nothing, because hiding a part would silently change the height of every bar and break the promise that the chart and the table agree.

- **Acceptance Criteria:**
  - [ ] When the page has loaded, then a legend appears centred beneath the chart naming Existing clients, New organic and New paid, each with a small swatch.
  - [ ] When the user compares a legend swatch with the bars, then the swatch is the same colour as the part it names.
  - [ ] When the user clicks a legend entry, then nothing about the chart changes.

### FR4 — Pointing at a month

When the user points at a month, that month's whole column is gently tinted and a small panel appears naming the month, each of the three parts with its figure in the order they are stacked, and the month's total last. Moving away hides both.

On a touch screen there is no pointing, so a tap does the same thing: tapping a month shows its panel, tapping a **different** month replaces it with that month's figures, and tapping anywhere outside the bars dismisses it. Without this a phone user could read no exact figure from the chart at all.

However the panel was opened, it is never left behind: it disappears when the pointer leaves the chart, when the user taps outside it, and when the outline moves away from the chart.

- **Acceptance Criteria:**
  - [ ] When the user points at February 2024, then a panel appears reading "Feb 2024", existing clients 221, new organic 15, new paid 14, and a total of 250.
  - [ ] When the user points at a month, then that month's column is tinted and the other eleven months are unchanged.
  - [ ] When the user moves the pointer off the chart, then the panel and the tint both disappear.
  - [ ] Given the page is viewed on a touch screen, when the user taps a month, then that month's panel appears.
  - [ ] Given a month's panel is open on a touch screen, when the user taps a different month, then that month's panel replaces it.
  - [ ] Given a month's panel is open on a touch screen, when the user taps outside the bars, then the panel and the tint disappear.
  - [ ] Given a month's panel is open, when the outline leaves the chart, then the panel and the tint disappear.
  - [ ] When the user reads the panel for any month, then its three figures add up to the total it shows.

### FR5 — Reaching the chart from the keyboard

The chart is a single stop on the way through the page: pressing Tab from the page heading puts the outline on the chart as a whole — it never moves onto the individual bars — and pressing Tab again leaves it for the table beneath.

Arriving at the chart makes **February 2024**, the first month, the month being read: its column is tinted and its panel opens, so the user is never looking at a focused chart that says nothing. Left and Right then move from month to month, the tint and the panel following, so a keyboard user reads exactly what a pointing user reads. At either end of the year the outline stays where it is rather than wrapping around.

Pressing Escape closes the panel and the tint while leaving the outline on the chart; moving to another month opens it again. Leaving the chart clears the panel, and coming back starts at February again — the dashboard remembers nothing between visits.

- **Acceptance Criteria:**
  - [ ] When the user presses Tab from the page heading, then the outline appears on the chart as a whole, which is a single stop, and never on an individual bar.
  - [ ] When the outline first reaches the chart, then February 2024 is the month being read, its column is tinted and its panel is shown.
  - [ ] Given February 2024 is being read, when the user presses Right, then March 2024 is being read and its panel replaces February's.
  - [ ] Given January 2025 is being read, when the user presses Right, then January 2025 is still the month being read.
  - [ ] Given February 2024 is being read, when the user presses Left, then February 2024 is still the month being read.
  - [ ] Given a month's panel is shown, when the user presses Escape, then the panel and the tint disappear and the outline stays on the chart.
  - [ ] Given the user has moved to June 2024 and then left the chart, when they return to the chart, then February 2024 is the month being read again.
  - [ ] Given the outline is on the chart, when the user presses Tab, then the outline leaves the chart and the table beneath is the next stop.

### FR6 — What a screen reader reports

A screen-reader user reaches the chart's figures two ways, and neither is a picture. Moving from month to month with the keyboard announces that month and all four of its numbers. Separately, the same figures are available to read as a table of twelve rows — one per month, each giving existing clients, new organic, new paid and the total — which is not shown on screen.

These are two deliberate ways to reach the same figures, and using both is intended: a user may hear June while moving and read June again in the table. What must never happen is a single move announcing the same month twice over, or the drawing itself shedding loose text — the scale's numbers and the month labels are never read as a stray list, because the drawing carries no readable text of its own.

- **Acceptance Criteria:**
  - [ ] When a screen-reader user moves the outline to February 2024, then it announces "Feb 2024", existing clients 221, new organic 15, new paid 14 and a total of 250.
  - [ ] When a screen reader reads the chart's figures as a table, then it finds twelve rows, one per month, each giving existing clients, new organic, new paid and the total.
  - [ ] When the user moves the outline to a month, then that month's figures are announced once for that move, not repeated.
  - [ ] When a screen reader reads the chart's drawing, then it finds no loose numbers from the scale or the month labels.
  - [ ] When a screen reader reaches the chart, then it is named so the user knows what it shows before hearing any figure.

### FR7 — Movement

When the figures arrive, the bars grow up from the bottom of the plot once, so the eye is drawn to the chart taking shape. If the viewer's system is set to reduce motion, the bars are simply there, fully drawn, with no growth — the same rule the table's rows already follow.

- **Acceptance Criteria:**
  - [ ] When the figures arrive, then the bars grow up from the bottom of the plot once and then stay still.
  - [ ] Given the viewer's system is set to reduce motion, when the figures arrive, then the bars appear fully drawn without growing.

### FR8 — Narrow screens

Thirteen months' worth of labels cannot fit across a phone, but the shape of the year can. On a narrow screen all twelve bars stay visible and simply become thinner; the plot keeps its height, so the difference between a good month and a bad one is as easy to see on a phone as on a laptop.

Only the month labels give way: below the width at which they would collide, every third month is named — February, May, August, November — and January, so the ends of the year are always labelled. The chart itself never scrolls sideways, and neither does the page.

- **Acceptance Criteria:**
  - [ ] When the page is viewed at 375 px wide, then all twelve bars are visible inside the card and none is cut off.
  - [ ] When the page is viewed at 375 px wide, then the month labels read "Feb 2024", "May 2024", "Aug 2024", "Nov 2024" and "Jan 2025", and no labels overlap.
  - [ ] When the page is viewed at 375 px wide, then the plot is the same height as at the design's width and the page has no horizontal scrollbar.
  - [ ] When the user tries to scroll the chart sideways at any width, then nothing moves, because the whole year is already shown.
  - [ ] When the page is viewed at the design's width, then all twelve months are named beneath their bars.

### FR9 — While loading, and when something is wrong

The chart appears inside the card that spec 001 already fills: the placeholder blocks shaped like a chart while the figures are loading, and the error message with its Retry button if they cannot be loaded. Nothing about those states changes here. The line that stood in for the chart until now — "12 months · Feb 2024 – Jan 2025" — is replaced by the chart itself.

- **Acceptance Criteria:**
  - [ ] Given the figures are slow to arrive, when the user opens the page, then the chart's card shows the placeholder blocks exactly as before, and the chart replaces them once the figures arrive.
  - [ ] Given the figures cannot be loaded, when the user opens the page, then the error message with its Retry button appears in place of the chart, and clicking Retry shows the chart once the figures arrive.
  - [ ] When the chart is shown, then the line "12 months · Feb 2024 – Jan 2025" no longer appears anywhere on the page.

---

## 3. Scope and Boundaries

### In-Scope

- The stacked monthly chart in the upper card of the Clients dashboard, for the twelve served months.
- The company-wide split by acquisition channel, added up from every adviser.
- The scale, its dotted grid, the month labels and the legend.
- Reading a month's figures by pointing, by tapping, and from the keyboard.
- What a screen reader is given: the per-month announcement and the same figures as a table.
- The chart's behaviour down to 375 px wide.

### Out-of-Scope

- The chart re-scoping to a selected branch or adviser — Phase 2, "Chart Follows the Drill-Down". Opening a row in the table changes nothing in the chart.
- Selecting, clicking or filtering by a month, a bar or one of its parts.
- A legend that hides or shows parts of the bars.
- Any state for a company with no channel figures at all: the served data always carries the full split (confirmed while grilling — three branches, ten advisers, three channels each).
- Changing the table, the served data, or how it is served (specs 001 and 002, both Completed).
- Comparing years, changing the period shown, or any other view of the same figures.
- The README's assumptions and next-steps sections (roadmap: "Ship-Ready") and the component review that follows it.
- Every other roadmap item, in every phase.

### Assumptions to challenge

- _(assumption)_ Figures appear exactly as recorded — whole clients, no thousands separators, and no rounding.
- _(assumption)_ The chart shows the same twelve months as the table, always, in the order they are served; there is no month the user can add or remove.
- _(assumption)_ The three acquisition channels are the same three for every adviser, so the legend names exactly three things. The data confirms this today.
- _(assumption)_ A month whose figure is zero for one channel still shows that channel in the panel, reading zero, rather than omitting it.

---

## Change Log

_Dated amendments made after the spec was first written — typically by `/awos:spec` in Update Mode when a bug fix changed documented behavior. Each entry records the date, the source reference (bug id or fix description), and what behavior changed and why. Leave empty until the first amendment._
