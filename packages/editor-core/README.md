# `@motionvideo/editor-core`

Domain logic thuần túy cho Timeline và Document của hệ thống (không phụ thuộc vào React, DOM, hay Zustand). Đóng vai trò là "bộ não" xử lý mọi thao tác của người dùng trên giao diện chỉnh sửa video.

## Vai trò

- Quản lý **Timeline & Document**: Cấu trúc track, clip, lane, overlay scenes.
- Xử lý **Operations & Commands**: Các thao tác tương tác như kéo thả (clip-move), di chuyển theo nhóm (clip-move-group), thay đổi thuộc tính (properties), bật/tắt hiển thị (mute, hide lane).
- Xử lý **Geometry & Policies**: Tính toán không gian timeline, va chạm khi thay đổi kích thước (resize-collision), quy tắc bắt dính (snapping), quy tắc thả clip (drop-target).
- Quản lý **Lịch sử (History)**: Undo/Redo an toàn, gom nhóm các lịch sử liên tiếp (coalesce).
- Quản lý **Selection & Clipboard**: Xử lý trạng thái đang chọn clip nào, sao chép/dán clip.

## API chính

```ts
import {
  executeTimelineCommand,
  moveClipGroup,
  applyLaneFlagPatch,
  resolveCollisionsAfterResize,
} from "@motionvideo/editor-core";
```

| Nhóm | Chức năng |
|---|---|
| `timeline/commands` | Hệ thống command pattern (Command Runner) để áp dụng thay đổi trên timeline |
| `operations/` | Logic di chuyển, sắp xếp clip (visual/audio placement), điều chỉnh cờ của track/lane |
| `timeline/policies` | Các quy tắc về không gian vật lý của timeline (snapping, zoom-fit) |
| `history/` | Cấu trúc dữ liệu và logic cho Undo/Redo |
| `properties/` | Quản lý thay đổi thuộc tính của đối tượng trên timeline |

## Không làm

- **Không chứa UI Component**: Tuyệt đối không import React hay sử dụng DOM ở đây. UI sẽ nằm ở ngoài các apps (`desktop` hoặc `web`).
- **Không quản lý State Toàn Cục**: Không dùng Zustand trực tiếp trong package này. Thay vào đó, app sẽ gọi hàm từ package này và tự update state của app.
- **Không Render Image/Video**: Việc diễn giải timeline thành tọa độ hình ảnh thuộc về `@motionvideo/motion-runtime`, việc encode video thuộc về `@motionvideo/motion-compiler` và `render-worker`.

## Phụ thuộc (Dependencies)

- `@motionvideo/motion-schema`: Sử dụng schema chuẩn để định nghĩa và giao tiếp.
