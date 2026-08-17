# NeonVideo V1 SVG

> Trạng thái: v1
>
> Mục tiêu: layer asset vector — đặt SVG lên scene, không sửa ruột.

---

## Khái niệm

`svg` là visual leaf **đặt một asset SVG có sẵn** lên scene.

Không phải `shape`. Không phải `path`. V1 **không chỉnh internals** của file SVG (không selector node, không edit vector).

Khác image: SVG có `style.fill` để recolor cơ bản. Image không có `style`.

---

## Cấu trúc

| Phần | Việc |
| --- | --- |
| `frame` | Box hiển thị |
| `payload.assetId` | Asset SVG nguồn |
| `payload.fit` | SVG nằm trong box thế nào |
| `style.fill` | Recolor đơn giản (tùy chọn) |

```json
{
  "id": "logo_svg",
  "type": "svg",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 240, "height": 240 },
  "transform": {
    "translate": { "x": 200, "y": 120 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "assetId": "svg_logo",
    "fit": "contain"
  },
  "style": {
    "fill": "#111111"
  }
}
```

---

## Payload

```json
{
  "assetId": "svg_logo",
  "fit": "contain"
}
```

`fit` giống image: `contain` | `cover` | `fill` | `none`.

Mặc định: **`contain`** (logo/icon thường nằm gọn trong box).

---

## Style

Chỉ `fill` màu đơn:

```json
{ "fill": "#111111" }
```

Đây là bề mặt recolor cho icon/logo SVG đơn giản. Không hứa override đúng mọi SVG nhiều màu / phức tạp.

Bỏ `style` nếu giữ màu gốc của asset.

---

## Không thuộc V1 canonical

- `style.stroke` / `style.strokeWidth`
- `payload.color`
- `payload.crop`
- override internals / selector theo node trong SVG
- full vector editing (dùng `path` / `shape` nếu cần vẽ)

---

## Câu chốt

`svg` là asset vector placement. `frame` là box. `assetId` chọn nguồn. `fit` đặt SVG trong box. `style.fill` là recolor cơ bản duy nhất. V1 không chỉnh internals.

---

## Xem thêm

- [v1-image-guide.md](./v1-image-guide.md)
- [v1-shape-guide.md](./v1-shape-guide.md)
- [v1-path-guide.md](./v1-path-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
