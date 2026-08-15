# MotiClip V1 Layer

> Trạng thái: v1
>
> Mục tiêu: mô hình **visual layer** + cây + timing + zIndex cho AI viết JSON.

---

## Guide này nói gì

- Visual layer là gì
- Root và nested khác nhau thế nào
- Field dùng chung của visual layer
- Vai trò: container, instance, leaf

Audio là ngoại lệ: vẫn là timeline object trên `project.layers`, nhưng **không** dùng mental model visual. Xem [v1-audio-guide.md](./v1-audio-guide.md).

---

## Đã chốt

- `layer` là primitive authoring duy nhất trong `MotionProjectV1`.
- Layer gốc có `parentLayerId: null`.
- Layer lồng có `parentLayerId` trỏ về cha.
- `group` là container nhìn thấy được và phải có ít nhất một child.
- `component` là instance niêm phong.
- Các type visual còn lại là leaf, trừ khi guide riêng nói khác.
- Mọi layer bắt buộc `timing` và `zIndex`.
- `timing.start` / `timing.duration` là contract canonical; không dùng layer `trim` trong JSON authoring.
- Thời lượng nhỏ nhất hợp lệ là 1 frame.
- `zIndex` unique trong cùng sibling scope.
- Root visual: `zIndex >= 0`. Nested visual: `zIndex >= 0`. Root audio: `zIndex < 0` (lane rule, không phải visual stacking) — chi tiết ở audio guide.
- `semantic` chỉ là metadata; không đổi render.
- Không emit `locked`.
- Không dùng `modifier` như khái niệm authoring tổng quát.
- Layout native:
  - `layout` chỉ trên `group`
  - `layoutItem` trên child visual trong group
- `frame` bắt buộc trên mọi visual layer, kể cả group. Cấm audio/camera. Canonical JSON không suy group.frame từ children.
- `transform` bắt buộc trên mọi visual layer, cùng một cấu trúc. Audio không có transform. Scale âm = lật. `depth` ≠ `zIndex`.
- `appearance` chỉ `visible` + `opacity` trên visual layer. Không hit-test.
- JSON protocol không định nghĩa hit-test, selection, hay editor UI.

---

## Câu chốt

Visual layer là object authoring trên timeline: là gì, ở đâu, sống lúc nào, nhìn thế nào, quan hệ với cha thế nào.

---

## Các lớp nghĩa của visual layer

- identity: `id`, `type`, `name`, `semantic`
- thời gian: `timing`
- cây: `parentLayerId`
- stacking: `zIndex`
- box local: `frame`
- hình học: `transform`
- hiển thị tối thiểu: `appearance` (`visible`, `opacity`)
- compositing / effects: tách khỏi appearance
- bố cục khi cần: `layout` (group), `layoutItem` (child)
- nội dung theo type: `payload`

---

## Root và nested

Root và nested visual đều là layer thật, đều có `timing` và `zIndex`. Timing child local theo cha; không vượt duration hiệu lực của cha. `zIndex` chỉ có nghĩa trong cùng sibling scope.

Với group: cả subtree nằm trong slot `zIndex` của group ở scope ngoài.

---

## Ba vai trò visual

- container: `group`
- instance: `component`
- leaf: text, image, video, path, shape, solid, …

Audio không thuộc ba vai trò này. Nó là timeline leaf riêng — [v1-audio-guide.md](./v1-audio-guide.md).

---

## Ngoài phạm vi

- Playback audio — [v1-audio-guide.md](./v1-audio-guide.md)
- Chi tiết payload từng type visual
- Luật layout cụ thể — [v1-layout-guide.md](./v1-layout-guide.md)
- Path-native `trim` / `morph`
- Hit-test / editor selection

---

## Xem thêm

- [v1-format-guide.md](./v1-format-guide.md)
- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-group-guide.md](./v1-group-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-layout-guide.md](./v1-layout-guide.md)
- [v1-transform-guide.md](./v1-transform-guide.md)
- [v1-appearance-guide.md](./v1-appearance-guide.md)
- [v1-audio-guide.md](./v1-audio-guide.md)
