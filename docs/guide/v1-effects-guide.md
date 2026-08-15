# MotiClip V1 Effects

> Trạng thái: nháp
>
> Mục tiêu: hiệu ứng điểm ảnh, không lẫn với hình học hay layout.

---

## Đã chốt

- Effect là xử lý pixel, không đổi geometry của layer.
- Họ hiện tại: `blur`, `shadow`, `glow`, `color-adjust`.
- Effect không định nghĩa `layer.type` và không thay compositing.
- Color-adjust brightness/contrast/saturation: số nguyên `0..200` (100 = bình thường). `hue-rotate`: `-180..180` độ.
- Glow / shadow opacity: số nguyên `0..100`.

---

## Còn mở

- Effect nào preview-safe và export-safe hôm nay.
- Thứ tự effect trong mảng có được coi là hành vi authoring ổn định không.
- Giới hạn số effect / tổ hợp nào cho bề mặt AI mặc định.

---

## Xem thêm

- [v1-appearance-guide.md](./v1-appearance-guide.md)
- [v1-compositing-guide.md](./v1-compositing-guide.md)
- [v1-production-surface-guide.md](./v1-production-surface-guide.md)
