# NeonVideo V2 Architecture

> Status: active architecture for the V2 render core.
>
> Scope: MCP, editor, AI, and CLI intent through authoring, compilation,
> visual/audio runtime evaluation, preview, export, and final encoded output.

## 1. One Intent, One Render Meaning

NeonVideo has several ways to create or modify a video, but they must converge
before rendering. MCP tools, the editor, AI agents, templates, and the CLI are
authoring surfaces. They do not own GPU logic, renderer state, or Matrix4 math.

```text
MCP tools       Editor UI       AI agent       Templates / CLI
     |               |              |                  |
     +---------------+--------------+------------------+
                             |
                             v
                  High-level Authoring JSON
                             |
                     Compiler A: lower intent
                             |
                             v
                    Atomic Protocol V2 JSON
                             |
                Compiler B: resolve and compile
                             |
                             v
                    Atomic Protocol V2 JSON
                       /                 \
                      /                   \
             Visual domain             Audio domain
                    |                       |
          Compiler B visual        Compiler B audio
                    |                       |
             RuntimeFrameV2            AudioMixPlanV2
                    |                       |
          PaintCommandBuffer       WebAudio / audio render
                    |                       |
        Native preview renderer            |
        WebGPU default / WebGL2            |
                    \                       /
                     \                     /
                      +---------+---------+
                                |
                                v
                         Remotion encoder
                         frames + audio -> MP4
```

The invariant is simple: a given Atomic Protocol V2 document and frame time
must have one backend-neutral runtime meaning. Preview and export may use
different platform adapters, but they must not reinterpret transforms, timing,
ordering, visual semantics, or audio timing/mix semantics. Visual and audio
remain separate until the final media encoder.

## 2. Authoring Surfaces

| Surface | Owns | Does not own |
| --- | --- | --- |
| MCP | Validate, inspect, patch, compile, and render workflows | GPU resources or renderer math |
| Editor | Human interaction, selection, timeline, and high-level document editing | Atomic compiler internals or GPU commands |
| AI | Generate or patch high-level intent with explicit constraints | Raw Matrix4, shaders, or backend-specific state |
| Templates / Skills | Reusable high-level structure and controlled parameters | New atomic behavior without certification |
| CLI | Automation and deterministic job orchestration | A parallel render contract |

All surfaces should produce the same high-level representation once that layer
is enabled. Until then, the V2 render core is exercised directly with Atomic
Protocol V2 fixtures; this is deliberate while atoms are certified one at a
time.

## 3. High-level Authoring JSON

High-level JSON is for rich intent. It can contain concepts that are useful to
people and AI but would make the renderer needlessly large:

```text
High-level Composition
├── view
│   └── camera intent, movement, zoom, orbit, and perspective intent
├── background
├── timeline
└── nodes
    ├── shape
    ├── path
    ├── text
    └── group
```

`view` is composition-level. A camera is therefore never a visual node: it
changes how the composition is observed. Compiler A lowers camera intent to
the normalized V2 view state and, once camera animation is certified, semantic
tracks targeting that state.

- Pattern, preset, template, and component.
- Camera movement, parallax, perspective intent, orbit, card tilt, and page
  flip.
- Ken Burns, zoom, pan, scene preset, transition, and text animation preset.
- Auto layout, responsive behavior, variables, and product-level constraints.

For example, a `hero-intro` pattern may describe a product image, a title, a
fade-up preset, and a camera push. It is not an atom and it is not a renderer
command.

### Compiler A: high-level to Atomic V2

Compiler A expands rich intent into explicit, inspectable semantic data. It
resolves templates, presets, layout, defaults, references, and deterministic
ids. Terms such as `hero-intro`, `fade-up`, and `ken-burns` disappear from its
output.

Compiler A is pure. It does not acquire a WebGPU device, create a canvas, or
emit shader code.

## 4. Atomic Protocol V2

Atomic Protocol V2 is the small JSON contract between authoring and render
execution. It describes what must be rendered, not how one backend implements
it.

### 4.1 Atomic document tree

```text
Atomic Protocol V2
├── composition
│   ├── width / height / fps / background
│   └── view
│       ├── projection
│       │   ├── orthographic: zoom + near + far
│       │   └── perspective: fov + near + far
│       └── transform: translate Vec3 + rotate Vec3
└── layers[]
```

The complete root also contains two non-visual domains:

```text
Atomic Protocol V2
├── composition
├── assets[]
├── layers[]       -> visual scene graph and atomic paint content
└── audio          -> tracks[] -> clips[] -> media timing and mix intent
```

This is the current schema shape. `composition.view` is required, so every V2
document has one explicit projection contract. Orthographic `zoom` is centered
on the composition: `1` preserves the full composition framing and `2` halves
the visible width and height. Both projection modes carry `near` and `far` for
canonical clip-Z boundaries. The camera intent that users author remains
high-level; this V2 field is the explicit, renderer-neutral result the runtime
needs.

`layers[]` is a flat, deterministic array whose entries carry `id`,
`parentLayerId`, `order`, `frame`, semantic 3D `transform`, normalized
`opacity` (`0..1`, default `1`), and
`timing`. A `group` entry may parent other layers. Group hierarchy is local
space structure in Protocol; it is not an implicit camera, clipping surface, or
depth-buffer feature.

Its vocabulary is intentionally narrow:

| Atomic concept | Meaning |
| --- | --- |
| Composition / view | Canvas size, frame rate, background, and normalized view/projection state |
| Group | Parent-child local space when group certification is available |
| Shape | Rectangle, ellipse, polygon, then further certified primitives |
| Text / image / video / path | Semantic content and asset references as each atom is certified |
| Frame | Local width and height |
| Transform | Semantic translate, scale, rotate, skew, and 3D anchor |
| Timing / animation | Active window and keyframes targeting atomic properties |
| Effects / mask / composite | Certified visual and compositing relationships |
| Audio | Separate tracks, clips, source trim, gain, pan, fades, and explicit media references |

Atomic V2 never contains a precomputed `mat4`, GPU buffer, shader, texture
handle, bind group, or backend-specific draw call. Those values belong to later
stages. The protocol is currently hard-locked to `formatVersion: 2`; V1 input
is not accepted by the compiler, runtime, preview, or export core.

### 4.2 Audio domain

Audio is a required root domain, including for silent projects. Silence is
represented by `audio: { sampleRate: 48000, tracks: [] }`.

```ts
type AudioDomainV2 = {
  sampleRate: 48000;
  tracks: AudioTrackV2[];
};

type AudioTrackV2 = {
  id: string;
  gainDb: number;
  pan: number; // -1..1
  muted: boolean;
  clips: AudioClipV2[];
};

type AudioClipV2 = {
  id: string;
  assetId: string;
  timing: { start: number; duration: number };
  trim: { start: number; end?: number };
  playbackRate: number;
  loop: boolean;
  gainDb: number;
  fadeIn?: AudioFadeV2;
  fadeOut?: AudioFadeV2;
};
```

Audio is not a visual atom and does not enter the scene graph. It has no frame,
transform, camera, order, Matrix4, or paint command. An audio clip may
reference an `audio` asset or explicitly reference the audio stream of a
`video` asset. A visual video layer does not implicitly create an audio clip.

All audio timing is expressed in composition seconds. `trim` is source-media
time, `timing.duration` is composition time, and the fixed V2 sample rate is
48 kHz. Track and clip gain, pan, looping, and fades are protocol intent;
decoded PCM, browser nodes, GPU resources, and encoder command strings belong
to later runtime adapters.

### 4.3 Layer and operator delivery plan

The final Atomic V2 surface will grow through certified tickets, not by adding
all node types to the schema in advance:

| Atomic surface | Plan task | State and ownership |
| --- | --- | --- |
| `shape.rectangle`, `shape.ellipse` | Tasks 2-5 | Certified. Frame, 3D transform, timing, opacity, order, fill, gradient, and supported stroke behavior are live. |
| `path` | Task 6: Path Embedded in 3D | Certified for the current static surface. Closed/open local-plane contours, `nonzero`/`evenodd` fill rules, holes, fixed-width stroke joins/caps/dashes, and topology-matched morph interpolation are resolved by Runtime before the shared Matrix4 transform. |
| `group` | Task 7: Group and Parent Transform | Certified. Compiler B lowers parent-to-child world Matrix4 inheritance, inherited opacity, nested timing, and deterministic child ordering. Runtime receives drawable leaves only. |
| `image` | Task 8: Image | Certified. Protocol stores `assets[]` metadata plus `payload.assetId`; Compiler emits backend-neutral `drawImage`, and preview backends own texture upload/cache, fit/crop, and alpha handling. |
| `video` | Task 9: Video | Certified. Protocol stores video metadata plus trim/loop/mute/frame policy; Runtime emits deterministic `mediaTime`, and preview backends seek the host-owned media source before upload. |
| `text` | Task 10 | Planned. Adds explicit font assets plus renderer-neutral shaping and glyph-run Runtime IR. |
| `effects` | Task 11 | Planned operators, not layer types. Each effect receives its own offscreen and pixel-parity contract. |
| `mask` and blend modes | Task 12 | Planned after groups and offscreen compositing boundaries are certified. |

High-level patterns, presets, templates, and components remain blocked until
the static path, group, image, and video tickets are certified. Compiler A may
then lower only to entries that the V2 capability manifest marks certified.
See [Atomic Protocol V2 Preview E2E Plan](../atomic-protocol-v2-preview-e2e-plan.md)
for the acceptance gates and exact test order.

## 5. Compiler B and Runtime IR

Compiler B accepts validated Atomic Protocol V2 and produces `RuntimeProjectV2`
with separate visual and audio runtime branches. It is the sole owner of
render math and protocol-to-runtime lowering:

```text
Atomic V2
  +-> validate visual capability and asset/reference rules
  |   -> resolve visual timing, hierarchy, and stable sibling order
  |   -> compose local and world Matrix4 transforms
  |   -> resolve view and projection into `worldToClipMatrix`
  |   -> lower semantic paint into `PaintCommandBuffer`
  |
  +-> validate audio asset references and mix rules
      -> resolve source trim, playback rate, loop, fades, gain, and pan
      -> lower audio intent into `AudioMixPlanV2`
```

At a requested video frame, `evaluateRuntimeProjectV2()` produces
`RuntimeFrameV2` and a `PaintCommandBuffer`. Each drawable has a required
Matrix4, opacity, visibility, and deterministic sibling `order`. Group nodes are
lowered before Runtime evaluation, so renderers consume leaves and never
recompute semantic transform properties or parent hierarchy.

For an audio sample range, the same runtime project produces an
`AudioMixPlanV2`:

```ts
evaluateRuntimeAudioMixV2(runtime, {
  startSample,
  sampleCount,
}): AudioMixPlanV2;
```

`AudioMixPlanV2` describes active source ranges, loop segments, gain envelopes,
pan, fades, and deterministic clip order. It does not contain decoded PCM or
browser/encoder implementation objects. Runtime therefore owns both branches,
but never merges audio into the visual frame IR.

### 3D from the beginning

V2 uses one Matrix4 representation for both 2D and 3D. A normal 2D scene is an
XY plane with `z = 0` under an orthographic projection. Rotate X/Y, translate
Z, perspective, and a non-zero Z anchor use the same contract when a feature
needs depth.

Atomic JSON keeps transforms semantic. Runtime IR owns the computed column-major
`worldToClipMatrix`; WebGL2 adapts its clip Z only at the preview backend.
During the
MVP, `order` remains the sole deterministic compositing order; `translate.z`
does not silently enable depth-buffer ordering.

## 6. Preview Rendering

`@motionvideo/preview-renderer` is NeonVideo's native preview package. It
consumes `RuntimeFrameV2` or `PaintCommandBuffer` only.

- WebGPU is the default backend.
- WebGL2 is the fallback and an explicit comparison backend for debugging.
- Both upload the same resolved Matrix4 and paint the same runtime commands.
- Both report unsupported commands as diagnostics instead of silently using a
  different render contract.
- Preview audio uses a separate WebAudio adapter driven by `AudioMixPlanV2`.
- WebGPU/WebGL2 never render audio and never own audio clock state.

The preview renderer owns device/context setup, GPU resource upload, draw
submission, presentation, and diagnostics. It does not parse authoring JSON,
expand a preset, calculate a layer transform, or depend on PixiJS.

## 7. Export and Final Output

`@motionvideo/remotion-renderer` receives the same Runtime V2 visual frame
meaning and audio mix meaning as preview. Remotion schedules visual frames,
renders/mixes audio, and encodes output; it does not recalculate visual
transforms or reinterpret audio timing.

```text
Atomic V2
   |
Compiler B
   +--> RuntimeFrameV2 -> WebGPU/WebGL2 preview -> visual frames
   |
   +--> AudioMixPlanV2 -> WebAudio preview / Remotion audio render
                                     |
                                     v
                              final media encoder
```

Export must not introduce a CSS transform model, recalculate layer matrices, or
accept a legacy project format. Audio export must consume the same sample-rate,
trim, loop, gain, pan, and fade semantics as preview. Pixel-level visual parity
tests compare certified cases across WebGPU, WebGL2, and Remotion output, while
audio parity tests compare deterministic sample ranges and mix plans. The
canonical full export gate is
`pnpm e2e:v2-remotion-parity`. It first renders every shared preview-lab fixture
through `MotiClipVideo`, then opens the native web preview in Playwright and
compares the complete RGBA PNG buffers. The gate serves the same media assets,
prepares the same font layout, and therefore verifies the actual preview-to-PNG
path rather than only checking that Remotion produced a non-empty file.

## 8. Certification and Delivery Order

An atom is complete only after its full path is proven:

```text
Protocol schema -> Compiler B -> Runtime visual -> WebGPU/WebGL2
-> browser pixel E2E -> Remotion frame

Protocol schema -> Compiler B -> Runtime audio -> WebAudio
-> deterministic audio E2E -> Remotion audio -> encoded-media smoke test
```

The current V2 visual surface includes rectangle and ellipse paint, image and
video media, prepared text, path contours and morphing, group transforms,
Matrix4 projection, and the certified effect operators. Each surface is
compiled from the preview lab and rendered through WebGPU/WebGL2 in the web
suite plus Remotion PNG export. High-level patterns, masks, and untested
future operators still require their own certification evidence.

## 9. Non-negotiable Boundaries

- No V1 compatibility branch in protocol, compiler, runtime, preview, or
  Remotion export.
- No high-level pattern, component, preset, template, or layout state in
  Atomic Protocol V2.
- No raw Matrix4 in Atomic Protocol V2.
- No GPU handles in Runtime IR.
- No semantic transform composition in preview or export renderers.
- No audio clip, track, or mix state in the visual scene graph.
- No Matrix4, camera, order, or GPU resource in the audio runtime branch.
- Preview and export must consume the same `AudioMixPlanV2` semantics.
- No PixiJS dependency in native preview.
- No untested atom is exposed as a supported high-level feature.

This guide is the starting point for all future V2 guides. New documentation
must describe one of these explicit boundaries and link back here rather than
recreating a parallel architecture.

