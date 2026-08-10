# Motion Project V3 Refactor Plan

> Status: Draft implementation plan
>
> Source design: [`json-project-design.md`](../json-project-design.md)
>
> **Chi tiết triển khai từng task:** [`motion-project-v3-implementation-detail.md`](./motion-project-v3-implementation-detail.md) — chứa breakdown granular đến từng file, function signature, và acceptance criteria.
>
> Goal: upgrade the current v2 authoring format into Motion Project v3 while preserving the single source of truth model:
>
> ```text
> MotionProject v3 authoring JSON
>   -> compile/link/prepare
>   -> MotionRuntime IR
>   -> evaluateCompositionFrame
>   -> Pixi preview / Remotion export / playback
> ```

## 0. Current State

The repo already has the right package shape:

| Package                          | Current responsibility                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `@motionvideo/motion-protocol`   | v2 authoring schema, runtime IR schema, limits, references, patch schema, capabilities |
| `@motionvideo/motion-compiler`   | v2 authoring project -> `NormalizedMotionProjectV2`                                    |
| `@motionvideo/motion-runtime`    | frame evaluation, paint/audio/media plans, diagnostics                                 |
| `@motionvideo/playback-engine`   | playback clock and frame scheduling over runtime IR                                    |
| `@motionvideo/pixi-renderer`     | preview painter over runtime output                                                    |
| `@motionvideo/remotion-renderer` | export painter over runtime output                                                     |
| `@motionvideo/render-contracts`  | render jobs, manifest, worker protocol                                                 |
| `@motionvideo/editor-core`       | editor commands, projection, selection, history                                        |

Important existing split:

```text
MotionProjectV2
  authoring data for AI/editor/save

NormalizedMotionProjectV2
  compiled runtime artifact for preview/export/playback
```

V3 should keep this split. The refactor is not to make one object do every job. The refactor is to make `MotionProjectV3` the only persisted authoring source of truth, and make all runtime artifacts derived from it.

## 1. Non-Negotiable Rules

- Keep v2 parsing and fixtures stable until v3 parity is proven.
- Do not make Pixi, Remotion, playback, or React read workspace modules directly.
- Do not move compiler semantics into runtime or painters.
- Do not store editor UI state inside canonical project JSON.
- Do not add v3 fields to AI/editor allowlists until schema -> compiler -> runtime -> Pixi -> Remotion gates are green.
- Runtime IR remains generated output, not an editable project format.
- Any v3 migration must be deterministic and fixture-backed.

## 2. Target Artifact Model

```text
motion-workspace
  Multi-file authoring source for humans, AI, Git, and larger projects.

motion-project v3
  Portable canonical authoring JSON. This is the persisted source of truth.

motion-runtime
  Compiled renderer artifact. This is generated and cacheable.

render-manifest
  Build metadata for cloud/local render reproducibility.
```

Required discriminators:

| Artifact           | `format`                                     | Editable | Renderer reads directly |
| ------------------ | -------------------------------------------- | -------- | ----------------------- |
| Workspace manifest | `motion-workspace`                           | yes      | no                      |
| Project bundle     | `motion-project`                             | yes      | no                      |
| Runtime IR         | `motion-runtime`                             | no       | yes                     |
| Render manifest    | `motion-render-manifest` or current contract | no       | render worker only      |

## 3. Phase 1 - Freeze V2 Baseline

Purpose: make sure v3 work cannot accidentally change current output.

Tasks:

- [ ] Add/confirm representative v2 fixtures:
  - minimal empty project
  - single scene
  - scene with text/image/svg/video/audio
  - scene with clips/tracks/presets
  - scene with caption track
  - scene with transition
  - project with variables and bindings
  - project with component instance
- [ ] Add parse -> serialize -> parse round-trip tests for v2.
- [ ] Add compile v2 -> runtime fixture snapshots.
- [ ] Add runtime frame fingerprints for key frames.
- [ ] Add Pixi/Remotion structural parity fixtures where currently supported.
- [ ] Add migration guard: v2 meaning must not change in-place.

Gate:

- [ ] `@motionvideo/motion-protocol` tests pass.
- [ ] `@motionvideo/motion-compiler` tests pass.
- [ ] `@motionvideo/motion-runtime` tests pass.
- [ ] Pixi and Remotion existing parity tests pass.
- [ ] Golden v2 compile outputs are checked in or reproducible through a fixture command.

## 4. Phase 2 - Add V3 Protocol Types Beside V2

Purpose: introduce v3 without switching consumers.

Files to add:

```text
packages/motion-protocol/src/v3/
  index.ts
  common.ts
  metadata.ts
  composition.ts
  capabilities.ts
  assets.ts
  variables.ts
  components.ts
  scenes.ts
  timeline.ts
  nodes/
  animation/
  extensions.ts
  provenance.ts
  references/
```

Tasks:

- [ ] Add `MOTION_PROJECT_V3_FORMAT_VERSION = 3`.
- [ ] Add `MotionProjectV3Schema`.
- [ ] Add `CompositionSettingsSchema`:
  - `width`
  - `height`
  - `fps`
  - `background`
  - `colorSpace`
  - `audioSampleRate`
  - optional `safeArea`
  - optional `motionBlur`
- [ ] Move brand/design-system authoring from v2 metadata shape into v3 `tokens`.
- [ ] Add `ProjectCapabilityRequirementsSchema`.
- [ ] Add v3 `ProjectTimelineSchema` with `visualTracks`, `audioTracks`, and `captionTracks`.
- [ ] Add v3 `VisualTrackSchema` and `VisualClipSchema`.
- [ ] Remove `scene.transition` from v3 scene shape.
- [ ] Keep scene-local `clips` for node animation.
- [ ] Add embedded component profile shape:
  - `components: EmbeddedComponent[]`
  - dependency pinning remains in `dependencies`.
- [ ] Add namespaced `extensions: Record<string, JsonValue>`.
- [ ] Add `ProjectProvenanceSchema`, excluded from render hash.
- [ ] Export v3 types from `@motionvideo/motion-protocol/v3` or from the main barrel with explicit names.

Gate:

- [ ] Minimal v3 project parses.
- [ ] Representative v3 project parses.
- [ ] Unknown fields reject except allowed extension namespaces.
- [ ] `formatVersion: 3` never parses through v2 parser by accident.

## 5. Phase 3 - V2 To V3 Migration

Purpose: make existing projects open cleanly as v3.

Files to add:

```text
packages/motion-protocol/src/v3/migrations/v2-to-v3.ts
packages/motion-protocol/src/v3/migrations/v2-to-v3.test.ts
```

Migration rules:

| V2                                      | V3                                                         |
| --------------------------------------- | ---------------------------------------------------------- |
| `metadata.aspectRatio` + `metadata.fps` | `composition.width/height/fps`                             |
| `metadata.safeArea`                     | `composition.safeArea`                                     |
| `metadata.designTokens`                 | `tokens`                                                   |
| `metadata.brand`                        | `tokens` plus optional variables/provenance                |
| `timeline.sceneOrder`                   | `timeline.visualTracks[main].clips`                        |
| `scene.transition`                      | corresponding visual clip `transitionOut`                  |
| `timeline.audioTracks`                  | v3 audio tracks with explicit duration/rate where possible |
| `extensions.constraints/events`         | namespaced `extensions` keys                               |

Tasks:

- [ ] Implement `migrateMotionProjectV2ToV3(project, options)`.
- [ ] Accept an optional asset metadata resolver for audio/video duration.
- [ ] Emit structured migration diagnostics:
  - missing asset duration
  - transition longer than clip/scene lifetime
  - unsupported component dependency
  - brand font not resolvable to font asset
  - aspect ratio mapped through default preset
- [ ] Add golden fixtures:
  - v2 minimal -> v3 minimal
  - v2 sceneOrder -> v3 main visual track
  - v2 transition -> v3 clip transition
  - v2 brand/designTokens -> v3 tokens
  - v2 audio -> v3 audio

Gate:

- [ ] Migration is deterministic.
- [ ] V2 source hash and v3 project hash are separately defined.
- [ ] Every migration warning has a stable code and path.

## 6. Phase 4 - Parse API And Compatibility Surface

Purpose: allow apps to adopt v3 gradually.

Tasks:

- [ ] Add `parseMotionProjectAny(input)` returning a tagged union:
  - `{ version: 2, project: MotionProjectV2 }`
  - `{ version: 3, project: MotionProjectV3 }`
- [ ] Add `parseMotionProjectV3`.
- [ ] Add `serializeMotionProjectV3`.
- [ ] Decide when the canonical alias flips:
  - short term: `MotionProject = MotionProjectV2`
  - migration phase: `MotionProject = MotionProjectV2 | MotionProjectV3`
  - final phase: `MotionProject = MotionProjectV3`
- [ ] Add `normalizeLegacyMotionInput` support only where it is still valid.
- [ ] Generate JSON Schema for v2 and v3.

Gate:

- [ ] Apps can continue loading v2.
- [ ] Tests can explicitly target v3.
- [ ] No runtime package needs to parse authoring JSON directly.

## 7. Phase 5 - Compiler V3 Entry Point

Purpose: make compiler the only conversion path from v3 authoring to runtime.

Files likely touched:

```text
packages/motion-compiler/src/index.ts
packages/motion-compiler/src/compile-v3.ts
packages/motion-compiler/src/timeline-v3.ts
packages/motion-compiler/src/compile-result.ts
```

Tasks:

- [ ] Add `compileMotionProjectV3(project, options)`.
- [ ] Keep `compileMotionProject(project)` working for v2 during transition.
- [ ] Compile v3 `composition` into runtime metadata/viewport settings.
- [ ] Compile `timeline.visualTracks` into composition-level runtime plan.
- [ ] Compile visual clips:
  - scene source
  - component source
  - start/duration
  - trimStart
  - playbackRate
  - loop
  - opacity
  - transitionIn/transitionOut
- [ ] Compile scene-local clips/tracks into runtime scene tracks.
- [ ] Resolve variables and bindings before runtime IR.
- [ ] Flatten component instances or embed/namespace as required by the chosen profile.
- [ ] Bake layout and text measurement inputs where compile-time.
- [ ] Bake caption token segmentation into runtime-ready caption/cue data if needed.
- [ ] Add compiler diagnostics with project paths/source refs.
- [ ] Add compile cache key that includes:
  - project hash
  - compiler version
  - protocol version
  - capability registry version
  - component dependency hashes

Gate:

- [ ] v3 minimal compiles.
- [ ] v3 representative project compiles.
- [ ] Runtime IR has no unresolved variable/component/layout/preset.
- [ ] v3 compile result validates against runtime schema.

## 8. Phase 6 - Runtime IR VNext

Purpose: make runtime represent v3 composition semantics without leaking authoring concerns.

Decision:

- Keep serialized runtime format named `format: "motion-runtime"`.
- Add a runtime version field if needed, separate from project `formatVersion`.
- Consider renaming the type from `NormalizedMotionProjectV2` to a neutral alias:
  - `MotionRuntimeProject`
  - `MotionRuntimeIR`
  - `NormalizedMotionRuntimeProject`

Tasks:

- [ ] Add composition-level runtime metadata:
  - width
  - height
  - fps
  - background
  - color space
  - audio sample rate
- [ ] Add runtime visual track/clip plan, or a compiled composition layer plan.
- [ ] Keep runtime scenes literal and renderer-ready.
- [ ] Add stable clip/layer keys for repeated scene usage.
- [ ] Add source refs that map runtime output back to v3 project paths.
- [ ] Add runtime hash inputs.
- [ ] Decide whether `PreparedRuntimeProject` remains in `motion-protocol` or moves to `motion-compiler`.

Gate:

- [ ] Runtime IR is serializable without `Map`.
- [ ] Prepared in-memory indexes are generated separately.
- [ ] Runtime IR validates independently of authoring project.

## 9. Phase 7 - Composition Evaluator V3

Purpose: evaluate project-level visual tracks instead of only `timeline.sceneOrder`.

Files likely touched:

```text
packages/motion-runtime/src/evaluate-composition.ts
packages/motion-runtime/src/resolve-timeline.ts
packages/motion-runtime/src/audio-render-plan.ts
packages/motion-runtime/src/evaluated-frame.ts
```

Tasks:

- [ ] Evaluate all active visual clips at composition time.
- [ ] Resolve scene local time from:
  - clip start
  - trimStart
  - playbackRate
  - loop
  - scene intrinsic duration
- [ ] Evaluate overlay tracks deterministically.
- [ ] Resolve transition layers from visual clip transitions.
- [ ] Produce one `EvaluatedCompositionFrame`.
- [ ] Ensure hit-test and paint use the same evaluated transforms.
- [ ] Resolve audio plan from v3 audio tracks.
- [ ] Resolve caption/cue/token activity from v3 caption tracks.
- [ ] Carry diagnostics with source paths.

Gate:

- [ ] cut/fade/crossfade/slide/wipe/zoom fixtures pass at before/start/middle/end/after frames.
- [ ] Same runtime frame gives same structural fingerprint.
- [ ] Hit-test snapshots match paint snapshots.

## 10. Phase 8 - Paint, Pixi, Remotion, Playback Adoption

Purpose: consumers should read only runtime/evaluated contracts.

Tasks:

- [ ] Update Pixi preview to consume the v3 evaluated frame without reading v3 authoring fields.
- [ ] Update Remotion renderer to consume the same evaluated frame contract.
- [ ] Update playback-engine load type to neutral runtime type, not v2-named type.
- [ ] Update render-worker to compile v3 before render.
- [ ] Update render manifest to include:
  - project hash
  - runtime hash
  - compiler version
  - protocol version
  - capability fingerprint
  - asset/font hashes
- [ ] Add preflight for required capabilities.

Gate:

- [ ] Pixi and Remotion render the same composition plan.
- [ ] Export does not compile differently from preview.
- [ ] Playback never compiles in RAF/play loop.

## 11. Phase 9 - Editor And AI Adoption

Purpose: move authoring surfaces from v2 assumptions to v3.

Editor tasks:

- [ ] Update project creation to emit v3.
- [ ] Update persistence/load envelope to accept v2 and v3.
- [ ] Add migration prompt or automatic migration policy.
- [ ] Update timeline projection:
  - v2 `sceneOrder` projection remains compatibility
  - v3 `visualTracks` becomes canonical timeline
- [ ] Update editor commands so timeline move/trim/reorder edits v3 visual clips.
- [ ] Keep editor-only state in workspace/editor state files, not project JSON.

AI tasks:

- [ ] Update prompt schema block to v3 JSON Schema.
- [ ] Keep AI allowlist capability-gated.
- [ ] Add v3 command patching for:
  - variables
  - tokens
  - visual clip edits
  - scene node edits
  - caption edits
- [ ] Add critic checks for v3 timeline/capability invariants.

Gate:

- [ ] AI can generate minimal v3 project.
- [ ] Editor can open v2, migrate to v3, save v3, compile v3, preview v3.
- [ ] Undo/redo commits canonical v3 project transactions.

## 12. Phase 10 - Workspace And Linker

Purpose: support multi-file projects without letting renderers know about workspace shape.

New package:

```text
packages/motion-workspace/
  package.json
  src/schema.ts
  src/loader.ts
  src/resolver.ts
  src/linker.ts
  src/canonicalize.ts
  src/source-map.ts
```

Tasks:

- [ ] Add `MotionWorkspaceManifestSchema` with `format: "motion-workspace"`.
- [ ] Add `MotionWorkspaceReader` interface.
- [ ] Add memory reader for tests.
- [ ] Add filesystem reader for local tooling if needed.
- [ ] Implement linker:
  - read manifest
  - parse modules
  - resolve paths
  - detect import cycles
  - validate module-local IDs
  - resolve assets/components
  - namespace instances
  - merge variables/tokens
  - build canonical v3 project
  - validate cross references
  - canonical serialize/hash
- [ ] Add bundle profiles:
  - `embedded-components`
  - `flattened-components`
- [ ] Ensure runtime/renderers never import `motion-workspace`.

Gate:

- [ ] Workspace bundle equals equivalent single-file v3 project semantically.
- [ ] Source map is deterministic.
- [ ] Absolute local paths are rejected in portable bundles.

## 13. Phase 11 - Hashing, Manifests, And Determinism

Purpose: make preview/export reproducible and debuggable.

Tasks:

- [ ] Add canonical serializer for v3 project.
- [ ] Add `projectHash`.
- [ ] Add `runtimeHash`.
- [ ] Add `sourceHash` for workspace modules.
- [ ] Exclude timestamps/provenance/editor state from render hash.
- [ ] Add render manifest versioning.
- [ ] Add deterministic sorting rules:
  - declaration order
  - stable ID tie-break
  - no object map order as render order
- [ ] Add deterministic time/frame quantization in one place.

Gate:

- [ ] Same semantic project -> same project hash.
- [ ] Same runtime artifact -> same runtime hash.
- [ ] Render manifest can reproduce a render job input.

## 14. Phase 12 - Remove V2 As Canonical

Purpose: complete migration after v3 is stable.

Tasks:

- [ ] Flip `MotionProject` alias to v3.
- [ ] Keep `MotionProjectV2` as legacy explicit type.
- [ ] Keep v2 parser for old file import.
- [ ] Stop new project creation from emitting v2.
- [ ] Stop editor commands from writing v2-only timeline shape.
- [ ] Deprecate v2-specific app code.
- [ ] Remove or quarantine v2-only renderer fallbacks.

Gate:

- [ ] `rg "timeline.sceneOrder"` only finds migration/tests/legacy adapters.
- [ ] `rg "scene.transition"` only finds migration/tests/legacy adapters.
- [ ] New projects are v3 only.
- [ ] v2 projects still import through migration.

## 15. Suggested PR Order

1. `protocol-v3-00`: freeze v2 fixtures and round-trip tests.
2. `protocol-v3-01`: add v3 schemas and minimal fixtures.
3. `protocol-v3-02`: add v2 -> v3 migration with golden fixtures.
4. `protocol-v3-03`: add parse/serialize compatibility APIs.
5. `compiler-v3-01`: compile v3 minimal project to current runtime IR.
6. `compiler-v3-02`: compile v3 visual tracks and scene clips.
7. `compiler-v3-03`: compile v3 audio/caption/component profiles.
8. `runtime-v3-01`: add neutral runtime type aliases and runtime versioning.
9. `runtime-v3-02`: evaluate v3 visual track composition.
10. `runtime-v3-03`: transition fixtures and diagnostics.
11. `render-v3-01`: Pixi/Remotion consume v3 composition output.
12. `playback-v3-01`: playback-engine neutral runtime loading.
13. `editor-v3-01`: create/load/save v3 project.
14. `editor-v3-02`: timeline edits write v3 visual clips.
15. `ai-v3-01`: v3 schema prompt and AI patch support.
16. `workspace-v3-01`: add `motion-workspace` manifest and memory linker.
17. `workspace-v3-02`: filesystem linker and bundle profiles.
18. `determinism-v3-01`: canonical serializer, hashes, manifest.
19. `cleanup-v3-01`: flip canonical alias to v3.
20. `cleanup-v3-02`: quarantine v2 as legacy import path only.

## 16. Test Matrix

Run these after each major phase:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/playback-engine test
pnpm.cmd --filter @motionvideo/pixi-renderer test
pnpm.cmd --filter @motionvideo/remotion-renderer test
pnpm.cmd --filter @motionvideo/render-contracts test
```

Add these as v3-specific suites:

- [ ] protocol v3 positive fixtures
- [ ] protocol v3 negative fixtures
- [ ] v2 -> v3 migration goldens
- [ ] v3 compile snapshots
- [ ] v3 evaluated frame structural fingerprints
- [ ] v3 transition frame fixtures
- [ ] v3 audio plan fixtures
- [ ] v3 caption/cue fixtures
- [ ] Pixi/Remotion parity over v3 runtime
- [ ] editor command transaction fixtures over visual clips
- [ ] AI generation/patch fixtures over v3 JSON Schema

## 17. Main Risks

| Risk                                           | Mitigation                                                      |
| ---------------------------------------------- | --------------------------------------------------------------- |
| v3 becomes another parallel source of truth    | Keep v2 legacy-only and migrate through one compiler path       |
| Runtime starts reading authoring fields        | Architecture tests blocking runtime -> workspace/editor imports |
| Pixi and Remotion diverge                      | Both consume `EvaluatedCompositionFrame`, not project JSON      |
| Timeline migration breaks old projects         | Golden fixtures for `sceneOrder` -> `visualTracks`              |
| Audio/video lifetime differs preview/export    | Explicit v3 duration/trim/rate and shared audio/media plans     |
| Components become network-dependent            | Portable bundles pin integrity and embed or flatten profiles    |
| AI writes fields before renderers support them | Capability gate before AI allowlist                             |
| Hashes change because of metadata/editor state | Canonical serializer excludes non-render fields                 |

## 18. Definition Of Done

V3 is ready when:

- [ ] `MotionProjectV3Schema` is strict and documented.
- [ ] v2 projects migrate deterministically to v3.
- [ ] New editor projects are v3.
- [ ] AI can generate and patch v3.
- [ ] Compiler produces runtime IR from v3 without unresolved authoring constructs.
- [ ] Runtime evaluates visual tracks, transitions, audio, captions, and overlays from compiled runtime IR.
- [ ] Pixi preview and Remotion export consume the same evaluated frame contract.
- [ ] Playback loads runtime IR and never compiles in the play loop.
- [ ] Workspace linker can produce the same canonical project as a single-file bundle.
- [ ] Project/runtime/render hashes are stable.
- [ ] Required capabilities fail preflight when unsupported.
- [ ] V2 remains importable but is no longer the canonical authoring shape.
