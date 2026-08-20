# `@motionvideo/motion-runtime`

Runtime IR V2 evaluator. Runtime does not parse authoring JSON; it receives
`RuntimeProjectV2`, resolves timing and stable order, and returns
`RuntimeFrameV2` with a backend-neutral `PaintCommandBuffer`.

```text
Atomic Protocol V2
        |
  compileProtocolV2
        |
  RuntimeProjectV2
        |
  evaluateRuntimeProjectV2
        |
  RuntimeFrameV2 / PaintCommandBuffer
```

## Ownership

| Module | Responsibility |
| --- | --- |
| `v2` | RuntimeProjectV2 validation and frame evaluation |
| `matrix4` | Backend-neutral 3D transforms and projection |
| `paint` | PaintCommandBuffer contract |
| `clock` | Frame/time quantization |

```ts
import {
  evaluateRuntimeProjectV2,
  type RuntimeProjectV2,
  type RuntimeFrameV2,
} from "@motionvideo/motion-runtime";
```

See [`docs/ai-first-editor-architecture.md`](../../docs/ai-first-editor-architecture.md)
and [`docs/v2-runtime-compiler-hard-cut-plan.md`](../../docs/v2-runtime-compiler-hard-cut-plan.md).
