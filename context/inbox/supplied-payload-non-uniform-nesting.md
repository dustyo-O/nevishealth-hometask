# Serve the supplied payload unchanged, and handle non-uniform nesting — grill notes 2026-09-23

_Reverses a decision made in spec 001. The brief says: "The nesting is not uniform. Branch 2 and Branch 3 have no employees, and only Anna Blackwood has channels. **Your UI has to handle that.**" We completed the data to make it uniform instead, which inverted the requirement — the UI was made to fit the data rather than the data being served as given. The owner caught it (2026-09-23). Facts marked **(measured)** were established during the grill against the real payload, not assumed._

## Decisions

- **D1:** The API serves `context/inbox/data.original.json` — the payload exactly as supplied in the brief — and it becomes the single data file. The generated variant is dropped; git history keeps it, and the README explains the reversal.
- **D2:** **(measured)** The supplied tree is genuinely non-uniform: Company → 3 branches; **Branch 2 and Branch 3 are leaves**; Branch 1 → 5 advisers of whom **only Anna Blackwood has channels**; James Walker, Maria Gutierrez, Robert Chen and Sarah Smith are leaves.
- **D3:** **(measured)** The table already handles this and needs **no change**. Served the real payload, Branch 2, Branch 3 and the four channel-less advisers render with no chevron and no `aria-expanded`, while Anna keeps hers — spec 002 FR1-AC4 working as written.
- **D4:** **(measured)** The supplied data carries **7 real discrepancies** between a parent and the sum of its children: Company May (301 stored vs 279), Branch 1 Aug (214 vs 216), Anna May (31 vs 30), Jun (32 vs 33), Jul (34 vs 35), Aug (38 vs 36), Sep (27 vs 28). They stay. They are not typos to fix; they are the data we were given.
- **D5:** The consistency check **reports them and nothing more** — the API logs, the UI stays clean, the request still succeeds (spec 001's decision, now with something real to report). The README names all seven.
- **D6:** Figures shown are always the stored ones, never recalculated — spec 002 FR1 already guarantees this, and with inconsistent data it becomes visible: the Company row reads 301 for May while its branches show 279.
- **D7:** **(measured)** The channel split covers **10% of the company** — 25 of 250 in February. A chart stacking only what exists would draw bars of 25–38 on a 0–100 axis beside a table showing 250–350.
- **D8:** So the chart stacks the three known channels **plus a fourth synthesised segment** for the clients whose channel the data does not record. Every bar still reaches the company's own figure, so the chart and the table still agree — the promise spec 003 makes.
- **D9:** That segment is called **"Not recorded"** and is drawn in a neutral grey from the existing line tokens, so it reads as absence rather than as a fourth acquisition channel.
- **D10:** It sits at the **bottom of the stack**, with the three known channels above it in the design's order — the grey mass forms the base and the acquisition story stays where the eye looks for change.
- **D11:** It is computed at the company level only: `company.values[month] − sum of every channel in the tree for that month`. **(measured)** With this payload it runs `225, 241, 256, 271, 284, 299, 314, 222, 223, 223, 223, 312` — always positive.
- **D12:** The remainder is never negative. If a future payload's channels exceed their parent, the remainder is zero and the bar is as tall as the channels sum to — slightly taller than the company's figure. That cannot happen here, and when it does the consistency check already reports it. No fourth state is built for it.
- **D13:** The legend shows the fourth entry **only when there is a remainder**, so a payload that records every client's channel returns the design's three-entry legend on its own.
- **D14:** The chart's hidden data table gains a "Not recorded" column and the month panel gains a row, both following the same rule as the legend.
- **D15:** **Spec 002 is amended in place** with a Change Log entry: criteria that open Branch 2 or Branch 3 are rewritten against rows that still have children, and one is added asserting a childless branch offers nothing to open. 002 stays Completed — the same treatment its three earlier amendments got.
- **D16:** **Spec 003 is amended in place** likewise: what the chart stacks, the legend's contents, the hidden table's columns, and the definition of "the parts add up to the Company row" now including the remainder.
- **D17:** **Spec 001 is amended in place**: the data decision it recorded — completing the payload — is reversed, with the reason.
- **D18:** `product-definition.md` §4 ("we completed the data rather than change the chart") and `architecture.md` §2's consistency invariant are corrected to match. The README's assumptions section carries the full story: what we assumed, why it was wrong, and what we changed.
- **D19:** Unchanged and explicitly so: who triggers it (opening the page), what the user sees when loading fails (spec 001's error panel and Retry), and the drill-down. There is no offline story and no second-device story — the dashboard is local-only and remembers nothing between visits (`architecture.md` §3, §5), so neither applies here any more than in specs 001–003.

## Out of scope

- Any change to the table's behaviour — it already handles the real shape (D3).
- Showing the discrepancies in the UI, or failing the request over them (D5).
- Changing the supplied figures in any way, including the design's own differing numbers (the design's Branch 1 Jul 291 vs the data's 201, and its January bar at ≈365 vs 350). Data wins; the README says so.
- The chart re-scoping to a selected branch or adviser — still Phase 2.
- A remainder at any level other than the company (D11); the chart is company-wide.
- Handling a payload whose channels exceed their parent beyond the zero clamp (D12).
- The README itself (roadmap: "Ship-Ready") and the component review that follows it.

## Open risks

- **R1 — the visual balance changes completely.** With 90% of every bar grey, the chart no longer looks like the mockup. It is the honest rendering of the supplied data, but it should be looked at in a browser before anyone calls it finished, and the owner's eye is the test.
- **R2 — spec 002's criteria need an audit, not a guess.** Every criterion that names a node must be checked against the real tree; "open Branch 2" is the one already found, and there may be more in FR2, FR3 and FR5 where Branch 2 or a channel-less adviser is used as an example.
- **R3 — the acceptance suite is built on the completed data.** `src/test/fixtures/shipped-clients.ts` reads the served file, and the chart specs assert 36 segments and a 0–400 axis. Both change. The e2e double's tree shape changes too.
- **R4 — the production smoke asserts "0 discrepancies".** It must become an assertion that the guard reports exactly the seven, which is a better test than the one it replaces.
- **R5 — `toMonthlySeries` groups by channel name across the tree.** With one adviser's channels it still works, but the remainder makes it no longer a pure "sum the tree" function; where the company's own total enters the calculation needs to stay obvious, or the chart quietly stops agreeing with the table.
- **R6 — the y-axis top changes with the data, not the design.** With the remainder the maximum is the company's 350 again, so the axis returns to 0–400 — but that is a consequence, not a guarantee, and the swept label test from spec 003 must still pass.

## Suggested acceptance criteria

- When the page has loaded, then the table shows Company, Branch 1, Branch 2 and Branch 3, and neither Branch 2 nor Branch 3 offers any control to open it.
- When the user opens Branch 1, then five adviser rows appear, and only Anna Blackwood offers a control to open her row.
- When the user reads the Company row for May 2024, then it shows 301 — the figure as supplied — even though the three branches beneath it show 279 between them.
- When the API starts, then it reports seven discrepancies between a parent and the sum of its children, and still serves the data.
- When the page has loaded, then each bar is divided into "Not recorded", "Existing clients", "New organic" and "New paid" from the bottom up, and its total height equals the figure the table shows on the Company row for that month.
- When the user reads February 2024 in the chart, then its parts are 225 not recorded, 25 existing clients, 0 new organic and 0 new paid, totalling 250.
- When the user looks at the legend, then it names all four segments, with "Not recorded" in a neutral grey distinct from the three channel colours.
- Given a payload in which every client's channel is recorded, when the chart is shown, then no "Not recorded" segment is drawn and the legend names three entries.
- When a screen reader reads the chart's figures as a table, then each of the twelve rows carries not recorded, existing clients, new organic, new paid and the total.

---

## Round 3 — the chart model, reopened 2026-09-23 (after slice 1)

_The owner challenged the premise: "what is 'not recorded'? maybe we were wrong in our chart idea". They were right, and the arithmetic settled it._

- **D20:** Our chart model came from **the design's legend, not from the task**. The brief says only "a stacked bar chart showing the data over time"; the design's three channel names are what we turned into a requirement. **(measured)** Channel-stacking at company level is off by ~90 % every month against the supplied data, which is why it needed an invented category to stand up.
- **D21:** The data is a tree whose every node holds the level beneath, and stacking by that level nearly closes: **(measured)** Company → 3 branches is exact in 11 of 12 months (May 279 vs 301); Branch 1 → 5 advisers exact in 11 of 12 (Aug 216 vs 214); Anna → 3 channels off by ±1–2 in five months. The 7 discrepancies are the only gaps.
- **D22:** **The chart shows the whole company sliced by exactly the rows the table is currently showing** — every visible row that is not itself opened. Opening a row splits its segment into its children; closing merges them back. "Expandable rows that reveal the level beneath" then reveals it in both cards at once, which is the brief's headline promise.
- **D23:** **(measured)** The segment count runs 3 → 7 → 9 as the user opens Branch 1 and then Anna; 9 is the maximum this data can reach. The bar's height stays the company's own figure throughout, so the scale never moves as the user drills.
- **D24:** The remainder primitive built in slice 1 carries over unchanged — `max(0, company − Σ visible rows)` — and keeps the name **"Not recorded"**, which still reads correctly: those clients are in the company's figure but recorded against no visible row. It shrinks from ~90 % of every bar to a sliver in one month. Where the visible rows *overshoot* the company figure (Aug, once Branch 1 is open), the existing fallback applies: no remainder, and the bar is the segments' sum.
- **D25:** **Colour carries the hierarchy.** Each branch takes one of the design's three colours, and its descendants are shades of it — at load the chart is the design's three colours; opening Branch 1 splits its purple into five purples. "Not recorded" keeps the neutral grey and is never a shade of anything.
- **D26:** The legend lists whatever is drawn, growing from three entries to nine and wrapping onto further lines. The card already grows rather than squeezing the plot, so nothing else is disturbed.
- **D27:** This pulls the Phase 2 roadmap item "Chart Follows the Drill-Down" into Phase 1, and reverses `product-definition.md`'s "the chart is company-level and independent of the table".

### Open risks added by round 3

- **R7 — the announcement gets long.** At nine segments the live region reads nine figures plus a total for every month. Consistent, but possibly tiring; worth the owner's ear once it exists.
- **R8 — nine shades must stay distinguishable**, including for a colour-blind reader, and the shades within one branch are by definition close together. Needs checking in a browser, not asserting in a unit test.
- **R9 — the chart now re-renders on every expand/collapse.** Spec 003 measured that the drawing does not re-render on hover; that guarantee must survive a changing series.

---

## Round 4 — the design settles it, 2026-09-23 (supersedes Round 3)

_The owner found the proof in Figma: the design's chart is company-level, stacked by the three acquisition channels, and its bars reach exactly the Company row's figures — 250, 267, 284, 301 … 350. Round 3's drill-down model is withdrawn. Round 3 is kept in this file rather than deleted, because the path matters: we were wrong twice, in opposite directions, and the README will say so._

- **D28:** **(evidence: the Figma frame, 1408×834)** The chart is **company-level and stacked by the three acquisition channels**, exactly as spec 003 built it. It does not follow the table's drill-down; "Chart Follows the Drill-Down" returns to Phase 2 where it was.
- **D29:** The Zustand store, `visibleBreakdown` and the derived shade palette are **not built**. `architecture.md` §1 and §6 revert to their previous text — expansion state stays private to the tree grid, and there is no global store.
- **D30:** **No "Not recorded" segment.** The three categories are exhaustive by their own names: "New organic" and "New paid" are the clients newly acquired, which the data records explicitly, and every other client is by definition an **existing** one. So **`Existing clients = company total − new organic − new paid`**.
- **D31:** **(measured)** That gives `250, 266, 282, 299, 315, 331, 348, 247, 248, 248, 248, 346` for Existing against organic `0,1,1,1,0,2,2,1,1,1,1,2` and paid `0,0,1,1,2,1,0,2,1,1,1,2` — and the bars equal the Company row in **all twelve months**. Mathematically this is slice 1's remainder folded into Existing instead of drawn separately, so that arithmetic survives; only the fourth segment and its token go.
- **D32:** **The assumption this rests on, to be declared in the README:** a client the data does not record as newly acquired is an existing client. It is the natural reading of the three names and the only split that both uses real figures and sums to the company's own — but it does attribute 225 of February's 250 on semantics rather than on recorded data.
- **D33:** **(measured)** The new-client segments are 0–2 clients, which is 0–1.7 px at the design's plot height — invisible. Every **non-zero** segment therefore gets a minimum drawn height so the stacking can be seen; zero stays zero. The cost, stated: the drawn bar can exceed its true total by about 2 px on a 250-client bar, under 1 %. Tests assert the **figures** exactly and the **drawn heights** within a tolerance.

### What round 4 costs

Slice 1 is merged and part of it is now wrong: the fourth segment, its token and the conditional legend/panel/table it drives all go. The `notRecorded` arithmetic stays, renamed for what it now does — top up Existing. That is the price of having changed direction twice, and it is small because slice 1 put the arithmetic in a pure function and fed everything from one series.
