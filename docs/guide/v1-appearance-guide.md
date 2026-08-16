# MotiClip V1 Appearance

> Trạng thái: v1
>
> Mục tiêu: lớp hiển thị tối thiểu của visual layer trên JSON authoring.

---

## Đã chốt

- `appearance` chỉ gồm `visible` và `opacity`.
- Chỉ trên **visual layer**. Audio không có `appearance`.
- `visible`: layer có được **render** hay không.
- `opacity`: độ mờ nguyên `0..100` (100 = đầy). Không dùng `0..1`. Không đặt trên `transform`.
- Opacity của cha có thể cộng hưởng xuống con.
- Appearance không chứa compositing, effects, hay interaction.
- JSON protocol **không** định nghĩa hit-test, selection, hay UI behavior của editor.

**Câu chốt:** `appearance` chỉ phục vụ render semantics của bề mặt authoring. Editor/preview tự quyết hit-test.

---

## Không thuộc appearance

| Thuộc | Không thuộc |
| --- | --- |
| `visible`, `opacity` | compositing (`blend-mode`, mask, isolation) |
| | effects (`blur`, `shadow`, …) |
| | hit-test / pointer-events / selection |
| | `payload.muted` / `payload.volume` (audio) |

---

## Xem thêm

- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-compositing-guide.md](./v1-compositing-guide.md)
- [v1-effects-guide.md](./v1-effects-guide.md)
- [v1-audio-guide.md](./v1-audio-guide.md)
