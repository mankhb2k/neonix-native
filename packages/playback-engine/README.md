# `@motionvideo/playback-engine`

Controller **transport + frame scheduler** dùng chung cho preview realtime. Nhận Runtime IR đã compile, đánh giá frame theo clock, rồi đẩy kết quả sang painter (native preview, Remotion, mock test). Package thuần TypeScript — không React, không renderer, không encode.

Web, desktop, và test harness dùng cùng một engine.

## Vai trò

```text
MotionRuntimeProject (Runtime IR)
        ↓
  PlaybackEngine  (clock · RAF · quality · metrics)
        ↓
  evaluateRuntimeProjectV2  (@motionvideo/motion-runtime)
        ↓
  FrameConsumer.paintCompositionFrame  →  native preview / Remotion / mock
```

- Clock thống nhất: ưu tiên `AudioContext.currentTime`, fallback `performance.now()`.
- Scheduler RAF: quantize theo FPS project, bỏ frame stale sau seek/patch.
- Quality modes: `interactive` (scrub), `playback` (preview), `final` (refine sau pause).
- Audio look-ahead scheduler (Web Audio, injectable cho test).
- Media texture provider + fallback bơm frame từ main thread sang worker.
- Frame buffer + buffer policy cho look-ahead (playing / scrub / paused).

## API chính

```ts
import {
  createPlaybackEngine,
  createPlaybackClock,
  createAudioScheduler,
  createMediaFrameProvider,
  createFrameBuffer,
  type FrameConsumer,
} from "@motionvideo/playback-engine";

const engine = createPlaybackEngine({
  fps: 30,
  consumer: {
    paintCompositionFrame(frame) {
      painter.paint(frame);
    },
  },
});

engine.load(runtime);
engine.play();
engine.seek(1.5);
engine.pause();
engine.dispose();
```

| Nhóm | Chức năng |
|---|---|
| `createPlaybackEngine` | Transport: `load` / `play` / `pause` / `seek` / `setRate` / `setLoop` / `setQuality` / `renderFrameAt` / `getMetrics` / `dispose` |
| `createPlaybackClock` | Clock AudioContext hoặc monotonic; re-anchor khi play / seek / rate / visibility |
| `createQualityController` | Mode `interactive` \| `playback` \| `final`; scale resolution, skip effect, refine sau pause |
| `createPlaybackMetrics` | Starvation, dropped, evaluate/paint time, buffer size |
| `createAudioScheduler` | Decode/cache buffer, look-ahead schedule, mute/solo/volume, channel routing |
| `createMediaFrameProvider` | Acquire/release video texture; `requestVideoFrameCallback`; audio video tách sang scheduler |
| `createFrameBuffer` | Buffer frame look-ahead, drop sequence stale, prune theo playhead |
| `createBufferPolicy` | Policy playing / interactive / paused (target ahead, inflight, starvation fallback) |
| `createMediaFallbackBridge` | Main thread bơm `VideoFrame` / `ImageBitmap` cho worker không gọi được media API |

Nền tảng (RAF, `cancelAnimationFrame`, `AudioContext`) inject qua options — test chạy được trên Node/Vitest không cần DOM.

## Không làm

- **Không compile MotionProject** — gọi `@motionvideo/motion-compiler` trước khi `load`.
- `PlaybackEngineV2` evaluates `RuntimeProjectV2` through
  `evaluateRuntimeProjectV2` and sends `RuntimeFrameV2` to the preview consumer.
- **Không paint GPU / encode MP4** — painter thuộc `@motionvideo/preview-renderer` hoặc `@motionvideo/remotion-renderer`.
- **Không editor UI / Zustand / React** — không playhead, timeline chrome, store; app mount engine và overlay.
- **Không orchestration render job** — thuộc apps + `@motionvideo/render-contracts`.

## Phụ thuộc

- `@motionvideo/motion-protocol`
- `@motionvideo/motion-runtime`
- `@motionvideo/render-contracts`

## Scripts

```bash
pnpm --filter @motionvideo/playback-engine typecheck
pnpm --filter @motionvideo/playback-engine test
```
