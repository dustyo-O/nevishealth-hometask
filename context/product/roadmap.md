# Product Roadmap: Nevis Book-of-Business Dashboard

_This roadmap outlines our strategic direction based on customer needs and business goals. It focuses on the "what" and "why," not the technical "how."_

_Context: a 6–8 hour take-home. Phase 1 is the deliverable, in the order we would ship if time ran out ("ship the parts that matter most"). Phase 2 is fidelity and polish if time remains. Phase 3 is the README's "what we would do next". Source: `context/product/product-definition.md`, brief in `context/inbox/brief.md`._

---

### Phase 1

_The highest priority features that form the core foundation of the product — the take-home deliverable._

- [x] **Clients Data & Dashboard Shell**
  - [x] **Client Data Served from an API:** Serve the company → branch → adviser → channel client tree, twelve months Feb 2024 – Jan 2025, from a small read-only REST API, so the dashboard has one source of truth and the data can later come from a real system.
  - [x] **Dashboard Page with Honest States:** A single "Clients" page that loads the data, tells the user when it is loading, and shows a clear message with a retry when loading fails — never an empty chart.

- [ ] **Monthly Detail Table**
  - [ ] **Hierarchical Table with Expandable Rows:** One column per month, one row per node; the Company row is expanded on load to its branches, a branch expands to its advisers, an adviser to their channels, and any row collapses again. A node without children is a leaf and offers nothing to expand.
  - [ ] **Keyboard and Assistive-Technology Access:** Every expand and collapse works from the keyboard, focus is visible, and the tree structure — each row's level and expanded state — is announced to screen readers.
  - [ ] **Expand/Collapse Behaviour Tests:** Automated UI tests prove rows expand and collapse by mouse and keyboard and that the hierarchy is exposed correctly.

- [ ] **Clients Trend Chart**
  - [ ] **Stacked Monthly Bar Chart by Channel:** One bar per month, stacked by acquisition channel (Existing clients / New organic / New paid) with a legend, on a clients y-axis, matching the design; totals agree with the table.
  - [ ] **Data-to-Chart Mapping Tests:** Automated tests prove the served tree maps into the right bars and segments, including the company-level channel split summed from the tree.

- [ ] **Ship-Ready**
  - [ ] **Nothing Breaks at 375 px:** The page stays usable and nothing overflows down to a 375 px wide viewport (full responsiveness is not a goal).
  - [ ] **README for Reviewers:** How to run and test in two commands, every assumption and open question with its reasoning (including where we think the brief, design or data was wrong and what we changed in the data), and what we would do next.

---

### Phase 2

_Once the deliverable is complete, we will move on to these high-value additions — matching the design's behaviour more closely and hardening quality._

- [ ] **Design Fidelity**
  - [ ] **Prototype-Faithful Interactions:** Match the Figma prototype's row hover treatment, toggle target (whole row vs. chevron) and any expand/collapse animation, once the prototype has been reviewed.
  - [ ] **Chart Follows the Drill-Down:** Let the chart re-scope to a selected branch or adviser so the drill-down is visible in the trend, not only in the table. _(Not in the design; an enhancement.)_

- [ ] **Quality Hardening**
  - [ ] **Accessibility Audit in CI:** Run an automated accessibility check on the dashboard as part of the test run, so regressions are caught, not just the two required behaviours.
  - [ ] **Data Consistency Guard:** The API validates that every parent equals the sum of its children and reports discrepancies, so the UI never has to choose between a stored total and a derived one.

---

### Phase 3

_Features planned for future consideration — the README's "what we would do next". Their priority and scope may be refined based on user feedback from earlier phases._

- [ ] **Finding Things Faster**
  - [ ] **Date Range and Branch Filters:** Let a manager narrow the view to a period or a branch without expanding rows.
  - [ ] **Sorting and Search:** Sort rows by a month's value and find an adviser by name in a large book.

- [ ] **Real Data and Real Users**
  - [ ] **Live Data Source:** Replace the fixed payload with the reporting system's data, keeping the same API shape.
  - [ ] **Sign-In and Roles:** Advisers see their own book by default; managers see their branch; leadership sees the company.

- [ ] **Everywhere and Out**
  - [ ] **Responsive Layouts:** Proper tablet and phone layouts beyond "nothing breaks at 375 px".
  - [ ] **Export:** Download the current view as CSV or PDF for the monthly report.
