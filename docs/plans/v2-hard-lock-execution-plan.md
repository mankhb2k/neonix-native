# V2 hard-lock execution plan

## Objective

Make the repository V2-only in code, tests, documentation, scripts, and TypeScript tooling.

The completion condition is not a scoped V2 check. The normal command
`pnpm typecheck` must pass with `apps/web/tsconfig.json`, which is the same
TypeScript project used by VS Code.

## Baseline

As of 2026-08-21:

- `pnpm --filter @motionvideo/web typecheck` reports 369 errors.
- The errors come from source that still references removed V1 contracts:
  `MotionProject`, `MotionLayer`, `V1`, `Matrix2D`, `RenderSnapshot`,
  `compileProjectV1`, `parseMotionProjectV1`, and the removed package paths
  `@motionvideo/motion-runtime/testing` and
  `@motionvideo/motion-protocol/runtime`.
- `pnpm typecheck:v2` passes only because it intentionally checks the active
  V2 graph. It is a certification command, not the full-repository gate.
- The active product routes are already V2-only:
  `/app`, `/app/editor/shape`, `/app/editor/overlap`, and `/docs/preview`.

## Rules

1. Do not restore V1 exports, V1 types, or compatibility package subpaths.
2. Do not silence V1 errors with `any`, `@ts-nocheck`, or a broad TypeScript
   exclusion while the old source remains product-accessible.
3. Every retained product path must parse `MotionProtocolV2`, compile through
   `compileProtocolV2`, evaluate `RuntimeProjectV2`, and render through the
   V2 paint/preview contract.
4. Delete a frozen V1 feature when no V2 replacement exists yet. A disabled
   V1 UI must not remain importable from an active route.
5. Keep `typecheck:v2` as a fast certified-boundary check, but use
   `pnpm typecheck` as the merge gate.

## Workstreams

| ID | Workstream | Primary scope | Completion condition |
| --- | --- | --- | --- |
| W1 | Tooling truth | root scripts, web TypeScript/Vitest configs | full vs scoped checks have clear names and expected behavior |
| W2 | Web legacy retirement | `apps/web/components/editor`, `apps/web/hooks/editor`, `apps/web/lib/editor` | no product/import graph references V1 editor code |
| W3 | V2 editor capability | `components/editor-v2`, `lib/v2-editor` | supported V2 atoms can be created, inspected, previewed, and exported |
| W4 | API/export migration | `app/api`, `lib/server/render`, export utilities | export accepts only Protocol V2/runtime V2 contracts |
| W5 | Docs and fixtures | docs components/content/tests | no V1 examples, parsers, or fixture builders remain in the web typecheck graph |
| W6 | Package cleanup | editor packages, web dependencies, root scripts | unused V1 packages and commands are removed |
| W7 | Validation | tests, typecheck, route smoke tests | all commands below pass without scoped exclusions |

## Phase 0 — Freeze and inventory

- [x] Record the full TypeScript error baseline:
  `pnpm --filter @motionvideo/web typecheck`.
- [x] Group every error by source root and missing V1 API.
- [x] Build an import map for all references into:
  - `apps/web/components/editor/**`
  - `apps/web/hooks/editor/**`
  - `apps/web/lib/editor/**`
  - `apps/web/lib/runtime/**`
- [x] Check the worktree before each deletion; do not remove user-modified
  files without reviewing the overlap.
- [x] Identify any externally used editor route, API route, or E2E suite that
  still assumes a V1 project document.

Exit criteria:

- Every legacy file is categorized as `delete`, `replace with V2`, or `test
  fixture to rewrite`.

## Phase 1 — Make typecheck semantics truthful

- [x] Keep `apps/web/tsconfig.json` as the complete VS Code project.
- [x] Make `apps/web` `typecheck` run `tsc --noEmit -p tsconfig.json`.
- [x] Keep `typecheck:v2` separate and explicitly scoped to the certified V2
  app graph.
- [x] Make root `typecheck` call the full web typecheck.
- [x] Add a CI step that runs both:
  - `pnpm typecheck`
  - `pnpm typecheck:v2`
- [x] Remove temporary generated-directory references from `tsconfig.json`:
  `.next-v2-e2e/types/**` and `.next-backend-order-e2e/types/**`.
- [x] Exclude test files from production package typechecks only where the
  package has a dedicated Vitest command; do not exclude production code.

Exit criteria:

- A successful `pnpm typecheck` proves that VS Code has no TypeScript errors
  in repository source.

## Phase 2 — Detach V1 behavior while preserving editor design

The existing editor UI is retained as a design system for the later V2 editor.
V1 document/store behavior must be detached from it; do not delete the visual
components merely because their current implementation is V1-backed.

- [x] Keep `apps/web/components/editor/**` and preserve its visual layout,
  panels, timeline, inspector, and stage composition for V2 adapters. The
  reference tree is excluded from the active product tsconfig until each
  adapter is migrated; active routes must not import it.
- [ ] Remove or replace only V1 behavior/imports behind that design:
  `apps/web/hooks/editor/**`, `apps/web/lib/editor/**`, and V1-only helpers
  under `apps/web/lib/runtime/**` after each replacement is available.
- [ ] Rewire `NewProjectModal` and `ProjectList` to V2 project creation and
  storage, or leave them as presentational components until that adapter exists.
- [x] Remove old V1 editor test fixtures, editor E2E tests, Vite phase-zero
  fixture scripts, and Storybook stories that import the retired editor.
- [ ] Remove V1-only dependencies from `apps/web/package.json` once no source
  imports them: `@motionvideo/editor-core`,
  `@motionvideo/editor-core` interaction module, `@motionvideo/patterns`, and any V1
  store-only dependency.
- [ ] Verify no source import remains for:
  - `@motionvideo/motion-runtime/testing`
  - `@motionvideo/motion-protocol/runtime`
  - `MotionProject`, `MotionLayer`, `V1`, `Matrix2D`, `RenderSnapshot`
  - `parseMotionProject*`, `compileProjectV1`, `compileMotionProject`

Exit criteria:

- `rg` finds no V1 package path or removed V1 symbol in web production source.
- The old editor is physically absent or fully replaced, not merely hidden by
  TypeScript configuration.

## Phase 3 — Finish the V2 editor surface

- [ ] Define the supported V2 authoring atom list (currently certified shape
  rectangle/ellipse capabilities).
- [ ] Make the V2 editor use `MotionProtocolV2Schema.safeParse` at every
  document boundary.
- [ ] Add V2 project persistence with a new storage key/version. Do not read
  V1 localStorage envelopes.
- [ ] Implement atom creation, selection, property editing, z-index editing,
  timing editing, and document JSON inspection only for certified atoms.
- [ ] Use `PreviewStage`/`createPreviewRenderer` for preview; do not add a DOM
  or Canvas2D V1 stage adapter.
- [ ] Implement V2 transport with `frameIndexAtTime` and composition FPS.
- [ ] Return a clear unsupported-capability result for atoms not yet certified.

Exit criteria:

- `/app/editor/:projectId` creates and edits a valid V2 document end-to-end.
- Invalid V2 JSON is rejected before compile/preview.

## Phase 4 — Migrate API and export paths

- [ ] Change every web API input type from a V1 project type to
  `MotionProtocolV2` or `RuntimeProjectV2` as appropriate.
- [ ] Ensure `/api/ai/generations` accepts/validates only Atomic Protocol V2.
- [ ] Ensure `/api/export` and `/api/renders` compile V2 before producing a
  render manifest.
- [ ] Remove V1 project envelope export helpers and local render-worker export
  registries.
- [ ] Keep export tests on the canonical paint command contract, including
  `beginFrame.projection.worldToClipMatrix`.
- [ ] Verify Remotion export consumes Runtime V2 paint commands only.

Exit criteria:

- An export request with V1 format/version is rejected.
- V2 shape export passes protocol → compiler → runtime → paint → Remotion.

## Phase 5 — Remove V1 docs, examples, and fixtures

- [ ] Delete or rewrite `apps/web/lib/docs` pages that import V1 parsers,
  `MOTION_PROTOCOL_LIMITS`, or V1 compiler APIs.
- [ ] Remove V1-only docs components such as old JSON/project/timeline visual
  examples when no V2 equivalent exists.
- [ ] Update README and guide text so the only documented document format is
  `motion-protocol` with `formatVersion: 2`.
- [ ] Replace V1 test fixtures with `MotionProtocolV2` fixtures.
- [ ] Keep the V2 preview lab as the canonical interactive docs example.

Exit criteria:

- Web docs compile without V1 imports and no public documentation claims V1 is
  supported.

## Phase 6 — Package and script cleanup

- [x] Remove obsolete root scripts for desktop, worker, V1 validators, AI
  evaluation, benchmarks, and Storybook from the V2 test contract.
- [ ] Remove package scripts whose only consumers were deleted V1 tests.
- [ ] Remove workspace packages that are exclusively V1 editor support after
  confirming no other application imports them.
- [ ] Keep these root commands:
  - `pnpm dev`
  - `pnpm build`
  - `pnpm typecheck`
  - `pnpm typecheck:v2`
  - `pnpm test`
  - `pnpm test:app`, `test:protocol`, `test:compiler`, `test:runtime`,
    `test:preview`, `test:export`
  - V2 boundary/hard-lock validators
- [ ] Update CI workflows that invoke removed scripts.

Exit criteria:

- No root script invokes desktop, V1, stale E2E, or removed package code.

## Phase 7 — Verification and release gate

Run in this order:

```powershell
pnpm typecheck
pnpm typecheck:v2
pnpm test
node scripts/validate-v2-boundary.mjs
node scripts/validate-v2-runtime-boundary.mjs
node scripts/validate-v2-consumers.mjs
node scripts/validate-v2-renderers.mjs
node scripts/validate-v2-core.mjs
node scripts/validate-v2-hard-lock.mjs
pnpm --filter @motionvideo/web build
```

Then smoke test:

```text
GET /app                 -> 200
GET /app/editor/shape    -> 200
GET /app/editor/overlap  -> 200
GET /docs/preview        -> 200
```

Final release gate:

- [ ] `pnpm typecheck` exits 0 with the full web `tsconfig.json`.
- [ ] `pnpm test` exits 0.
- [ ] All V2 validators exit 0.
- [ ] No source references V1 contracts or removed package subpaths.
- [ ] No `.next-*` directory is tracked by Git.
- [ ] `git diff --check` exits 0.

## Suggested execution order

1. Phase 1 (truthful typecheck).
2. Phase 2 (detach V1 behavior while preserving editor design).
3. Phase 5 (remove V1 docs/fixtures pulled into web typecheck).
4. Phase 4 (API/export contract cleanup).
5. Phase 3 (expand actual V2 editor capability).
6. Phase 6 and Phase 7 (package cleanup and release gate).

This order prevents a temporary compatibility layer from becoming permanent
and makes the TypeScript error count fall by entire retired dependency graphs,
not by cosmetic one-line substitutions.
