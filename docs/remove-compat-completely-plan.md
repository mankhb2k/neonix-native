# Remove Compat Completely Plan

> Status: focused deletion plan
>
> Goal: remove `packages/motion-protocol/src/compat/` completely from the source tree, so V3 is the only authoring protocol available to code, scripts, MCP tools, Skills, and AI agents.

## Decision

`compat/` should not stay in the main source tree long-term.

Current state:

- `compat/` is no longer exported from `@motionvideo/motion-protocol`.
- Product V3 paths do not need `compat`.
- Remaining `compat` users are old validation/acceptance scripts and one protocol test.
- Those scripts point to old `docs/fixtures/v2` data and should be converted, archived, or deleted.

Target state:

```text
packages/motion-protocol/src/compat/ does not exist.
```

And:

```text
rg "compat/parse-v2|src/compat|\\.\\/compat|\\.\\.\\/compat|MotionProjectV2|parseMotionProjectV2|parseMotionComponentV2|MotionComponentV2|MotionPatchSchema|applyMotionPatch" packages apps scripts -S
```

returns no production matches.

## Why Remove Compat

Keeping compat creates three problems:

- It keeps V2 authoring concepts alive in the main repo.
- Architecture gate needs broad allowlists, so passing the gate does not mean the codebase is truly V3-only.
- AI agents may learn the wrong mental model if `compat`, V2 parser names, or V2 patch APIs remain visible in source/docs.

For an AI/MCP/Skill-first product, the surface should be boringly clear:

```text
Agent / Skill / MCP / Editor
  -> MotionProject V3
  -> V3 Patch
  -> Validate
  -> Compile
  -> Preview / Render
```

## Current Compat Dependents

Known direct dependents:

| File | Current compat usage | Recommendation |
| --- | --- | --- |
| `scripts/validate-runtime-primitives.ts` | `parseMotionProjectV2`, `parseMotionComponentV2` | rewrite as V3 or replace with runtime/provider tests |
| `scripts/validate-acceptance-export.ts` | `parseMotionProjectV2`, `parseMotionComponentV2` | convert to V3 export smoke |
| `scripts/validate-acceptance-web-parity.ts` | `parseMotionProjectV2`, `parseMotionComponentV2` | convert to V3 preview/provider parity or archive |
| `scripts/score-acceptance-pack.ts` | `parseMotionProjectV2`, `parseMotionComponentV2`, old `applyMotionPatch` | replace with V3 Skill/MCP scoring later |
| `packages/motion-protocol/src/capabilities.test.ts` | `parseMotionComponentV2` | convert to V3 capability fixture/test |
| `packages/motion-protocol/src/compat/*` | V2 parser/project/component/patch/reference code | delete after dependents are gone |

## Phase 0 - Snapshot Current Behavior

Purpose: know exactly what will be lost before deleting compat.

Tasks:

- [ ] Run architecture gate:

```powershell
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

- [ ] Run protocol tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
```

- [ ] Record which compat-dependent scripts still run.
- [ ] If a script fails because fixtures are missing or APIs changed, mark it stale.
- [ ] Decide for each stale script:
  - delete
  - archive
  - rewrite as V3

Gate:

- [ ] A small table exists in PR notes listing keep/rewrite/delete decisions.

## Phase 1 - Remove Compat From User-Facing Docs

Purpose: prevent AI and contributors from treating compat as supported.

Tasks:

- [ ] Remove README references that suggest using V2 or compat.
- [ ] Replace `applyMotionPatch` docs with `applyMotionProjectV3Patch`.
- [ ] Replace `docs/fixtures/v2` mentions with V3 fixture docs or archived migration notes.
- [ ] Update comments in `packages/motion-protocol/src/index.ts` that mention old `src/legacy/*`.
- [ ] Make README say:

```text
V3 is the only authoring protocol.
compat was removed; old V2 fixtures are archived outside product paths.
```

Gate:

- [ ] `rg "compat|legacy|parseMotionProjectV2|MotionProjectV2|applyMotionPatch|docs/fixtures/v2" README.md packages/motion-protocol/README.md docs -S` only matches archived migration documents.

## Phase 2 - Replace Capability Test Dependency

Purpose: remove the only protocol test dependency on `parseMotionComponentV2`.

Tasks:

- [ ] Open `packages/motion-protocol/src/capabilities.test.ts`.
- [ ] Identify what behavior currently requires `parseMotionComponentV2`.
- [ ] Replace V2 component fixture with one of:
  - V3 embedded component fixture
  - direct capability manifest fixture
  - minimal V3 project that declares/uses the capability
- [ ] Remove import from `./compat/parse-v2`.
- [ ] Ensure capability tests still cover the same capability IDs.

Gate:

- [ ] `rg "compat/parse-v2|parseMotionComponentV2" packages/motion-protocol/src -S` returns no matches outside deleted compat files.
- [ ] `pnpm.cmd --filter @motionvideo/motion-protocol test` passes.

## Phase 3 - Convert Or Delete `validate-runtime-primitives`

Purpose: decide whether the old V2 visual primitive regression script is still worth keeping.

Current issue:

- It imports `parseMotionProjectV2` and `parseMotionComponentV2`.
- It expects `docs/fixtures/v2`.
- It imports `compileMotionProject` from render-worker compiler bridge, but the V3 bridge exposes `compileProject`.

Option A: rewrite as V3.

Tasks:

- [ ] Create or reuse V3 fixtures for:
  - hierarchy transform
  - geometry paths
  - mask compositing
  - repeater
  - text animator
  - motion path
  - effects stack
  - path morph
  - secondary motion
  - camera transition
  - media assets
- [ ] Change parser to `parseMotionProject`.
- [ ] Change compiler bridge to `compileProject`.
- [ ] Move fixture root to `docs/fixtures/v3` or `packages/motion-protocol/src/__fixtures__/v3`.
- [ ] Replace component V2 fixtures with embedded V3 components.
- [ ] Rename script to `validate-v3-runtime-primitives.ts`.
- [ ] Update `package.json` script.

Option B: delete/archive.

Tasks:

- [ ] Delete the stale script.
- [ ] Remove `validate:primitives` from root `package.json`.
- [ ] Replace with package tests that cover the same runtime primitives.
- [ ] Move old notes to archived docs if useful.

Recommendation:

```text
Rewrite only if you actively use it as visual regression.
Otherwise delete/archive now and rebuild a smaller V3 provider-preview regression later.
```

Gate:

- [ ] No active script imports `parseMotionProjectV2`.
- [ ] `pnpm validate:primitives` either runs V3 or no longer exists.

## Phase 4 - Convert Or Delete Acceptance Export Script

Purpose: remove V2 export smoke dependency.

Current script:

```text
scripts/validate-acceptance-export.ts
```

Tasks if converting:

- [ ] Replace `parseMotionProjectV2` with `parseMotionProject`.
- [ ] Replace `parseMotionComponentV2` with V3 embedded components or remove external components.
- [ ] Replace `compileMotionProject` with `compileProject`.
- [ ] Replace fixture root with V3 fixtures.
- [ ] Use one representative V3 project that includes assets, text, transition, caption/audio if possible.
- [ ] Keep MP4 probe behavior.
- [ ] Rename to `validate-v3-acceptance-export.ts`.
- [ ] Update `package.json`.

Tasks if deleting:

- [ ] Delete script.
- [ ] Remove `validate:acceptance-export` from `package.json`.
- [ ] Ensure render-worker e2e covers basic export instead.

Gate:

- [ ] Export smoke no longer imports compat.
- [ ] Export smoke either passes with V3 or is removed.

## Phase 5 - Convert Or Delete Web Parity Script

Purpose: remove V2 worker PNG checksum dependency.

Current script:

```text
scripts/validate-acceptance-web-parity.ts
```

Tasks if converting:

- [ ] Replace V2 fixtures with V3 fixtures.
- [ ] Replace `parseMotionProjectV2` with `parseMotionProject`.
- [ ] Replace `parseMotionComponentV2` with embedded V3 component fixtures.
- [ ] Replace direct draw-scene checks with provider-neutral preview result if available.
- [ ] Rename baseline from `web-parity-baseline.json` to `v3-preview-parity-baseline.json`.
- [ ] Update `package.json`.

Tasks if deleting:

- [ ] Delete script.
- [ ] Remove `validate:acceptance-web-parity` from `package.json`.
- [ ] Replace later with provider-neutral Pixi/Remotion/Canvas parity.

Gate:

- [ ] No web parity script imports compat.

## Phase 6 - Replace Acceptance Pack Scoring

Purpose: remove the last old patch/API scoring path.

Current script:

```text
scripts/score-acceptance-pack.ts
```

Current issues:

- Uses `parseMotionProjectV2`.
- Uses `parseMotionComponentV2`.
- Uses old `applyMotionPatch`.
- Scores old `docs/fixtures/v2` compositions.

Recommended direction:

```text
Replace this with a V3 Skill/MCP scoring harness, not a direct V2 conversion.
```

Tasks:

- [ ] Delete or archive `score-acceptance-pack.ts`.
- [ ] Remove `score:acceptance-pack` from `package.json`.
- [ ] Create a future task for `score:v3-skill-pack`.
- [ ] New scoring should evaluate:
  - skill manifest validity
  - generated V3 project validity
  - V3 patch validity
  - compile success
  - preview frame success
  - render/export success
  - capability preflight
  - visual/timing/reuse rubric

Gate:

- [ ] `rg "applyMotionPatch|MotionPatchSchema|score-acceptance-pack|parseMotionProjectV2" scripts package.json -S` has no active matches.

## Phase 7 - Delete Compat Folder

Purpose: remove V2 authoring code from protocol source.

Pre-delete gate:

```powershell
rg "compat/parse-v2|src/compat|\\.\\/compat|\\.\\.\\/compat|MotionProjectV2|parseMotionProjectV2|parseMotionComponentV2|MotionComponentV2|MotionPatchSchema|applyMotionPatch" packages apps scripts -S
```

Expected:

- No matches outside `packages/motion-protocol/src/compat`.

Delete:

```text
packages/motion-protocol/src/compat/
```

Tasks:

- [ ] Delete `packages/motion-protocol/src/compat/component.ts`.
- [ ] Delete `packages/motion-protocol/src/compat/project.ts`.
- [ ] Delete `packages/motion-protocol/src/compat/parse-v2.ts`.
- [ ] Delete `packages/motion-protocol/src/compat/patch.ts`.
- [ ] Delete `packages/motion-protocol/src/compat/references/`.
- [ ] Remove any tsconfig/package references if present.

Gate:

- [ ] `Test-Path packages/motion-protocol/src/compat` returns `False`.
- [ ] Protocol typecheck passes.
- [ ] Protocol tests pass.

## Phase 8 - Tighten Architecture Gate

Purpose: make the gate prove final V3 cleanliness.

Tasks:

- [ ] Remove allowlist entry for `packages/motion-protocol/src/compat/`.
- [ ] Remove allowlist entries for acceptance scripts if deleted/converted.
- [ ] Remove allowlist for protocol tests that used compat.
- [ ] Keep forbidden patterns:
  - `MotionProjectV2`
  - `MotionComponentV2`
  - `parseMotionProjectV2`
  - `parseMotionComponentV2`
  - `serializeMotionProjectV2`
  - `MotionPatchSchema`
  - `applyMotionPatch`
  - `src/compat`
  - `./compat`
  - `../compat`
- [ ] Add direct folder existence check for `packages/motion-protocol/src/compat`.
- [ ] Keep docs allowlist only for archived migration docs.

Gate:

```powershell
pnpm.cmd validate:v3-source-of-truth
```

passes with no compat allowlist.

## Phase 9 - Final Test Sweep

Purpose: ensure compat deletion did not remove useful regression coverage.

Run:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/playback-engine test
pnpm.cmd --filter @motionvideo/render-contracts test
pnpm.cmd --filter @motionvideo/pixi-renderer test
pnpm.cmd --filter @motionvideo/remotion-renderer test
pnpm.cmd validate:v3-source-of-truth
```

Optional if scripts remain:

```powershell
pnpm.cmd validate:primitives
pnpm.cmd validate:acceptance-export
pnpm.cmd validate:acceptance-web-parity
```

Gate:

- [ ] Core tests pass.
- [ ] Architecture gate passes.
- [ ] Any retained validation script is V3-only.

## Recommendation

Best path for the current repo:

1. Convert `capabilities.test.ts` away from compat.
2. Delete/archive the four stale V2 scripts unless you actively use them.
3. Remove their package scripts.
4. Delete `packages/motion-protocol/src/compat`.
5. Tighten `validate-v3-source-of-truth`.
6. Rebuild a smaller V3 visual/provider regression suite later.

Reason:

```text
The old compat scripts are currently more stale safety blanket than reliable safety net.
V3/MCP/Skill direction benefits more from a clean protocol surface.
```

## Definition Of Done

Compat removal is complete when:

- [ ] `packages/motion-protocol/src/compat/` does not exist.
- [ ] `package.json` has no scripts that rely on V2 fixtures.
- [ ] Active scripts import `parseMotionProject`, not `parseMotionProjectV2`.
- [ ] Active scripts compile through `compileProject` or `compileMotionProjectV3`.
- [ ] Public docs mention V3 only.
- [ ] Root protocol API exposes no compat patch/parser/project/component names.
- [ ] Architecture gate has no compat allowlist.
- [ ] Protocol tests pass.
