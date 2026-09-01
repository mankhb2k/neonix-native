# `@motionvideo/motion-protocol`

Atomic Protocol V2 schema and validation contract for NeonVideo.

This package owns authoring JSON only. It does not own Runtime IR, Matrix4
buffers, GPU resources, preview rendering, or export rendering.

## Public API

```ts
import {
  MotionProtocolV2Schema,
  parseMotionProtocol,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol";

const protocol: MotionProtocolV2 = MotionProtocolV2Schema.parse(input);
```

The explicit V2 entrypoint is also available:

```ts
import { MotionProtocolV2Schema } from "@motionvideo/motion-protocol/v2";
```

The retired `./runtime` entrypoint and all V1 parser/schema exports have been
removed.

## Protocol V2 shape

```text
MotionProtocolV2
├── composition
│   ├── width / height / fps
│   ├── background / colorSpace
│   └── required view + projection
└── layers[]
    └── atomic layer
        ├── frame
        ├── transform (3D translate / scale / rotate / skew / anchor)
        ├── timing
        ├── opacity / order (unique among siblings; higher paints later)
        ├── optional property tracks / keyframes (local layer time)
        └── shape payload + paint style
```

The root also contains required `assets[]` and `audio` domains. Silent
projects use `audio: { sampleRate: 48000, tracks: [] }`. Audio is parallel to
`layers[]`, not part of the visual scene graph; its clips reference `audio` or
`video` assets. A video layer with embedded sound stores its audio authoring
controls in `payload.audio`. The video layer remains the default source of
composition timing and source trim; the Compiler copies those values into a
separate runtime audio clip. The audio derivative itself is metadata on the
video asset and is not decoded audio.

Every schema is strict. Unknown fields are rejected. A Protocol V1 envelope,
legacy origin/depth fields, bones, high-level patterns, and runtime-only fields
are not accepted by this package.

## Complete JSON design

### 1. Root document

`MotionProtocolV2` always has these seven root fields:

```text
MotionProtocolV2
├── format
├── formatVersion
├── id
├── composition
├── assets[]
├── layers[]
└── audio
```

Minimal valid project:

```json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "id": "project-001",
  "composition": {
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "background": "#000000",
    "colorSpace": "srgb",
    "view": {
      "projection": {
        "kind": "orthographic",
        "zoom": 1,
        "near": 0.1,
        "far": 1000
      },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 }
      }
    }
  },
  "assets": [],
  "layers": [],
  "audio": {
    "sampleRate": 48000,
    "tracks": []
  }
}
```

### 2. Composition

| Field | Meaning |
| --- | --- |
| `width` | Composition width in pixels |
| `height` | Composition height in pixels |
| `fps` | Frames per second |
| `background` | `#RRGGBB` or `#RRGGBBAA` |
| `colorSpace` | Currently `srgb` |
| `view` | Composition projection and view transform |

`view.projection` is either:

- `orthographic`: `kind`, `zoom`, `near`, `far`;
- `perspective`: `kind`, `fov`, `near`, `far`.

`view.transform` contains semantic `translate` and `rotate` Vec3 values.

### 3. Assets

`assets[]` contains portable metadata and references only. It does not contain
textures, decoded audio, browser elements, GPU handles, or other runtime data.

| `kind` | Required identity and metadata |
| --- | --- |
| `image` | `id`, `uri`; optional `mimeType`, `width`, `height`, `integrity` |
| `video` | `id`, `uri`; optional dimensions, `duration`, `fps`, audio derivative |
| `audio` | `id`, `uri`, `mimeType`; optional `duration`, `sampleRate`, `channels`, `integrity` |
| `font` | `id`, `uri`, `mimeType`, `family`, `weight`, `style`, `integrity` |

A video audio derivative has `uri` and optional `mimeType`, `duration`,
`sampleRate`, `channels`, and `integrity`.

### 4. Shared visual-layer fields

Every layer has the following base fields:

```json
{
  "id": "layer-001",
  "parentLayerId": null,
  "order": 1,
  "frame": { "width": 1080, "height": 500 },
  "transform": {
    "translate": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "rotate": { "x": 0, "y": 0, "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "anchor": { "x": 0, "y": 0, "z": 0 }
  },
  "opacity": 1,
  "enabled": true,
  "backfaceVisibility": "visible",
  "timing": { "start": 0, "duration": 5000 }
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique layer identifier |
| `parentLayerId` | Parent group identifier or `null` |
| `order` | Paint order within the sibling scope; higher paints later |
| `frame` | Local width and height |
| `transform` | Translate, scale, rotate, skew, anchor, and optional ordered operations |
| `opacity` | Source opacity from `0` to `1`; default `1` |
| `enabled` | Optional editor/runtime enable state; omitted means `true` |
| `backfaceVisibility` | Optional `visible` or `hidden`; controls painting of the reverse side after accumulated 3D transforms |
| `timing` | Composition-time start and duration in milliseconds |
| `tracks` | Optional typed keyframe tracks sampled in local layer time (milliseconds) |
| `composite` | Optional blend mode and mask |
| `effects` | Optional ordered effect list |

#### Transform and matrix boundary

The semantic component fields (`translate`, `scale`, `rotate`, `skew`, and
`anchor`) remain in Protocol V2 for compatibility. V2 also supports an
optional ordered `operations[]` form. Operation order is significant and is
the lossless representation for CSS transform lists:

```json
{
  "anchor": { "x": 0, "y": 0, "z": 0 },
  "operations": [
    { "type": "translate", "value": { "x": 100, "y": 0, "z": 0 } },
    { "type": "rotateZ", "value": 30 },
    { "type": "scale", "value": { "x": 1.2, "y": 1.2, "z": 1 } }
  ]
}
```

Supported operations are `translate`, `rotateX`, `rotateY`, `rotateZ`,
`scale`, `skew`, `perspective`, and `matrix`. A `matrix` operation carries
exactly 16 finite column-major values (matching the runtime/WebGL `Matrix4`)
and is a first-class protocol value for CSS
`matrix()`/`matrix3d()`; it is not an undocumented fallback. The compiler
emits the ordered operations, and the runtime composes them into its internal
`Matrix4` for rendering. Matrix multiplication and GPU representation remain
runtime implementation details; the transform information itself stays in
the protocol so it cannot be lost between compiler and runtime.

For the additive V2 migration, the legacy component fields remain required
even when `operations[]` is present. New compiler/runtime support must treat
`operations[]` as authoritative for order; old consumers that do not support
operations must reject such input rather than silently ignoring it.

In normal use, simple 2D transforms continue to use the semantic component
fields and do not need `operations[]`. The ordered form is reserved for cases
where transform order must be preserved, for 3D operations, perspective, or
an arbitrary matrix. Most ordinary CSS animation tracks therefore continue to
target properties such as `transform.translate.x`, `transform.scale`, or
`opacity` rather than manipulating a matrix directly.

`enabled` is an editor/runtime state, not a persisted copy of CSS `display` or
`visibility`. A disabled layer remains in the protocol hierarchy but
contributes no rendered output. It can also be targeted by a boolean track for
discrete timeline enable/disable changes.

### 4.1 Local 3D contexts

`composition.view.projection` is the global camera. A CSS `perspective`
property, however, applies to one subtree, so Protocol V2 represents it on a
group through an optional `render3d` context:

```json
{
  "type": "group",
  "render3d": {
    "transformStyle": "preserve-3d",
    "perspective": {
      "distance": 800,
      "origin": { "x": 400, "y": 300 }
    }
  }
}
```

`transformStyle` is the single flattening boundary: `flat` (the default when
the field is omitted) flattens descendants, while `preserve-3d` keeps them in
the group's 3D space. `perspective.distance` is positive and `origin` is the
compiler-resolved point in the group's local coordinate units; it may be
outside the group bounds. This is the resolved projection context, not a
second CSS property atom. `backfaceVisibility` is a layer-level render state
and may be `visible` or `hidden`.

### 4.2 Temporal tracks

Protocol V2 uses one temporal primitive for visual properties: an optional
`tracks[]` list on every layer. A track addresses one animatable leaf property
with a dot-separated `path` and contains strictly ordered keyframes in local
layer time in milliseconds. The static layer value remains the base value
outside the track's keyframe range; compiler/runtime behavior is a separate
lowering concern.

```json
{
  "tracks": [
    {
      "id": "title-x",
      "path": "transform.translate.x",
      "keyframes": [
        { "time": 0, "value": { "type": "number", "value": -120 } },
        {
          "time": 600,
          "value": { "type": "number", "value": 0 },
          "easing": { "type": "cubicBezier", "x1": 0.22, "y1": 1, "x2": 0.36, "y2": 1 }
        }
      ]
    }
  ]
}
```

All temporal numbers in Protocol V2 are milliseconds; fractional milliseconds
are allowed when a source timeline needs sub-millisecond precision.

`value` is explicitly typed as `number`, `vec2`, `vec3`, `vec4`, `color`,
`boolean`, `string`, or `enum`. Numeric/vector/color values are interpolable;
boolean/string/enum values are discrete. Supported easing descriptors are
`linear`, `step`, `cubicBezier`, and `spring`. Effect paths use the stable
effect ID as a path segment, for example `effects.main-blur.radius`; effect
IDs used by tracks must not contain a dot.

The protocol only describes temporal data. CSS `animation`, CSS `transition`,
Figma smart-animate, and AE-style editor actions are high-level inputs that
must be normalized into these tracks. No compiler or runtime behavior is
defined by this package yet.

### 5. Visual layer types

`layers[]` is a discriminated union by `type`.

| Type | Payload | Style or behavior |
| --- | --- | --- |
| `group` | Optional `render3d` context | Hierarchy container; children point to its `id` |
| `shape` | `shape`: `rectangle` or `ellipse`; optional `cornerRadius` | Fill, gradient, opacity, stroke, and stroke width |
| `path` | Contours with line/cubic segments; `fillRule`; optional morph | Fill, stroke, joins, caps, dash, and contour morph |
| `image` | `assetId`; optional `fit`, normalized `crop` | Image asset placement |
| `video` | `assetId`; optional `fit`, trim, audio, `framePolicy` | Video asset placement and source-time selection |
| `text` | Canonical `TextLayout`: visual lines, glyph runs, positioned glyphs | Runtime font/glyph rendering; CSS text semantics are resolved before Protocol V2 |

Image and video `fit` can be `contain`, `cover`, `fill`, or `none`.

### 5.1 Text layout and glyph runs

Text is render data, not a CSS text-layout command. A text layer contains one
required `payload.layout`, which is a visual sequence of lines and glyph runs.
Each run selects an exact font asset and optional resolved OpenType variation
coordinates; each glyph has its glyph ID, local origin, and advance vector.

```json
{
  "payload": {
    "source": { "text": "Hello مرحبا", "language": "en" },
    "layout": {
      "lines": [
        { "id": "line-1", "baselineY": 48, "runIds": ["latin", "arabic"] }
      ],
      "runs": [
        {
          "id": "latin",
          "font": { "assetId": "inter", "size": 40, "variations": { "wght": 650 } },
          "fill": "#ffffff",
          "glyphs": [
            { "glyphId": 43, "x": 0, "y": 48, "advance": { "x": 28, "y": 0 }, "cluster": 0 }
          ]
        },
        {
          "id": "arabic",
          "font": { "assetId": "noto-arabic", "size": 40 },
          "fill": "#00e5ff",
          "glyphs": [
            { "glyphId": 70, "x": 28, "y": 48, "advance": { "x": 24, "y": 0 }, "cluster": 6 }
          ]
        }
      ]
    }
  }
}
```

`lines[].runIds` defines visual paint order. Run IDs and line IDs are unique;
every run must be referenced by exactly one line. This permits bidirectional
text, font fallback, wrapping, and rich inline styles without adding CSS
`white-space`, `direction`, `word-break`, or `font-family` syntax to Atomic.
`payload.source` is optional editor metadata only: the runtime must render
`layout`, never reshape its source string. `cluster` is an optional UTF-16
offset into that metadata for editor selection/caret mapping.

The text compiler/shaper owns cascade, font fallback, OpenType features,
variation resolution, bidi, spacing, line breaking, wrapping, alignment, and
rich spans. Text decoration is lowered to ordinary shape/path layers. The
runtime owns glyph-outline lookup/caching, tessellation or atlas generation,
and GPU drawing from the selected font asset + variation coordinates + glyph
ID. Glyph outlines do not enter Protocol JSON.

Run-level tracks use the stable run ID, for example
`payload.layout.runs.latin.fill` (color) or
`payload.layout.runs.latin.font.size` (number). Whole-text motion normally
uses the shared layer transform and opacity tracks.

### 5.2 Paint and gradients

Paint is represented by the final source primitive, not by CSS `background`
shorthand. A compiler may lower multiple background layers into an ordered
group of shape and image layers. Shape fills support solid colors and
gradients:

```json
{
  "type": "conic-gradient",
  "from": 45,
  "cx": 0.5,
  "cy": 0.5,
  "stops": [
    { "offset": 0, "color": "#ff0000" },
    { "offset": 0.35, "color": "#ffff00" },
    { "offset": 1, "color": "#0000ff" }
  ]
}
```

Supported gradient types are `linear-gradient`, `radial-gradient`, and
`conic-gradient`. Every gradient has at least two color stops; stop offsets
are normalized to `0..1` and must be non-decreasing. Linear and radial
gradients keep their existing geometric fields (`angle`, `cx`, `cy`, and
`radius` where applicable). A conic gradient uses `from` in degrees and an
optional normalized center (`cx`, `cy`). Background shorthand, repetition,
layer order, and implicit CSS stop resolution remain compiler concerns.

### 6. Compositing and effects

Optional compositing:

```json
{
  "composite": {
    "blendMode": "normal",
    "isolation": "auto"
  }
}
```

Blend modes map 1:1 to the CSS Compositing and Blending Level 1 names:
`normal`, `darken`, `multiply`, `color-burn`, `lighten`, `screen`,
`color-dodge`, `overlay`, `soft-light`, `hard-light`, `difference`,
`exclusion`, `hue`, `saturation`, `color`, and `luminosity`. The non-CSS
`add` value is not part of Protocol V2. `isolation` maps to CSS `isolation`
and is `auto` or `isolate`. SVG masking is referenced by layer-level
`clipPath` and `mask` IDs. `clipPath` uses geometric coverage; `mask` uses
`alpha` or `luminance` coverage.

When both references are present, the compiler emits separate coverage
surfaces and the runtime applies the clip path before the alpha/luminance mask.
Mask position, size, repeat, origin, clip, and source-image resolution remain
compiler responsibilities.

`blendMode` is a runtime compositing primitive, not a compiler-only semantic:
the runtime must evaluate the selected formula against the source and
backdrop pixels. Protocol stores the CSS name; formula implementation,
premultiplied-alpha handling, and color-space details belong to runtime.

Effects are ordered and have unique IDs. The current effect types are:

| Type | Fields |
| --- | --- |
| `color-adjust` | `brightness`, `contrast`, `saturation`, `hueRotate` |
| `grayscale` | `amount` (`0..1`) |
| `sepia` | `amount` (`0..1`) |
| `invert` | `amount` (`0..1`) |
| `filter-opacity` | `amount` (`0..1`); distinct from layer `opacity` |
| `blur` | `radius` |
| `shadow` | `source` (`box` or `alpha`), `offset`, `blur`, signed `spread`, `color`, `inset` |
| `outer-glow` | `radius`, `color`, `opacity` |
| `inner-glow` | `radius`, `color`, `opacity` |
| `noise` | `scale`, `amount`, `opacity`, `seed` |

At most eight effects can be attached to one drawable layer.

`shadow` is the canonical shadow atom. `source: "box"` represents CSS
`box-shadow`: `spread` is signed and `inset` may be true or false. `source:
"alpha"` represents CSS `filter: drop-shadow()`, so it requires
`spread: 0` and `inset: false`. Shadow transparency is carried by the alpha
component of `color`; there is no second shadow-opacity field. Multiple
shadows are repeated in `effects[]` and retain list order. Runtime must derive
each shadow from the original layer source surface, so one shadow does not
become the input silhouette of the next shadow.

The semantic filter effects map directly to CSS `grayscale()`, `sepia()`,
`invert()`, and `opacity()`. `filter-opacity` is intentionally separate from
the layer-level `opacity` because it participates in the ordered filter chain.
Protocol V2 keeps these names and normalized values readable for users and AI;
compiler/runtime lowering to a color matrix is a later implementation step and
is not part of this package. Effect order must be preserved, so color effects
may only be fused when that does not move them across a spatial effect such as
`blur` or `shadow`.

### 7. Audio

Audio is a required root domain and is parallel to visual layers.
All audio timing, trim, fade, and media-duration values in Protocol V2 are
milliseconds. `sampleRate` and `fps` remain rates measured per second.

```json
{
  "audio": {
    "sampleRate": 48000,
    "tracks": [
      {
        "id": "track-001",
        "gainDb": 0,
        "pan": 0,
        "muted": false,
        "clips": [
          {
            "id": "clip-001",
            "assetId": "audio-001",
            "timing": { "start": 0, "duration": 30000 },
            "trim": { "start": 0, "end": 30000 },
            "playbackRate": 1,
            "enabled": true,
            "gainDb": 0,
            "pan": 0
          }
        ]
      }
    ]
  }
}
```

Each audio clip may also contain `fadeIn` and `fadeOut`, each with a
`duration` and curve of `linear` or `equal-power`.

Audio clip timing is composition time in milliseconds. `trim` is source time in
milliseconds. Audio clips may
reference only `audio` assets or the audio derivative of a `video` asset.
`enabled: false` silences the mix input without removing it from the timeline.

#### Embedded audio on a video layer

`video.payload.audio` is an authoring control surface for the audio stream
belonging to that video layer. It has the same audio characteristics as a
standalone input:

| Field | Meaning |
| --- | --- |
| `enabled` | Whether the embedded audio contributes to the mix |
| `gainDb` | Input gain in decibels |
| `pan` | Normalized stereo pan from `-1` to `1` |
| `fadeIn` | Optional fade-in duration and curve |
| `fadeOut` | Optional fade-out duration and curve |
| video `timing` | Default composition range for the linked audio |
| video `trimStart` / `trimEnd` | Default source range for the linked audio |

The current Protocol keeps timing and trim on the video layer so one edit can
move, trim, or retime the visual and its original audio together. The
authoring command changes these values; the Compiler resolves them into an
independent audio clip. This avoids putting decoder state, PCM, or FFmpeg
commands inside Protocol JSON.

Example:

```json
{
  "type": "video",
  "timing": { "start": 2000, "duration": 4000 },
  "payload": {
    "assetId": "video-01",
    "trimStart": 1000,
    "trimEnd": 5000,
    "audio": {
      "enabled": true,
      "gainDb": -3,
      "pan": 0,
      "fadeIn": { "duration": 250, "curve": "linear" },
      "fadeOut": { "duration": 500, "curve": "equal-power" }
    }
  }
}
```

The semantic lowering is:

```text
video layer
  ├── visual source: original video stream
  └── audio source: video asset audio derivative
        └── timing/trim inherited from the video layer
            + gain/pan/fades from payload.audio
```

If an editor needs audio independent from the video, it should create or
promote a standalone audio clip in `audio.tracks[]` instead of silently
changing the meaning of the linked video layer.

### 8. Validation rules

The Protocol schema validates both field types and project relationships:

- root format is `motion-protocol`, version is `2`;
- unknown fields are rejected;
- asset, layer, track, and clip IDs are unique where required;
- parent layers exist, are groups, and cannot form cycles;
- sibling `order` values are unique;
- asset references match the required asset kind;
- video trims and audio fades stay within their timing/source ranges;
- mask sources satisfy the group and drawable-layer rules.

Capability support is decided by the Compiler after Protocol validation. A
valid JSON field is therefore a valid authoring value, but not automatically a
promise that every renderer already supports it.

## Pipeline ownership

```text
Atomic Protocol V2 JSON
        |
        v
@motionvideo/motion-compiler
        |
        v
RuntimeProjectV3
        |
        v
@motionvideo/motion-runtime
```

Preview and export consume Runtime IR through their own renderers.

## Commands

```bash
pnpm --filter @motionvideo/motion-protocol typecheck
pnpm --filter @motionvideo/motion-protocol test
pnpm --filter @motionvideo/motion-protocol check:schema
```
