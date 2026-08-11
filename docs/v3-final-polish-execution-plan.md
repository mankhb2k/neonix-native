# V3 Final Polish Execution Plan

> Status: final execution checklist
>
> Goal: finish the last cleanup items so the V3 source-of-truth gate is trustworthy and all agent-facing naming is V3/visualTracks-first.

## Current Position

The main V3 architecture is already in good shape:

- `compat/` is gone.
- V3 authoring is the public source of truth.
- Runtime IR uses `formatVersion: 3`.
- Runtime timeline uses `visualTracks`.
- Compiler V3 reads `timeline.visualTracks` directly.
- Runtime composition now uses `transitionOut` instead of `scene.transition`.
- Protocol tests pass.
- V3 source-of-truth gate currently passes.

Remaining work is small but important:

- Fix the gate regex bug for removed V2 aliases.
- Rename `motion-workspace.sceneOrder` to a V3-neutral name.
- Remove stale V2 wording in comments.
- Re-run tests and scans.

## Phase 0 - Baseline

Purpose: confirm what is currently passing before touching the final polish items.

Tasks:

- [ ] Run architecture gate:

```powershell
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

- [ ] Run protocol tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
```

- [ ] Run runtime tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-runtime test
```

- [ ] Run compiler tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test
```

- [ ] Snapshot remaining surface residue:

```powershell
rg -n "MotionRuntimeIR|NodeTimingV2|ProceduralDriverV2|RuntimeDiagnosticV2|ImageNodeV2|VideoNodeV2|sceneOrder|scene\\.transition" packages apps scripts -S
```

Acceptance:

- [ ] We know if any later failure was introduced by this cleanup.

## Phase 1 - Fix Source-Of-Truth Gate Regex

Purpose: make the gate actually catch removed V2 aliases if they are reintroduced.

Problem:

Some forbidden regexes in `scripts/validate-v3-source-of-truth.ts` contain a backspace character instead of a regex word boundary.

Bad:

```ts
/MotionRuntimeIR/
```

Good:

```ts
/\bMotionRuntimeIR\b/
```

Tasks:

- [ ] Replace broken regex patterns for:
  - `MotionRuntimeIR`
  - `NodeTimingV2`
  - `ProceduralDriverV2`
  - `RuntimeDiagnosticV2`
  - `NormalizedMotionProjectSchema`
- [ ] Add or update a tiny regression test/script fixture if the repo already has tests for the gate.
- [ ] Manually verify the gate fails if a temporary forbidden string is inserted into a non-allowlisted scratch file.
- [ ] Remove the scratch file after verification.

Acceptance:

- [ ] The gate catches removed V2 aliases.
- [ ] The gate still passes on clean source.

Verification:

```powershell
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

## Phase 2 - Rename Workspace `sceneOrder`

Purpose: remove the last confusing authoring-adjacent `sceneOrder` API.

Context:

`packages/motion-workspace` is build-time tooling and currently links modules into a valid `MotionProjectV3`. It does not break runtime V3. However, `sceneOrder` is still a V2-shaped name and can confuse AI/MCP/Skill users.

Recommended new name:

```ts
sceneModules
```

Why:

- It describes workspace files, not timeline clips.
- It avoids reusing old timeline vocabulary.
- The linker can still convert module order into `timeline.visualTracks`.

Tasks:

- [ ] Update manifest schema:
  - `sceneOrder` -> `sceneModules`
- [ ] Update linker:
  - `manifest.sceneOrder` -> `manifest.sceneModules`
- [ ] Update workspace tests:
  - fixture field names
  - assertion names
  - test descriptions
- [ ] Update comments:
  - "Load all scene modules in sceneOrder" -> "Load scene modules in manifest order"
- [ ] If backward compatibility is not needed, do not keep an alias.
- [ ] If compatibility is needed temporarily, keep it only in a migration parser, not in the canonical manifest type.

Acceptance:

- [ ] `MotionWorkspaceManifestSchema` no longer exposes `sceneOrder`.
- [ ] The linker still outputs V3 `timeline.visualTracks`.
- [ ] This command has no production matches in workspace:

```powershell
rg -n "sceneOrder" packages/motion-workspace/src -S
```

Suggested verification:

```powershell
pnpm.cmd --filter @motionvideo/motion-workspace test
```

If there is no package-specific test script, run the root/package test command used by the repo.

## Phase 3 - Remove Stale V2 Comments

Purpose: keep the source readable for agents and future contributors.

Known stale comment:

```text
ImageNodeV2 / VideoNodeV2
```

Tasks:

- [ ] Update `apps/desktop/gui/editor/library/adapters/payload-to-timeline-command.ts`.
- [ ] Replace V2 schema wording with neutral names:
  - `ImageNodeSchema`
  - `VideoNodeSchema`
  - or simply "image/video node schema"
- [ ] Search for similar stale comments in production source.

Verification:

```powershell
rg -n "ImageNodeV2|VideoNodeV2|V2Schema|\\b\\w+V2\\b" apps packages scripts -S
```

Acceptance:

- [ ] Remaining V2 mentions are only in negative tests, diagnostics explaining rejected input, or docs about migration/history.

## Phase 4 - Review Gate Allowlist

Purpose: reduce false confidence from broad allowlists.

Tasks:

- [ ] Review each allowlist entry in `scripts/validate-v3-source-of-truth.ts`.
- [ ] Keep allowlists for:
  - negative tests
  - V3 validators that explain rejected V2 input
  - docs that intentionally explain migration or unsupported V2
- [ ] Remove allowlists for production code where possible.
- [ ] Confirm `packages/motion-runtime/src/composition/*` no longer needs a `scene.transition` allowlist.
- [ ] Confirm `packages/motion-compiler/src/compile-v3.ts` no longer needs any V2 allowlist.

Acceptance:

- [ ] The gate is strict enough that a pass means production source is clean.
- [ ] Production paths are not broadly hidden from scans.

Verification:

```powershell
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

## Phase 5 - Final Test Matrix

Purpose: prove final polish did not break runtime/compiler/protocol behavior.

Tasks:

- [ ] Run protocol tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
```

- [ ] Run runtime tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-runtime test
```

- [ ] Run compiler tests:

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test
```

- [ ] Run workspace tests if available:

```powershell
pnpm.cmd --filter @motionvideo/motion-workspace test
```

- [ ] Run source-of-truth gate:

```powershell
pnpm.cmd --filter @motionvideo/render-worker exec tsx ../../scripts/validate-v3-source-of-truth.ts
```

Acceptance:

- [ ] All available tests pass.
- [ ] Any package without a test script is explicitly noted.

## Phase 6 - Final Source Scans

Purpose: confirm no production residue remains.

Run:

```powershell
rg -n "compat/parse-v2|src[\\\\/]compat|\\.\\/compat|\\.\\.\\/compat|src/legacy|MotionProjectV2|MotionComponentV2|parseMotionProjectV2|parseMotionComponentV2|serializeMotionProjectV2|NormalizedMotionProjectV2|MotionRuntimeIR" packages apps scripts -S
```

Run:

```powershell
rg -n "\\b\\w+V2\\b|\\b\\w+V2Schema\\b|MOTION_V2_LIMITS|NodeTimingV2|ProceduralDriverV2|RuntimeDiagnosticV2|ImageNodeV2|VideoNodeV2" packages apps scripts -S
```

Run:

```powershell
rg -n "timeline\\.sceneOrder|project\\.timeline\\.sceneOrder|scene\\.transition" packages apps scripts -S
```

Run workspace-specific scan:

```powershell
rg -n "sceneOrder" packages/motion-workspace/src -S
```

Allowed matches:

- Negative tests that verify V2 rejection.
- V3 MCP/Skill diagnostics explaining invalid user input.
- Docs that explicitly say V2 is unsupported.

Not allowed:

- Production schema fields.
- Production parser support.
- Public exports.
- Runtime/compiler production code requiring V2 names or `sceneOrder`.

## Final Definition Of Done

This final polish is complete when:

- [ ] Gate regexes use real word boundaries.
- [ ] Reintroducing a removed alias fails the gate.
- [ ] `motion-workspace` no longer exposes `sceneOrder`.
- [ ] Production comments no longer mention V2 node schema names.
- [ ] Runtime composition uses `transitionOut`, not `scene.transition`.
- [ ] Protocol, runtime, compiler, and workspace tests pass where available.
- [ ] Final scans show no production V2 residue.

After this, the repo is clean enough to start MCP/server/provider work with a clear contract:

```text
Agents author MotionProjectV3.
Skills produce MotionProjectV3Patch or MotionProjectV3.
Compiler derives MotionRuntimeProject.
Providers consume runtime only.
```
