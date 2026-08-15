# MotiClip V1 Variables và Bindings

> Trạng thái: v1
>
> Mục tiêu: nối dữ liệu typed từ `project.variables` vào public prop. Không sửa internals, layer field, cấu trúc scene, hay thay animation.

---

## Đã chốt

- Variable chỉ là dữ liệu typed ở cấp project.
- Prop là cổng public do owner mở ra — đầu vào duy nhất AI/user được bind.
- Binding là dây một chiều `variable → prop`. Không chứa logic render.
- Target duy nhất: `{ "type": "prop", "layerId", "propId" }`.
- Không còn `layer`, `layerProp`, `componentLayer`, hay property path sâu.
- V1 chỉ bind prop primitive: `string`, `number`, `boolean`, `color`, `asset`, `choice`.
- Type variable phải khớp type prop (kể cả `assetKind` và choice options ⊆ prop options).
- Owner nối prop vào leaf nội bộ (`propBindings`). Một prop có thể fan-out nhiều field.
- Nested internals chỉ nhận `childProp`. AI/user không skip-level.
- Không inline `{ ref: { kind: "variable" } }` trên prop. Không `component.variables`.

**Câu chốt:** Binding chỉ nối từ project variable tới public prop. Prop là binding target duy nhất trong V1.

---

## Schema tối thiểu

```json
{
  "id": "headline",
  "type": "string",
  "value": "Hello world"
}
```

```json
{
  "id": "bind_headline",
  "source": { "kind": "variable", "variableId": "headline" },
  "target": {
    "type": "prop",
    "layerId": "hero_card",
    "propId": "title"
  }
}
```

---

## Owner sinks (không phải project binding)

Project binding dừng ở prop. Owner mới nối vào leaf protocol:

| Prop kind | Leaf hợp lệ |
| --- | --- |
| number | `frame.width/height`, `transform.translate/scale/rotate.z/skew/depth/origin`, `appearance.opacity`, `effects.<id>` số, `layout.gap`, `layoutItem` min/max |
| boolean | `appearance.visible` |
| string | `payload.content.text` |
| color | `payload.color`, `style.fill`, `style.stroke`, `effects.<id>.color` |
| asset | `payload.assetId` (`assetKind` khớp) |
| choice | `layout.mode/justify/align`, `layoutItem.width/height/alignSelf` |

Không nối vào `timing.*`, `zIndex`, `semantic`, path, mask, cả khối transform/appearance/effects, object/array.

Protocol dùng `transform.translate` (không `position`), `hue-rotate` (không `hueRotate`).

---

## Không thuộc V1 bind surface

object, array, list, path, gradient, transform/timing/layout/effects/mask như một khối, expression.

---

## Xem thêm

- [v1-component-guide.md](./v1-component-guide.md)
- [v1-production-surface-guide.md](./v1-production-surface-guide.md)
