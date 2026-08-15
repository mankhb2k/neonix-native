# MotiClip V1 Path

> Trạng thái: v1
>
> Mục tiêu: layer vector tự do — hộp, contour, tô.

---

## Khái niệm

`path` là visual leaf dựng từ **điểm và đoạn vector**.

Khác `shape`:

| | `shape` | `path` |
| --- | --- | --- |
| Là gì | Hình có công thức sẵn | Hình tự vẽ |
| Loại | rectangle / ellipse / polygon | contours + segments |
| Dùng khi | Box, vòng, tam giác… | Icon, Bezier, lỗ, nhiều sub-path |

Dùng `path` khi cần:

- icon / vector tự do
- đường cong Bezier
- contour phức tạp
- nhiều sub-path trong cùng một layer (ví dụ chữ O)

Không dùng `path` cho hình chuẩn — dùng `shape`. Xem [v1-shape-guide.md](./v1-shape-guide.md).

---

## Ba phần của một path

| Phần | Việc |
| --- | --- |
| `frame` | Hộp kích thước trước transform |
| `payload` | Hình vector (`contours`, `fillRule`, `morphTargets?`) |
| `style` | Tô (`fill` / `stroke`) |

`transform` / `appearance` / `timing` / `zIndex` giống mọi visual layer.

Không có `payload.geometry`. Contour nằm thẳng trên `payload`.

---

## Rule chốt: không `payload.color`

Màu path **chỉ** nằm ở:

- `style.fill`
- `style.stroke`

Giống shape. `payload.color` dành cho text / solid.

---

## Payload

```json
{
  "contours": [
    {
      "id": "c1",
      "start": { "x": 20, "y": 20 },
      "segments": [
        { "kind": "line", "to": { "x": 180, "y": 20 } },
        { "kind": "line", "to": { "x": 180, "y": 100 } },
        { "kind": "line", "to": { "x": 20, "y": 100 } }
      ],
      "closed": true
    }
  ],
  "fillRule": "nonzero"
}
```

| Field | Vai trò |
| --- | --- |
| `contours` | Các đường con trong cùng layer. Tối thiểu 1. `id` unique. |
| `fillRule` | `nonzero` (mặc định) hoặc `evenodd` |
| `morphTargets` | Advanced. Không dùng trong ví dụ AI mặc định |

Điểm path (`start`, `to`, `control1`, `control2`) là tọa độ **local pixel trong frame**, không phải 0..1 như polygon.

---

## Contour

Một contour = một nét liên tục.

- `start` — điểm bắt đầu
- `segments` — các đoạn nối tiếp sau `start` (tối thiểu 1)
- `closed` — `true` khép kín, `false` hở

Một path có thể có một hoặc nhiều contour (lỗ, icon nhiều mảng).

### Segment V1

**Line**

```json
{ "kind": "line", "to": { "x": 100, "y": 0 } }
```

**Cubic Bezier**

```json
{
  "kind": "cubic",
  "control1": { "x": 40, "y": 0 },
  "control2": { "x": 60, "y": 100 },
  "to": { "x": 100, "y": 100 }
}
```

Không có quadratic / arc riêng trong V1 — xấp xỉ bằng cubic nếu cần.

---

## fillRule

- `nonzero` — mặc định, winding rule
- `evenodd` — lỗ xen kẽ

Đây là khái niệm vector chuẩn, thuộc V1 canonical.

---

## Style

AI mặc định:

- `fill`
- `stroke`
- `strokeWidth`

Nâng cao (schema vẫn nhận): `fillOpacity`, `strokeOpacity`, `lineCap`, `lineJoin`, `miterLimit`, `dash`, `dashOffset`, gradient fill.

Path hở thường chỉ `stroke` + `strokeWidth`, không `fill`.

---

## Ví dụ

### Path kín, fill + stroke

```json
{
  "id": "path_1",
  "type": "path",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 200, "height": 120 },
  "transform": {
    "translate": { "x": 300, "y": 140 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "contours": [
      {
        "id": "c1",
        "start": { "x": 20, "y": 20 },
        "segments": [
          { "kind": "line", "to": { "x": 180, "y": 20 } },
          { "kind": "line", "to": { "x": 180, "y": 100 } },
          { "kind": "line", "to": { "x": 20, "y": 100 } }
        ],
        "closed": true
      }
    ],
    "fillRule": "nonzero"
  },
  "style": {
    "fill": "#FF7A00",
    "stroke": "#111111",
    "strokeWidth": 4
  }
}
```

### Path hở, chỉ stroke (cubic)

```json
{
  "id": "curve_1",
  "type": "path",
  "parentLayerId": null,
  "zIndex": 2,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 240, "height": 140 },
  "transform": {
    "translate": { "x": 600, "y": 160 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "contours": [
      {
        "id": "c1",
        "start": { "x": 20, "y": 100 },
        "segments": [
          {
            "kind": "cubic",
            "control1": { "x": 60, "y": 20 },
            "control2": { "x": 160, "y": 20 },
            "to": { "x": 220, "y": 100 }
          }
        ],
        "closed": false
      }
    ],
    "fillRule": "nonzero"
  },
  "style": {
    "stroke": "#00C2FF",
    "strokeWidth": 6
  }
}
```

---

## Morph (advanced)

`morphTargets` được phép trong schema. Không đưa vào ví dụ AI mặc định.

Mỗi target là một bộ `contours` thay thế. Morph hợp lệ khi topology khớp **base**:

- cùng số contour
- cùng thứ tự (cùng `id` theo index)
- cùng `closed` từng contour
- cùng số segment
- cùng `kind` segment tại từng vị trí

Điểm (`start` / `to` / control) được nội suy; cấu trúc đoạn thì không.

---

## Không thuộc V1 authoring mặc định

- `payload.geometry` wrapper
- `trim` trên payload (nếu có, thuộc runtime / nâng cao sau)
- `payload.color`
- quadratic / arc segment
- generic `modifier`

---

## Xem thêm

- [v1-shape-guide.md](./v1-shape-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
