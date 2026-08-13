# Protocol Guide — `motion-protocol/src`

Hướng dẫn này mô tả **nhiệm vụ của từng file** trong `packages/motion-protocol/src`, bỏ qua các file `.test.ts`. Đây là tài liệu tham khảo nhanh để hiểu cách package được tổ chức theo domain, và file nào sở hữu schema / type nào.

> **Nguyên tắc tổ chức chung:**
>
> - Mỗi file `.ts` (không phải `index.ts`) thường sở hữu **một domain schema** (V1 authoring) hoặc **một domain schema** (runtime IR).
> - Các file `*-types.ts` chỉ chứa type được `z.infer` từ schema, tách riêng để **tránh circular import** giữa union và per-kind schema.
> - `index.ts` là barrel re-export, không chứa logic schema.
> - V1 (`src/v1`) là **authoring protocol duy nhất**; Runtime (`src/runtime`) là **IR cho renderer** (literal, flattened).

---

## 1. Thư mục gốc `src/`

| File                      | Nhiệm vụ                                                                                                                                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`                | Public API surface. Cung cấp alias canonical (`MotionProject`, `Node`, `Scene`, `parseMotionProject`, …) và re-export `capabilities` + AI matrix. Đây là cổng export duy nhất ra ngoài package.                                |
| `capabilities.ts`         | `MOTION_PROTOCOL_LIMITS` (internal, `Object.freeze`): giới hạn cứng cho scenes/layers/clips/tracks/keys… áp dụng cho cả V1 lẫn runtime. Đồng thời chứa bảng đăng ký khả năng thuộc tính (`motionPropertyCapability`) cho AI/UI. |
| `ai-schema-capability.ts` | Ma trận E2E cho AI schema expansion (`ai-schema.1`). Một hàng là "production-ready" khi mọi cột (schema → compiler → runtime → paint → pixi → remotion) đều "yes". AI allowlist chỉ mở khi gate E2E xanh.                      |
| `scene-registry.ts`       | Registry template scene theo role (`hook`, `pain`, `problem`, `solution`, `benefit`, `demo`, …).                                                                                                                               |

---

## 2. `src/v1/` — Authoring Protocol (V1)

### 2.1 File gốc `src/v1/`

| File                 | Nhiệm vụ                                                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.ts`           | Barrel re-export cho toàn bộ V1. Root schema nằm ở `./project` (leaf module) để tránh circular deps với `mcp`, `patch`, `parse`, `skills`.                                                                               |
| `common.ts`          | V1 shared primitives — **canonical source of truth** cho `IdSchema`, `FiniteNumberSchema`, `SemverSchema`, `PropertyPathSchema`, `ColorHexSchema`, `LocaleIdentifierSchema`, `MOTION_PROJECT_V1_FORMAT_VERSION` (= 1), … |
| `values.ts`          | JSON value schemas — `JsonValueSchema` (lazy recursive), `ResolvableValueSchema`, `ValueKindSchema`.                                                                                                                     |
| `transform.ts`       | `TransformSchema` — vị trí/kích thước/xoay/scale/opacity/anchor/flip của layer.                                                                                                                                           |
| `effects.ts`         | `EffectSchema` — discriminated union các pixel effect (blur, shadow, …).                                                                                                                                                 |
| `layout.ts`          | Layout schemas — `RepeatSourceSchema`, `RepeatLayoutSchema`, `RepeaterSchema`, `EdgeInsetsSchema`, `LayoutConstraintSchema`, `LayoutItemPolicySchema`.                                                                   |
| `modifiers.ts`       | Motion modifier schemas — `MotionModifierSchema` (motion-path, …).                                                                                                                                                       |
| `assets.ts`          | Asset schemas — discriminated `assetType` union (image/svg/video/audio/font).                                                                                                                                            |
| `assets-types.ts`    | Type `z.infer` cho từng asset kind, tách riêng tránh circular import giữa union và per-kind exports.                                                                                                                     |
| `canonical-hash.ts`  | Canonical hash — single source of truth cho deterministic hashing (`projectHash`/`runtimeHash`). Exclude timestamp/provenance/extensions/editor-state để đảm bảo reproducibility.                                        |
| `capabilities.ts`    | Capability requirements của project — `required`/`optional`/`experimental` với ID dạng dotted manifest (`primitive.group`, `effect.blur`, …).                                                                            |
| `captions.ts`        | Caption schemas — `CaptionTokenSchema`, caption track/cue.                                                                                                                                                               |
| `components.ts`      | Components & dependencies — sealed owner-owned component (`ComponentDefinitionV1Schema`), `props`/`variants`/`propBindings`/`internalBindings`, `ProjectDependenciesV1Schema`.                                                |
| `composition.ts`     | Composition settings — width/height/fps/background/colorSpace, thay thế `metadata.aspectRatio` + `fps` của v2.                                                                                                           |
| `extensions.ts`      | `NamespacedExtensionsSchema` — extension theo dotted namespace, value `unknown`, không vào render hash.                                                                                                                  |
| `metadata.ts`        | `ProjectMetadataV1Schema` — id/name/description/locale (BCP-47)/tags/timestamps.                                                                                                                                         |
| `mcp.ts`             | MCP Tool Contract — typed operation schemas cho 8 operation MCP-facing, server-agnostic.                                                                                                                                 |
| `normalize-input.ts` | Input normalizer — walk authoring tree, normalize text payload `{ text }` → `{ content: { kind: "plain" } }` trước khi Zod parse.                                                                                        |
| `parse.ts`           | Canonical production parse — `parseMotionProjectV1` (text-payload normalize → schema + reference validation). Strict V1 only. `serializeMotionProjectV1` emit key alphabet để byte-identical. |
| `patch.ts`           | Native Patch Contract — safe editor surface cho AI/MCP (`applyMotionProjectV1Patch`, `MotionProjectV1PatchSchema`), idempotent, luôn re-validate bằng `MotionProjectV1Schema`.                                           |
| `project.ts`         | **Root schema** (`MotionProjectV1Schema`) — leaf module (không barrel cycle), object + `.strict()` + `.superRefine()` kiểm tra duplicate id.                                                                             |
| `provenance.ts`      | Provenance — debug/trace metadata, exclude khỏi render hash.                                                                                                                                                             |
| `scenes.ts`          | `SceneDefinitionV1Schema` — scene definition (layers + scene-local clips). Scene không mang `transition`.                                                                                                                 |
| `skills.ts`          | Skill Template Contract — named template mô tả capability/input/output/instruction cho AI/MCP tạo hoặc patch project.                                                                                                    |
| `source-ref.ts`      | Source-ref schemas — `SourceRefKindSchema` (text-run/caption-token/caption-cue/node/clip).                                                                                                                               |
| `timeline.ts`        | Project timeline — `visualTracks` scene-only clips, unique `order`, same-lane exclusive; **không** role / transitionIn/Out. Component = scene layer, không clip source.                                                   |
| `types.ts`           | V1 public protocol types — nơi đặt **aggregate root type** (`MotionProjectV1` viết tay) để tránh TS serialize type khổng lồ trong schema module.                                                                         |
| `variables.ts`       | Variables, design tokens & project bindings — `ProjectVariableV1Schema`, `DesignTokensSchema`, `ProjectBindingV1Schema`, `PublicParamSchema`.                                                                            |

### 2.2 `src/v1/layers/`

| File                  | Nhiệm vụ                                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`            | Layer union — `LayerV1Schema` discriminated union theo `type`, gồm `component` (sealed instance, group-like transform/timing/zIndex). Timeline không nhận component làm clip source. |
| `base.ts`             | `LayerBaseV1Schema` + transform — nền tảng chung cho mọi layer (id/type/parentLayerId/transform/timing/effects/modifiers).                                 |
| `geometry.ts`         | Geometry layers — `ShapeLayerV1Schema` + `PathLayerV1Schema` (point/path primitives).                                                                  |
| `geometry-types.ts`   | Type `z.infer` cho shape/path, tách riêng tránh circular import.                                                                                    |
| `media.ts`            | Media + camera layers — `ImageLayerV1Schema`, `VideoLayerV1Schema`, `SvgLayerV1Schema`, `CameraLayerV1Schema` (payload `{ assetId, fit }`).              |
| `paint.ts`            | Paint schemas — `FitSchema`, `CropSchema`, `PaintStyleSchema` (fill/stroke/gradient).                                                               |
| `structural.ts`       | Structural layers — `GroupLayerV1Schema`, `BoneLayerV1Schema`, `SolidLayerV1Schema`, `AdjustmentLayerV1Schema`.                                          |
| `structural-types.ts` | Type `z.infer` cho structural layers, tách riêng tránh circular import.                                                                              |
| `text.ts`             | `TextLayerV1Schema` — text layer, content dùng rich text (plain/runs).                                                                                |
| `text-content.ts`     | Text content schemas & helpers — `TextPayloadSchema`, `segmentTextUnits`, rich text runs.                                                           |
| `timing.ts`           | `LayerTimingSchema` — layer-level in/out timing.                                                                                                      |

### 2.3 `src/v1/animation/`

| File         | Nhiệm vụ                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `index.ts`   | Animation barrel — re-export easing/clips/tracks/drivers.                                           |
| `clips.ts`   | `MotionClipV1Schema` — scene-local motion clips (scheduling `absolute`/`scene-end`/`after`/`with`). |
| `drivers.ts` | `ProceduralDriverSchema` — procedural driver vocabulary (evaluated trong runtime IR).               |
| `easing.ts`  | Keyframe easing — `KeyframeEasingNamedSchema`/`Cubic`/`Spring`/`KeyframeEasingSchema`.              |
| `tracks.ts`  | `PropertyTrackV1Schema` — property track + extrapolation + keyframes.                               |

### 2.4 `src/v1/references/`

| File             | Nhiệm vụ                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`       | References barrel.                                                                                                                 |
| `project.ts`     | Project-wide reference validation — `validateMotionProjectV1References` (scene refs, asset types, transform public properties, …). |
| `node-graph.ts`  | `validateLayerGraphV1` — duplicate id, parent refs, mask sources, self-parent, cycles, depth, group-only children.                  |
| `node-assets.ts` | `validateLayerAssetsV1` — node → asset reference validation (media + font).                                                         |
| `helpers.ts`     | Reference helpers — `duplicates`, `morphTopologyMismatch`.                                                                         |
| `types.ts`       | Reference validation types — `ReferenceIssue`, `MotionV1ReferenceError`.                                                           |

---

## 3. `src/runtime/` — Runtime IR (Renderer-Ready)

> Runtime IR = literal, flat, renderer-ready. Biến đã resolve, component instance đã flatten, repeat node đã clone, preset/text-animator đã biên dịch thành keyframe track.

| File           | Nhiệm vụ                                                                                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`     | Runtime IR barrel — export `MotionRuntimeProjectSchema`/`MotionRuntimeProject`, các sub-schema, `PreparedRuntimeProject`.                                                               |
| `common.ts`    | Re-export từ V1 canonical source of truth (`IdSchema`, `PropertyPathSchema`, …) + hằng `MOTION_PROJECT_FORMAT_VERSION`/`MOTION_COMPONENT_FORMAT_VERSION`/`MOTION_PATCH_FORMAT_VERSION`. |
| `assets.ts`    | Asset schemas cho runtime IR.                                                                                                                                                           |
| `effects.ts`   | `EffectSchema` — pixel effects cho runtime node.                                                                                                                                        |
| `helpers.ts`   | Runtime geometry validation helpers — `duplicates`, `morphTopologyMismatch`.                                                                                                            |
| `layout.ts`    | Layout schemas — `RepeatSourceSchema`, `RepeatLayoutSchema`, `RepeaterSchema`, layout constraint/item policy.                                                                           |
| `modifiers.ts` | `MotionModifierSchema` — motion modifiers cho runtime node.                                                                                                                             |
| `prepared.ts`  | `PreparedRuntimeProject` — compiled runtime IR kèm O(1) lookup index (Map, in-memory, không serialize). Dùng chung cho compiler & runtime.                                              |
| `project.ts`   | **`MotionRuntimeProject`** — canonical runtime IR root schema (`MotionRuntimeProjectSchema` + `.superRefine`).                                                                          |
| `transform.ts` | `TransformSchema` — runtime transform (gồm cả perspective-3D `z`).                                                                                                                      |
| `values.ts`    | JSON value schemas — `JsonValueSchema`, `ResolvableValueSchema`, `VariableReferenceSchema`, `ValueKindSchema`.                                                                          |

### 3.1 `src/runtime/layers/`

| File            | Nhiệm vụ                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`      | Runtime node union — `LayerSchema` discriminated union theo `type` (bao gồm `component` node type).                                              |
| `base.ts`       | `LayerBaseSchema` — nền tảng chung cho runtime node (id/type/transform/timing/effects/modifiers/repeater).                                       |
| `geometry.ts`   | Runtime geometry — shape/path, re-export point/path primitives từ V1.                                                                           |
| `media.ts`      | Runtime media — `ImageLayerSchema`, `VideoLayerSchema`, `SvgLayerSchema`.                                                                          |
| `paint.ts`      | Paint schemas — `FitSchema`, `CropSchema`, `PaintStyleSchema`.                                                                                  |
| `structural.ts` | Runtime structural — `GroupLayerSchema`, `BoneLayerSchema`, `SolidLayerSchema`, `AdjustmentLayerSchema`, `CameraLayerSchema`, `ComponentLayerSchema`. |
| `text.ts`       | Runtime text — `TextLayerSchema` + `TextAnimatorSchema`.                                                                                         |

---

## 4. Sơ đồ quan hệ (tóm tắt)

```text
src/index.ts  ──►  re-export capabilities + v1 + runtime
     │
     ├── capabilities.ts          (MOTION_PROTOCOL_LIMITS + property registry)
     ├── ai-schema-capability.ts  (AI E2E matrix)
     ├── scene-registry.ts        (template scenes)
     │
     ├── v1/                      (Authoring Protocol — duy nhất)
     │     ├── project.ts         (root schema, leaf module)
     │     ├── types.ts           (aggregate types viết tay)
     │     ├── parse.ts / normalize-input.ts / patch.ts / mcp.ts / skills.ts
     │     ├── layers/ animation/ references/  (schema theo domain)
     │
     └── runtime/                 (Runtime IR — renderer-ready)
           ├── project.ts         (MotionRuntimeProject root)
           ├── prepared.ts        (PreparedRuntimeProject — in-memory)
           └── layers/  (runtime node union)
```

> **Ranh giới chuyển đổi:** V1 (authoring) → `@motionvideo/motion-compiler` → Runtime IR (renderer). `motion-protocol` chỉ định nghĩa cả hai schema + validation; không thực hiện compile.
