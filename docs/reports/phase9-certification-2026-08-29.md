# Phase 9 certification — 2026-08-29

## Cutover result

Runtime V3 is the only public runtime/media contract and
`@motionvideo/playback-engine` is the only playback package. The old
`packages/playback-engine-next` package, feature flag, shadow bridge, V2 audio
project/mix evaluator, and compiler V2 entrypoints are removed from the source
tree. Certified visual lowering is retained only as an internal implementation
detail behind the V3 visual boundary.

## Automated gates

- Playback architecture certification: passed (`canonicalStructure`, no flat
  files, no legacy consumers, no compatibility bridge).
- Full typecheck: passed for app, protocol, compiler, runtime, preview, export.
- Full repository test command: passed — web editor 62, protocol 42, compiler
  4, runtime 69, preview 27, render contracts 105 tests.
- Canonical playback package tests: passed — 24 tests.
- Runtime V3 tests: passed — 69 tests.
- Targeted Playwright editor transport test: passed (Chromium).

## Manual gates

The 30–60 minute long-media soak and production profiling (CPU, heap,
AudioWorklet underruns, GPU resource counts) remain operational checks to run
in a deployed browser session with representative media. They are intentionally
not claimed as completed by repository automation.
