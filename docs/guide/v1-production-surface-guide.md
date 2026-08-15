# MotiClip V1 Bề mặt production

> Trạng thái: nháp
>
> Mục tiêu: AI dùng gì mặc định, cái gì nâng cao / nội bộ.

---

## Guide này cần chốt

- Feature nào an toàn mặc định
- Feature nào nâng cao nhưng vẫn cho phép
- Feature schema-valid nhưng không khuyến khích AI mặc định
- Preview-safe khác export-safe thế nào

---

## Đã chốt

- Bề mặt AI mặc định **nhỏ hơn** full schema.
- Generic `modifier` không thuộc JSON authoring V1 (chỉ runtime IR).
- Field native theo domain được ưu tiên hơn bucket extension.
- AI luôn ghi: `id`, `name`, `type`, `parentLayerId`, `zIndex`, `timing`.
- AI ghi `frame` trên mọi visual layer (kể cả group). Không ghi trên audio/camera. Không suy group.frame từ children.
- AI không ghi `locked`.
- `semantic` tùy chọn; không dùng để “vẽ khác”.
- `inheritFlags` không dùng trừ khi user/tool cố ý. Không emit `modifiers`.
- Layout: chỉ `group.layout` + child `layoutItem`. Field: `mode`, `gap`, `padding`, `justify`, `align`, size `fixed|hug|fill`, `alignSelf`, min/max. Grid cần `columns`. Không `wrap` / `grow` / `shrink` / span.
- Transform: mọi visual layer cùng `{ translate, scale, rotate.z, skew, origin, depth }`. Lật bằng scale âm. Origin AI: `0` \| `0.5` \| `1`. Không `flipX/Y`, không `transform.z`.
- Appearance: chỉ `visible` + `opacity` trên visual layer. Integer opacity `0..100`. Không hit-test. Audio không có `appearance`; mute/volume trên payload.
- Compositing: `blend-mode` + `isolation` + `mask`. Tách khỏi appearance/effects. Blend 7 mode hiện tại là production-safe, không mở rộng. AI mặc định mask: `clip`/`alpha` + `mask-only`. Không emit `isolation` trừ khi cần `isolate`. `inverse-alpha` / `luma` / `inverse-luma` / `content-and-mask` là nâng cao.
- Component: instance leaf với đủ wrapper atoms. Default AI set `payload.props` (+ `variantId`). Variant chỉ override props. `project.bindings` → `componentLayer.propId` là advanced. Nested chỉ `childProp`.
- Effects: mảng có thứ tự, id unique. `blur` / outer `shadow` / outer `glow` / `color-adjust`. Animate numeric leaf theo `effects.<id>.*`. Không animate color. Glow không `intensity`. Không effects trên audio/camera.

---

## Còn mở

- Allowlist production-ready đợt đầu (từng field từng type).
- Nhãn `preview-safe` / `export-safe` theo domain.
- Field nâng cao vẫn document nhưng không đưa vào ví dụ mặc định.

---

## Xem thêm

- [v1-layer-guide.md](./v1-layer-guide.md)
- [v1-format-guide.md](./v1-format-guide.md)
- [README.md](./README.md)
