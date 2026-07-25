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
| Lip-sync cue generation | cue validation and generated mouth `payload.assetId` step-key golden | `2031522` |
| Deterministic Secondary Motion | bounded rotation-only bone chain, random-access solver, Runtime/PNG goldens | `8102637` |
| Camera projection and scene transitions | active-camera pan/zoom/rotation, overlap frame plan, crossfade compositing, Runtime/PNG goldens | `ce3583a` |
| Deterministic video frame sampling | cached ffmpeg frame decode with trim/hold/transparent/loop and fit | `4b82763` |
| Audio timeline mix and probe | BGM/VO/SFX trim/loop/gain/fade mix muxed to AAC; ffprobe stream/duration assert | `4882661` |
| SVG export import (Figma/Illustrator) | sanitize/reject unsafe SVG, leaf-part fingerprints, identical re-import keeps node mapping | `59331f2` |
| Browser Runtime IR preview parity | PreviewStage + `/appai/runtime-harness` evaluateScene vs worker hierarchy goldens | `9d82ef8` |
| P0 primitives-object schema matrix | `primitives-coverage.json` 113 rows; Wave A–E schema ± + P1 reject wall; compositions mapped | `d67cd65` |
| P0 schema freeze | Checklist + freeze asserts (round-trip, binding uniqueness, patch public surface, semantic.key, AI registry); formatVersion stays 2 | see `docs/p0-schema-freeze-checklist.md` |

Current verification after P0 schema freeze: 27 positive artifacts, 107 negative artifacts, 40 limit cases, 17 Runtime goldens, 18 PNG goldens, 21 pinned assets, and 113 primitives-coverage rows.

## Partial or not implemented

| Capability | Current evidence/status | Next required milestone |
|---|---|---|
| Browser preview/export parity | Runtime IR evaluate + transform/text/shape preview; media/PNG screenshot parity still deferred | media assets in Canvas adapter, screenshot tolerance vs worker PNG |
| P1 primitives | emitter, trim path, animated dash/gradient, blend modes, constraints, IK and bend are intentionally deferred | activate only with a real composition fixture |

## Verification commands

```bash
pnpm validate:v2-fixtures
pnpm validate:primitives
pnpm typecheck
```

The PNG previews produced by `validate:primitives` are in `tmp/primitive-previews` and are generated artifacts, not source fixtures.
