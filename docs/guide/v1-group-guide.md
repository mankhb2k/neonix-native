# MotiClip V1 Group

`type: "group"` là **visual container** của một tập layer con. Không phải folder tên, không phải clipping box, không phải size box.

Source: `packages/motion-protocol/src/v1/layers/structural.ts` + `layers/index.ts` (`children.min(1)`).

Xem thêm [v1-format-guide.md](v1-format-guide.md) §5 và [v1-timeline-guide.md](v1-timeline-guide.md).

---

## 1. Câu chốt

**group là container hợp thành subtree, không phải box điều khiển nội dung nội tại của từng child.**

`frame` trả lời “layer này to bao nhiêu”. **group** trả lời “những layer con này đi cùng nhau như một đơn vị như thế nào”.

---

## 2. Bốn trách nhiệm

1. Gom nhiều child thành một đơn vị
2. Áp `transform` lên cả subtree
3. Áp `appearance` / `compositing` / `effects` / mask lên cả subtree
4. Giới hạn thời gian sống của subtree bằng `timing` của chính group

Group **không**:

- Định nghĩa nội dung đồ họa riêng nếu không có child
- Chỉnh shape / text / media bên trong child
- Tự clip child theo box của nó
- Thay child quyết định animation nội tại của child

---

## 3. Invariant

| Luật | Nghĩa |
| --- | --- |
| Phải có `children` | Group không hợp lệ nếu `children` rỗng. Không phải leaf. |
| Child vẫn là layer đầy đủ | Mỗi child có `zIndex`, `timing`, `transform` riêng |
| Timing | Child local to parent; bị chặn bởi timing hiệu lực của group |
| Stacking | Subtree luôn nằm trong slot `zIndex` của group ở scope cha |
| Không clip mặc định | Muốn cắt: `compositing.mask` (hoặc primitive khác), không suy từ `frame` |
| `frame` bắt buộc | Size box **của group**; không cắt children; không auto từ children |
| `frame` ≠ container | `frame` không tạo container. Group không thay `frame` của child |

---

## 4. Ví dụ

```jsonc
{
  "id": "hero",
  "type": "group",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 6 },
  "frame": { "width": 520, "height": 200 },
  "transform": { "translate": { "x": 960, "y": 540 } },
  "children": [
    {
      "id": "card",
      "type": "solid",
      "parentLayerId": "hero",
      "zIndex": 0,
      "timing": { "start": 0, "duration": 6 },
      "frame": { "width": 520, "height": 160 }
    }
  ]
}
```

Root `title` với `zIndex: 2` luôn vẽ trên toàn bộ `hero`, kể cả child `zIndex: 99` bên trong group.

---

## 5. AI authoring

- Đừng tạo group rỗng.
- Đừng bỏ `frame` trên group. Đó là box layout/hit-test, không clip.
- Đừng bỏ `zIndex` / `timing` trên child.
- Muốn cắt subtree: mask, không phải frame của group.
- Muốn xếp children: `layout` trên group + `layoutItem` trên child. Không dùng modifier. Xem [v1-layout-guide.md](v1-layout-guide.md).
