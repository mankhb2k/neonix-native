# `@motionvideo/motion-compiler`

The compiler lowers Atomic Protocol V2 JSON into the canonical backend-neutral
runtime representation used during the migration to Runtime V3.
It does not render pixels, own GPU resources, or evaluate a frame by itself.

```text
Atomic Protocol V2 JSON
        |
  compileProtocol
        |
RuntimeProjectV2
        |
evaluateRuntimeProjectV2
        |
PaintCommandBuffer
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

`compileProtocol()` validates the V2 schema, certified capabilities, timing,
references, and view state before emitting `RuntimeProjectV2`. Matrix4 values
are runtime IR values; they are not stored in Atomic Protocol JSON.

`compileProtocolToRuntimeV3()` projects the same normalized compiler result into
the media-catalog/video-timeline/audio-timeline IR consumed by
`playback-engine-next`. It does not re-parse or re-lower visual semantics.

`compileProtocolToPaintCommands()` is only a convenience composition of the
canonical compiler and `evaluateRuntimeProjectV2()`. Preview and export should
use the same Runtime IR and paint semantics.

The old `compileProtocolV2*` names remain deprecated source-compatible aliases
for callers that have not completed migration; they are not separate compiler
implementations.

## Ownership

- `@motionvideo/motion-protocol`: Atomic Protocol V2 schema and certification.
- `@motionvideo/motion-runtime`: timing evaluation, matrix validation, and
  backend-neutral paint commands.
- `@motionvideo/preview-renderer`: WebGPU default with WebGL2 fallback.
- `apps/render-worker`: export and encoding.

## Out Of Scope

- Pixel rasterization and GPU resource ownership.
- Frame evaluation and timeline playback.
- High-level authoring patterns, presets, templates, and components.
