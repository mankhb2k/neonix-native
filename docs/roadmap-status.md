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
| Component Action outer playback | iterations, reverse/alternate, `action.loop` fill and over-duration guard | *(pending commit)* |

Current verification after Action playback: 24 positive artifacts, 68 negative artifacts, 38 limit cases, 15 Runtime goldens, 14 PNG goldens, and 21 pinned assets.

## Partial or not implemented

| Capability | Current evidence/status | Next required milestone |
|---|---|---|
| Lip-sync cue generation | Mouth variants exist, but no cue/marker-to-step-key compiler | cue schema, alignment validation, generated track golden |
| Secondary Motion | No modifier/evaluator implementation | deterministic random-access segmented-chain solver and PNG fixture |
| Figma/Illustrator importer and re-import | Source mapping is typed metadata only | sanitizer/parser, stable element fingerprint reconciliation and import fixtures |
| Camera projection/scene transitions | Active camera is validated, but renderer does not apply camera transforms or transitions | camera-aware render plan and overlap/crossfade fixture |
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
