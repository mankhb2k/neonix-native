# MotiClip V1 Components

> Trạng thái: v1
>
> Mục tiêu: instance niêm phong trên cây project; compiler bung template.

---

## Đã chốt

1. `type: "component"` là **sealed instance leaf** trên project tree. Definition = mẫu niêm phong. Instance = layer đặt trên cây. AI/user thấy một layer; compiler/runtime bung thành wrapper + internals.
2. Bên ngoài instance được chỉnh **wrapper atoms** (vỏ): `frame`, `transform`, `timing`, `zIndex`, `appearance`, `compositing`, `effects`, `semantic`. (Cộng `name`, `parentLayerId`, và `layoutItem` khi là child của group có `layout`.)
3. Bên ngoài **không** được chỉnh: `layers`, `propBindings`, property internal, nested internals trực tiếp. Không bind/animate/patch vào ruột từ project consumer.
4. `props` là public signals điều khiển ruột. Wrapper atoms điều khiển cả khối như một object.
5. `variant` chỉ là preset override **props**. Không đổi tree, bindings, hay layout graph.
6. Default AI: `payload.props` (+ `variantId`). `project.bindings` chỉ `type: "prop"` (`layerId` + `propId`). Nested chỉ nhận giá trị qua `childProp`; không skip-level.

**Câu chốt:** vỏ = wrapper atoms. Ruột public = props. Variant = preset props. Binding project chỉ tới prop.

---

## Cách nên nghĩ

| Khái niệm | Nghĩa đời thường |
| --- | --- |
| **Prop** | Một **tín hiệu public** — nút chỉnh mà user/AI được đụng |
| **PropBindings** | Các **dây nối** tín hiệu đó vào bên trong component |
| **Prop value** | Giá trị gắn lên tín hiệu (màu tĩnh, biến, hoặc keyframes) |
| **Instance** | Layer `type: "component"` — leaf authoring; wrapper atoms + `payload.props` |

```text
User chỉnh props
     │
     ▼
  brandColor = #00ff88          ← một tín hiệu
     │
     ├─► circle.style.fill
     ├─► title.payload.color    ← fan-out nhờ propBindings
     └─► border.style.stroke
```

- **User / app / AI consumer** chỉnh wrapper atoms + `payload.props` / `variantId`.
- **Owner / designer AI** thiết kế `propBindings` và internals.
- **Compiler** bung instance và biến props thành giá trị / `propertyAnimations` trên layer nội bộ.

Timeline **không biết** component. Root/group đặt instance. Definition mô tả bên trong.

---

## Câu chốt contract (chi tiết)

> Definition = sealed template. Component layer = instance leaf. Compiler expand = wrapper + internals.  
> Wrapper atoms điều khiển vỏ. Props điều khiển ruột public. Variant chỉ override props.  
> Prop keyframes animate public signal, không animate wrapper.  
> Nested chỉ `childProp`. Project binding chỉ `type: "prop"`.

---

## 1. Props và PropBindings làm việc thế nào

### 1.1 Một prop = một tín hiệu

Owner khai báo:

```jsonc
{
  "id": "brandColor",
  "label": "Brand color",
  "kind": "color",
  "default": "#ffcc00",
  "animatable": true
}
```

User **không** cần biết có bao nhiêu layer bên trong. Họ chỉ biết: “có nút Brand color”.

### 1.2 PropBindings = dây nối (có thể fan-out)

Muốn một màu đổi **cả 3 vật thể**, owner nối cùng `propId` tới 3 layer:

```jsonc
{
  "propBindings": [
    {
      "propId": "brandColor",
      "target": {
        "kind": "layerProperty",
        "layerId": "circle",
        "property": "style.fill"
      }
    },
    {
      "propId": "brandColor",
      "target": {
        "kind": "layerProperty",
        "layerId": "title",
        "property": "payload.color"
      }
    },
    {
      "propId": "brandColor",
      "target": {
        "kind": "layerProperty",
        "layerId": "border",
        "property": "style.stroke"
      }
    }
  ]
}
```

> `layerId` = id của **layer nội bộ** trong `component.layers` (circle, title, border…).

Compiler `resolvePropTargets(propId)` tìm **mọi** dây nối, không dừng ở binding đầu tiên.

### 1.3 User chỉ set props trên instance

```jsonc
{
  "type": "component",
  "id": "badge-1",
  "payload": {
    "componentId": "promo-badge",
    "props": {
      "brandColor": "#00ff88"
    }
  }
}
```

Compiler hiểu:

```text
badge-1.brandColor = #00ff88
  → circle.style.fill     = #00ff88
  → title.payload.color   = #00ff88
  → border.style.stroke   = #00ff88
```

**Một prop có thể điều khiển nhiều layer.** Đó là fan-out.

### 1.4 Animate cùng tín hiệu

Vì `animatable: true`, value có thể là keyframes:

```jsonc
{
  "payload": {
    "componentId": "promo-badge",
    "props": {
      "brandColor": {
        "kind": "keyframes",
        "keys": [
          { "t": 0, "value": "#ffcc00" },
          { "t": 1, "value": "#00ff88" },
          { "t": 2, "value": "#ff3366" }
        ]
      }
    }
  }
}
```

Compiler **fan-out cùng keyframes** tới mọi dây nối:

```text
brandColor keyframes
  → circle color keyframes
  → title color keyframes
  → border stroke keyframes
```

User vẫn chỉ chỉnh **một** prop. Ba layer chuyển màu đồng bộ.

```mermaid
flowchart TB
  prop["prop brandColor"]
  wire1["binding → circle"]
  wire2["binding → title"]
  wire3["binding → border"]
  prop --> wire1
  prop --> wire2
  prop --> wire3
```

### 1.5 Ai làm việc gì

| Ai | Làm gì | Không làm |
| --- | --- | --- |
| **User / consumer** | Wrapper atoms + `payload.props` / `variantId` | Không sửa `layers` / `propBindings` / internals |
| **Owner** | Khai báo `props[]`, viết `propBindings`, dựng `layers`, `variants[].props` | Variant không đổi tree |
| **Compiler** | Expand instance → wrapper + internals; resolve props → apply / emit `propertyAnimations` | Không suy luận binding thiếu |

---

## 2. Hai phần của Prop

| Phần | Ai viết | JSON |
| --- | --- | --- |
| **Definition** | Owner | `component.props[]` — tín hiệu là gì (`kind`, `default`, `animatable`…) |
| **Value** | Consumer / variant / project binding | `payload.props`, `variant.props`, binding `propId` |

```mermaid
flowchart LR
  def["props definition"]
  val["prop value"]
  wire["propBindings"]
  layers["1..N internal layers"]
  def --> val
  val --> wire
  wire --> layers
```

---

## 3. PropKind

```ts
type PropKind = "string" | "number" | "boolean" | "color" | "choice" | "asset";
```

| Kind | Dùng cho | Default `animatable` | Interpolate (theo type, không field) |
| --- | --- | --- | --- |
| `string` | title, label | `true` | step |
| `number` | opacity, progress, size | `true` | linear / easing |
| `boolean` | showIcon, visible | `true` | step |
| `color` | brandColor, fill | `true` | color |
| `choice` | style, layout, mode | `false` (`animatable: true` được) | step |
| `asset` | image, video, font… | `false` (`animatable: true` được) | step |

Không dùng `text` / `enum` / `list` trên public API (`string` thay text, `choice` thay enum).

### Ví dụ definition

```jsonc
{ "id": "progress", "label": "Progress", "kind": "number", "default": 0, "min": 0, "max": 1, "animatable": true }
```

```jsonc
{ "id": "avatar", "label": "Avatar", "kind": "asset", "assetKind": "image", "default": "asset-default-avatar" }
```

```jsonc
{ "id": "style", "label": "Style", "kind": "choice", "options": ["solid", "outline", "ghost"], "default": "solid" }
```

### AssetKind

```ts
type AssetKind = "image" | "video" | "audio" | "svg" | "font" | "media";
```

- Strict: `image` / `video` / `audio` / `svg` / `font`
- `media` = image **hoặc** video (heroMedia, backgroundMedia…)
- Không có `any` ở V1 canonical

---

## 4. Prop values

### Static

```jsonc
{
  "payload": {
    "componentId": "progress-ring",
    "props": { "progress": 0.75, "color": "#00ff88", "label": "Loading" }
  }
}
```

### Variable-bound

Chỉ một đường: `project.bindings` với `target.type: "prop"`.  
Không ghi `{ ref: { kind: "variable" } }` trong `payload.props`, `prop.default`, hay `variant.props`.  
Không có `component.variables`.

```jsonc
{
  "bindings": [
    {
      "id": "bind-label",
      "source": { "kind": "variable", "variableId": "cta-text" },
      "target": { "type": "prop", "layerId": "cta", "propId": "label" }
    }
  ]
}
```

### Keyframed

```jsonc
{
  "props": {
    "progress": {
      "kind": "keyframes",
      "keys": [
        { "t": 0, "value": 0 },
        { "t": 2, "value": 1, "easing": "easeOut" }
      ]
    }
  }
}
```

### Keyframe rules

- `t` là **local time của component instance layer** — `0..layer.timing.duration`
- `keys` phải **tăng dần**, **không trùng `t`**, và **`t ≤ layer.timing.duration`**
- `number` → `linear`; `color` → `color`
- `string` / `boolean` / `choice` / `asset`: chỉ **step**
- `animatable: false` (hoặc omitted trên choice/asset) + keyframes → **reject**
- `choice` / `asset` có thể `animatable: true`; asset keyframe vẫn **step-only**
- Asset / choice: mỗi key phải khớp `assetKind` / `options`
- Unknown `ref.variable` → **reject**
- Không animate `payload.props.<propId>` qua `timeline.clips`. Nếu prop cần animation, đặt keyframes ngay trong `payload.props.<propId>`. Layer property (`transform`, `appearance.opacity`, …) của instance vỏ đi qua `timeline.clips`. Xem [v1-animation-keyframes-guide.md](./v1-animation-keyframes-guide.md).

Prop keyframes animate **public signal**, không animate wrapper. Animation trên field wrapper của instance (`transform`, `appearance.opacity`, …) là vỏ. Prop keyframes fan-out vào layer nội bộ qua `propBindings`.

---

## 5. Hai loại PropBinding

| Target | Shape | Ý nghĩa |
| --- | --- | --- |
| `layerProperty` | `{ kind: "layerProperty", layerId, property }` | Nối tín hiệu → property của layer nội bộ |
| `childProp` | `{ kind: "childProp", childLayerId, propId }` | Forward tín hiệu → prop của **child component trực tiếp** |

### Forward xuống child

Một prop cha có thể forward xuống **nhiều** child (nhiều binding `childProp`):

```jsonc
{
  "propId": "brandColor",
  "target": {
    "kind": "childProp",
    "childLayerId": "button-instance",
    "propId": "color"
  }
}
```

Giá trị (kể cả keyframes) được forward **nguyên**. Child tự fan-out tiếp qua `propBindings` của mình.

```text
A.brandColor keyframes
  → B.color keyframes          (childProp)
    → C.fillColor keyframes    (child của B)
      → layer fill             (layerProperty)
```

Không skip-level: A không bind thẳng layer nội bộ của C.

Compiler resolve recursive: thấy `childProp` thì đi tiếp vào child definition cho đến khi gặp `layerProperty`.

### Project binding (advanced)

| Field | Ở đâu | Phạm vi |
| --- | --- | --- |
| `project.bindings` | Project | **Một** instance: `type: "prop"` + `layerId` + `propId` |

Default AI **không** dùng `project.bindings` để set prop. Dùng `payload.props`. Binding `prop` giữ trong protocol cho hệ thống/app chia sẻ variable.

Global bulk `target.type: "component"` **đã gỡ**. Không bind layer field. Nested Button trong Card không nhận project binding — parent phải `childProp`.

Hai `propBindings` cùng `layerProperty` (`layerId` + `property`) → **reject**. Hai `childProp` cùng (`childLayerId` + `propId`) → **reject**.

---

## 6. Resolve order

Luồng **một chiều**. Không write ngược. Không child override parent. Binding **không** ghi xuống internals.

```text
root source
  -> parent prop
  -> child prop
  -> grandchild prop
  -> internal layerProperty
```

Mọi nguồn đều là **prop source**. Binding chỉ drive public prop. Compiler merge cascade xong rồi mới apply `layerProperty` / emit `propertyAnimations`.

Priority **mỗi prop trên mỗi instance** (sau thắng trước):

1. `prop.default`
2. `variant.props`
3. `payload.props`
4. parent forwarded prop (`childProp`)
5. project binding (`target.type: "prop"`)

Nested instance không nhận project binding. Parent forward (bước 4) ghi vào child `payload.props` rồi recurse.

```mermaid
flowchart TD
  collect[Collect project-tree instances]
  sources[Resolve prop sources per instance]
  merge[Merge cascade into resolvedProps]
  forward[Forward childProp to nested instances]
  apply[Apply layerProperty + emit propertyAnimations]
  collect --> sources --> merge --> forward --> apply
```

---

## 7. Definition + instance đầy đủ

```jsonc
{
  "id": "promo-badge",
  "version": "1.0.0",
  "integrity": "sha256:…",
  "props": [
    {
      "id": "brandColor",
      "label": "Brand color",
      "kind": "color",
      "default": "#ffcc00",
      "animatable": true
    }
  ],
  "propBindings": [
    {
      "propId": "brandColor",
      "target": { "kind": "layerProperty", "layerId": "circle", "property": "style.fill" }
    },
    {
      "propId": "brandColor",
      "target": { "kind": "layerProperty", "layerId": "title", "property": "payload.color" }
    },
    {
      "propId": "brandColor",
      "target": { "kind": "layerProperty", "layerId": "border", "property": "style.stroke" }
    }
  ],
  "layers": [/* circle, title, border, … */],
  "variants": []
}
```

```jsonc
{
  "id": "badge-1",
  "type": "component",
  "parentLayerId": null,
  "zIndex": 2,
  "timing": { "start": 0, "duration": 4 },
  "frame": { "width": 256, "height": 256 },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "componentId": "promo-badge",
    "props": { "brandColor": "#00ff88" }
  }
}
```

---

## 8. Timeline reminder

Component instance = `type: "component"` leaf trên **project layer tree**. Compiler bung thành wrapper + internals. Instance mang đủ wrapper atoms; internals sealed. Timing nằm ở `layer.timing`.

---

## 9. Anti-patterns

| ❌ Sai | ✅ Đúng |
| --- | --- |
| User sửa `layers` / `propBindings` | User set wrapper atoms + `payload.props` |
| Bind thẳng internals từ project | Cấm. Chỉ `type: "prop"`; default AI: `payload.props` |
| Global bulk binding mọi instance cùng `componentId` | Từng instance `prop`; nested qua `childProp` |
| `target.type: "layer"` / `"componentLayer"` / `"component"` | `target.type: "prop"` |
| Animate internal bằng track ngoài | Prop keyframes hoặc wrapper atoms trên instance |
| Variant đổi tree / bindings | Variant chỉ `props` |
| Skip-level vào nested child | `childProp` từng tầng |
| `actions` / named action animations | Đã gỡ; animate bằng prop keyframes hoặc `timeline.clips` |
| `PublicParamSchema` / `ComponentBindingSchema` | `ComponentPropV1Schema` + `propBindings` |

---

## 10. Tóm tắt một câu

> **Instance là leaf. Vỏ = wrapper atoms. Ruột public = props. Variant = preset props. Project binding tới propId là advanced. Nested chỉ childProp.**

---

## 11. Module map

| File | Vai trò |
| --- | --- |
| `src/v1/components/index.ts` | Definition, PropKind, propBindings |
| `src/v1/components/prop-values.ts` | Literal / keyframes. Không inline variable ref. |
| `src/v1/layers/component.ts` | Instance `payload.props` |
| `src/v1/references/project.ts` | Validation |
| `motion-compiler/compile-v1.ts` | Resolve + fan-out + `propertyAnimations` |

Xem thêm: [v1-format-guide.md](v1-format-guide.md), [v1-timeline-guide.md](v1-timeline-guide.md), [v1-group-guide.md](v1-group-guide.md).
