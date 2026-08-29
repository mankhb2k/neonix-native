# `@motionvideo/motion-runtime`

Backend-neutral Runtime V3 semantics. Runtime does not parse authoring JSON; it
receives the compiler's `RuntimeProjectV3`, resolves static video/audio
timelines, and returns backend-neutral render plans and paint commands.

```text
MotionProtocolV2
        |
  compileProtocol
        |
  RuntimeProjectV3
      |                 |
resolveVideoAt   resolveAudioWindow
      |                 |
VideoRenderPlanV3  AudioMixPlanV3
      |
PlaybackEngine / offline export
```

## Ownership

| Module | Responsibility |
| --- | --- |
| `v3` | RuntimeProjectV3 types, validation, timeline resolvers, visual boundary, offline audio, and semantic identity |
| `matrix4` | Backend-neutral 3D transforms and projection |
| `paint` | PaintCommandBuffer contract |
| `clock` | Frame/time quantization |
| `visual-internals` | Certified visual lowering reused behind the V3 visual boundary; not a public project/audio contract |

## Matrix4 hard-lock

Runtime V3 uses one backend-neutral `Matrix4` representation for both 2D and
3D. A 2D layer is simply an XY-plane transform with `z = 0` and an orthographic
projection. The runtime public API does not export the old affine/Canvas2D
adapters, and `PaintCommand.setTransform.matrix4` is required rather than an
optional fallback.

Those adapters are editor-local implementation details and never Runtime IR.
Preview and the native export worker consume the same V3 visual semantics. Runtime V2 project
and audio contracts are not exported from the package root.

Audio is a parallel runtime output. `resolveAudioWindow()` returns an
`AudioMixPlanV3` from a sample range; it never decodes media or creates WebAudio
nodes. Playback backends and the offline export adapter are the only owners of
browser/media scheduling.

```ts
import {
  evaluateRuntimeProjectV3,
  resolveAudioWindow,
  resolveVideoAt,
  type RuntimeProjectV3,
} from "@motionvideo/motion-runtime";
```

See [`docs/ai-first-editor-architecture.md`](../../docs/ai-first-editor-architecture.md)
and [`docs/v2-runtime-compiler-hard-cut-plan.md`](../../docs/v2-runtime-compiler-hard-cut-plan.md).
