# `@motionvideo/remotion-renderer`

Remotion export surface for Runtime V2. The package receives an already
evaluated `RuntimeFrameV2` and renders the same `PaintCommandBuffer` meaning as
the native preview. It does not parse authoring JSON or compile a project.

## Pipeline

```text
Atomic Protocol V2
        |
  motion-compiler
        |
  motion-runtime
        |
  RuntimeFrameV2 / PaintCommandBuffer       RuntimeAudioMixPlanV2
        |                                          |
  RemotionPreviewCanvas                     RemotionAudioTrack
        \                                          /
                 Remotion encode
```

## Public API

```ts
import {
  MotionComposition,
  MotiClipVideo,
  RemotionFramePainter,
  RemotionPreviewCanvas,
} from "@motionvideo/remotion-renderer";
```

`RemotionFramePainter` and `RemotionPreviewCanvas` consume required Matrix4
transforms from Runtime V2. They do not create semantic transforms, convert to
CSS `matrix(...)`, or maintain a separate export transform model. The native
preview package owns WebGPU/WebGL2 backend selection; Remotion schedules the
same runtime frame for encoding. `RemotionAudioTrack` consumes the separate
`RuntimeAudioMixPlanV2` output, renders its deterministic stereo mix in an
offline audio context, and passes the result to Remotion without re-parsing
Protocol JSON.

## Boundaries

- No editor chrome, timeline UX, or authoring state.
- No Protocol or Compiler imports in production renderer code.
- No `render-contracts` dependency; job orchestration belongs to the app or
  worker layer.
- No V1 project input or compatibility branch.

`RemotionPaintRenderer` remains a source-compatible alias for the Matrix4-only
`RemotionFramePainter` while existing callers migrate to the clearer name.
