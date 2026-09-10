# `@motionvideo/motion-runtime`

Runtime V3 is the shared semantic layer used by Preview and Native Export. It
receives a compiled `RuntimeProjectV3`, evaluates the project at a frame/time,
and returns backend-neutral visual and audio plans.

Runtime visual timing is expressed in seconds. Protocol V2 authoring timing is
expressed in milliseconds; the compiler converts it once before creating the
runtime project. Video and audio plans then use their native microsecond and
sample domains respectively.

Animated visual state is carried by the optional `visualTimeline` frame-delta
table. The compiler bakes this table at the composition FPS, and the runtime
overlays the selected frame's nodes before producing paint commands. This
keeps browser/Protocol authoring semantics out of render workers while making
Preview and Native Export evaluate the same Runtime V3 data.

`RuntimeProjectV3.durationUs` is the canonical end of the complete runtime
timeline. It covers the last visual node, video instance, and audio clip. The
playback engine reads this value; it must not reconstruct duration from the
individual runtime plans.

Runtime does not parse authoring JSON and does not draw pixels itself. Preview
and Export consume the same Runtime outputs and choose their own rendering and
encoding technologies.

## Runtime flow

```text
RuntimeProjectV3
        │
        │ evaluate(frame, time)
        ▼
┌──────────────────────────┐
│          RUNTIME         │
│                          │
│  Timeline evaluation     │
│  Hierarchy resolution    │
│  Matrix calculation      │
│  Opacity/compositing     │
│  Media-time resolution   │
│  Paint command creation  │
│  Audio mix plan creation │
└────────────┬─────────────┘
             │
             ├── PaintCommandBuffer
             └── AudioMixPlanV3
```

The visual path is evaluated per frame. The audio path is evaluated for a
bounded composition-sample range. They are separate outputs so a renderer can
schedule video and audio independently while preserving one project timeline.

## Six core runtime jobs

### 1. Timeline evaluation

Runtime maps the requested `frame` or `time` to the composition timeline. It
uses the composition FPS and deterministic frame/time quantization so Preview
and Export evaluate the same moment in the project.

The runtime does not decide what the user meant. That meaning has already been
compiled into `RuntimeProjectV3`. Runtime only evaluates the compiled timeline
at the requested position.

### 2. Hierarchy resolution

Runtime resolves the layer tree and its paint order. It determines which nodes
are active at the requested time, preserves parent/child relationships, and
keeps group boundaries needed for masks, isolation, and compositing.

This produces an ordered frame representation that a backend can consume
without reimplementing project hierarchy rules.

### 3. Matrix calculation

Runtime calculates the transform of each visible node from local space to
composition space. The canonical representation is backend-neutral `Matrix4`.
2D layers use the same representation on the XY plane with an orthographic
projection.

The renderer receives resolved transforms; it does not need to reconstruct
parent transforms or interpret authoring transform fields.

### 4. Opacity and compositing

Runtime resolves node opacity, group opacity, masks, isolation boundaries, and
the order in which surfaces are composited. When a subtree must be rendered to
an isolated surface, the paint output carries the boundary and the alpha to
apply when the surface is composited back.

Runtime describes the compositing semantics. The Preview or Export backend owns
the actual surface allocation and GPU/CPU drawing operation.

### 5. Media-time resolution

Runtime maps composition time to the correct source time for video and other
time-based media. It applies clip start/end, playback rate, trim boundaries,
visibility, and the configured source-frame policy.

The result is media metadata in the paint command or a `VideoRenderPlanV3`;
Runtime does not decode video frames. Media decoding and resource loading belong
to the backend or export worker.

### 6. Paint command creation

Runtime converts the evaluated visual state into a validated
`PaintCommandBuffer`. Commands describe what must be painted—such as clear,
transform, shape, path, text, image, video, mask, effect, and composite
operations—without depending on Canvas, WebGPU, WebGL, Chromium, or another
rendering library.

The same buffer is the semantic handoff for both Preview and Native Export.
Each backend replays the commands using its own rendering technology.

## Parallel audio responsibility

Audio is evaluated alongside the visual frame path, but it has a different
unit of work: a bounded sample range rather than one frame. Runtime creates an
`AudioMixPlanV3` with the active clips, source ranges, playback mapping, gain,
pan, mute state, and fade envelopes.

`AudioMixPlanV3` is a plan, not decoded PCM. Runtime does not create WebAudio
nodes, open an audio device, or encode audio. The playback backend and the
offline export pipeline perform those operations.

### Embedded video audio

When a video layer has `payload.audio`, Runtime receives the already-lowered
audio clip from the Compiler. It does not read audio fields from the visual
video command and does not inspect the original MP4 itself.

```text
RuntimeProjectV3
  ├── videoTimeline
  │     └── visual video instance → video frame plan
  └── audioTimeline
        └── linked audio clip → AudioMixPlanV3
              ├── source: audio derivative
              ├── composition timing: linked to video timing
              ├── source trim: linked to video trim
              ├── playback rate
              ├── gain / pan
              └── fade envelopes
```

At a requested sample window, Runtime resolves whether the linked audio is
active, maps composition samples to source samples, and emits the controls
needed by the audio backend. The original video's embedded audio is therefore
not played as a second input. Preview mutes it and uses the audio backend;
Export disables it and uses the offline audio pipeline.

## Public boundaries

### Input

The input is the compiler-owned `RuntimeProjectV3`:

```text
MotionProtocolV2
        │
        ▼
Compiler
        │
        ▼
RuntimeProjectV3
```

Runtime expects the project to already contain the normalized visual model,
media catalog, video timeline, and audio timeline. It does not accept a second
authoring format or silently migrate incomplete project data.

### Output

```text
RuntimeProjectV3 + frame/time
        │
        ▼
Runtime
        ├── RuntimeFrameV3 / PaintCommandBuffer
        └── VideoRenderPlanV3

RuntimeProjectV3 + audio sample range
        │
        ▼
Runtime
        └── AudioMixPlanV3
```

The visual output is consumed by Preview Renderer and Export Renderer. The
audio output is consumed by playback or offline audio processing. Runtime does
not return an MP4 and does not own storage, job management, or billing.

## Audio ownership summary

```text
Protocol
  → describes audio intent and linked controls
Compiler
  → creates an independent runtime audio clip
Runtime
  → resolves sample-accurate state into AudioMixPlanV3
Audio Backend
  → decodes, applies gain/fade/pan, and mixes
FFmpeg
  → encodes or muxes the final audio with video
```

## Determinism and parity

For the same `RuntimeProjectV3`, frame/time, and media metadata, Runtime must
produce the same semantic output. This is the parity boundary between Preview
and Export:

```text
RuntimeProjectV3
        │
        ├── Runtime evaluation ──► Preview backend
        │
        └── Runtime evaluation ──► Native export backend
```

If Preview and Export show different pixels, the first comparison should be
the Runtime frame and its `PaintCommandBuffer`, before investigating backend
rendering differences.

## Source organization

| Folder | Responsibility |
| --- | --- |
| `foundation/` | Frame/time quantization and deterministic runtime utilities |
| `project/` | `RuntimeProjectV3` types, validation, identity, and public evaluation boundary |
| `visual/` | Visual frame evaluation, text preparation, effects, and visual validation |
| `geometry/` | Backend-neutral matrices and path geometry |
| `media/` | Media-time and source-frame resolution |
| `paint/` | `PaintCommandBuffer`, command validation, display-list decoding, and replay contracts |
| `audio/` | Audio mix-plan evaluation and offline audio helpers |

## Public API example

```ts
import {
  evaluateRuntimeProjectV3,
  resolveAudioWindow,
  resolveVideoAt,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";

const frame = evaluateRuntimeProjectV3(project, frameNumber, { time });
const video = resolveVideoAt(project, timelineTimeUs);
const audio = resolveAudioWindow(project, { startSample, frameCount });
```

These functions resolve semantics only. Rendering, media decoding, FFmpeg
encoding, storage, and export job orchestration belong to the layers above the
runtime.

See [`ARCHITECHTURE.md`](../../ARCHITECHTURE.md),
[`docs/ai-first-editor-architecture.md`](../../docs/ai-first-editor-architecture.md),
and [`docs/v2-runtime-compiler-hard-cut-plan.md`](../../docs/v2-runtime-compiler-hard-cut-plan.md).
