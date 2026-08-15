# MotiClip V1 Transform

> Trạng thái: v1
>
> Mục tiêu: `transform` là primitive hình học chung cho mọi visual layer.

---

## Câu chốt

`frame` trả lời box local rộng/cao bao nhiêu.  
`transform` trả lời box đó được đặt, xoay, nghiêng, scale và nằm sâu bao nhiêu trong không gian cha.

`transform` không phải layout, timing, effect, và không quyết định paint order (`zIndex`).

Áp dụng cùng một cấu trúc cho: group, component, text, image, svg, video, shape, path, solid, bone, adjustment. **Audio không có `transform`.**

---

## Schema

```json
{
  "transform": {
    "translate": { "x": 0, "y": 0 },
    "scale": { "x": 1, "y": 1 },
    "rotate": { "z": 0 },
    "skew": { "x": 0, "y": 0 },
    "origin": { "x": 0.5, "y": 0.5 },
    "depth": 0
  }
}
```

| Field | Nghĩa |
| --- | --- |
| `translate.x/y` | Vị trí trong không gian cha (px) |
| `scale.x/y` | Tỷ lệ theo trục. `1` = gốc. Âm = lật (`-1` ngang/dọc). Không `flipX`/`flipY` |
| `rotate.z` | Xoay 2D quanh Z (độ). Không `rotate.x/y` |
| `skew.x/y` | Nghiêng (độ) |
| `origin.x/y` | Điểm neo trong box local, normalized `0..1`. AI ưu tiên `0` \| `0.5` \| `1` |
| `depth` | Z logic trong không gian cha (parallax / camera). Không thay `zIndex` |

`origin`: `(0,0)` góc trái trên; `(0.5,0.5)` tâm; `(1,1)` góc phải dưới.

---

## `depth` vs `zIndex`

| | `zIndex` | `depth` |
| --- | --- | --- |
| Việc | Lane / paint order | Vị trí không gian |
| Luật | Số lớn hơn vẽ trên, cùng sibling scope | Hình học / camera / parallax |
| Không | Không phải vị trí Z | Không đổi thứ tự vẽ |

Không gộp hai field.

---

## Pipeline

1. Có `frame` và nội dung local trong frame  
2. Chọn `origin` trong box  
3. Áp `scale`, `rotate`, `skew` quanh origin  
4. Áp `translate` và `depth` vào không gian cha  

Mọi transform **local theo cha**. Child compose với cha. `group.transform` áp cả subtree; `component.transform` áp cả instance niêm phong. Leaf dùng cùng contract.

---

## Layout

Layout tính placement / base size **trước**. Transform áp **sau**. Layout = luật xếp; transform = hình học cuối của từng layer.

---

## Không có trong V1

`flipX` / `flipY`, matrix, perspective trên transform, 3D rotate (`x`/`y`), transform modifier.

---

## Production

Mọi visual layer bắt buộc `transform` cùng cấu trúc trên. AI ghi `origin` chuẩn `0` \| `0.5` \| `1`. Scale âm để lật. Skew và `depth` thuộc V1. Không invent `transform.z` / `transform.x`.

---

## Xem thêm

- [v1-frame-guide.md](./v1-frame-guide.md)
- [v1-layout-guide.md](./v1-layout-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
