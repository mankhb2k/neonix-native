# MotiClip V1 Layout

> Trạng thái: v1
>
> Mục tiêu: layout native trên `group`, tính từ `frame` tường minh.

---

## Đã chốt

- Chỉ **`group`** có `layout`.
- Child visual (không root, không audio) có `layoutItem`.
- Không `modifiers`.
- Compiler nướng thành `frame` + `translate`, rồi xóa `layout` / `layoutItem` trước runtime.
- Container: `mode: "row" | "column" | "grid"`, `gap`, `padding`, `justify`, `align`.
- Grid: `columns` bắt buộc. Flow trái→phải, trên→dưới. Không span, không rowGap/columnGap riêng, không template, không autoFlow.
- Child: `width` / `height` = `fixed` | `hug` | `fill`; `alignSelf`; min/max.
- min/max clamp **sau** fixed/hug/fill.
- Layout đọc `group.frame` (bắt buộc). Không suy box group từ children.

**Không thuộc v1:** `wrap`, `grow`, `shrink` — schema reject.

---

## Ví dụ

```json
{
  "id": "stack",
  "type": "group",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 4 },
  "frame": { "width": 800, "height": 400 },
  "layout": {
    "mode": "column",
    "gap": 16,
    "padding": 24,
    "justify": "start",
    "align": "stretch"
  },
  "children": [
    {
      "id": "title",
      "type": "text",
      "parentLayerId": "stack",
      "zIndex": 0,
      "frame": { "width": 800, "height": 48 },
      "layoutItem": { "width": "fill", "height": "hug" }
    }
  ]
}
```

---

## Xem thêm

- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-group-guide.md](./v1-group-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
