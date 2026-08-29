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
        └── shape payload + paint style
```

The root also contains required `assets[]` and `audio` domains. Silent
projects use `audio: { sampleRate: 48000, tracks: [] }`. Audio is parallel to
`layers[]`, not part of the visual scene graph; its clips reference `audio` or
`video` assets. A video with embedded sound stores only `payload.audio.enabled`,
`gainDb`, `pan`, and optional fades; its timing, trim, and visual order remain
owned by the video layer.

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
  "timing": { "start": 0, "duration": 5 }
}
```

| Field | Meaning |
| --- | --- |
| `id` | Unique layer identifier |
| `parentLayerId` | Parent group identifier or `null` |
| `order` | Paint order within the sibling scope; higher paints later |
| `frame` | Local width and height |
| `transform` | Translate, scale, rotate, skew, and anchor |
| `opacity` | Source opacity from `0` to `1`; default `1` |
| `timing` | Composition-time start and duration in seconds |
| `composite` | Optional blend mode and mask |
| `effects` | Optional ordered effect list |

### 5. Visual layer types

`layers[]` is a discriminated union by `type`.

| Type | Payload | Style or behavior |
| --- | --- | --- |
| `group` | None | Hierarchy container; children point to its `id` |
| `shape` | `shape`: `rectangle` or `ellipse`; optional `cornerRadius` | Fill, gradient, opacity, stroke, and stroke width |
| `path` | Contours with line/cubic segments; `fillRule`; optional morph | Fill, stroke, joins, caps, dash, and contour morph |
| `image` | `assetId`; optional `fit`, normalized `crop` | Image asset placement |
| `video` | `assetId`; optional `fit`, trim, audio, `framePolicy` | Video asset placement and source-time selection |
| `text` | Text, font, size, line layout, alignment, language | Single-style LTR text with no wrapping |

Image and video `fit` can be `contain`, `cover`, `fill`, or `none`.

### 6. Compositing and effects

Optional compositing:

```json
{
  "composite": {
    "blendMode": "normal",
    "mask": {
      "mode": "clip",
      "sourceLayerId": "mask-layer",
      "sourceVisibility": "mask-only"
    }
  }
}
```

Blend modes are `normal`, `multiply`, `screen`, and `add`. Mask modes are
`clip`, `alpha`, `inverse-alpha`, and `luma`.

Effects are ordered and have unique IDs. The current effect types are:

| Type | Fields |
| --- | --- |
| `color-adjust` | `brightness`, `contrast`, `saturation`, `hueRotate` |
| `blur` | `radius` |
| `drop-shadow` | `x`, `y`, `blur`, `color`, `opacity` |
| `outer-glow` | `radius`, `color`, `opacity` |
| `inner-glow` | `radius`, `color`, `opacity` |
| `noise` | `scale`, `amount`, `opacity`, `seed` |

At most eight effects can be attached to one drawable layer.

### 7. Audio

Audio is a required root domain and is parallel to visual layers.

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
            "timing": { "start": 0, "duration": 30 },
            "trim": { "start": 0, "end": 30 },
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

Audio clip timing is composition time. `trim` is source time. Audio clips may
reference only `audio` assets or the audio derivative of a `video` asset.
`enabled: false` silences the mix input without removing it from the timeline.

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
