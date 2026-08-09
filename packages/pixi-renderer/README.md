# `@motionvideo/pixi-renderer`

Cầu **RenderSnapshot / paint buffer → PixiJS** cho preview stage trên browser (desktop + web). Sync deterministic vào display cache; selection/hit-test overlay vẫn thuộc editor app / `editor-interactions`.

## Vai trò

```text
RenderSnapshot (motion-runtime)
        ↓
  PixiSnapshotAdapter / display-cache
        ↓
  PixiStageRenderer · PixiFramePainter · PixiAssetStore
```

- Adapter sync snapshot → object cache (test được không cần WebGL thật).
- Stage renderer + frame painter gắn Pixi.
- Asset store (texture) cho media trên stage.
- `assertSnapshotContract` — kiểm tra snapshot orthographic / depth.

## API chính

```ts
import {
  PixiSnapshotAdapter,
  createPixiStageRenderer,
  createPixiFramePainter,
  createPixiAssetStore,
  assertSnapshotContract,
} from "@motionvideo/pixi-renderer";
```

| Nhóm | Chức năng |
|---|---|
| `PixiSnapshotAdapter` | Sync snapshot → display-object cache |
| `PixiStageRenderer` | Host stage Pixi |
| `PixiFramePainter` | Paint frame buffer |
| `PixiAssetStore` | Load/cache texture |
| `display-cache` | Sync paint buffer helpers |

## Không làm

- **Không editor UI / timeline / Zustand** — không clip strip, inspector, store; app mount canvas và overlay.
- **Không hit-test / transform session** — thuộc `@motionvideo/editor-interactions` (+ hooks `editor-react`); Pixi chỉ paint.
- **Không encode MP4 / Remotion** — export thuộc `remotion-renderer` + worker.
- **Không compile project** — nhận snapshot đã evaluate từ runtime/compiler qua host app.
- **Không contract render job** — thuộc `render-contracts`.

## Phụ thuộc

- `pixi.js`
- `@motionvideo/motion-runtime` · `@motionvideo/motion-schema`
