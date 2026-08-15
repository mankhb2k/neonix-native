# MotiClip V1 Video

> Trạng thái: v1
>
> Mục tiêu: layer video — placement trong frame + playback nguồn.

---

## Khái niệm

`video` là media layer có **hai phần**:

| Phần | Việc |
| --- | --- |
| Placement | Video nằm trong `frame` thế nào (`fit`) |
| Playback | Phát đoạn nào (`trimStart` / `trimEnd`), `loop`, `muted` |

`timing` vẫn là timing của **layer** trên timeline. Trim cắt **nguồn media**, không thay `timing`.

---

## Cấu trúc

| Field | Vai trò |
| --- | --- |
| `frame` | Box hiển thị |
| `payload.assetId` | Video nguồn |
| `payload.fit` | Cách video nằm trong box |
| `payload.trimStart` | Điểm bắt đầu trong nguồn (giây) |
| `payload.trimEnd` | Điểm kết thúc trong nguồn (giây) |
| `payload.loop` | Có lặp không |
| `payload.muted` | Có tắt tiếng không |
| `payload.framePolicy` | Nâng cao — không emit nếu không cần |

```json
{
  "id": "video_1",
  "type": "video",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 120 },
  "frame": { "width": 1280, "height": 720 },
  "transform": {
    "translate": { "x": 0, "y": 0 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "assetId": "video_intro",
    "fit": "cover",
    "trimStart": 0,
    "trimEnd": 8,
    "loop": false,
    "muted": true
  }
}
```

---

## Payload

```json
{
  "assetId": "video_intro",
  "fit": "cover",
  "trimStart": 0,
  "trimEnd": 8,
  "loop": false,
  "muted": true
}
```

`fit`: `contain` | `cover` | `fill` | `none`.

Mặc định: **`cover`**, **`loop: false`**, **`muted: false`**.

`trimStart` / `trimEnd` tùy chọn. Nếu ghi cả hai, `trimStart` phải nhỏ hơn `trimEnd`. `trimStart` được phép `0`.

---

## Rule chốt

- `frame` là box hiển thị video
- `fit` quyết định video nằm trong box thế nào
- `trimStart` / `trimEnd` cắt nguồn media
- `timing` vẫn là timing của layer
- `loop` và `muted` là playback cơ bản
- `framePolicy` là nâng cao

---

## Không thuộc V1 canonical

**Không `payload.crop`.** Video V1 không crop. Muốn cắt hình: dùng `fit` / `frame` / mask, không crop nguồn.

Không `style` trên video.

---

## Câu chốt

Video là media layer cho video source. `frame` là box. `fit` lấp box. `trimStart` / `trimEnd` cắt đoạn nguồn. `loop` / `muted` điều khiển playback cơ bản. `framePolicy` advanced. V1 không dùng `payload.crop`.

---

## Xem thêm

- [v1-image-guide.md](./v1-image-guide.md)
- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
