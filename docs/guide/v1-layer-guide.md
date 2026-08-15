# MotiClip V1 Layer

> Trạng thái: v1 draft
>
> Mục tiêu: mô hình layer chung cho AI viết JSON.

---

## Guide này nói gì

- Layer là gì
- Root và nested khác nhau thế nào
- Field dùng chung
- Vai trò: container, instance, leaf

---

## Đã chốt

- `layer` là primitive authoring duy nhất trong `MotionProjectV1`.
- Layer gốc có `parentLayerId: null`.
- Layer lồng có `parentLayerId` trỏ về cha.
- `group` là container nhìn thấy được và phải có ít nhất một child.
- `component` là instance niêm phong.
- Các type còn lại là leaf, trừ khi guide riêng nói khác.
- Mọi layer bắt buộc `timing` và `zIndex`.
- `timing.start` / `timing.duration` là contract canonical; không dùng layer `trim` trong JSON authoring.
- Thời lượng nhỏ nhất hợp lệ là 1 frame.
- `zIndex` unique trong cùng sibling scope.
- Root visual: `zIndex >= 0`. Root audio: `zIndex < 0`. Nested visual: `zIndex >= 0`.
- `semantic` chỉ là metadata; không đổi render.
- Không emit `locked`.
- Không dùng `modifier` như khái niệm authoring tổng quát.
- Layout native:
  - `layout` chỉ trên `group`
  - `layoutItem` trên child visual trong group
- `frame` bắt buộc trên mọi visual layer, kể cả group. Cấm audio/camera. Canonical JSON không suy group.frame từ children.

---

## Câu chốt

Layer là object authoring đầy đủ trên timeline: là gì, sống lúc nào, xếp chồng ra sao, quan hệ với cha thế nào.

---

## Các lớp nghĩa chung

- identity: `id`, `type`, `name`, `semantic`
- thời gian: `timing`
- cây: `parentLayerId`
- stacking: `zIndex`
- box local: `frame` — bắt buộc trên mọi visual layer; cấm audio/camera
- hình học / hiển thị: `transform`, `appearance`, `compositing`, `effects`
- bố cục khi cần: `layout` (group), `layoutItem` (child)
- nội dung theo type: `payload`

---

## Root và nested

Root và nested đều là layer thật, đều có `timing` và `zIndex`. Timing child local theo cha; không vượt duration hiệu lực của cha. `zIndex` chỉ có nghĩa trong cùng sibling scope.

Với group: cả subtree nằm trong slot `zIndex` của group ở scope ngoài.

---

## Ba vai trò

- container: `group`
- instance: `component`
- leaf: text, image, video, path, shape, solid, audio, …

---

## Ngoài phạm vi

- Chi tiết payload từng type
- Luật layout cụ thể — xem [v1-layout-guide.md](./v1-layout-guide.md)
- Path-native `trim` / `morph`
- Playback media

---

## Xem thêm

- [v1-format-guide.md](./v1-format-guide.md)
- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-group-guide.md](./v1-group-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-layout-guide.md](./v1-layout-guide.md)
