# Editor-core isolation plan

## Boundary contract

`@motionvideo/editor-core` is the pure authoring domain. It owns Protocol V2
document mutations, schema validation, inverse commands, selection, timeline
projection/geometry, edit intents, and framework-independent pointer/stage
interaction math.

It does not compile or evaluate runtime projects, calculate playback duration,
own a clock/playhead, touch media or canvas APIs, render pixels, persist data,
or decide whether a compiler/backend supports a feature.

| Owner | Responsibility | Forbidden overlap |
| --- | --- | --- |
| `editor-core` | Authoring document and pure interaction semantics | Runtime compilation, transport, DOM/React, persistence |
| `motion-compiler` | Protocol V2 → `RuntimeProjectV3` lowering | Editor state and playback |
| `motion-runtime` | Runtime duration, timing, evaluation, paint/audio/video plans | Authoring commands and UI gestures |
| `playback-engine` | Clock, transport, seek/play/pause, readiness, scheduling, backend delivery | Timeline projection and document mutation |
| `apps/web` | UI, DOM/canvas adapters, stores, persistence, and orchestration | Duplicating package-owned semantics |

## Migration phases

- [x] Remove compiler/runtime compilation from `editor-core` command application.
- [x] Keep compiler failures as web-host diagnostics rather than core diagnostics.
- [x] Add architecture tests forbidding compiler/runtime/playback imports from `editor-core`.
- [ ] Move any remaining authoring-time runtime sampling behind an explicit web adapter.
- [ ] Replace web duration/extent mixing with separate authoring projection extent and runtime playback duration.
- [ ] Add boundary tests for web → editor-core commands and web → compiler/runtime/playback orchestration.
