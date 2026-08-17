# NeonVideo V1 Text

> Trạng thái: v1
>
> Mục tiêu: một hộp chữ, một đoạn text, một style chung.

---

## Đã chốt

- `text` là visual leaf. Nó hiển thị một đoạn chữ với một style chung.
- Cần 2 style khác nhau → 2 text layer. Không rich text, không runs.
- Canonical layer: `frame`, `transform`, `appearance`, `payload`.
- String prop bind vào `payload.text`.

---

## Payload

```json
{
  "text": "Hello world",
  "fontAssetId": "font_inter",
  "fontSize": 64,
  "color": "#111111",
  "alignment": "left",
  "wrap": "word",
  "lineHeight": 72,
  "letterSpacing": 0,
  "maxLines": 2,
  "overflow": "clip"
}
```

| Field | Ý nghĩa |
| --- | --- |
| `text` | Nội dung chữ |
| `fontAssetId` | Font dùng để render |
| `fontSize` | Cỡ chữ |
| `color` | Màu chữ |
| `alignment` | `left` \| `center` \| `right` |
| `wrap` | `none` \| `word` \| `character` |
| `lineHeight` | Khoảng cách dòng |
| `letterSpacing` | Khoảng cách ký tự |
| `maxLines` | Số dòng tối đa |
| `overflow` | `visible` \| `clip` \| `ellipsis` |

Mặc định: `alignment` left, `wrap` word, `overflow` clip, `color` `#000000`. `fontSize` và `text` bắt buộc.

---

## Ví dụ layer

```json
{
  "id": "title_1",
  "type": "text",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 800, "height": 120 },
  "transform": {
    "translate": { "x": 120, "y": 80 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  },
  "appearance": { "visible": true, "opacity": 100 },
  "payload": {
    "text": "Hello world",
    "fontAssetId": "font_inter",
    "fontSize": 64,
    "color": "#111111",
    "alignment": "left",
    "wrap": "word",
    "lineHeight": 72,
    "letterSpacing": 0,
    "overflow": "clip"
  }
}
```

---

## Không thuộc V1

`content.kind`, `runs`, `run.style`, rich text nhiều đoạn, highlight từng đoạn, font khác nhau trong cùng một text layer.

Muốn một chữ đỏ / một chữ xanh / một chữ to hơn → nhiều text layer.

---

## Xem thêm

- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-variables-bindings-guide.md](./v1-variables-bindings-guide.md)
