# ADR: RuntimeProjectV3 and backend-neutral playback boundary

- Status: accepted for implementation
- Date: 2026-08-28
- Scope: Phase 0–1 of `playback-engine-next` and audio compiler

## Decision

Keep MotionProtocolV2 as the authoring and interchange contract. Add an internal
`RuntimeProjectV3` compiled representation with separate, immutable plans for
media, video, and audio. PlaybackEngineNext consumes only those plans and
backend interfaces; it does not know about `HTMLVideoElement`, WebCodecs,
`AudioBuffer`, fetch, or a particular renderer.

The visual node model and timing semantics from Runtime V2 are reused. The V3
change is the media boundary and the audio/video timeline model:

```text
MotionProtocolV2 -> Compiler -> RuntimeProjectV3
                                  |-- MediaCatalog
                                  |-- VideoTimelinePlanV3
                                  `-- AudioTimelinePlanV3
```

`resolveVideoAt(timeUs)` and `resolveAudioWindow(sampleRange)` are pure,
deterministic functions. The engine owns scheduling, clocking, seek generations,
and lifecycle. Adapters implement media acquisition/decoding and can be swapped
without changing engine or compiler semantics.

## Why now

The app is pre-production, so a deliberate internal runtime boundary is cheaper
than preserving the V2 audio coupling. The protocol remains stable, so authoring
and persisted project data do not need a migration.

## Constraints and non-goals

- No WebCodecs implementation is required in Phase 0–1.
- HTML video remains the first video backend, but only behind an adapter.
- Audio is represented as independent clips/tracks, including extracted audio
  derivatives for video clips.
- Existing Runtime V2 visual output must remain semantically equivalent.
- No binary asset regeneration is required to land the type/validation boundary;
  fixture assets are added in the compiler/preview phase.

## Rejected alternatives

1. Keep a single media element as the audio clock: prevents sample-accurate
   mixing and makes future streaming/worklet backends expensive.
2. Put backend objects in the compiled project: makes the project non-serializable
   and couples compiler output to browser APIs.
3. Replace MotionProtocolV2 now: expands migration scope without improving the
   runtime boundary.

## Exit criteria

Phase 0 is complete when this ADR, the baseline report, and the plan are in the
repository. Phase 1 is complete when V3 types, validation, deterministic
resolvers, and boundary tests are exported from `@motionvideo/motion-runtime`.
