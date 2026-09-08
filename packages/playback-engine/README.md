# `@motionvideo/playback-engine`

The framework-independent runtime transport for MotionVideo.

## Owns

- the canonical transport clock and current time;
- the runtime-provided canonical `durationUs` and end transition;
- play, pause, seek, rate, tick, and end-of-composition transitions;
- runtime readiness, buffering, operation generations, and diagnostics;
- scheduling runtime video and audio plans through backend sinks;
- media resource lifecycle and backend coordination.

## Does not own

- Protocol V2 authoring documents or editor commands;
- timeline lanes, clips, selection, history, or undo/redo;
- React, Zustand, Next.js, DOM pointer handling, or Skia painting;
- an editor-specific controller or transport store.

The editor integration lives in `apps/web/lib/editor/playback`. It compiles
the authoring document to `RuntimeProjectV3`, sends transport commands to this
package, and forwards runtime frames to Stage/Skia. The package does not know
which renderer consumes those frames.

`docs/skia` intentionally keeps its direct debug path:

```text
Protocol V2 → Compiler → Runtime → Skia
```

It is not an editor playback dependency.
