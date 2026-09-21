# Nevis frontend take-home — brief (verbatim) + owner's notes

Source of truth for the product definition, spec and README "assumptions" section.
Received 2026-09-21. Product-level content lives in `context/product/product-definition.md`;
the technical choices below feed `/awos:architecture`.

## Brief (verbatim)

Advisors and their managers need to see how their book of business develops over time, and to
drill from the whole company down to a single branch, advisor or acquisition channel.
Your task is a dashboard over the client data below, with two parts:
- A stacked bar chart showing the data over time.
- A table of the detail per month, with expandable rows that reveal the level beneath.

There is no scaffolding to clone. Start from an empty project and set it up as you see fit.
We have left parts of this brief open on purpose. Where you had to make a call, tell us what you
assumed and why, including anything you think we got wrong.

### Design
The UI and behaviour should closely match the design: Web engineer home task.
- Figma: https://www.figma.com/design/t6itC2qsmr3WLPugwrVdqS/Web-engineer-home-task
- Chart only: https://www.figma.com/design/t6itC2qsmr3WLPugwrVdqS/Web-engineer-home-task?node-id=1-2781&t=TvH76geLlDaxzr7h-0

### Requirements
- Use LLMs however you normally would.
- Use React and TypeScript.
- Serve the data from a Node.js REST API, and handle the loading and error states in the UI.
- Design component APIs the way you would on a real team: composable, with clear boundaries.
- Make it accessible. Expanding and collapsing rows has to work from the keyboard, and the
  hierarchy has to reach assistive technology.
- Test the UI, at least expand and collapse behaviour and how the data maps into the chart.
- Full responsiveness is not required, but nothing should break or overflow down to 375px.
- Use any CSS framework, charting library or state management library you like.
- Include a short README: how to run and test it, the assumptions and open questions from
  above, and what you would do next.
- Aim for about 6–8 hours. If you run out of time, ship the parts that matter most.

### Data model (verbatim, supplied 2026-09-21; original payload in `context/inbox/data.original.json`)

The data is a tree: a company holds branches, a branch holds employees, and an employee holds
acquisition channels. Every node has an `id`, a `name` and a `values` array of 12 monthly figures in
order, running Feb 2024 to Jan 2025 in the design.
The nesting is not uniform. Branch 2 and Branch 3 have no employees, and only Anna Blackwood
has channels. Your UI has to handle that.
Serve the payload below from your API. You can copy it straight out of this PDF.

### Data adjustments (owner's decision 2026-09-21 — "keep the data structure; adjustments are fine")

`context/inbox/data.json` is the payload the API serves. Same structure as the original
(`branches → employees → channels`, every node `{id, name, values[12]}`), generated deterministically
(`uuid5`, fixed seed) with these changes, so every parent equals the sum of its children in every month:

- Typos fixed: Maria Gutierrez May 2024 `22 → 44` (hence Branch 1 May `156 → 178`; Company 301 now
  reconciles); Robert Chen Aug 2024 `58 → 56` (the design's value; Branch 1 Aug 214 reconciles).
- Anna Blackwood's "Existing clients" absorbs the drift so her three channels sum to her totals;
  "New organic" / "New paid" are as supplied.
- Every adviser now has the three channels (Existing clients / New organic / New paid) — generated for
  James, Maria, Robert, Sarah — so the chart's channel legend is computable at every level.
- Branch 2 gained advisers Priya Nair, Tom Fletcher, Elena Rossi; Branch 3 gained David Okafor,
  Lucy Bennett (split ≈ 5:3:2 and 3:2 of the branch totals), each with channels.
- Company and branch totals are unchanged except Branch 1 May.
- The UI must still handle a node without children as a leaf (the brief says nesting is not uniform).

### Design access
- Editable copy (the original is view-only, which the Figma MCP rejects):
  https://www.figma.com/design/uGz8NPxIedqnyscM78YTW9/Web-engineer-home-task--Copy-?node-id=0-1
- Page `0:1` "Mockups": `1:2781` Mockup 2 (1440×900 dashboard), `5:3060` Mockup 1 (900×900) = a link to the
  interactive prototype (behaviour reference — expand/collapse, hover):
  https://www.figma.com/proto/t6itC2qsmr3WLPugwrVdqS/Frontend-engineer-home-task?page-id=0%3A1&node-id=1-2781&starting-point-node-id=1%3A2781
  components `0:1414` Row name (Level=Company|Branch|Adviser × Collapsed|Opened, Level=Attribute),
  `0:1491` Table · First and second levels, `0:1447` Table · Third level, `0:1533` Row (hover states).
- Screenshots saved in `context/inbox/design/`: `mockup-2-dashboard.png`, `table-levels-1-2-opened.png`,
  `table-level-3-opened.png`, `row-name-variants.png`, `mockup-1-prototype.png`.
- Design fidelity is not strict (owner, 2026-09-21): behaviour must work as expected; the data may be
  adjusted as long as the structure is kept.

## Owner's notes (technical direction — input to /awos:architecture)

- No Tailwind; CSS modules.
- Feature-sliced design.
- No SSR. React 19 on Vite with TypeScript; TanStack Query on the frontend.
- Consider Radix UI. Decision rule: if Radix satisfies "component APIs … composable, with clear
  boundaries", use it; if hand-written components demonstrate that skill better, build from scratch.
- Backend: Nest.js for the REST API.
- Charting: recharts is the top pick.
- Testing: Playwright tests on mocked data — at least expand/collapse and data → chart mapping.
- Accessibility is a must: keyboard expand/collapse, hierarchy exposed to assistive technology.
  Consider a library for keyboard navigation.
