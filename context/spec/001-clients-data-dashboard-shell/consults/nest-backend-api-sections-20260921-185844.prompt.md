You are running as the **`nest-backend`** agent (`claude --agent nest-backend`): your instructions are `.claude/agents/nest-backend.md`; the skills it lists are in `.claude/skills/`. Read `CLAUDE.md` first.
This is a **consultation**, not a lane: answer the questions below in markdown. Read, search and run read-only commands as you need (verify versions and option names — do not guess). Create or edit **no files**, with one exception: when your answer is complete, write it in full to `context/spec/001-clients-data-dashboard-shell/consults/nest-backend-api-sections-20260921-185844.md` with the Write tool (that path is pre-approved), then end your turn with exactly this line:

    CONSULT nest-backend api-sections: DONE

The lead quotes the file verbatim — no preamble, no restating the questions; cite the files and commands you used to verify facts.

---

# Consultation for the technical specification of spec 001 — backend, contracts, workspace wiring

You are drafting the backend and shared-contracts sections of `context/spec/001-clients-data-dashboard-shell/technical-considerations.md`. The lead assembles the document; you answer the questions below. Structures and contracts, not implementations: file paths + responsibilities, endpoint + payload shapes, config keys and their purpose, commands. No full code, no full config files. Where you assert a version or an option name, verify it (`npm view <pkg> version`, official docs via WebFetch) and say how you verified.

Read first:
- `context/spec/001-clients-data-dashboard-shell/functional-spec.md` — FR1, FR2, FR4 (contract, switches, consistency warnings, health, timings)
- `context/product/architecture.md` — §1 (Backend framework, Shared contracts), §2, §3, §4
- `context/inbox/clients-data-dashboard-shell.md` — decisions D1–D4, D10, D12–D13, risks R1–R2
- `context/inbox/data.json` — the payload to serve (keys `branches` / `employees` / `channels`; child lists may be absent)

The repo has NO application code yet: this spec also creates the pnpm workspace (`apps/web`, `apps/api`, `packages/contracts`). Node 22, pnpm 10.

## Questions

1. **`packages/contracts` wiring (risk R1).** One workspace package consumed by BOTH Vite (browser ESM, TS) and Nest (Node, ts-jest / tsc). Options: (a) TS source exported via package.json `exports` → consumers compile it; (b) built `dist` with a build step and `types`; (c) tsconfig `paths`. Recommend one, say why, and list the package.json / tsconfig keys the contracts package must contain (keys only). Then the schema/type layout: `ClientsResponse { months: string[12]; company: TreeNode }`, `TreeNode { id, name, values: number[12], branches?, employees?, channels? }`. Should `TreeNode` be one recursive type with three optional child keys, or a discriminated union by level? Justify against the functional spec's leaf rule (missing/empty child list = leaf) and its "wrong shape" definition (missing months/company, missing id/name, values not exactly 12 numbers). Name the zod schema exports.
2. **`apps/api` layout inside the workspace.** Files with one-line responsibilities: `nest-cli.json`, `tsconfig.json`, `tsconfig.build.json`, jest config, `src/main.ts`, `src/app.module.ts`, `src/clients/{clients.module, clients.controller, clients.service, clients.repository (interface + DI token), json-clients.repository, consistency}.ts`, `src/clients/data/clients.json`, `src/health/…`, `test/`. Scripts: dev (watch), build, start, lint, typecheck, test, test:e2e. Which NestJS major (verify 12.x on Node 22, or recommend 11.x with a reason).
3. **`GET /api/clients` contract.** Response JSON shape; where `months` comes from (constant in contracts vs derived from a configured start month + values length — recommend); status codes; error body shape (Nest default `{ statusCode, message, error }`?); `GET /api/health` shape; global prefix `api`.
4. **Dev-only switches** `?delay=<ms>` and `?fail=1` (both present: wait, then fail). Where to implement (controller vs interceptor vs middleware), how gated (`NODE_ENV !== 'production'`? a dedicated env var?), what the production build does with them (ignore entirely), a cap on `delay`, the 500 body for `fail`. Simplest correct option.
5. **Data loading.** Import the JSON at build time vs `fs.readFile` at boot; how tests inject a different dataset (DI token for the path or the object) for the "broken fixture", "childless branch" and "zero branches" acceptance criteria.
6. **Consistency check.** Where it runs (`OnModuleInit` of repository or service?), algorithm outline (per node, per month, children = whichever child key exists), log line format (`Logger.warn` with node path + month), never throws, never mutates.
7. **CORS** for the Vite origin in dev (config keys), listen port 3000, the Vite-proxy assumption (the web app calls same-origin `/api/...` in dev).
8. **Tests** (Jest via Nest CLI + supertest): list the test files and what each proves, mapped to FR2's acceptance criteria — envelope validates against the contracts zod schema; `company` deep-equals the data file; childless levels; health; no warnings on shipped data; one warning per mismatch on a broken fixture; `fail=1` → 500; `delay=3000` ≥ 3 s; production ignores switches (how to test the gate without a real production build).
9. **Root workspace pieces the backend needs from the scaffold:** `pnpm-workspace.yaml` packages, root scripts `check:api` (= lint + typecheck + test for api and contracts), how `pnpm dev` runs api + web concurrently (`pnpm -r --parallel` vs `concurrently`), `.nvmrc`.

Aim for ~150–200 lines. End with **Risks I see** (max 5) specific to this stack.
