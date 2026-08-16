# MotiClip V1 Shape

> Trạng thái: v1
>
> Mục tiêu: layer hình primitive gần Figma — hộp, hình gì, tô như thế nào.

---

## Khái niệm

`shape` là visual leaf với **công thức sẵn**. V1 giữ đúng 3 loại:

- `rectangle`
- `ellipse`
- `polygon`

Khác `path`:

- `shape` = hình chuẩn, dễ sinh, dễ học
- `path` = vector tự do (điểm + đoạn)

Cần hình tự vẽ → dùng `path`, không nhồi vào shape.

---

## Ba phần của một shape

| Phần | Việc |
| --- | --- |
| `frame` | Hộp kích thước (width/height) trước transform |
| `payload` | Hình gì (geometry) |
| `style` | Tô như thế nào (paint) |

`transform` / `appearance` / `timing` / `zIndex` giống mọi visual layer khác.

---

## Rule chốt: không `payload.color`

Màu shape **chỉ** nằm ở:

- `style.fill`
- `style.stroke`

`payload.color` dành cho text / solid. Owner bind color vào `style.fill` hoặc `style.stroke`.

---

## Payload

### Rectangle

```json
{
  "shape": "rectangle",
  "cornerRadius": 24
}
```

`cornerRadius` chỉ hợp lệ trên rectangle. Đơn vị pixel theo box.

### Ellipse

```json
{
  "shape": "ellipse"
}
```

Hình tròn = ellipse với `frame` vuông.

### Polygon

```json
{
  "shape": "polygon",
  "points": [
    { "x": 0.5, "y": 0 },
    { "x": 1, "y": 1 },
    { "x": 0, "y": 1 }
  ]
}
```

`points` là tọa độ **chuẩn hóa theo frame**, mỗi trục `0..1`:

- `{ "x": 0, "y": 0 }` = góc trên trái của hộp
- `{ "x": 0.5, "y": 0 }` = giữa cạnh trên
- `{ "x": 1, "y": 1 }` = góc dưới phải

Tối thiểu 3 điểm. Không dùng pixel tuyệt đối.

---

## Style

AI mặc định chỉ ghi:

- `fill`
- `stroke`
- `strokeWidth`

Schema vẫn nhận (nâng cao, không phải ví dụ mặc định):

- `fillOpacity`, `strokeOpacity` (0..1)
- `lineCap`, `lineJoin`, `miterLimit`
- `dash`, `dashOffset`
- gradient `fill` (object, không phải hex)

---

## Ví dụ

### Rectangle

```json
{
  "id": "rect_1",
  "type": "shape",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 320, "height": 180 },
  "transform": {
    "translate": { "x": 100, "y": 120 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "shape": "rectangle",
    "cornerRadius": 24
  },
  "style": {
    "fill": "#FF7A00",
    "stroke": "#111111",
    "strokeWidth": 4
  }
}
```

### Ellipse

```json
{
  "id": "circle_1",
  "type": "shape",
  "parentLayerId": null,
  "zIndex": 2,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 160, "height": 160 },
  "transform": {
    "translate": { "x": 420, "y": 180 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "shape": "ellipse"
  },
  "style": {
    "fill": "#00C2FF"
  }
}
```

### Polygon (tam giác)

```json
{
  "id": "triangle_1",
  "type": "shape",
  "parentLayerId": null,
  "zIndex": 3,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 200, "height": 200 },
  "transform": {
    "translate": { "x": 700, "y": 180 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "shape": "polygon",
    "points": [
      { "x": 0.5, "y": 0 },
      { "x": 1, "y": 1 },
      { "x": 0, "y": 1 }
    ]
  },
  "style": {
    "fill": "#7C4DFF",
    "stroke": "#111111",
    "strokeWidth": 2
  }
}
```

---

## Giữ / bỏ

**Giữ:** `type: "shape"`, `payload.shape`, `payload.cornerRadius`, `payload.points`, `style.fill`, `style.stroke`, `style.strokeWidth`.

**Bỏ khỏi canonical shape:** `payload.color`.

**Nâng cao:** `fillOpacity`, `strokeOpacity`, `lineCap`, `lineJoin`, `miterLimit`, `dash`, `dashOffset`, gradient fill.

---

## Xem thêm

- [v1-path-guide.md](./v1-path-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-variables-bindings-guide.md](./v1-variables-bindings-guide.md)
