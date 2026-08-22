# Review Schema — AI Authoring Guide

Kế hoạch bộ guide cho AI tạo JSON. Các mục **đã chốt** trỏ thẳng vào guide hiện hành — đừng viết lại semantic cũ.

---

## 1. Layers — đã chốt một phần

V1 là **layers-only**. Nguồn:

- [docs/guide/v2-architechture.md](docs/guide/v2-architechture.md)

Đã chốt:

- Mọi layer: `zIndex` + `timing` bắt buộc. Nested `zIndex >= 0`. Unique trong siblings.
- Child timing local to parent; effective = giao cửa sổ.
- `frame` = size box local trước transform. Bắt buộc mọi visual layer (kể cả group); không clip; không suy từ children. Cấm audio/camera.
- `transform` = hình học visual chung. Audio không có. Scale âm = lật. `depth` ≠ `zIndex`.
- `group` = visual container, ≥1 child, không clip mặc định.
- `semantic` = metadata, không đổi paint.
- Không emit `locked` trong JSON authoring.

Còn mở (không dạy AI mặc định): `inheritFlags`, `modifiers` safe subset, production matrix preview/export.

---

## 2. Properties / Atoms

Sau layer, bổ sung vocabulary đóng:

- `transform`
- `appearance`
- `compositing`
- `effects`
- `modifiers` (chưa có safe subset)

**Mục tiêu:** property nào hợp lệ / animatable / bindable, ví dụ đúng và sai.

---

## 3. Variables & Bindings

The V1 component guide was retired. Components belong to future high-level
authoring and must lower to certified Atomic V2 atoms.

- Literal vs variable
- `target.type: layer` vs `componentLayer`
- Lỗi type-mismatch thường gặp

---

## 4. Safe Animation

- `keyframes`, `easing`, `tracks`
- Local time vs global time (`0..layer.timing.duration`)
- Subset AI nên dùng mặc định

---

## 5. Asset Authoring

The V1 asset-storage guide was retired. Future V2 asset authoring must be
specified only after image/video atoms are certified.

---

## 6. Production Support Matrix

- `schema-valid` / `preview-safe` / `export-safe` / `not recommended for AI`
