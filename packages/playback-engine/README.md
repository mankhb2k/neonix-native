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
  onSnapshot(snapshot) {
    // The editor subscribes to this one clock for time and playing state.
    ui.updateTransport(snapshot.time, snapshot.playing);
  },
});

engine.load(runtime satisfies RuntimeProjectV2);
engine.play();
engine.seek(1.5);
engine.pause();
engine.dispose();
```

`PlaybackV2Snapshot` is the canonical transport publication. It contains the
evaluated frame, the audio mix window, and active `drawVideo` commands so a
host does not need a second RAF loop or a second media clock.

Browser hosts may provide `createDOMMediaControllerV2()` through the engine's
`media` option. It keeps video elements muted, seeks only active commands, and
pauses inactive sources; audio remains owned by the Web Audio adapter.

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
ports remain backend-neutral utilities. The optional browser-only WebAudio
adapter is separate from the pure runtime and can consume the same engine
output without entering `preview-renderer`:

```ts
import {
  createPlaybackEngineV2,
  createWebAudioAdapterV2,
} from "@motionvideo/playback-engine";

const audio = createWebAudioAdapterV2();
const engine = createPlaybackEngineV2({
  paintCompositionFrame(frame) {
    painter.paint(frame);
  },
  consumeAudioMixPlan(plan, context) {
    audio.consumeAudioMixPlan(plan, context);
  },
});

engine.load(runtime);
await audio.resume(); // call from a user gesture in the browser
engine.play();
// On host pause/seek: engine.pause(); audio.pause(); / engine.seek(t)
```

The adapter resolves immutable V2 asset sources, caches decoded buffers,
resamples them to 48 kHz, and schedules source -> gain -> stereo-pan graphs
from `RuntimeAudioMixPlanV2`. It reports autoplay, source, decode, resampling,
and context failures through diagnostics. It does not parse protocol JSON,
evaluate timing, or create GPU resources.

## Scripts

```bash
pnpm --filter @motionvideo/playback-engine typecheck
pnpm --filter @motionvideo/playback-engine test
```
