# Neonix V2 Architecture Guide

> Status: active architecture and Atomic Protocol V2 reference.
>
> Scope: the contract from V2 project JSON through compilation, runtime
> evaluation, native preview, Remotion export, and encoded media. This is an
> architecture guide, not an implementation plan or ticket tracker.

## Purpose and source of truth

Neonix can be authored by the editor, MCP tools, AI, templates, or the CLI.
Those are authoring surfaces; they do not define rendering semantics. Every
renderable project must become one strict `MotionProtocolV2` document before
it reaches the render core.

The source of truth for the accepted JSON is
[`@motionvideo/motion-protocol`](../../packages/motion-protocol/src/v2/project.ts).
Compiler-supported visual features are owned by
`@motionvideo/motion-compiler`. Protocol owns the project schema and validation;
the compiler decides which valid features can be lowered to RuntimeProjectV3.

## 1. One project, one render meaning

```text
Editor / MCP / AI / templates / CLI
                 |
                 v
        MotionProtocolV2 JSON
                 |
                 v
 @motionvideo/motion-compiler
 compileProtocol()
                 |
                 v
           RuntimeProjectV3
             /           \
            v             v
  VideoRenderPlanV3   AudioMixPlanV3
             \           /
                 v
          PlaybackEngine
             /           \
            v             v
    Native preview      Offline export
                              |
                              v
                         encoded media
```

For a given V2 document and time, the visual and audio meaning is
backend-neutral and deterministic. WebGPU, WebGL2, WebAudio, and Remotion may
adapt that meaning to their platform, but must not reinterpret timing,
transforms, ordering, compositing, media selection, or mixing.

Visual and audio are parallel domains. They meet only at final media output;
audio is never a visual layer and visual rendering never owns the audio clock.

### 1.1 Authoring, compilation, and the next playback runtime

Protocol V2 remains the authoring contract. Runtime V3 is the execution
projection: it keeps the certified visual runtime semantics while separating
static video and audio timelines from backend-specific playback. The compiler
is pure and deterministic; it does not create media elements, decoders, audio
nodes, GPU resources, or worker state.

```text
AUTHORING — MotionProtocolV2
│
│  VideoLayer
│  ├── visual intent
│  └── embedded audio intent
│
▼
PURE COMPILER
│
▼
RuntimeProjectV3
├── composition
├── mediaCatalog
├── visual                    # reuse visual runtime semantics đã chứng nhận
├── videoTimeline             # static VideoTimelinePlanV3
└── audioTimeline             # static AudioTimelinePlanV3
        │
        ├──────────────────────────────────────────────┐
        │                                              │
        ▼                                              ▼
resolveVideoAt(timeUs)                     resolveAudioWindow({ startSample, frameCount })
        │                                              │
        ▼                                              ▼
VideoRenderPlanV3                            AudioMixPlanV3
        │                                              │
        └───────────────────┬──────────────────────────┘
                            ▼
                    PlaybackEngine
                    ├── TransportStateMachine
                    ├── ClockController
                    ├── OperationEpoch
                    ├── ReadinessCoordinator
                    ├── BufferPolicy
                    ├── ResourceCoordinator
                    └── Diagnostics/Metrics
                         │                 │
              ┌──────────┘                 └──────────┐
              ▼                                       ▼
         VideoBackend                            AudioBackend
         ├── HTMLVideo V1                    ├── WebAudioGraph V1
         └── WebCodecs V2                    └── StreamingWorklet V2
              │                                       │
              └──────────────────┬────────────────────┘
                                 ▼
                         Preview Renderer
                         ├── WebGPU
                         └── WebGL2

Export consumes the same RuntimeProjectV3 semantics through an offline backend.
```

`VideoLayer.payload.audio` is authoring intent only. It uses the same per-input
controls as a standalone audio clip: `enabled`, `gainDb`, `pan`, `fadeIn`, and
`fadeOut`. During compilation, embedded video audio becomes an explicit audio
timeline clip that references the video's audio derivative. Standalone clips
and embedded video audio therefore enter the same `AudioMixPlanV3` without
making audio a visual-layer concern.

`enabled: false` means "keep this source on the composition timeline but make
only this mix input silent." It lowers to a muted runtime clip and the audio
adapter keeps its source aligned at zero gain. It must never pause, seek, or
otherwise change `PlaybackEngine` transport. `track.muted`, `track.gainDb`, and
`track.pan` remain optional mixer-bus controls for all clips on that track.

`resolveVideoAt()` and `resolveAudioWindow()` are pure timeline queries. They
return backend-neutral plans, not decoded frames or PCM. `PlaybackEngine`
owns transport, the single audio master clock, operation epochs, readiness,
buffering, resource leases, and diagnostics. HTML video, WebCodecs, Streaming
Worklet, and BufferSource are replaceable adapters behind those boundaries;
changing one does not change compiler or timeline semantics. The preview
renderer consumes the resulting video resources and paint commands, while an
offline export backend consumes the same V3 plans for parity.

### 1.2 Playback ownership and adapter boundary

The following is the MVP ownership model. It is deliberately explicit: a
browser media element is a decoder/presenter adapter, never the authority for
composition time.

```text
AUTHORING
MotionProtocolV2
        |
        v
PURE COMPILER
        |
        v
RuntimeProjectV3
├── visual
├── mediaCatalog
├── videoTimeline
└── audioTimeline
        |
        v
PlaybackEngine                             Neonix owns
├── TransportStateMachine
├── timeline position
├── play / pause / seek / rate
├── OperationEpoch
├── Readiness / Buffer policy
├── resolveVideoAt(time)
└── resolveAudioWindow(samples)
        |
        ├───────────────────┐
        v                   v
Video Engine            Audio Engine
        |                   |
        v                   v
VideoBackend            AudioBackend
HTMLVideo V1            WebAudioGraph V1
WebCodecs V2            StreamingWorklet V2
        |                   |
        └──────── Chrome ───┘
```

**Neonix owns** the MotionProtocolV2 contract and validation, pure compilation
to RuntimeProjectV3, composition time and transport commands, operation epochs,
active video/audio selection, deterministic trim/gain/pan/fade/mute/overlap
resolution, video-muted-by-default policy, asset identity, R2 resource keys,
the media catalog, and derivative policy.

**Chrome owns** HTTP range requests, cache and network buffering, demux/decode
for supported H.264/AAC streams, HTMLVideoElement/HTMLAudioElement instances,
GPU presentation, audio-device output, user-gesture/autoplay policy, and the
promise lifecycle returned by `element.play()`.

The adapter is responsible for translating an engine command to that browser
surface and for containing browser-specific outcomes. In particular, an
`AbortError` caused when a newer pause/seek supersedes an outstanding `play()`
is an expected adapter completion, not a transport-state transition. A rejected
play is reported as an adapter diagnostic; it never lets a media element become
the timeline clock.

Today the MVP exposes engine-owned `play`, `pause`, and `seek`, driven by a
`TransportClock` while HTML media adapters execute their bounded commands.
`WebAudioGraphBackendV3` is the primary MVP audio mixer; a native HTML media
adapter is retained only as a narrow fallback. `rate` remains an
engine-owned future command and adapters must not modify
`HTMLMediaElement.playbackRate` independently.

#### 1.2.1 Transport-clock and audio-window contracts

`TransportClock` is an explicit seam. The engine consumes timeline
microseconds and does not know whether the position originated from
`performance.now()`, an AudioContext, or a rendered sample counter.

```ts
interface TransportClock {
  nowUs(): number;
  start(atUs?: number): void;
  pause(atUs?: number): number;
  seek(timeUs: number): void;
}
```

The current preview clock is `MonotonicTransportClock`. The V2 precision path
is `AudioSampleTransportClock`, which converts
`renderedSamples / project.audioTimeline.sampleRate` into the same timeline-us
domain. `rate` remains an engine-owned future command; it is deliberately not
exposed by the current controller, and an adapter must never modify
`HTMLMediaElement.playbackRate` independently.

Audio is resolved in an unambiguous composition-sample domain:

```ts
resolveAudioWindow(runtime, { startSample, frameCount })
```

#### 1.2.2 Private media access

Neonix keeps user media private in R2. `MotionProtocolV2` revisions may carry
the last known URI for authoring portability, but the editor server rehydrates
UUID-backed asset references to short-lived S3-compatible presigned URLs when
loading a project. The browser therefore reads originals and derivatives
without requiring an R2 custom domain or exposing the bucket publicly.

The media elements and image loaders set `crossOrigin = "anonymous"` before
assigning `src`. The R2 bucket CORS policy must allow the exact app origins
(for example `http://localhost:3000` and the production app origin), `GET` and
`HEAD`, and range/exposure headers used by media playback. A custom domain is
optional infrastructure for a future authenticated media gateway; it is not
part of the MVP contract.

`sampleRate` is fixed by `runtime.audioTimeline`; it is not caller input. The
result is a bounded `AudioMixPlanV3`: active inputs, native source sample
ranges, gain envelopes, pan and fades. `frameCount` maps directly to a
128-frame AudioWorklet quantum, while buffer policy can request a larger
prefetch window such as 2048 frames.

For MVP audible playback, `WebAudioGraphBackendV3` owns one graph per active
clip: `MediaElementAudioSourceNode -> GainNode -> StereoPannerNode -> master`.
Browser media elements still perform HTTP, buffering and decode; Neonix applies
the resolved gain, pan and fade automation and decides when each element seeks,
starts or pauses. `HTMLMediaAudioBackendV3` remains a compatibility fallback,
not the primary mixer. At the target architecture,
`StreamingWorkletBackend` consumes decoded PCM windows and its rendered-sample
counter becomes the authoritative transport clock; video adapters then only
present frames for that time.

### 1.3 Media ingest, probing, and derivative processing

Media processing is deliberately a deployment adapter, not part of the
protocol, compiler, or playback engine. The authoring contract contains only
asset identity and intent. After upload, a processor probes the original
asset and publishes immutable derivatives using the shared storage namespace:

```text
Client
  |
  | direct upload
  v
Supabase Storage  --------------------------+
  |                                         |
  v                                         |
{assetId}/origin.*                         |
                                            |
                                            v
                              MediaProcessingBackend
                              |                 |
                              | MVP             | later
                              v                 v
                      Vercel Node.js      Railway/VPS Docker worker
                              |
                              +-- ffprobe: stream metadata
                              +-- ffmpeg: optional audio extraction
                              +-- poster/proxy generation
                              +-- update asset + probe job status
                                            |
                                            v
{assetId}/
  audio.m4a
  poster.webp
  video-proxy.mp4
                                            |
                                            v
                                  RuntimeProjectV3.mediaCatalog
```

The MVP processor runs in a Vercel **Node.js** function. It must not run in
the Edge runtime, and it must not receive video bytes through the API request;
it reads the original from Supabase Storage with a signed URL and writes
results back to Storage. `ffprobe` records stream facts first. If a video has
an audio stream, `ffmpeg` produces the canonical `audio.m4a` derivative. If
no audio stream exists, the video remains visual-only and the compiler does
not invent an embedded audio clip.

The processing boundary is replaceable:

```ts
interface MediaProcessingBackend {
  probeAndDerive(job: MediaProcessingJob): Promise<MediaProcessingResult>;
}
```

`VercelNodeMediaProcessor` is the current adapter. A future
`RailwayDockerMediaProcessor` or `VpsDockerMediaProcessor` can implement the
same job/result contract without changing `MotionProtocolV2`,
`RuntimeProjectV3`, `AudioTimelinePlanV3`, or `PlaybackEngine`. Supabase
Storage and Database remain the durable source of originals, derivatives,
metadata, and job status; Supabase Edge Functions may dispatch or receive a
webhook but are not the media-processing runtime.

Processing is asynchronous and idempotent. The asset lifecycle is
`uploading -> processing -> ready | partial | failed`; retries use the asset
id plus source integrity as the idempotency key. The runtime only consumes a
catalog after the required derivative has been verified, so a temporary worker
failure cannot change playback semantics.

## 2. Package ownership

| Boundary | Package | Owns | Does not own |
| --- | --- | --- | --- |
| Protocol | `@motionvideo/motion-protocol` | Strict V2 authoring JSON, asset metadata, and atomic vocabulary | Matrix4 values, GPU objects, decoded media, renderer commands |
| Compiler | `@motionvideo/motion-compiler` | Validation, references, pure V2-to-V3 lowering | Pixel rendering, frame playback, GPU resources |
| Runtime | `@motionvideo/motion-runtime` | Timing, hierarchy, Matrix4/projection evaluation, paint commands, audio mix plans | Protocol parsing, media decoding, WebAudio/GPU state |
| Media processing | Web-owned storage orchestration plus `@motionvideo/export-renderer` VPS worker | Object-key policy in Web; probe/derivative records and media processing in the worker | Authoring semantics, timeline evaluation, playback clocks |
| Preview | `@motionvideo/preview-renderer` | Canvas/device setup, WebGPU-first rendering, WebGL2 fallback, asset upload/cache, diagnostics | Semantic transform composition, authoring JSON parsing, audio clock |
| Export | `@motionvideo/remotion-renderer` | Rendering the evaluated paint tree, offline audio mix, Remotion encode integration | A second protocol/compiler/transform model |

High-level constructs such as presets, templates, components, auto-layout,
camera gestures, and AI intent are deliberately outside Atomic Protocol V2.
The repository provides the canonical V2 compiler plus the V3 runtime
projection, not a general high-level-authoring compiler. Any future authoring
layer must lower to the atomic contract described here.

## 3. Canonical Atomic JSON design

### 3.1 V2 root document

Every project has this strict root shape. Unknown fields are rejected.

```text
MotionProtocolV2
|- format: "motion-protocol"
|- formatVersion: 2
|- id
|- composition
|  |- width, height, fps, background, colorSpace: "srgb"
|  `- view
|     |- projection: orthographic | perspective
|     `- transform
|- assets[]
|- layers[]
`- audio
```

`composition.view` is required. It is not a layer or a user-facing camera
object: it is the renderer-neutral view state for the entire composition.

- Orthographic projection: `kind`, `zoom`, `near`, and `far`. `zoom: 1`
  frames the full composition; `zoom: 2` halves the visible width and height.
- Perspective projection: `kind`, `fov`, `near`, and `far`.
- View transform: semantic Vec3 `translate` and `rotate` values. Runtime turns
  it into the world-to-clip Matrix4.

`assets[]` contains renderer-neutral metadata only. Supported asset kinds are
`image`, `video`, `audio`, and `font`; the descriptor carries an id, URI and
applicable media metadata. A texture, decoded PCM buffer, browser media
element, glyph atlas, or GPU handle never belongs in this JSON.

### 3.2 Shared visual-layer contract

All six visual layer types use the following atomic design:

```ts
type VisualLayerBaseV2 = {
  id: string;
  parentLayerId: string | null; // only a group can be a parent
  order: number;                // unique among siblings; higher paints later
  frame: { width: number; height: number };
  transform: {
    translate: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    rotate: { x: number; y: number; z: number };
    skew: { x: number; y: number };
    anchor: { x: number; y: number; z: number };
  };
  opacity: number; // 0..1, default 1
  enabled?: boolean; // editor/runtime state, omitted means true
  visibility?: "visible" | "hidden" | "collapse"; // SVG presentation property
  timing: { start: number; duration: number }; // composition milliseconds
  tracks?: TrackV2[]; // typed keyframes in local milliseconds
  composite?: {
    blendMode:
      | "normal" | "darken" | "multiply" | "color-burn"
      | "lighten" | "screen" | "color-dodge" | "overlay"
      | "soft-light" | "hard-light" | "difference" | "exclusion"
      | "hue" | "saturation" | "color" | "luminosity";
    isolation?: "auto" | "isolate";
  };
  effects?: EffectV2[];
};
```

The transform remains semantic in JSON. The compiler/runtime is the sole owner
of local, parent/world, view, and projection Matrix4 composition. A normal 2D
scene is an XY plane at `z = 0` under orthographic projection; the same model
also supports 3D translation, X/Y rotation, perspective, and a 3D anchor.
`order`, not `translate.z`, remains the deterministic paint order.

Groups create hierarchy and can carry transform, timing, opacity, visibility,
blend, isolation, clipPath, and mask relationships. A group does not draw,
clip to its frame, or become an implicit camera. Mask definitions are kept in
project definition tables and emitted as runtime-only coverage sources.
`clipPath` produces geometric coverage; `mask` produces alpha or luminance
coverage. When both are present, the runtime applies both coverage operations
to the isolated group surface.

Blend modes use the CSS canonical names in Protocol V2 and are evaluated by
the runtime against source and backdrop pixels; they are not lowered to a
color matrix. `isolation` is a separate compositing boundary.

`enabled` is an editor/runtime state rather than CSS `display`. `visibility`
is the SVG presentation property and is preserved in JSON; the compiler
normalizes `hidden` and `collapse` to a non-painting runtime node.

Each layer may carry an optional `tracks[]` list. A track addresses one
animatable leaf property with a typed dot-separated path and strictly ordered
keyframes in local milliseconds. CSS animation/transition, Figma smart animate,
and AE-style editor actions remain high-level inputs; they must lower to these
protocol tracks. Runtime behavior is defined outside the Protocol package.

### 3.3 Complete visual atom catalog

The following is the entire currently defined V2 visual layer vocabulary.

| Atom | JSON payload and style | Certified atomic behavior |
| --- | --- | --- |
| `group` | No drawable payload; uses the shared layer fields | Parent/child transforms, nested timing, inherited opacity/visibility, sibling order, CSS blend modes, isolation, and clipPath/alpha/luminance masks |
| `shape` | `payload.shape: "rectangle"` or `"ellipse"`; optional rectangle `cornerRadius`; `style.fill`, opacity, optional stroke/width/opacity | Solid and multi-stop linear/radial/conic gradients, fill/stroke opacity, rectangle corner radius, 3D transform, timing, opacity, and ordering |
| `path` | `payload.contours[]` with line/cubic segments, `fillRule`, optional topology-matched `morph`; fill/stroke style | Nonzero/evenodd fills, multiple contours/holes, fixed-width strokes, miter/bevel/round joins, butt/square/round caps, dash array/offset, and morph interpolation before tessellation |
| `image` | `payload.assetId`, optional `fit` and normalized `crop` | Image asset lookup, `contain`, `cover`, `fill`, `none`, crop, plus shared transform/timing/opacity/order |
| `video` | `payload.assetId`, optional `fit`, `trimStart`, `trimEnd`, `audio`, `framePolicy` | Deterministic media-time selection; `floor`, `round`, or `ceil` frame policy; trim, embedded-audio intent, fit, and shared fields |
| `text` | Required `payload.layout`: visual lines, glyph runs, positioned glyphs; optional source metadata | Exact font asset/variation instance per run, visual glyph paint order, bidi/fallback/wrapping/rich spans already resolved, plus shared fields |

Text accepts no CSS text-layout syntax such as `white-space`, `direction`,
`font-family`, `word-break`, or inline markup. The text compiler/shaper
resolves those inputs to positioned glyphs before emitting V2. `runs[]` carries
the exact font asset, optional variation coordinates, fill, and glyph IDs;
`lines[].runIds` determines visual paint order. The optional `source` object is
editor metadata only and never controls rendering. Runtime receives the chosen
font instance and glyph IDs, then performs glyph-outline lookup/cache,
tessellation or atlas generation, and drawing. It does not rerun CSS text
layout. Text decoration is lowered to regular shape/path layers.

### 3.4 Effects

Effects are ordered atomic operators on the rasterized result of a drawable
layer. They are not layer types and cannot change semantic transforms. Up to
eight effects with unique ids may be attached to a drawable.

| Effect type | Atomic parameters | Meaning |
| --- | --- | --- |
| `color-adjust` | brightness, contrast, saturation, hueRotate | Ordered pixel-local colour adjustment |
| `grayscale` | amount (`0..1`) | CSS grayscale semantic filter |
| `sepia` | amount (`0..1`) | CSS sepia semantic filter |
| `invert` | amount (`0..1`) | CSS invert semantic filter |
| `filter-opacity` | amount (`0..1`) | CSS opacity filter, distinct from layer opacity |
| `blur` | radius | Gaussian spatial blur in output pixels |
| `shadow` | source (`box` or `alpha`), offset, blur, signed spread, color, inset | CSS box-shadow or alpha-derived filter drop-shadow |
| `outer-glow` | radius, color, opacity | Alpha-derived exterior glow |
| `inner-glow` | radius, color, opacity | Alpha-derived interior glow |
| `noise` | scale, amount, opacity, seed | Deterministic seeded grain |

Spatial effects and group compositing create explicit isolated/offscreen
surfaces in Runtime IR. Preview/export render those surfaces; they do not
recalculate a source layer's transforms.

`shadow` is the single canonical shadow atom. `source: "box"` is CSS
`box-shadow` and permits signed `spread` plus `inset`; `source: "alpha"` is
CSS `filter: drop-shadow()` and requires `spread: 0` and `inset: false`.
Multiple shadow entries retain `effects[]` order, but each entry samples the
original layer source surface rather than the previously generated shadow.
Alpha belongs in `color`, including its `#RRGGBBAA` component.

Semantic color filters remain readable in Protocol V2. A later
compiler/runtime stage may lower contiguous color-filter runs to a fused
Mat4x5 color matrix, but effect order must remain unchanged across spatial
effects such as `blur` and `shadow`.

### 3.5 Audio atomic design

`audio` is required, including for silent projects:

```ts
type AudioDomainV2 = {
  sampleRate: 48000;
  tracks: Array<{
    id: string;
    gainDb: number;
    pan: number; // -1..1
    muted: boolean;
    clips: Array<{
      id: string;
      assetId: string; // an audio asset or the audio stream of a video asset
      timing: { start: number; duration: number }; // milliseconds
      trim: { start: number; end?: number }; // milliseconds
      playbackRate: number;
      enabled: boolean; // false is silent; it never stops transport
      gainDb: number;
      pan: number; // -1..1, per source
      fadeIn?: { duration: number; curve: "linear" | "equal-power" }; // milliseconds
      fadeOut?: { duration: number; curve: "linear" | "equal-power" }; // milliseconds
    }>;
  }>;
};
```

All audio time in the Protocol document is in composition milliseconds until
Runtime evaluates a requested sample range. Protocol covers audio asset identity, timing,
bounded trim, per-input enable/gain/pan/fades, track bus controls, overlapping
clips, and explicit video-audio sources. A video layer does not create sound
implicitly: its `payload.audio` must be present and its source video must have
an imported audio derivative before the compiler can create a mix input.

Protocol V2 has no audio or video loop field. Repetition is represented by
separate clips or instances with explicit timeline ranges. Persisted documents
from the short-lived loop experiment are migrated on read by removing the
retired field; new documents remain strict and cannot encode implicit looping.

## 4. Compilation and Runtime IR

`compileProtocol()` is the canonical pure compiler entrypoint. It validates the
strict schema, compiler-supported feature usage, asset references, hierarchy, sibling
order, masks, and view contract, then emits the canonical visual/runtime V3
semantics. `compileProtocol()` lowers the validated document
into `RuntimeProjectV3`: a media catalog plus static `videoTimeline` and
`audioTimeline` plans. No second compiler or alternate protocol source is
allowed.

The certified visual lowering retained under `motion-runtime/src/visual` is an
implementation namespace for the certified paint semantics; it is not a
second runtime contract. New playback code uses the V3 projection and its pure
timeline resolvers. It does not reparse authoring JSON or rebuild timing at the
backend.

At a visual frame, the V3 visual evaluator resolves active timing, hierarchy,
inherited opacity, transforms, view projection, compositing boundaries,
effects, media time, and stable paint order into the backend-neutral paint
buffer.

At an audio sample range, `resolveAudioWindow()` produces an `AudioMixPlanV3`
containing deterministic bounded source ranges, gain envelopes, pan, fades,
and mix input order. It does not decode PCM or construct WebAudio nodes.

For the next runtime, `resolveVideoAt()` and `resolveAudioWindow()` consume the
static V3 timelines and return `VideoRenderPlanV3` and `AudioMixPlanV3`. This is
an evaluation-layer change, not a second authoring protocol: both V2-compatible
visual semantics and V3 media plans originate from the same compiled document.

Runtime IR may contain calculated Matrix4s and backend-neutral mesh, glyph-run,
or paint data. It must not contain authoring presets, raw GPU state, textures,
audio decoders, DOM media elements, or encoder commands.

## 5. Preview, export, and parity

`@motionvideo/preview-renderer` consumes only an evaluated runtime frame or
paint buffer. It selects WebGPU by default and WebGL2 as a fallback. The host
supplies image/video sources through an asset map or resolver; the renderer
owns only upload/cache lifecycle and diagnostics.

`@motionvideo/remotion-renderer` builds its paint tree from the same command
buffer and its audio track from the same audio mix plan. It does not parse
Protocol JSON, compose CSS transforms, or create an export-only timing model.

The architectural acceptance rule is therefore simple: preview and export use
the same RuntimeProjectV3 visual and audio meaning. Backend-specific limitations
must surface as diagnostics rather than silently changing the result.

### 5.1 Media decode and playback pipeline (V3)

Media decoding is an application-owned orchestration boundary. The browser may
provide codec implementations through WebCodecs and audio output through Web
Audio, but neither `HTMLVideoElement.currentTime` nor native video audio is a
composition clock. The engine owns operation generations, seek cancellation,
buffer budgets, scheduling, and the single master audio sample clock.

```text
Project JSON
    │
    ▼
Media Compiler
    │
    ▼
MediaRenderPlan
    │
    ├── Video source ───────────────► Video decoder/frame queue
    │
    ├── Embedded video audio ─┐
    │                         ├──► Decode Worker
    └── Standalone audio ─────┘         │
                                        ▼
                               PCM ring buffers
                                        │
                                        ▼
                               AudioWorklet Mixer
                                        │
                                  master sample clock
                                        │
                  ┌─────────────────────┴────────────────────┐
                  ▼                                          ▼
             Speakers                              WebGL/WebGPU paint
```

The two audio inputs are semantically different in the authoring model but
identical at runtime: both resolve to timestamped PCM chunks and enter the same
mixer. A video's embedded audio is represented by `payload.audio`; its
import-time audio derivative is stored on the video asset metadata. The
original video URI is used only by the visual decoder.

The V3 decode and buffering contracts are deliberately bounded:

- `DecodeCoordinator` requests only the audio windows required by the current
  plan and rejects stale completions after a seek or operation-epoch change.
- `PcmWindow` and `AudioBufferPolicy` enforce bounded sample/byte windows;
  discarded chunks are released before new work is admitted.
- `WebAudioGraphBackendV3` is the MVP output mixer: each active browser media
  source is routed through GainNode and StereoPannerNode into one master graph.
  `HTMLMediaAudioBackendV3` is compatibility fallback only, not the primary
  overlap/fade/pan implementation.
- `StreamingWorkletBackend` is the V2 streaming adapter; it replaces graph
  output with bounded PCM windows and an AudioWorklet mixer when precision and
  streaming are required.
- `VideoInstancePool` owns reusable video instances and
  `HtmlVideoBackend` adapts HTML video to the V3 plan. A future WebCodecs
  backend can replace it without changing timeline resolution or transport.

Playback enters `preparing` before `playing`. It waits for the initial audio
pre-roll, then starts the audio clock and uses that clock to request video
frames. On underrun, the engine reports diagnostics and may drop/repeat visual
frames; it must not let a video element silently take over transport timing.

## 6. Non-negotiable boundaries

- Only `format: "motion-protocol"` and `formatVersion: 2` enter the render
  core; there is no V1 compatibility branch.
- Atomic JSON contains semantic values, never precomputed `mat4`, draw calls,
  shader code, GPU handles, texture data, decoded audio, or DOM objects.
- Preview and Remotion consume runtime output; neither recomposes semantic
  transforms, hierarchy, view state, timing, or audio mix intent.
- Audio stays outside `layers[]`; visual nodes have no audio state.
- High-level authoring concepts never leak into V2 JSON.
- A feature is supported for rendering only when the Compiler can lower it to
  RuntimeProjectV3; schema presence alone is not a render promise.

## 7. Related guides and code

- [Audio guide](./audio.md): author-facing audio conventions and examples.
- [Atomic Protocol V2 schema](../../packages/motion-protocol/schema/v2.json):
  generated JSON Schema for validation and tooling.
- [Protocol source](../../packages/motion-protocol/src/v2): canonical Zod
  schemas, layer definitions, assets, and effects.
- [Compiler](../../packages/motion-compiler/src/compiler): Atomic JSON to
  Runtime IR lowering, with the V3 projection in
  [`runtime-project-v3.ts`](../../packages/motion-compiler/src/runtime-project-v3.ts).
- [Runtime](../../packages/motion-runtime/src): V3 visual evaluation, media
  catalog types, and timeline resolvers.
- [Playback Engine](../../packages/playback-engine/src): transport,
  clock, readiness, buffering, resource, backend, and diagnostics orchestration.
