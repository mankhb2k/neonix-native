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
│   └── optional view + projection
└── layers[]
    └── certified atomic layer
        ├── frame
        ├── transform (3D translate / scale / rotate / skew / anchor)
        ├── timing
        ├── opacity / zIndex
        └── shape payload + paint style
```

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
RuntimeProjectV2
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
