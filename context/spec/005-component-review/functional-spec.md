# Functional Specification: Component Review

- **Roadmap Item:** Phase 1 — Component Review, the last thing before the work is sent: read every component as a reviewer would, split what does two jobs, lift complex logic into hooks, and remove what nothing uses.
- **Status:** Draft
- **Author:** Alexander Shleyko
- **Sources:** the four parallel review reports in `context/inbox/consults/react-frontend-component-review-*.md` (29 findings), `context/product/roadmap.md`, and specs 001–004, whose behaviour this work must leave untouched

---

## 1. Overview and Rationale (The "Why")

This one changes nothing for the person using the dashboard. That is the point of it.

The brief asks for component APIs designed "the way you would on a real team: composable, with clear boundaries", and says so as a thing it will judge. Duplication and wrong seams are only visible once everything exists, which is why this is the last item rather than the first: the table and the chart both had to be built before anyone could see what they share, what leaked between them, and what was written twice.

Four reviewers read the code in parallel, each a different slice, against four questions: is it concise and does it do one thing; does anything render *and* decide; is anything in `shared/` actually used once; and is intricate logic sitting in a component when it should be a hook that can be read and tested alone. They reported 29 findings, including one test that had silently guarded nothing since a rename.

Success is measured by what does **not** happen: every acceptance criterion in specs 001–004 still passes, unedited, and nobody using the dashboard can tell this work was done.

---

## 2. Functional Requirements (The "What")

### FR1 — Nothing the user can see changes

Every behaviour specified by specs 001, 002, 003 and 004 survives exactly: the table's levels and rows that open, the whole keyboard model, what a screen reader is told, the chart's three parts and their figures, the panel, the narrow-screen layout, and the loading, failed and retry states.

- **Acceptance Criteria:**
  - [ ] When the full check runs after this work, then every test written for specs 001–004 passes **without having been edited**, except where a review finding says a test itself was wrong and the ledger records which and why.
  - [ ] When the user opens the dashboard at 1440 px and at 375 px, then the table and the chart look and behave as they did before this work.
  - [ ] When a test had to change, then the ledger says which finding required it and what was wrong with it.

### FR2 — A reviewer meeting the code reads the code first

The intent behind a decision stays; the history of how it was measured moves to the ledger that already keeps such things. What a file says about itself matches what it does, and the "generic" layer does not name the business it is generic over.

- **Acceptance Criteria:**
  - [ ] When someone greps the shared layer for the words of this business — "month", "Company", "clients" — then the hits are in that layer's own parameters and not in its rules or its comments.
  - [ ] When a document describes a signature or a file, then that signature or file exists as described, or the document is amended in the same commit.
  - [ ] When a public export list is read, then everything on it is imported by something outside its slice.
