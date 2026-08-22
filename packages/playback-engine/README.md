# `@motionvideo/playback-engine`

V2-only transport for realtime preview. The package accepts an already
compiled `RuntimeProjectV2`, advances the playhead, and sends evaluated
`RuntimeFrameV2` values to a renderer-owned consumer.

```text
Protocol V2 JSON
  -> compileProtocolV2
  -> RuntimeProjectV2
  -> PlaybackEngineV2
  -> RuntimeFrameV2
  -> preview-renderer / Remotion
```

## API

```ts
import {
  createPlaybackEngineV2,
  type RuntimeProjectV2,
} from "@motionvideo/playback-engine";

const engine = createPlaybackEngineV2({
  paintCompositionFrame(frame) {
    painter.paint(frame);
  },
});

engine.load(runtime satisfies RuntimeProjectV2);
engine.play();
engine.seek(1.5);
engine.pause();
engine.dispose();
```

`play()` schedules Runtime V2 frames from a monotonic clock. A browser host can
use the emitted frames to repaint a native media source without seeking the
video on every tick. `seek()` remains the deterministic path for scrubbing and
frame-accurate tests.

The engine does not parse authoring JSON, compile projects, calculate GPU
commands, or encode video. WebGPU/WebGL2 and export adapters consume the same
V2 frame semantics after playback evaluates the runtime project.

### Browser preview example

```ts
const runtime = compileProtocolV2(projectWithVideoV2);
let latestFrame = null;
const engine = createPlaybackEngineV2({
  paintCompositionFrame(frame) {
    latestFrame = frame;
    // React host passes latestFrame to <PreviewStage frame={latestFrame}
    // isPlaying={engine.playing} />.
  },
});

engine.load(runtime);
engine.renderFrameAt(0); // deterministic first frame
engine.play();           // realtime clock; video element is already playing
```

Clock, quality, metrics, frame buffering, media texture transport, and worker
ports remain backend-neutral utilities. Audio scheduling is intentionally not
part of this package until its V2 protocol contract is certified.

## Scripts

```bash
pnpm --filter @motionvideo/playback-engine typecheck
pnpm --filter @motionvideo/playback-engine test
```
