# Protocol Guide — `motion-protocol/src`

Hướng dẫn này mô tả **nhiệm vụ của từng file** trong `packages/motion-protocol/src`, bỏ qua `.test.ts`, `__tests__`, `__fixtures__`.

> **Nguyên tắc:**
>
> - Mỗi file `.ts` (không phải barrel `index.ts`) sở hữu **một domain schema**.
> - `*-types.ts` chỉ chứa `z.infer`, tách để tránh circular import.
> - `index.ts` trong folder là barrel (hoặc ghép schema từ atom files).
> - V1 (`src/v1`) = authoring JSON. Runtime (`src/runtime`) = IR renderer. Compile nằm ở `@motionvideo/motion-compiler`.

**Percent / độ (authoring):** `appearance.opacity`, `payload.volume`, glow/shadow opacity = integer **0..100** (100 = full). Color-adjust + adjustment payload brightness/contrast/saturation = integer **0..200** (100 = normal). `hue-rotate` = **-180..180** độ. Paint/audio: `ratioFromPercent(n) = n/100`.

---

## 1. Thư mục gốc `src/`

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Public authoring API (`.`). Runtime không export ở đây. |
| `internal.ts` | Barrel `@motionvideo/motion-protocol/internal` — compiler `animation/clips`, `captions`. Authoring clips: `v1/timeline/clips.ts`. |
| `capabilities.ts` | `MOTION_PROTOCOL_LIMITS` + bảng `motionPropertyCapability` / `motionEffectPropertyCapability`. |
| `ai-schema-capability.ts` | Ma trận E2E AI schema (`ai-schema.1`). |
| `scene-registry.ts` | Legacy template registry — không còn trên public barrel. |

---

## 2. `src/v1/` — Authoring Protocol

### 2.1 File gốc (không nằm trong folder con)

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Barrel V1 — layers, assets, components, patch, MCP. Không export captions / motion-clip units. |
| `common.ts` | Primitive: `IdSchema`, `FiniteNumberSchema`, `PercentSchema` (0..100 int), `ColorAdjustPercentSchema` (0..200 int), `HueRotateSchema` (−180..180), `ratioFromPercent`, `MOTION_PROJECT_V1_FORMAT_VERSION`. |
| `values.ts` | `JsonValueSchema`, `LiteralValueSchema`. Prop values không dùng `VariableReferenceSchema`. |
| `frame.ts` | `FrameSchema` — `{ width, height }` size box trước transform. Bắt buộc mọi visual layer; cấm audio/camera. |
| `layer-atoms.ts` | Helper test/fixture `visualLayerAtoms()` / `defaultTransform()`. |
| `layout.ts` | Repeater (khác `frame`) + `layout` / `layoutItem` native (`mode` row/column/grid). |
| `canonical-hash.ts` | Hash deterministic (`projectHash` / `runtimeHash`). Exclude timestamp/provenance/extensions. |
| `capabilities.ts` | Capability requirements project (`required` / `optional` / `experimental`). |
| `captions.ts` | Legacy caption tokens — không thuộc `project.layers`; export qua `internal`. |
| `composition.ts` | Width/height/fps/background/colorSpace. |
| `design-tokens.ts` | `project.tokens` — colors/fonts/spacing/radii/motion. |
| `extensions.ts` | `NamespacedExtensionsSchema` — không vào render hash. |
| `metadata.ts` | `ProjectMetadataV1Schema`. |
| `mcp.ts` | MCP tool contract. |
| `normalize-input.ts` | Normalize text payload trước Zod. |
| `parse.ts` | `parseMotionProjectV1` / `serializeMotionProjectV1`. |
| `patch.ts` | `applyMotionProjectV1Patch`. |
| `project.ts` | Root `MotionProjectV1Schema` (leaf, không barrel cycle). |
| `provenance.ts` | Debug/trace — exclude hash. |
| `source-ref.ts` | Click-to-edit: `layer` \| `text-run`. |
| `types.ts` | Aggregate `MotionProjectV1` viết tay. |
| `variables.ts` | `ProjectVariableV1Schema`, `ProjectBindingV1Schema` (`type: "prop"`). |

**Property path (cũ → mới, không alias):**

| Cũ | Mới |
| --- | --- |
| `transform.x/y` | `transform.translate.x/y` |
| `transform.z` | `transform.depth` |
| `transform.rotation` / `rotationZ` | `transform.rotate.z` |
| `transform.scaleX/Y` | `transform.scale.x/y` |
| `transform.anchorX/Y` | `transform.origin.x/y` |
| `transform.opacity` / `visible` | `appearance.opacity` / `appearance.visible` |
| `transform.width/height` | `frame.width` / `frame.height` |
| `flipX/Y` | `scale.x < 0` / `scale.y < 0` |

### 2.2 `src/v1/transform/`

Geometry only. Không size, opacity, zoom.

**MVP 2.5D (V1 chốt):** cùng một `TransformSchema` cho mọi visual layer. `translate.x/y`, `scale.x/y` (âm = lật), `rotate.z`, `skew.x/y`, `origin.x/y` (0..1; AI ưu tiên 0 / 0.5 / 1), `depth`. `depth > 0` gần người xem. Không phải `zIndex`. Không flipX/Y, matrix, perspective, rotate.x/y, scale.z.

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Ghép `TransformSchema`. |
| `translate.ts` | `{ x, y }` — không `z`. |
| `rotate.ts` | `{ z }` độ (2D). |
| `scale.ts` | `{ x, y }`. Âm = lật trục. |
| `skew.ts` | `{ x, y }`. |
| `origin.ts` | Pivot `{ x, y }` (0..1). |
| `depth.ts` | Pseudo-3D gần/xa; mặc định 0. Không phải `zIndex`. |

### 2.3 `src/v1/appearance/`

Lớp hiển thị tối thiểu của visual layer — không phải compositing, effect, hay hit-test.

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | `AppearanceSchema` = `visible` + `opacity`. |
| `opacity.ts` | `OpacitySchema` = `PercentSchema` (0..100 int, default 100). |
| `visibility.ts` | `VisibilitySchema` boolean (render on/off). |

### 2.4 `src/v1/compositing/`

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | `CompositingSchema` — `blend-mode`, `isolation`, `mask`. Tách appearance/effects. |
| `blend-mode.ts` | 7 mode: normal, multiply, screen, add, darken, lighten, overlay. Không mở rộng. |
| `isolation.ts` | `auto` \| `isolate`. Advanced; mặc định `auto`. |
| `mask.ts` | `sourceLayerId`, mode, `source-visibility`. Graph: path/shape/solid/group/component. |

### 2.5 `src/v1/effects/`

Stack `effects[]`. Không có field `filter` trên layer.

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | `EffectSchema` — mảng có thứ tự; animate `effects.<id>.field`. |
| `blur.ts` | `radius` only. |
| `shadow.ts` | Outer: `offset`, `blur`, `color`, `opacity` default 25. Color không animate. |
| `glow.ts` | Outer: `radius`, `color`, `opacity`. Không `intensity`. |
| `color-adjust.ts` | brightness/contrast/saturation 0..200; `hue-rotate` −180..180. |

### 2.6 `src/v1/assets/`

`assetType` = kind (`image` \| `svg` \| `video` \| `audio` \| `font`). Codec nằm ở `mimeType` (`image/png` \| `image/jpeg` \| `image/webp`). Không có `assetType: "webp"`.

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Union schema + storage policy; `z.infer` per-kind (`ImageAssetV1`, …). |
| `validation.ts` | Envelope authoring/storage. |

### 2.7 `src/v1/components/`

Catalog (definition). Instance layer ở `layers/component.ts`.

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Definition: props, variants (props-only preset), owner `propBindings`, internals. |
| `prop-values.ts` | Literal \| keyframes (`value`, không track `v`). Không inline variable ref. Keyframes = public signal, không wrapper. |

### 2.8 `src/v1/layers/`

Discriminator luôn `type`. Chỉ `group` có `children` (ít nhất một). `audio` root-only (zIndex âm).

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | `LayerV1Schema` union + `GroupLayerV1` gắn `children`. |
| `base.ts` | `LayerBaseV1Schema` — required zIndex, timing, frame, transform; appearance, compositing, effects, inheritFlags, layoutItem. No `locked`, no `modifiers`. |
| `timing.ts` | `LayerTimingSchema` — in/out. |
| `component.ts` | Sealed instance leaf. Wrapper atoms + `payload.componentId` / `variantId?` / `props`. Compiler expand. |
| `audio.ts` | `AudioLayerV1Schema` — root-only, zIndex âm; payload trim/fade/volume/loop/muted. Không frame/transform/appearance. |
| `media.ts` | `image`: `{ assetId, fit` default `cover`, `crop?` `}`. `svg`: `{ assetId, fit` default `contain` `}` + `style.fill?`. `video`: `{ assetId, fit` default `cover`, `trim?`, `loop`/`muted` default false `}`; không crop. `camera` riêng. |
| `geometry.ts` | `shape` (rectangle/ellipse/polygon, points 0..1) + `path` (`contours`, `fillRule`, `morphTargets?`). Không `payload.color`. |
| `geometry-types.ts` | `z.infer` shape/path. |
| `paint.ts` | `FitSchema`, `CropSchema`, `PaintStyleSchema`, `SvgStyleSchema` (chỉ fill). |
| `structural.ts` | `group` (phải có children), `bone`, `solid`, `adjustment`. |
| `structural-types.ts` | `z.infer` structural. |
| `text.ts` | `TextLayerV1Schema`. |
| `text-content.ts` | Payload chữ phẳng: `text` + typography. Không runs. |
| `flatten.ts` | `flattenLayerTree`. |

### 2.9 `src/v1/animation/`

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Barrel easing/drivers/interpolation. |
| `easing.ts` | Named / cubic / spring. |
| `drivers.ts` | `ProceduralDriverSchema` (runtime evaluate). |
| `clips.ts` | **Internal** `MotionClipV1` cho compiler runtime, không thuộc authoring JSON. |

### 2.10 `src/v1/timeline/`

Metadata only + authoring `clips`. Visual/audio sống trên `project.layers`.

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Barrel. |
| `schema.ts` | `duration` / `workArea` / `markers` / `clips`. |
| `clips.ts` | Authoring `timeline.clips` — layer/property keyframes. |
| `duration.ts` | Derive duration từ root layer timing. |
| `canonicalize.ts` | Điền duration thiếu + snap frame-grid. |
| `frame-grid.ts` | Snap/validate thời gian về `n / fps`. |
| `validation.ts` | Integrity timeline (không còn visual/audio/caption tracks). |

### 2.11 `src/v1/references/`

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Barrel. |
| `project.ts` | `validateMotionProjectV1References`. |
| `layer-graph.ts` | Duplicate id, parent, mask, cycle, depth. |
| `layer-assets.ts` | Layer → asset (id/type/trim). |
| `helpers.ts` | `duplicates`, `morphTopologyMismatch`. |
| `types.ts` | `ReferenceIssue`. |

---

## 3. `src/runtime/` — Runtime IR

Literal, renderer-ready. Transform / appearance / compositing / effects **reuse schema V1** (`../../v1/...`). Không còn `runtime/transform.ts` hay `runtime/effects.ts`.

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Barrel `@motionvideo/motion-protocol/runtime`. |
| `common.ts` | Re-export primitive V1 + hằng format version runtime. |
| `assets.ts` | Asset IR (cùng mime image png/jpeg/webp). |
| `helpers.ts` | `duplicates`, `morphTopologyMismatch`. |
| `layout.ts` | Repeater + native `layout` / `layoutItem` (same fields as V1; compiler normally bakes then strips). |
| `modifiers.ts` | Removed from Runtime IR V1. Morph/bend/trim không qua modifier. |
| `prepared.ts` | `PreparedRuntimeProject` — index O(1), không serialize. |
| `project.ts` | `MotionRuntimeProjectSchema`. |
| `values.ts` | JSON / resolvable values. |

### 3.1 `src/runtime/layers/`

| File | Nhiệm vụ |
| --- | --- |
| `index.ts` | Runtime node union theo `type`. |
| `base.ts` | `LayerBaseSchema` — required frame (except camera/audio), layoutItem, V1 transform/appearance/compositing/effects. |
| `audio.ts` | Runtime audio leaf. No appearance. |
| `geometry.ts` | Shape/path (primitive từ V1). |
| `media.ts` | Image / svg / video. |
| `paint.ts` | Fit / crop / paint style. |
| `structural.ts` | Group, bone, solid, adjustment, **camera**, **component**. |
| `text.ts` | Text + text animator. |

---

## 4. Sơ đồ

```text
src/index.ts
     ├── capabilities.ts / ai-schema-capability.ts / internal.ts
     │
     ├── v1/
     │     ├── project.ts / parse.ts / patch.ts / mcp.ts
     │     ├── common.ts / values.ts / frame.ts / variables.ts
     │     ├── transform/ appearance/ compositing/ effects/
     │     ├── assets/ components/ layers/ animation/ timeline/ references/
     │
     └── runtime/
           ├── project.ts / prepared.ts / assets.ts
           └── layers/   (reuse V1 transform/appearance/effects)
```

> V1 → `@motionvideo/motion-compiler` → Runtime IR. `motion-protocol` chỉ schema + validation.
