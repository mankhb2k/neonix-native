# MotiClip V1 Image

> Trạng thái: v1
>
> Mục tiêu: layer ảnh — nguồn, hộp, fit, crop.

---

## Khái niệm

`image` là visual leaf **hiển thị một asset ảnh**.

- Nguồn: `payload.assetId`
- Hộp hiển thị: `frame`
- Cách ảnh nằm trong hộp: `payload.fit`
- Cắt nguồn (nếu cần): `payload.crop`

Không nhầm:

| | Việc |
| --- | --- |
| `assetId` | Ảnh nguồn |
| `frame` | Box hiển thị trên layer |
| `fit` | Ảnh nằm trong box thế nào |
| `crop` | Lấy vùng nào của nguồn |
| `transform` | Biến đổi toàn layer sau khi đã đặt vào frame |

---

## Cấu trúc

```json
{
  "id": "image_1",
  "type": "image",
  "parentLayerId": null,
  "zIndex": 1,
  "timing": { "start": 0, "duration": 90 },
  "frame": { "width": 400, "height": 300 },
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
    "assetId": "img_hero",
    "fit": "cover"
  }
}
```

Image **không có** `style`. Không `fill` / `stroke`.

---

## fit

Giá trị V1: `contain` | `cover` | `fill` | `none`.

Mặc định: **`cover`**.

| `fit` | Ý nghĩa |
| --- | --- |
| `contain` | Giữ tỷ lệ, nằm gọn trong frame |
| `cover` | Giữ tỷ lệ, phủ kín frame, có thể bị cắt |
| `fill` | Lấp đầy frame, có thể méo |
| `none` | Không tự fit |

---

## crop

Tùy chọn. Cắt **nguồn ảnh**, không đổi `frame`.

Tọa độ chuẩn hóa `0..1` trên asset:

```json
"crop": {
  "x": 0.1,
  "y": 0.1,
  "width": 0.8,
  "height": 0.8
}
```

`x` / `y` là góc trên trái của vùng lấy; `width` / `height` là kích thước vùng trên nguồn.

---

## PNG transparent

`fit` luôn tính theo **toàn bộ hình chữ nhật asset**.

V1 không:

- tự bỏ qua vùng transparent
- auto-trim vùng rỗng

Muốn bỏ vùng trong suốt: ghi `crop`, hoặc cắt lúc import/preprocess. Không phải hành vi mặc định của image.

---

## Không thuộc V1 canonical

- `style` / `fill` / `stroke` trên image
- auto-detect non-transparent bounds
- `object-position` riêng
- `radius` trên `payload` image (bo góc dùng mask / shape khác, không field image)

---

## Câu chốt

`frame` là box hiển thị. `assetId` là nguồn. `fit` đặt ảnh trong box. `crop` chọn vùng nguồn. `transform` biến đổi layer sau đó. PNG transparent vẫn fit theo full asset rectangle.

---

## Xem thêm

- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-video-guide.md](./v1-video-guide.md)
- [v1-svg-guide.md](./v1-svg-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
