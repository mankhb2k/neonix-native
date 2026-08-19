# NeonVideo V1 Effects

> Trạng thái: v1
>
> Mục tiêu: xử lý pixel trên visual layer. Không đổi frame, layout, transform, appearance, compositing.

---

## Đã chốt

- `effects` là mảng có thứ tự. Runtime giữ đúng thứ tự authoring.
- Mỗi effect có `id` ổn định, unique trên layer. Animation theo `effects.<id>.field`, không theo index.
- Chỉ numeric leaf được keyframe linear. Không animate cả object. Không animate `color` của effect trong V1.
- Họ: `blur`, `shadow` (outer), `glow` (outer), `inner-glow`, `noise`, `color-adjust`.
- Áp dụng visual layer (kể cả group/component). Không audio. Camera không phải bề mặt authoring effects V1.
- Authoring chỉ ghi `effects`. Isolation/offscreen là việc engine, không thêm field JSON.

**Câu chốt:** appearance = hiện/mờ. compositing = blend/mask. effects = xử lý bề mặt pixel.

---

## Bề mặt chung

```json
{
  "effects": [
    { "id": "fx-blur-1", "type": "blur", "radius": 12 }
  ]
}
```

Property path: `effects.fx-blur-1.radius`, `effects.fx-shadow-1.offset.x`.

Animate đúng: leaf số (`radius`, `offset.x`, `opacity`, `hue-rotate`).  
Không dùng V1: `effects.fx-shadow-1.offset`, `effects.fx-glow-1.color`.

---

## Blur

Làm mờ nội dung layer. Không hướng, không inner/outer, không `radiusX`/`radiusY`.

```json
{ "id": "fx-blur-1", "type": "blur", "radius": 12 }
```

Animate: `effects.fx-blur-1.radius` (linear).

---

## Shadow

Bóng **ngoài**. Hướng qua `offset`. Không inner / spread / angle / distance.

```json
{
  "id": "fx-shadow-1",
  "type": "shadow",
  "offset": { "x": 8, "y": 12 },
  "blur": 24,
  "color": "#000000",
  "opacity": 25
}
```

Animate (linear): `offset.x`, `offset.y`, `blur`, `opacity`. Không animate `color`.

---

## Glow

Outer glow — halo đều ra ngoài silhouette. Inner glow là type `inner-glow` riêng, không phải flag. Không `intensity` (dùng `opacity`).

```json
{
  "id": "fx-glow-1",
  "type": "glow",
  "radius": 16,
  "color": "#ffffff",
  "opacity": 80
}
```

Animate (linear): `radius`, `opacity`. Không animate `color`.

---

## Inner glow

Halo đều vào trong silhouette. Không inflate bounds. Không `intensity` / spread / choke.

```json
{
  "id": "fx-inner-glow-1",
  "type": "inner-glow",
  "radius": 18,
  "color": "#A855FF",
  "opacity": 60
}
```

Animate (linear): `radius`, `opacity`. Không animate `color`.

---

## Noise

Grain overlay trên pixel opaque của layer (`alpha > 0`). Không phải full-screen grain mặc định. Muốn grain cả frame: gắn `noise` lên shape/solid full-frame, không gắn vào card nhỏ. Không seed trên JSON. Runtime hash `metadata.id` + `layer.id` + `effect.id` + (`animated` ? frame : 0). Không displacement / glitch / chromatic / scanline.

```json
{
  "id": "fx-noise-1",
  "type": "noise",
  "amount": 12,
  "scale": 1,
  "opacity": 25,
  "animated": true
}
```

Animate (linear): `amount`, `scale`, `opacity`. Không animate `animated` (boolean, default `false`).

---

## Color adjust

Chỉnh màu pixel. Identity: brightness/contrast/saturation `100`, `hue-rotate` `0`. Range: 0..200 và hue −180..180.

```json
{
  "id": "fx-color-1",
  "type": "color-adjust",
  "brightness": 100,
  "contrast": 100,
  "saturation": 100,
  "hue-rotate": 0
}
```

Animate (linear): cả bốn field. Không exposure / gamma / curves / …

---

## Xem thêm

- [v1-cyber-recipe.md](./v1-cyber-recipe.md)
- [v1-appearance-guide.md](./v1-appearance-guide.md)
- [v1-compositing-guide.md](./v1-compositing-guide.md)
- [v1-production-surface-guide.md](./v1-production-surface-guide.md)
