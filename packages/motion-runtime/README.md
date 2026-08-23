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
| `audio-mix` | Sample-accurate RuntimeAudioMixPlanV2 evaluation |

## Matrix4 hard-lock

Runtime V2 uses one backend-neutral `Matrix4` representation for both 2D and
3D. A 2D layer is simply an XY-plane transform with `z = 0` and an orthographic
projection. The runtime public API does not export the old affine/Canvas2D
adapters, and `PaintCommand.setTransform.matrix4` is required rather than an
optional fallback.

Those adapters may exist temporarily for the deferred editor migration, but
they are editor-local implementation details and never Runtime IR. Preview and
Remotion consume only `RuntimeFrameV2` / `PaintCommandBuffer` for visual
output.

Audio is a parallel runtime output. `evaluateRuntimeAudioMixV2()` returns a
`RuntimeAudioMixPlanV2` from a sample range; it never decodes media or creates
WebAudio nodes. The playback WebAudio adapter and Remotion export adapter are
the only owners of browser/media scheduling.

```ts
import {
  evaluateRuntimeProjectV2,
  type RuntimeProjectV2,
  type RuntimeFrameV2,
} from "@motionvideo/motion-runtime";
```

See [`docs/ai-first-editor-architecture.md`](../../docs/ai-first-editor-architecture.md)
and [`docs/v2-runtime-compiler-hard-cut-plan.md`](../../docs/v2-runtime-compiler-hard-cut-plan.md).
