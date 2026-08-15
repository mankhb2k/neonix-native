# MotiClip V1 Appearance

> Trạng thái: nháp
>
> Mục tiêu: hiện/ẩn và độ mờ là lớp appearance dùng chung, tách khỏi compositing và effect.

---

## Đã chốt

- `appearance.visible` quyết định layer có được vẽ hay không.
- `appearance.opacity` là phần trăm nguyên `0..100` (100 = đầy). Không dùng `0..1`.
- Appearance tách khỏi compositing (blend / mask / isolation) và tách khỏi effects (blur / shadow / …).
- Opacity của cha có thể cộng hưởng xuống con; tắt bằng `inheritFlags.opacity: false` khi cố ý. AI không ghi `inheritFlags` mặc định.

---

## Còn mở

- Audio có nên giữ `appearance.visible` cho đồng bộ editor, hay đơn giản hóa.
- Wording mặc định cho inheritance opacity trong mọi ví dụ AI.

---

## Xem thêm

- [v1-compositing-guide.md](./v1-compositing-guide.md)
- [v1-effects-guide.md](./v1-effects-guide.md)
