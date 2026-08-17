# NeonVideo V1 Compositing

> Trạng thái: v1
>
> Mục tiêu: cách visual layer chồng lên nhau lúc vẽ. Schema giữ nguyên; guide này chốt bề mặt AI.

---

## Đã chốt

- `compositing` là lớp riêng trên visual layer. Tách khỏi `appearance` và `effects`.
- Object gồm đúng 3 field: `blend-mode`, `isolation`, `mask`.
- Group **không** clip theo `frame`. Muốn cắt / lộ: `compositing.mask`.
- Schema và graph validation **giữ nguyên**. Guide chỉ thu hẹp bề mặt AI mặc định.

**Câu chốt:** compositing là blend + isolation + mask. Không phải opacity, không phải blur.

---

## Tách miền

| Lớp | Field |
| --- | --- |
| `appearance` | `visible`, `opacity` |
| `compositing` | `blend-mode`, `isolation`, `mask` |
| `effects` | `blur`, `shadow`, `glow`, `inner-glow`, `noise`, `color-adjust` |
| media `payload` | `fit`, `crop` |

Không nhét vào compositing: blur, shadow, glow, brightness, color-adjust, opacity, visibility, crop, fit.

---

## `blend-mode`

Schema (đủ, không mở rộng):

`normal` | `multiply` | `screen` | `add` | `darken` | `lighten` | `overlay`

Cả bảy mode đều production-safe và được AI dùng khi cần. Mặc định schema: `normal`. Không emit nếu đang `normal`.

---

## `isolation`

Schema: `auto` | `isolate`. Mặc định: `auto`.

**Advanced.** AI không emit `isolation` mặc định. Runtime/engine dùng `auto`. Chỉ ghi `isolate` khi thật sự cần tách scope blend / mask / effect.

---

## `mask`

Giữ trong v1. Không mask thì clip/reveal sẽ làm bẩn `group` hoặc `frame`.

Schema:

- `sourceLayerId` — bắt buộc
- `mode`: `clip` | `alpha` | `inverse-alpha` | `luma` | `inverse-luma`
- `source-visibility`: `mask-only` | `content-and-mask`

Graph validation (đã có, giữ nguyên):

- không self-mask
- source phải tồn tại
- source type: `path` | `shape` | `solid` | `group` | `component`

### AI mặc định (production-safe)

- `mode`: `clip` hoặc `alpha`
- `source-visibility`: `mask-only`

### Schema-valid nhưng nâng cao

- `mode`: `inverse-alpha`, `luma`, `inverse-luma`
- `source-visibility`: `content-and-mask` (dễ nhiễu kết quả vẽ)

```json
{
  "compositing": {
    "blend-mode": "multiply",
    "mask": {
      "sourceLayerId": "cutout",
      "mode": "alpha",
      "source-visibility": "mask-only"
    }
  }
}
```

Không ghi `isolation` trong ví dụ mặc định.

---

## Xem thêm

- [v1-appearance-guide.md](./v1-appearance-guide.md)
- [v1-effects-guide.md](./v1-effects-guide.md)
- [v1-group-guide.md](./v1-group-guide.md)
- [v1-production-surface-guide.md](./v1-production-surface-guide.md)
- [v1-layer-guide.md](./v1-layer-guide.md)
