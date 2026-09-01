# `@motionvideo/motion-compiler`

The compiler is the single conversion boundary between authoring JSON and the
runtime model used by Preview and Export.

```text
MotionProtocolV2
        │
        ▼
     Compiler
        │
        ▼
RuntimeProjectV3
        │
        ├── Preview
        └── Export
```

The compiler does not create a second authoring format. It receives one
`MotionProtocolV2` project and produces one deterministic `RuntimeProjectV3`
project.

## What the compiler is responsible for

The compiler owns the lowering decision: how a valid authoring value becomes a
runtime value that both Preview and Export can understand.

It is responsible for:

1. Accepting and canonicalizing Protocol V2 input.
2. Checking that every used feature is supported by the compiler.
3. Resolving authoring defaults and converting semantic values to runtime
   values.
4. Lowering visual layers into runtime visual nodes.
5. Building the runtime media catalog from asset metadata or probe data.
6. Lowering video layers into the runtime video timeline.
7. Lowering standalone audio and embedded video audio into the runtime audio
   timeline.
8. Validating the complete RuntimeProjectV3 before returning it.
9. Failing with a clear error when the project cannot be compiled safely.

The compiler is pure and deterministic for the same Protocol document and the
same supplied media catalog. It does not render pixels, decode media, create
GPU resources, control playback, or encode MP4 files.

## The complete compile flow

```text
                 MotionProtocolV2
                 canonical project
                         │
                         ▼
              ┌─────────────────────────┐
              │         COMPILER        │
              │                         │
              │  1. Parse / canonicalize│
              │  2. Check capabilities  │
              │  3. Lower visual model  │
              │  4. Build media catalog │
              │  5. Lower video timing  │
              │  6. Lower audio timing  │
              │  7. Validate Runtime V3 │
              └────────────┬────────────┘
                           │
                           ▼
                    RuntimeProjectV3
```

### Step 1: Parse and canonicalize

The public compiler boundary accepts unknown input. The Protocol parser
converts it to the strict `MotionProtocolV2` contract, including migration of
supported input representations.

After this step, the compiler works only with the canonical Protocol V2 model:

```text
format: "motion-protocol"
formatVersion: 2
composition
assets[]
layers[]
audio
```

Protocol schema validation owns JSON shape and project relationships. The
compiler does not invent another authoring schema.

### Step 2: Check capabilities

The Protocol schema answers:

> Is this JSON structurally and semantically valid authoring data?

The compiler capability catalog answers:

> Can this compiler lower the feature into RuntimeProjectV3 correctly?

These are different questions. A field may be valid in Protocol V2 while its
lowering is not yet implemented or certified. Such a project must stop with a
clear error instead of silently producing a different video.

### Step 3: Lower the visual model

The compiler converts visual authoring atoms into backend-neutral runtime visual
nodes. This includes:

- composition dimensions, background, and view projection;
- group hierarchy and parent relationships;
- local and world transform values;
- inherited timing and opacity;
- sibling paint order;
- blend modes and group-local masks;
- shape, path, image, video, and text payloads;
- ordered layer effects.

Matrix values are created for Runtime IR. They are never added to Protocol V2
JSON.

The result is the visual part of RuntimeProjectV3. Preview and Export consume
this same meaning; neither backend compiles the Protocol again.

### Step 4: Build the media catalog

The media catalog connects Protocol asset IDs to runtime media resources.

```text
Protocol assets[] + optional probe catalog
                    │
                    ▼
              mediaCatalog
              ├── image resources
              ├── video streams
              ├── audio streams
              └── font resources
```

Production callers can provide an immutable probe-hydrated catalog containing
stream IDs, durations, dimensions, frame rates, audio sample rates, and
derivative resources. Without one, the compiler can build a deterministic
Protocol-derived catalog for development and fixtures.

The compiler records references and timing metadata. It does not download,
decode, or cache the media bytes.

### Time-unit boundary

Protocol V2 stores layer timing, keyframe time, media duration, trims, and
fades in milliseconds. Runtime visual nodes use seconds, video instances use
microseconds, and audio clips use sample positions. The compiler performs
these conversions exactly once at this boundary; no runtime caller should
reinterpret Protocol millisecond values.

### Step 5: Lower the video timeline

Each visual video layer that has a resolvable video stream becomes a runtime
video instance with:

- a runtime media and stream reference;
- composition start and duration;
- source trim range;
- playback rate;
- deterministic frame selection policy.

```text
video layer + video asset
          │
          ▼
videoTimeline.instances[]
```

### Step 6: Lower the audio timeline

The compiler keeps audio parallel to the visual scene graph and creates runtime
audio tracks for:

- standalone Protocol audio clips;
- embedded audio explicitly enabled on video layers.

Audio lowering converts Protocol milliseconds to composition sample positions
and preserves:

- source trim;
- playback rate;
- enabled/muted state;
- gain and pan;
- fade duration and curve;
- track-level gain, pan, and mute state;
- source media and stream identity.

```text
Protocol audio + video embedded audio
                    │
                    ▼
              audioTimeline
```

For embedded audio, the video layer is the authoring owner of the linked
timeline by default:

```text
video layer
  ├── timing.start / timing.duration
  ├── payload.trimStart / payload.trimEnd
  └── payload.audio
        ├── enabled
        ├── gainDb
        ├── pan
        └── fadeIn / fadeOut
        │
        ▼
runtime audio clip
  ├── source: video asset audio derivative
  ├── timing: copied from video layer
  ├── trim: copied from video payload
  └── controls: copied from payload.audio
```

This is the important separation: the Compiler does not leave audio attached
to the visual node for the Runtime to interpret. It emits a visual video
instance and an independent audio timeline input that share the same source
asset and timing semantics. If `payload.audio.enabled` is false, the linked
audio input remains represented but is silent. If audio must be edited
independently, authoring should use a standalone `audio.tracks[].clips[]`
entry.

Audio sample rate in Protocol V2 and the runtime mix plan is `48000` for the
composition timeline. A source stream may retain its native sample rate in the
media catalog.

### Step 7: Validate the final RuntimeProjectV3

Before returning, the compiler validates the assembled runtime project. This
ensures that visual nodes, media references, video instances, audio clips, and
runtime version fields form one usable runtime document.

```text
invalid runtime projection
          │
          ▼
compiler error with code and path
```

## RuntimeProjectV3 output

The canonical compiler output has one runtime envelope:

```text
RuntimeProjectV3
├── format: "motion-runtime"
├── runtimeVersion: 3
├── projectId
├── visual
├── mediaCatalog
├── videoTimeline
├── audioTimeline
└── diagnostics
```

This is the only compiler output used by the next runtime. It is consumed by
both Preview and Export.

## Capabilities

### What a capability means

A capability is a named compiler support claim for one authoring feature. It is
the smallest explicit unit used to answer whether a Protocol value can be
lowered safely.

Examples:

```text
shape.rectangle.fill
shape.rectangle.gradient
image.preserveAspectRatio
video.trim
text.font
path.morph
effect.blur
mask.alpha
composite.blend.screen
```

The catalog is owned by this package because support is not determined by the
Protocol schema alone. The compiler is the first layer that can know whether a
field has a correct Runtime V3 lowering.

### Why the catalog exists

The capability catalog provides four guarantees:

1. **One support decision**: Preview and Export use the same compiler support
   boundary.
2. **Fail-closed behavior**: an unsupported feature produces an error instead
   of a silent fallback.
3. **Safe rollout**: a feature can be added only after its lowering is ready.
4. **Traceable tests**: each supported feature can be covered by compile and
   parity tests.

Capabilities are not a second Protocol, not editor metadata, and not a runtime
feature flag system. They are the compiler's support catalog for V2 → V3.

### Capability lifecycle

```text
Protocol field exists
        │
        ▼
Compiler lowering exists
        │
        ▼
Runtime semantics are valid
        │
        ▼
Preview and Export parity is tested
        │
        ▼
Capability is published as supported
```

The catalog version changes when the compiler support surface changes. A
capability should not be published merely because the Protocol schema accepts
the corresponding JSON.

The public catalog is available as:

```ts
import {
  COMPILER_SUPPORTED_FEATURES,
  COMPILER_SUPPORTED_FEATURES_VERSION,
  isCompilerFeatureSupported,
} from "@motionvideo/motion-compiler";
```

## Public API

```ts
import {
  compileProtocol,
  compileProtocolToPaintCommands,
} from "@motionvideo/motion-compiler";

const runtime = compileProtocol(protocol);
const frame = compileProtocolToPaintCommands(protocol, { frame: 0 });
```

### `compileProtocol()`

The canonical entrypoint. It produces `RuntimeProjectV3` and may receive an
optional probe-hydrated media catalog:

```ts
const runtime = compileProtocol(protocol, { mediaCatalog });
```

Use this output as the input to Preview, Export, or another runtime consumer.

### `compileProtocolToPaintCommands()`

This is a convenience composition for tests and simple callers:

```text
compileProtocol()
        │
        ▼
RuntimeProjectV3
        │
        ▼
evaluateRuntimeProjectV3()
        │
        ▼
PaintCommandBuffer
```

It does not define a second compiler path. Production Preview and Export should
share the canonical RuntimeProjectV3 semantics.

### Compiler errors

The canonical V3 entrypoint reports structured failures for important runtime
boundary problems:

| Code | Meaning |
| --- | --- |
| `MISSING_MEDIA_STREAM` | A video layer has no resolvable video stream |
| `MISSING_AUDIO_DERIVATIVE` | An audio input has no resolvable audio stream |
| `INVALID_RUNTIME_PROJECT` | The assembled RuntimeProjectV3 is invalid |

Unsupported compiler features and invalid Protocol input also fail the compile
operation with a message identifying the feature or field involved.

## Ownership boundaries

| Package | Responsibility |
| --- | --- |
| `@motionvideo/motion-protocol` | Strict Protocol V2 JSON and authoring validation |
| `@motionvideo/motion-compiler` | Capability checks and V2 → V3 lowering |
| `@motionvideo/motion-runtime` | Runtime evaluation and backend-neutral paint/audio plans |
| Preview renderer | Browser rendering and device resources |
| Export renderer | Native rendering and media output |
| FFmpeg | Final media encoding |

The compiler never becomes the renderer. It prepares the one runtime meaning
that every renderer must consume.

## Out of scope

- Pixel rasterization or GPU resource ownership.
- Media download, decoding, or byte caching.
- Playback transport, clocks, buffering, or device control.
- FFmpeg invocation or MP4 storage.
- High-level authoring patterns, presets, templates, and components.

## Development commands

```bash
pnpm --filter @motionvideo/motion-compiler typecheck
pnpm --filter @motionvideo/motion-compiler test
pnpm --filter @motionvideo/motion-compiler lint
```
