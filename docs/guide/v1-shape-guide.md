# MotiClip V1 Shape

> Trạng thái: nháp
>
> Mục tiêu: thuộc tính native của layer hình primitive nằm trên chính layer đó.

---

## Đã chốt

- Hành vi shape sống trên layer shape, không nhét generic `modifiers`.
- Shape dùng cho hình primitive: rectangle, ellipse, polygon (và các kind schema đang hỗ trợ).
- `frame` bắt buộc: size box của shape.
- Paint (fill / stroke) thuộc bề mặt shape, không phải modifier.

---

## Còn mở

- Payload cuối cho từng kind (corner radius chỉ rectangle, hay khái quát sau).
- Có cần object `geometry` lồng hay field nằm thẳng trên payload.
- Tập shape-native nào vào bề mặt AI mặc định.

---

## Xem thêm

- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-path-guide.md](./v1-path-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
