# Bản đồ guide MotiClip V1

> Trạng thái: bản đồ nháp cho bề mặt authoring V1.
>
> Mục tiêu: nhìn hết các guide cần có để AI viết JSON đúng contract.

---

## Guide cốt lõi đang dùng

Các file này đã có và là nguồn sự thật đang chạy:

- [v1-format-guide.md](./v1-format-guide.md)
- [v1-timeline-guide.md](./v1-timeline-guide.md)
- [v1-component-guide.md](./v1-component-guide.md)
- [v1-group-guide.md](./v1-group-guide.md)
- [asset-format-storage.md](./asset-format-storage.md)

---

## Guide theo từng domain

Các file này tách từng miền để AI không nhồi mọi thứ vào một tài liệu.

| File | Phạm vi | Trạng thái |
| --- | --- | --- |
| [v1-layer-guide.md](./v1-layer-guide.md) | Mô hình visual layer + cây + timing + zIndex | v1 |
| [v1-frame-guide.md](./v1-frame-guide.md) | `frame` là size box | Nháp |
| [v1-transform-guide.md](./v1-transform-guide.md) | Transform không gian | v1 |
| [v1-appearance-guide.md](./v1-appearance-guide.md) | `visible` + `opacity` (visual only) | v1 |
| [v1-compositing-guide.md](./v1-compositing-guide.md) | Blend, isolation, mask | v1 |
| [v1-effects-guide.md](./v1-effects-guide.md) | Hiệu ứng điểm ảnh | v1 |
| [v1-shape-guide.md](./v1-shape-guide.md) | Rectangle / ellipse / polygon; paint trên style | v1 |
| [v1-path-guide.md](./v1-path-guide.md) | Vector tự do: contours, fillRule, paint trên style | v1 |
| [v1-text-guide.md](./v1-text-guide.md) | Một hộp, một đoạn, một style | v1 |
| [v1-image-guide.md](./v1-image-guide.md) | Ảnh: assetId, fit, crop 0..1; không style | v1 |
| [v1-svg-guide.md](./v1-svg-guide.md) | SVG asset: fit + style.fill recolor; không internals | v1 |
| [v1-video-guide.md](./v1-video-guide.md) | Video: fit + trim/loop/muted; không crop | v1 |
| [v1-audio-guide.md](./v1-audio-guide.md) | Audio root-only, không visual | v1 |
| [v1-layout-guide.md](./v1-layout-guide.md) | Layout của container và con | Nháp |
| [v1-variables-bindings-guide.md](./v1-variables-bindings-guide.md) | Biến và binding | v1 |
| [v1-animation-keyframes-guide.md](./v1-animation-keyframes-guide.md) | timeline.clips + prop keyframes; interpolation cứng | v1 |
| [v1-compiler-runtime-guide.md](./v1-compiler-runtime-guide.md) | Compiler emit + runtime IR; không mở rộng protocol | v1 |
| [v1-production-surface-guide.md](./v1-production-surface-guide.md) | Bề mặt AI mặc định / nâng cao | Nháp |

---

## Quyết định đã chốt

- `modifier` không thuộc bề mặt authoring ưu tiên.
- Hành vi hình học, layout, media nằm trên object sở hữu chúng, không nhét generic modifier.
- `frame` là size box, không phải khái niệm container.
- `group` là visual container có children, không phải clipping box.
- Không ghi `locked` vào JSON authoring.
- `semantic` chỉ là metadata, không đổi cách vẽ.
- Mọi layer bắt buộc `zIndex` và `timing`.
- Child timing tính local theo cha; cửa sổ hiệu lực là phần giao.
- `layout` chỉ trên `group`; `layoutItem` trên child visual. Không phải modifier.
- `transform` chung cho mọi visual layer; audio không có. Scale âm = lật. `depth` ≠ `zIndex`.
- `appearance` chỉ `visible` + `opacity` trên visual layer. Audio không có appearance. Protocol không định nghĩa hit-test.
- `compositing` tách khỏi appearance/effects: `blend-mode`, `isolation`, `mask`. AI mặc định: blend khi cần; mask `clip`/`alpha` + `mask-only`; không emit isolation.
- Component instance = leaf + wrapper atoms. Props = ruột public. Variant = preset props. Project binding chỉ `type: "prop"`.
- Binding = variable → public prop. Kinds: string, number, boolean, color, asset, choice.
- Effects = pixel stack có thứ tự. Animate `effects.<id>.field`. Glow không intensity. Không effects trên camera/audio.
- Animation layer/property = `timeline.clips`. Prop = `payload.props` keyframes. `t` local. Không animate frame/trim/fit.
- Compiler/runtime chỉ thực thi protocol. Runtime không modifier; tracks là IR nội bộ.

---

## Thứ tự thảo luận tiếp

1. Path native (`trim` / `morph` trên payload) vs SVG asset
2. Guide text / media / audio
3. Bề mặt production allowlist còn lại
