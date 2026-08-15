# MotiClip V1 Transform

> Trạng thái: nháp
>
> Mục tiêu: transform không gian dùng chung cho layer hình.

---

## Guide này nói gì

- `translate`
- `scale`
- `rotate`
- `skew`
- `origin`
- `depth`

---

## Đã chốt

- Transform tác động lên nội dung / size box local của layer.
- `transform` không thay `frame`. Size ở `frame`; vị trí/xoay/phóng ở `transform`.
- MVP 2.5D: `translate.x/y`, `depth`, `rotate.z`, `scale.x/y`, `skew.x/y`, `origin.x/y`.
- `depth > 0` gần người xem, `< 0` xa hơn, `0` mặt phẳng thường. Có thể keyframe. **Không phải `zIndex`.**
- Không có perspective / `rotate.x/y` / `scale.z` / `transform-style` trên bề mặt authoring này.
- Cha có thể kéo theo con qua inheritance; `inheritFlags` tắt từng kênh khi cần. AI không dùng `inheritFlags` mặc định.
- Audio không có `transform`.

---

## Còn mở

- `depth` có nằm trong bề mặt AI mặc định hay để mục nâng cao.
- Có type nào bị hạn chế bớt kênh transform không (ngoài audio).

---

## Ngoài phạm vi

- Layout
- Effects
- Motion path (không nhét vào transform)

---

## Xem thêm

- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
