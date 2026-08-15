# MotiClip V1 Compositing

> Trạng thái: nháp
>
> Mục tiêu: cách layer chồng lên nhau về mặt vẽ — không nhầm với effect.

---

## Đã chốt

- Compositing là một lớp nghĩa riêng.
- Thuộc về đây: `blend-mode`, `isolation`, `mask`.
- Group **không** phải clipping box mặc định.
- Muốn cắt / lộ nội dung: dùng `mask` tường minh (hoặc primitive chuyên biệt), không suy từ `frame` của group.

---

## Còn mở

- Tập mask production-safe cho AI (mode nào, source type nào).
- Toàn bộ blend mode trong schema có vào bề mặt AI mặc định không.
- `isolation` là field authoring phổ thông hay mục nâng cao.

---

## Xem thêm

- [v1-group-guide.md](./v1-group-guide.md)
- [v1-effects-guide.md](./v1-effects-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
