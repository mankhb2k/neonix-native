# MotiClip V1 Path

> Trạng thái: nháp
>
> Mục tiêu: chốt `path` là layer vector tự do và đặt hành vi hình học vào `payload.geometry`.

---

## Path là gì

`path` là layer hình học vector tự do.

Khác với `shape`:

- `shape` dùng cho primitive chuẩn như rectangle, ellipse, polygon
- `path` dùng cho hình được mô tả bằng các điểm và các đoạn path

Nói ngắn:

- `shape` = hình có công thức sẵn
- `path` = hình được dựng từ đường vector

`path` chỉ nên chịu trách nhiệm cho:

- hình học vector của chính nó
- style fill/stroke của chính nó
- các hành vi native của path nếu cần

`path` không nên ôm:

- layout
- media playback
- relationship logic chung
- generic `modifier`

---

## Payload là gì

`payload` là phần dữ liệu riêng của `path`.

Field chung của layer ở bên ngoài:

- `timing`
- `zIndex`
- `frame`
- `transform`
- `appearance`
- `compositing`
- `effects`

Field riêng của `path` ở trong `payload`.

---

## Geometry là gì

Trong `path`, dữ liệu hình học nên nằm trong `payload.geometry`.

Lý do:

- `contours` là hình học
- `trim` là hành vi hình học của path
- nếu sau này giữ `morph` hay `bend`, đó cũng là hành vi hình học

Vì vậy `geometry` là nơi đúng nhất để chứa những thứ này.

---

## Đã chốt

- `path` là layer vector tự do.
- `path` không dùng generic `modifier` trong authoring surface.
- `payload` là nơi chứa dữ liệu riêng của `path`.
- Hình học path nằm trong `payload.geometry`.
- `payload.geometry.contours` là dữ liệu hình học cốt lõi.
- `trim`, nếu giữ, thuộc về `payload.geometry`.
- `frame` vẫn là size box của path layer.

---

## Shape dữ liệu đang hướng tới

```jsonc
{
  "type": "path",
  "frame": { "width": 400, "height": 200 },
  "payload": {
    "geometry": {
      "contours": [
        /* ... */
      ],
      "trim": {
        "start": 0,
        "end": 1,
        "offset": 0
      }
    }
  },
  "style": {
    "stroke": "#ffffff",
    "strokeWidth": 4
  }
}
```

---

## Trim là gì

`trim` là cách chỉ hiển thị một đoạn của path thay vì toàn bộ path.

Ví dụ:

- `start = 0`
- `end = 0.5`

thì chỉ hiện nửa đầu của path.

`trim` là path-native behavior:

- không đổi layer type
- không phải transform
- không phải effect
- không phải concept generic

Nó hợp với các case:

- line reveal
- draw-on
- loading ring
- path write-on

---

## Còn mở

- Shape cuối cùng của `payload.geometry.trim`.
- `morph` sẽ được chốt sau.
- `bend` sẽ được chốt sau.
- `style` sẽ tiếp tục ở ngoài hay gom cách khác trong guide shape/path chung.

---

## Xem thêm

- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-shape-guide.md](./v1-shape-guide.md)
