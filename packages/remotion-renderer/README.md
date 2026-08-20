# `@motionvideo/remotion-renderer`

Cầu **Runtime IR / paint tree → Remotion React** để encode/export (và snapshot parity với preview). Nhận dữ liệu đã compile/evaluate; không phải editor UI.

## Vai trò

```text
Compiled / evaluated frame (motion-runtime + compiler)
        ↓
  buildRemotionPaintTree / RemotionFramePainter
        ↓
  MotionComposition · MotiClipVideo  →  Remotion encode
```

- Composition Remotion cho timeline video.
- Paint tree / frame painter từ drawables runtime.
- Snapshot renderer phục vụ parity test với native/DOM preview.
- Re-export một số helper timeline duration từ `motion-runtime` cho composition.

## API chính

```ts
import {
  MotionComposition,
  MotiClipVideo,
  RemotionFramePainter,
  buildRemotionPaintTree,
} from "@motionvideo/remotion-renderer";
```

| Nhóm                                  | Chức năng                         |
| ------------------------------------- | --------------------------------- |
| `MotionComposition` / `MotiClipVideo` | Entry composition Remotion        |
| `RemotionFramePainter*`               | Vẽ frame từ tree / snapshot       |
| `build-remotion-paint-tree`           | Flatten drawables → tree Remotion |

## Không làm

- **Không editor chrome / timeline UX** — không playhead, marquee, Zustand.
- **Không orchestration job** — tạo/hủy job, webhook, storage thuộc apps + `render-contracts`.
- **Không compile MotionProject** — gọi `@motionvideo/motion-compiler` trước khi đưa vào composition.
- **Không preview GPU browser** — preview stage dùng `@motionvideo/preview-renderer` (hoặc DOM host trong app).
- **Không tự pin/version Lambda** — pin nằm ở `render-contracts` (`REMOTION_PIN`); worker/app cấu hình deployment.

## Peer dependencies

- `react` / `react-dom` ^19

## Phụ thuộc

- `remotion`
- `@motionvideo/motion-compiler` · `motion-runtime` · `motion-protocol`
- `@motionvideo/render-contracts`
