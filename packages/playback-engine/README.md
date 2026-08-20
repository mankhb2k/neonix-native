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
```

The engine does not parse authoring JSON, compile projects, calculate GPU
commands, or encode video. WebGPU/WebGL2 and export adapters consume the same
V2 frame semantics after playback evaluates the runtime project.

Clock, quality, metrics, frame buffering, media texture transport, and worker
ports remain backend-neutral utilities. Audio scheduling is intentionally not
part of this package until its V2 protocol contract is certified.

## Scripts

```bash
pnpm --filter @motionvideo/playback-engine typecheck
pnpm --filter @motionvideo/playback-engine test
```
