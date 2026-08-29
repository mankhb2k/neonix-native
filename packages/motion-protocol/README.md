# `@motionvideo/motion-protocol`

Atomic Protocol V2 schema and capability contract for NeonVideo.

This package owns authoring JSON only. It does not own Runtime IR, Matrix4
buffers, GPU resources, preview rendering, or Remotion rendering.

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
    └── certified atomic layer
        ├── frame
        ├── transform (3D translate / scale / rotate / skew / anchor)
        ├── timing
        ├── opacity / order (unique among siblings; higher paints later)
        └── shape payload + paint style
```

The root also contains required `assets[]` and `audio` domains. Silent
projects use `audio: { sampleRate: 48000, tracks: [] }`. Audio is parallel to
`layers[]`, not part of the Matrix4 scene graph; its clips reference `audio`
or `video` assets and lower to `RuntimeAudioMixPlanV3`. A video with embedded
sound stores only `payload.audio.enabled`, `gainDb`, and optional fades; its
timing, trim, loop, and visual order remain owned by the video layer.

Every schema is strict. Unknown fields are rejected. A Protocol V1 envelope,
legacy origin/depth fields, bones, high-level patterns, and runtime-only fields
are not accepted by this package.

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
