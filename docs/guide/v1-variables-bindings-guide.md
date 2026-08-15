# MotiClip V1 Variables và Bindings

> Trạng thái: v1 (bindings tới component = advanced)
>
> Mục tiêu: luồng dữ liệu tái sử dụng cho JSON do AI sinh.

---

## Đã chốt

- Variable là giá trị có kiểu.
- Binding nối variable tới property **wrapper** của layer (`target.type: "layer"`) hoặc public prop của một instance (`target.type: "componentLayer"` + `propId`).
- Default AI surface cho component: `payload.props`. `project.bindings` → `componentLayer` là **advanced**.
- Nested internals không nhận project binding. Chỉ `childProp` từ parent owner.
- `semantic` là metadata; không thay variable.

---

## Còn mở

- Subset property layer nào AI-safe để bind.
- Ví dụ nên ưu tiên literal hay giá trị qua variable.

---

## Xem thêm

- [v1-component-guide.md](./v1-component-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-production-surface-guide.md](./v1-production-surface-guide.md)
