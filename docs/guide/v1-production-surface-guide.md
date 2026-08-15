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
- Component: instance leaf với đủ wrapper atoms. Default AI set `payload.props` (+ `variantId`) bằng literal/keyframes. Variant chỉ override props. `project.bindings` chỉ `type: "prop"`. Nested chỉ `childProp`. Không `component.variables`, không inline variable ref.
- Image: một asset ảnh trong `frame`. `payload.assetId` + `payload.fit` (`contain`/`cover`/`fill`/`none`, mặc định `cover`) + `payload.crop?` (0..1 trên nguồn). Không `style`. Fit theo full asset rectangle, kể cả PNG trong suốt. Không auto-trim alpha.
- SVG: asset vector placement, không phải shape/path. `payload.assetId` + `payload.fit` (mặc định `contain`) + `style.fill?` recolor đơn giản. Không crop, không `payload.color`, không stroke, không sửa internals.
- Path: vector tự do. `frame` + `payload.contours` / `fillRule` + `style`. Không `payload.color`. Segment `line` \| `cubic`. `morphTargets` nâng cao, topology phải khớp base. AI mặc định `style.fill` / `stroke` / `strokeWidth`.
- Shape: rectangle / ellipse / polygon. `frame` + `payload` geometry + `style` paint. Không `payload.color`. AI mặc định `style.fill` / `stroke` / `strokeWidth`. Polygon `points` 0..1 theo frame.
- Text: một hộp, một `payload.text`, một style. Không runs / rich text. String sink: `payload.text`.
- Binding: variable → public prop. Prop kinds V1: string, number, boolean, color, asset, choice. Không bind layer field / internals.
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
