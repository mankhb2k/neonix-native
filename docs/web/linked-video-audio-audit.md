# Linked Video Audio — Phase 0 Audit

> Audit date: 2026-08-27
>
> Scope: Protocol V2, compiler/runtime, playback engine, web preview, timeline,
> and Remotion export. This document records the baseline before the linked
> embedded-audio migration.

## Ownership contract

| Concern | Current owner | Target owner | Persisted in project JSON? |
| --- | --- | --- | --- |
| Composition timing | Protocol `layer.timing` | Protocol `layer.timing` | Yes |
| Video source trim/loop | `video.payload.trimStart/trimEnd/loop` | Same | Yes |
| Embedded video audio enabled state | `video.payload.muted` plus native video state | `video.payload.audio.enabled` | Yes |
| Independent audio timing | `project.audio.tracks[].clips[].timing` | Same | Yes |
| Live current time | `TimelineShell`/playback store and playback engine instances | One `PlaybackEngineV2` | No |
| Visual video decoding | `HTMLVideoElement` used by PreviewStage/renderer | Engine-owned muted media adapter | No |
| Live audio output | WebAudio adapter and, currently, possible native video output | One WebAudio adapter | No |
| Visual frame evaluation | PreviewStage/runtime | Playback engine snapshot + renderer | No |
| Export audio | Remotion audio plan from runtime audio tracks | Same plan including lowered embedded audio | No |

## Current findings

1. `V2VideoLayerSchema.payload` has `muted?: boolean`; it has no embedded audio
   object. The field is currently passed to the runtime video paint command.
2. `V2AudioClipSchema` already accepts a video asset as its source. This is the
   existing explicit “video source audio” escape hatch and is the shape used by
   `audio.video-source` fixtures.
3. `compile-v2` lowers only `project.audio.tracks` into
   `RuntimeAudioProjectV2`; it does not lower a video layer's embedded audio.
4. `PreviewStage` currently calls `HTMLVideoElement.play()` for every loaded
   video asset when `isPlaying` is true and changes `source.muted` from the
   evaluated video command. This can create a second audible pipeline when an
   explicit audio clip also references the same video.
5. `PreviewStage` also owns a playback engine/WebAudio adapter pair while the
   editor transport still owns the UI playhead. Pause and mute are therefore
   split across asynchronous React effects and independent media paths.
6. `PlaybackEngineV2` already owns a clock and emits visual frames/audio plans,
   and `WebAudioAdapterV2.pause()` increments its scheduling generation and
   stops active sources. The missing boundary is engine ownership of visual
   media and the lowering of embedded video audio.
7. Remotion visual video elements are muted by default in the current renderer,
   while its audio path consumes the runtime audio mix plan. This is compatible
   with the target architecture once embedded audio is lowered into that plan.

## Baseline fixture matrix

| Fixture | Video component | Embedded audio | Independent audio | Expected target behaviour |
| --- | --- | --- | --- | --- |
| Silent video | Yes | No | No | Visual only |
| Video with sound | Yes | Enabled | No | One linked video clip, one WebAudio input |
| Muted video with sound | Yes | Disabled | No | Visual only; no native audio |
| Video + music | Yes | Enabled | Yes | Two intentionally mixed inputs |
| Trimmed video | Yes | Enabled | No | Audio inherits video trim/timing |
| Split video | Two video segments | Two inherited configs | No | Each segment remains synchronized |
| Detached audio | Yes | Removed | Yes | Normal audio clip, independently editable |
| Extracted derivative | Yes | Removed | Yes, derivative asset | Same timing as detach; no duplicate on retry |
| Looping video | Yes | Enabled | No | Audio loops with the video source span |

## Legacy migration rule

The migration is intentionally one-way when a legacy project is loaded:

- `payload.muted: false` maps to `payload.audio.enabled: true` with `gainDb: 0`.
- `payload.muted: true` maps to `payload.audio.enabled: false` with
  `gainDb: 0`.
- The original `muted` property is removed before validation/save.

The loader must emit a migration diagnostic and never write both fields. A
project save persists the new shape only after the migrated document passes the
Protocol V2 schema.

## Phase 0 exit criteria

- [x] All current `payload.muted` consumers are listed: video schema, compiler,
  runtime paint command, PreviewStage, Remotion preview, timeline projection,
  timeline command, inspector, seed data, and tests.
- [x] Clock/audio/media ownership and the target single-owner contract are
  documented.
- [x] Embedded, independent, detached, extracted, trimmed, split, and looping
  fixture cases are defined.
- [x] The legacy migration mapping is explicit and deterministic.
- [x] Phase 1 implements the new schema and compiler lowering.
