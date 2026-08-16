# MotiClip V1 Animation / Keyframes

> Trạng thái: v1
>
> Mục tiêu: cái gì được animate, animate bằng cách nào, keyframe nằm ở đâu.

---

## Khái niệm

Animation là **thay đổi giá trị trình bày theo thời gian**. Không phải đổi cấu trúc layer, layout, hay playback setup.

Hai lớp dữ liệu:

| Lớp | Ở đâu | Vai trò |
| --- | --- | --- |
| Base state | `layer` / `payload` / `style` / `payload.props` literal | Giá trị lúc t = 0 / khi không có clip |
| Animation | `timeline.clips` (layer property) hoặc `payload.props.<propId>` keyframes (component) | Chuyển động |

Layer **không** ôm keyframe trên field thường. Không nhầm authoring JSON với runtime `tracks` / compiler motion-units.

---

## Hai đường animation

### 1. Layer property animation

Animate field của layer: `transform.translate.x`, `appearance.opacity`, `style.fill`, …

**Chỗ ghi:** `timeline.clips` — nơi duy nhất cho đường này.

### 2. Prop keyframe animation

Animate public prop của component instance:

**Chỗ ghi:** `payload.props.<propId>` với `{ "kind": "keyframes", "keys": [...] }`

Owner fan-out vào internals qua `propBindings`. Không animate `payload.props.*` bằng `timeline.clips`.

---

## Shape của keyframe

Một key: thời điểm `t`, `value`, `easing?`.

```json
{
  "kind": "keyframes",
  "keys": [
    { "t": 0, "value": 0 },
    { "t": 1, "value": 100 }
  ],
  "interpolation": "linear"
}
```

`keys` tăng dần, không trùng `t`.

---

## Interpolation theo type

Cứng trong V1. Không mở rộng.

| Loại | Interpolation |
| --- | --- |
| number (kể cả angle) | `linear` |
| color | `color` |
| boolean | `step` |
| string | `step` |
| choice | `step` |
| asset | `step` |

Bỏ `interpolation` → dùng mặc định theo loại. Ghi sai (ví dụ `linear` trên color) → reject.

---

## Thời gian `t`

Cả hai đường dùng **local time của layer đích**.

- `t = 0` = `layer.timing.start`
- `t` phải `≤ layer.timing.duration`
- Prop keyframes: local theo **component instance layer**
- `timeline.clips`: local theo **layer mà clip `layerId` trỏ tới**

Không phải absolute clock của `timeline.duration`. Runtime IR (`project.tracks`) là output compiler, không phải chỗ authoring.

---

## `timeline.clips`

```json
{
  "timeline": {
    "duration": 4,
    "clips": [
      {
        "id": "fade_title",
        "layerId": "title",
        "property": "appearance.opacity",
        "kind": "keyframes",
        "keys": [
          { "t": 0, "value": 0 },
          { "t": 1, "value": 100 }
        ],
        "interpolation": "linear"
      }
    ]
  }
}
```

`id` clip unique. `layerId` phải tồn tại. `property` phải animatable trên type của layer đó.

---

## Allowlist animatable (V1)

Được animate (giá trị trình bày):

- `transform.translate.x` / `y`
- `transform.scale.x` / `y`
- `transform.rotate.z`
- `transform.skew.x` / `y`
- `transform.depth`
- `appearance.opacity`
- `style.fill` (shape / path / svg)
- `style.stroke` / `style.strokeWidth` (shape / path)
- `payload.color` (text / solid)
- `payload.fontSize`
- `effects.<id>.*` numeric (không animate color của effect)

Không animate (cấu trúc / setup / playback):

- `frame.width` / `frame.height` — scale bằng `transform.scale`. Owner **có thể bind** frame/origin như setup tĩnh; **không** keyframe.
- `timing.*`, `zIndex`
- `transform.origin.*`, `appearance.visible` — bindable setup, không animate
- `payload.fit`, `wrap`, `alignment`, `overflow`, `fillRule`, `shape`, `assetId`
- `payload.trimStart` / `trimEnd`, `loop`, `muted`, `framePolicy`
- `payload.crop*`
- layout / layoutItem
- `payload.props.*` (dùng keyframes trên prop)

---

## Anti-patterns

- Ghi keyframe vào `transform.translate.x` trên layer JSON
- Animate `frame` để “phóng to”
- Animate trim video
- Dùng `timeline.clips` cho prop component
- Nhầm `timeline.clips` với compiler `MotionClip` / runtime `tracks`

---

## Ví dụ — layer property

```json
{
  "layers": [
    {
      "id": "title",
      "type": "text",
      "parentLayerId": null,
      "zIndex": 1,
      "timing": { "start": 0, "duration": 4 },
      "frame": { "width": 800, "height": 120 },
      "transform": {
        "translate": { "x": 0, "y": 200 },
        "scale": { "x": 1, "y": 1 },
        "rotate": { "z": 0 },
        "skew": { "x": 0, "y": 0 },
        "origin": { "x": 0.5, "y": 0.5 },
        "depth": 0
      },
      "appearance": { "visible": true, "opacity": 100 },
      "payload": {
        "text": "Hello",
        "fontSize": 64,
        "color": "#111111",
        "alignment": "center",
        "wrap": "word",
        "overflow": "clip"
      }
    }
  ],
  "timeline": {
    "duration": 4,
    "clips": [
      {
        "id": "slide_x",
        "layerId": "title",
        "property": "transform.translate.x",
        "kind": "keyframes",
        "keys": [
          { "t": 0, "value": 0 },
          { "t": 1, "value": 80, "easing": "easeOut" }
        ],
        "interpolation": "linear"
      }
    ]
  }
}
```

Prop keyframes: xem [v1-component-guide.md](./v1-component-guide.md).

---

## Câu chốt

Base state ở layer. Layer/property animation ở `timeline.clips`. Prop animation ở `payload.props`. `t` local theo layer. Không animate frame, trim, hay field setup. Interpolation: number linear, color color, còn lại step.

---

## Xem thêm

- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-component-guide.md](./v1-component-guide.md)
- [v1-transform-guide.md](./v1-transform-guide.md)
- [v1-effects-guide.md](./v1-effects-guide.md)
