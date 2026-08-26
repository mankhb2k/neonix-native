# MotiClip V2 Architecture Guide

> Status: active architecture and Atomic Protocol V2 reference.
>
> Scope: the contract from V2 project JSON through compilation, runtime
> evaluation, native preview, Remotion export, and encoded media. This is an
> architecture guide, not an implementation plan or ticket tracker.

## Purpose and source of truth

MotiClip can be authored by the editor, MCP tools, AI, templates, or the CLI.
Those are authoring surfaces; they do not define rendering semantics. Every
renderable project must become one strict `MotionProtocolV2` document before
it reaches the render core.

The source of truth for the accepted JSON is
[`@motionvideo/motion-protocol`](../../packages/motion-protocol/src/v2/project.ts).
The complete list of certified visual atomic capabilities is
[`V2_CERTIFIED_ATOMS`](../../packages/motion-protocol/src/v2/capabilities.ts),
and the audio list is
[`V2_AUDIO_CAPABILITY_LEDGER`](../../packages/motion-protocol/src/v2/audio-capabilities.ts).
This guide explains their architectural meaning; schema and capability ledger
win if this page ever becomes stale.

## 1. One project, one render meaning

```text
Editor / MCP / AI / templates / CLI
                 |
                 v
        MotionProtocolV2 JSON
                 |
                 v
 @motionvideo/motion-compiler
       compileProtocolV2()
                 |
                 v
           RuntimeProjectV2
             /           \
            v             v
RuntimeFrameV2       RuntimeAudioMixPlanV2
PaintCommandBuffer          |
       |                    |
       +---- Native preview +---- WebAudio preview
       |                    |
       +---- Remotion visual +---- Remotion audio
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

## 2. Package ownership

| Boundary | Package | Owns | Does not own |
| --- | --- | --- | --- |
| Protocol | `@motionvideo/motion-protocol` | Strict V2 authoring JSON, asset metadata, atomic vocabulary, capability ledger | Matrix4 values, GPU objects, decoded media, renderer commands |
| Compiler | `@motionvideo/motion-compiler` | Validation, references, V2-to-runtime lowering | Pixel rendering, frame playback, GPU resources |
| Runtime | `@motionvideo/motion-runtime` | Timing, hierarchy, Matrix4/projection evaluation, paint commands, audio mix plans | Protocol parsing, media decoding, WebAudio/GPU state |
| Preview | `@motionvideo/preview-renderer` | Canvas/device setup, WebGPU-first rendering, WebGL2 fallback, asset upload/cache, diagnostics | Semantic transform composition, authoring JSON parsing, audio clock |
| Export | `@motionvideo/remotion-renderer` | Rendering the evaluated paint tree, offline audio mix, Remotion encode integration | A second protocol/compiler/transform model |

High-level constructs such as presets, templates, components, auto-layout,
camera gestures, and AI intent are deliberately outside Atomic Protocol V2.
The repository currently provides the V2 compiler (Atomic JSON to Runtime IR),
not a general high-level-authoring compiler. Any future authoring layer must
lower to the atomic contract described here.

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
  timing: { start: number; duration: number }; // composition seconds
  composite?: {
    blendMode: "normal" | "multiply" | "screen" | "add";
    mask?: {
      mode: "clip" | "alpha" | "inverse-alpha" | "luma";
      sourceLayerId: string;
      sourceVisibility: "mask-only";
    };
  };
  effects?: EffectV2[];
};
```

The transform remains semantic in JSON. The compiler/runtime is the sole owner
of local, parent/world, view, and projection Matrix4 composition. A normal 2D
scene is an XY plane at `z = 0` under orthographic projection; the same model
also supports 3D translation, X/Y rotation, perspective, and a 3D anchor.
`order`, not `translate.z`, remains the deterministic paint order.

Groups create hierarchy and can carry transform, timing, opacity, blend, and
mask relationships. A group does not draw, clip to its frame, or become an
implicit camera. Masking is group-local: its source must be a direct drawable
child; `clip` requires a shape source, while alpha, inverse-alpha, and luma can
use a drawable source. Mask sources are emitted as `mask-only`.

There is no generic keyframe/animation-track JSON field in the current V2
schema. The supported temporal primitive is `timing`; any animation layer must
be introduced explicitly in a future protocol revision rather than inferred by
a renderer.

### 3.3 Complete visual atom catalog

The following is the entire currently defined V2 visual layer vocabulary.

| Atom | JSON payload and style | Certified atomic behavior |
| --- | --- | --- |
| `group` | No drawable payload; uses the shared layer fields | Parent/child transforms, nested timing, inherited opacity, sibling order, isolated compositing, four blend modes, and clip/alpha/inverse-alpha/luma masks |
| `shape` | `payload.shape: "rectangle"` or `"ellipse"`; optional rectangle `cornerRadius`; `style.fill`, opacity, optional stroke/width/opacity | Solid and two-stop linear/radial gradients, fill/stroke opacity, rectangle corner radius, 3D transform, timing, opacity, and ordering |
| `path` | `payload.contours[]` with line/cubic segments, `fillRule`, optional topology-matched `morph`; fill/stroke style | Nonzero/evenodd fills, multiple contours/holes, fixed-width strokes, miter/bevel/round joins, butt/square/round caps, dash array/offset, and morph interpolation before tessellation |
| `image` | `payload.assetId`, optional `fit` and normalized `crop` | Image asset lookup, `contain`, `cover`, `fill`, `none`, crop, plus shared transform/timing/opacity/order |
| `video` | `payload.assetId`, optional `fit`, `trimStart`, `trimEnd`, `loop`, `muted`, `framePolicy` | Deterministic media-time selection; `floor`, `round`, or `ceil` frame policy; trim, loop, mute, fit, and shared fields |
| `text` | NFC `text`, `fontAssetId`, font size, line height, letter spacing, alignment, vertical alignment, language, fill | Explicit font asset, single-style LTR text, no-wrap/visible overflow layout, single or newline-separated lines, left/center/right and top/middle/bottom alignment, solid fill, plus shared fields |

`text` intentionally does **not** accept RTL, variable-font axes, rich text,
word wrapping, clipping, gradient fill, or text stroke. Those are not hidden
fallback behaviors.

### 3.4 Effects

Effects are ordered atomic operators on the rasterized result of a drawable
layer. They are not layer types and cannot change semantic transforms. Up to
eight effects with unique ids may be attached to a drawable.

| Effect type | Atomic parameters | Meaning |
| --- | --- | --- |
| `color-adjust` | brightness, contrast, saturation, hueRotate | Ordered pixel-local colour adjustment |
| `blur` | radius | Gaussian spatial blur in output pixels |
| `drop-shadow` | x, y, blur, color, opacity | Alpha-derived projected shadow |
| `outer-glow` | radius, color, opacity | Alpha-derived exterior glow |
| `inner-glow` | radius, color, opacity | Alpha-derived interior glow |
| `noise` | scale, amount, opacity, seed | Deterministic seeded grain |

Spatial effects and group compositing create explicit isolated/offscreen
surfaces in Runtime IR. Preview/export render those surfaces; they do not
recalculate a source layer's transforms.

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
      timing: { start: number; duration: number };
      trim: { start: number; end?: number };
      playbackRate: number;
      loop: boolean;
      gainDb: number;
      fadeIn?: { duration: number; curve: "linear" | "equal-power" };
      fadeOut?: { duration: number; curve: "linear" | "equal-power" };
    }>;
  }>;
};
```

All audio time is in composition seconds until Runtime evaluates a requested
sample range. The audio capability ledger covers asset identity, timing, trim,
loop, independent track/clip gain, pan, fade curves, track mute, overlapping
clips, and explicit video-audio sources. A video layer does not create sound
implicitly; an audio clip must reference the video asset.

## 4. Compilation and Runtime IR

`compileProtocolV2()` validates the strict schema, certified capability usage,
asset references, hierarchy, sibling order, masks, and view contract. It then
emits `RuntimeProjectV2`.

At a visual frame, `evaluateRuntimeProjectV2()` resolves active timing,
hierarchy, inherited opacity, Matrix4 transforms, view projection, compositing
boundaries, effects, media time, and stable paint order into `RuntimeFrameV2`
and its `PaintCommandBuffer`.

At an audio sample range, `evaluateRuntimeAudioMixV2()` produces a
`RuntimeAudioMixPlanV2` containing deterministic source ranges, loop segments,
gain envelopes, pan, fades, and mix input order. It does not decode PCM or
construct WebAudio nodes.

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
the same Runtime V2 visual and audio meaning. Backend-specific limitations
must surface as diagnostics rather than silently changing the result.

## 6. Non-negotiable boundaries

- Only `format: "motion-protocol"` and `formatVersion: 2` enter the render
  core; there is no V1 compatibility branch.
- Atomic JSON contains semantic values, never precomputed `mat4`, draw calls,
  shader code, GPU handles, texture data, decoded audio, or DOM objects.
- Preview and Remotion consume runtime output; neither recomposes semantic
  transforms, hierarchy, view state, timing, or audio mix intent.
- Audio stays outside `layers[]`; visual nodes have no audio state.
- High-level authoring concepts never leak into V2 JSON.
- A capability is supported only when it appears in the corresponding V2
  capability ledger; schema presence alone is not a support promise.

## 7. Related guides and code

- [Audio guide](./audio.md): author-facing audio conventions and examples.
- [Atomic Protocol V2 schema](../../packages/motion-protocol/schema/v2.json):
  generated JSON Schema for validation and tooling.
- [Protocol source](../../packages/motion-protocol/src/v2): canonical Zod
  schemas, layer definitions, assets, effects, and capability ledgers.
- [Compiler](../../packages/motion-compiler/src/compile-v2): Atomic JSON to
  Runtime IR lowering.
- [Runtime](../../packages/motion-runtime/src/v2): visual evaluation and audio
  mix planning.
