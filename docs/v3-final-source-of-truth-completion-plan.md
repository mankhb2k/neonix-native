# V3 Final Source Of Truth Completion Plan

> Status: final cleanup plan
>
> Goal: finish the last V2 residue cleanup so MotionProject V3 is the only source of truth for AI, MCP, Skills, editor commands, preview, playback, render, and export.

## Current State

The core direction is now correct:

- `compat/` has been removed.
- Public package exports no longer expose `./compat/*`.
- V3 authoring uses `formatVersion: 3`.
- V3 authoring rejects `sceneOrder`, `scene.transition`, and `formatVersion: 2`.
- V3 compiler reads `timeline.visualTracks` directly.
- V3 compiler preserves runtime visual tracks instead of flattening everything into one primary track.
- V3 compiler emits runtime `formatVersion: 3`.
- Runtime IR requires `timeline.visualTracks`.
- V3 barrel circular import risk has been fixed by moving `MotionProjectV3Schema` to `v3/project.ts`.
- Main tests currently pass:
  - `@motionvideo/motion-compiler`: 79 tests
  - `@motionvideo/motion-protocol`: 218 tests
  - `@motionvideo/motion-runtime`: 238 tests
  - V3 source-of-truth gate passes

Remaining work is no longer a big migration. It is final hygiene:

- Remove remaining `*V2` aliases.
- Remove stale docs/comments that mention legacy paths.
- Convert or archive old V2 acceptance generator scripts.
- Rename runtime transition internals away from `scene.transition`.
- Tighten the source-of-truth gate so passing it means production is truly V3-clean.

## Final Target

One authoring protocol:

```text
MotionProjectV3
```

One edit protocol:

```text
MotionProjectV3Patch
```

One timeline model:

```text
timeline.visualTracks[].clips[]
```

One runtime contract:

```text
MotionRuntimeProject
```

One provider-neutral pipeline:

```text
AI / MCP / Skill / Editor
  -> MotionProjectV3
  -> validate
  -> compile
  -> MotionRuntimeProject
  -> provider adapter
  -> preview / playback / render / export
```

## Non-Goals

- Do not bring back `compat/`.
- Do not support V2 authoring input.
- Do not create a V2-to-V3 migration layer inside production packages.
- Do not keep public deprecated V2 aliases just for theoretical external users, because the project has not shipped publicly yet.

## Phase 0 - Baseline Before Cleanup

Purpose: make sure the current good state is captured before deleting aliases.

Tasks:

- [ ] Run source-of-truth gate:

```powershell
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

- [ ] Run protocol tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
```

- [ ] Run compiler tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test
```

- [ ] Run runtime tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-runtime test
```

- [ ] Snapshot remaining V2 residue:

```powershell
rg -n "MotionProjectV2|MotionComponentV2|parseMotionProjectV2|parseMotionComponentV2|serializeMotionProjectV2|NormalizedMotionProjectV2|MotionRuntimeIR|\\b\\w+V2\\b|\\b\\w+V2Schema\\b|MOTION_V2_LIMITS|sceneOrder|scene\\.transition|formatVersion:\\s*2" packages apps scripts docs -S
```

Acceptance:

- [ ] Current baseline is known.
- [ ] Any cleanup regression is easy to identify.

## Phase 1 - Remove Remaining V2 Type Aliases

Purpose: remove the last public/internal names that teach agents the wrong model.

Current known residue:

- `MotionRuntimeIR`
- `NodeTimingV2`
- `ProceduralDriverV2`
- `RuntimeDiagnosticV2`

Tasks:

- [ ] Remove `MotionRuntimeIR` from `packages/motion-protocol/src/runtime/project.ts`.
- [ ] Update comments/tests that mention `MotionRuntimeIR`.
- [ ] Remove `NodeTimingV2` from:
  - `packages/motion-protocol/src/runtime/nodes/base.ts`
  - `packages/motion-protocol/src/runtime/nodes/index.ts`
  - `packages/motion-protocol/src/v3/nodes/timing.ts`
  - `packages/motion-protocol/src/v3/nodes/index.ts`
- [ ] Remove `ProceduralDriverV2` from:
  - `packages/motion-protocol/src/v3/animation/drivers.ts`
  - `packages/motion-protocol/src/v3/animation/index.ts`
- [ ] Remove `RuntimeDiagnosticV2` from `packages/motion-runtime/src/diagnostics.ts`.
- [ ] Update any imports that still reference these aliases.
- [ ] Update root API regression test to assert these names are not exported.

Acceptance:

- [ ] This command has no production matches:

```powershell
rg -n "MotionRuntimeIR|NodeTimingV2|ProceduralDriverV2|RuntimeDiagnosticV2" packages apps scripts -S
```

- [ ] Protocol/runtime tests pass.

## Phase 2 - Clean Stale Public API Comments

Purpose: avoid confusing humans and agents with old migration language.

Problem examples:

- Root index comments still mention `src/legacy/*`.
- Some comments say "re-exported for compat".
- Some comments refer to "pending phases" that are already finished.

Tasks:

- [ ] Update `packages/motion-protocol/src/index.ts` header:
  - remove mention of `src/legacy/*`
  - say V2 authoring is removed
  - say V3 is the only authoring protocol
- [ ] Replace "re-exported for compat" with "canonical runtime exports" where applicable.
- [ ] Remove stale "pending phases" comments.
- [ ] Update package README if it still implies transitional compatibility.

Acceptance:

- [ ] Public API comments describe the current architecture, not old migration steps.
- [ ] This command has no production comment matches except negative tests/docs:

```powershell
rg -n "src/legacy|re-exported for compat|pending Phases|during the transition" packages/motion-protocol/src packages/motion-protocol/README.md -S
```

## Phase 3 - Convert Or Archive Old Acceptance Generator

Purpose: remove the last script that still generates V2-shaped project JSON.

Current issue:

`scripts/generate-acceptance-pack.mjs` still writes:

```js
formatVersion: 2
timeline: { sceneOrder: ... }
```

Decision:

Because V2 is no longer supported, prefer converting this script to V3. If the fixtures are no longer used, delete or move them outside production scripts.

Tasks:

- [ ] Check whether `scripts/generate-acceptance-pack.mjs` is referenced by package scripts, CI, docs, or README.
- [ ] If still useful, convert it to generate V3:
  - `formatVersion: 3`
  - add `composition`
  - add `capabilities`
  - add `timeline.visualTracks`
  - move scene order into visual clips
  - use clip-level `transitionOut` if needed
- [ ] If not useful, archive it under non-production docs or delete it.
- [ ] Remove references to `docs/fixtures/v2`.
- [ ] Add a V3 acceptance fixture smoke test if acceptance packs are still part of the workflow.

Acceptance:

- [ ] This command has no production matches:

```powershell
rg -n "docs[\\\\/]fixtures[\\\\/]v2|formatVersion:\\s*2|timeline:\\s*\\{\\s*sceneOrder|sceneOrder: scenes" scripts -S
```

- [ ] Acceptance generation, if retained, creates valid `MotionProjectV3`.

## Phase 4 - Rename Runtime Composition Transition Model

Purpose: make runtime internals match V3 clip-level transition semantics.

Current issue:

Runtime composition still uses `scene.transition` internally. This is not necessarily authoring V2, but it preserves the old mental model.

Target:

Runtime composition should speak in clip/layer terms:

```text
transitionOut
transitionIn
outgoingTransition
incomingTransition
```

Instead of:

```text
scene.transition
```

Tasks:

- [ ] Inspect composition input types in `packages/motion-runtime/src/composition`.
- [ ] Rename composition scene input field:
  - `transition` -> `transitionOut`, or
  - `scene.transition` -> `clip.transitionOut`
- [ ] Update `evaluate-composition-layers.ts` to read the new field.
- [ ] Update `transition-fixtures.ts` to construct clip-level transition input.
- [ ] Update composition tests.
- [ ] Update source-of-truth gate comments after the rename.

Acceptance:

- [ ] This command has no production matches:

```powershell
rg -n "scene\\.transition" packages/motion-runtime/src packages/motion-compiler/src apps/render-worker/src -S
```

- [ ] Transition tests still pass.
- [ ] Runtime terminology matches V3 authoring semantics.

## Phase 5 - Clarify Render Manifest Versioning

Purpose: avoid false confusion around `formatVersion: 2` in render manifest.

Current state:

`apps/render-worker/src/runtime/render-manifest.ts` has:

```ts
format: "moticlip-render-manifest"
formatVersion: 2
```

This is not MotionProject V2 and not runtime IR V2. It is render manifest versioning. It can stay, but the naming should be explicit enough that agents do not confuse it with project format.

Options:

- Option A: keep as-is and document it clearly.
- Option B: rename field to `manifestVersion`.
- Option C: bump to `formatVersion: 3` only if the render manifest shape changed.

Recommendation:

Use Option B if you want maximum AI clarity:

```ts
manifestVersion: 2
```

Tasks:

- [ ] Decide whether to keep `formatVersion` or rename to `manifestVersion`.
- [ ] If renaming, update render manifest type, builder, tests, and consumers.
- [ ] If keeping, add a comment that this is render manifest version, not MotionProject format.
- [ ] Update grep/gate rules to distinguish render manifest version from project/runtime version.

Acceptance:

- [ ] No agent-facing docs confuse render manifest `formatVersion` with MotionProject `formatVersion`.

## Phase 6 - Tighten Source-Of-Truth Gate

Purpose: make gate pass mean production is genuinely V3-clean.

Current issue:

The gate still allowlists some production files for transition reasons.

Tasks:

- [ ] Remove allowlist entries that are no longer needed:
  - `packages/motion-compiler/src/compile-v3.ts`
  - `packages/motion-runtime/src/composition/evaluate-composition-layers.ts`
  - `packages/motion-runtime/src/composition/transition-fixtures.ts`
- [ ] Keep allowlists only for:
  - negative tests that intentionally reject V2 inputs
  - migration docs
  - README lines explaining what not to do
- [ ] Add explicit forbidden checks for:
  - `MotionRuntimeIR`
  - `NodeTimingV2`
  - `ProceduralDriverV2`
  - `RuntimeDiagnosticV2`
  - `src/legacy`
  - production `scene.transition`
- [ ] Add a hard check that `packages/motion-protocol/src/compat/` does not exist.
- [ ] Add a hard check that `@motionvideo/motion-protocol` package exports do not expose compat or legacy paths.

Acceptance:

- [ ] Gate pass means production code has no V2 residue.
- [ ] Gate does not hide production residue behind broad allowlists.

## Phase 7 - Final Docs Pass

Purpose: make docs match the clean architecture.

Tasks:

- [ ] Update `docs/motion-format-v3.md`:
  - show only V3 authoring JSON
  - show `visualTracks`
  - explain compiler output separately as runtime IR
  - avoid showing V2 examples except in "rejected input" sections
- [ ] Update `packages/motion-protocol/README.md`:
  - AI agents generate `MotionProjectV3`
  - Skills output V3 patches or V3 projects
  - transitions belong to visual clips
  - runtime IR is generated, not manually authored by default
- [ ] Add a short "Source of Truth Contract" section:

```text
Authoring source of truth: MotionProjectV3
Editing source of truth: MotionProjectV3Patch
Runtime source of truth: MotionRuntimeProject generated from V3
Timeline source of truth: visualTracks
```

Acceptance:

- [ ] A human or agent reading docs learns V3 only.
- [ ] V2 appears only as rejected/unsupported historical context.

## Phase 8 - Final Verification

Purpose: prove the cleanup is complete.

Run:

```powershell
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
```

Run source scans:

```powershell
rg -n "compat/parse-v2|src[\\\\/]compat|\\.\\/compat|\\.\\.\\/compat|src/legacy|MotionProjectV2|MotionComponentV2|parseMotionProjectV2|parseMotionComponentV2|serializeMotionProjectV2|NormalizedMotionProjectV2|MotionRuntimeIR" packages apps scripts -S
```

```powershell
rg -n "\\b\\w+V2\\b|\\b\\w+V2Schema\\b|MOTION_V2_LIMITS|NodeTimingV2|ProceduralDriverV2|RuntimeDiagnosticV2" packages apps scripts -S
```

```powershell
rg -n "timeline\\.sceneOrder|project\\.timeline\\.sceneOrder|scene\\.transition" packages apps scripts -S
```

Expected:

- No production matches.
- Matches are allowed only in:
  - negative tests
  - docs explaining rejected V2 input
  - archived migration notes outside production paths

## Final Definition Of Done

V3 source of truth is complete when:

- [ ] No compat folder exists.
- [ ] No legacy import path is documented as supported.
- [ ] No production source exports `*V2` aliases.
- [ ] No production source requires `sceneOrder`.
- [ ] No production runtime/compiler path uses `scene.transition`.
- [ ] Compiler V3 reads `timeline.visualTracks`.
- [ ] Runtime IR uses `timeline.visualTracks`.
- [ ] Runtime IR uses `formatVersion: 3`.
- [ ] Gate passes without broad production allowlists.
- [ ] Protocol, compiler, and runtime tests pass.
- [ ] Docs teach only V3 authoring and V3 patching.

At that point, the architecture is clean enough for MCP/server/plugin work:

```text
Agent creates or edits MotionProjectV3
Moticlip validates it
Compiler produces MotionRuntimeProject
Provider renders or previews it
```
