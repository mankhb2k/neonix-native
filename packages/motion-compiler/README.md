# `@motionvideo/motion-compiler`

Compiler B lowers Atomic Protocol V2 JSON into backend-neutral Runtime IR V2.
It does not render pixels, own GPU resources, or evaluate a frame by itself.

```text
Atomic Protocol V2 JSON
        |
  compileProtocolV2
        |
RuntimeProjectV2
        |
evaluateRuntimeProjectV2
        |
PaintCommandBuffer
```

## Public V2 API

```ts
import {
  compileProtocolV2,
  compileProtocolV2ToPaintCommands,
} from "@motionvideo/motion-compiler";

const runtime = compileProtocolV2(protocol);
const frame = compileProtocolV2ToPaintCommands(protocol, { frame: 0 });
```

`compileProtocolV2()` validates the V2 schema, certified capabilities, timing,
references, and view state before emitting `RuntimeProjectV2`. Matrix4 values
are runtime IR values; they are not stored in Atomic Protocol JSON.

`compileProtocolV2ToPaintCommands()` is only a convenience composition of the
V2 compiler and `evaluateRuntimeProjectV2()`. Preview and export should use the
same Runtime IR and paint semantics.

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
