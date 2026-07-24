# Motion engine roadmap status

This file is the current implementation ledger. A capability is marked **done** only when schema/reference validation, compiler or evaluator behavior, and the relevant fixture/golden checks pass.

## Done and committed

| Milestone | Evidence | Commit |
|---|---|---|
| Finite resource policy and strict schema limits | 37 limit cases in `validate:v2-fixtures` | `a4e2edf` |
| Discriminated Node/asset schemas | typed v2 parser and negative matrix | `edfb5fa` |
| Property capability registry | enumerable property/domain/runtime metadata | `93d9eb5` |
| Spatial runtime foundation | world matrices, bounds, hit-test, offscreen budgets | `ff2de31` |
| Deterministic frame/PNG goldens | runtime frame clock and pixel goldens | `46a51f0` |
| Shape/Path/Paint geometry | typed geometry, bounds, fill/stroke, PNG golden | `0e65f59` |
| Mask compositing | clip/alpha/inverse-alpha, nesting and hit-test | `dad6a35` |
| Repeater expansion | list/count and four layouts with stagger | `6785ce3` |
| Unicode Text Animator | grapheme/word/line expansion | `3e36a6f` |
| Motion Path | arc-length progress, offsets and orientation | `d946e1e` |
| SVG cut-out authoring contract | source parts, rig slots, variants and named actions | `41d4f28` |
| Deterministic playback | rate, iterations, reverse/alternate, infinite clipping and schedule | `47eb433` |
| Ordered Effects stack | blur, shadow, glow, color-adjust, animation, mask-before-effects and PNG golden | `0b66cfe` |
| Normalized Path Morph | topology-checked targets, progress tracks, Runtime/PNG goldens at t=0/1/2 | `36103d6` |
| Component Action outer playback | iterations, reverse/alternate, `action.loop` fill and over-duration guard | `9fb5c60` |
| Lip-sync cue generation | cue validation and generated mouth `payload.assetId` step-key golden | *(this commit)* |
| Deterministic Secondary Motion | bounded rotation-only bone chain, random-access solver, Runtime/PNG goldens | *(this commit)* |
| Camera projection and scene transitions | active-camera pan/zoom/rotation, overlap frame plan, crossfade compositing, Runtime/PNG goldens | *(this commit)* |

Current verification after Camera projection and scene transitions: 26 positive artifacts, 78 negative artifacts, 40 limit cases, 17 Runtime goldens, 18 PNG goldens, and 21 pinned assets.

## Partial or not implemented

| Capability | Current evidence/status | Next required milestone |
|---|---|---|
| Figma/Illustrator importer and re-import | Source mapping is typed metadata only | sanitizer/parser, stable element fingerprint reconciliation and import fixtures |
| Camera projection/scene transitions | Orthographic active-camera projection, timeline overlap and crossfade raster compositing are implemented | fade policy refinement and preview parity |
| Video frame rendering | Video assets are validated/plumbed, but draw path has no decoded frame/trim/loop behavior | deterministic frame decoder and media golden |
| Audio mixer/export | Audio timeline metadata exists; ffmpeg export currently encodes video frames only | trim/loop/fade/gain mix and stream probe E2E |
| Browser preview/export parity | Web editor preview still uses CSS/mock blocks rather than Runtime IR | browser-safe render adapter, timestamp parity and Web E2E |
| P1 primitives | emitter, trim path, animated dash/gradient, blend modes, constraints, IK and bend are intentionally deferred | activate only with a real composition fixture |

## Verification commands

```bash
pnpm validate:v2-fixtures
pnpm validate:primitives
pnpm typecheck
```

The PNG previews produced by `validate:primitives` are in `tmp/primitive-previews` and are generated artifacts, not source fixtures.
