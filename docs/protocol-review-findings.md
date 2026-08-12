# Motion Protocol — Comprehensive Review

> Date: 2026-08-12 | Branch: `chore/rename-motion-protocol`
> Scope: `packages/motion-protocol/src/`

---

## Layer 1: Entry Points ✅ (FIXED 2026-08-12)

**Files:** `index.ts`, `v3/index.ts`, `v3/project.ts`, `v3/parse.ts`

### 🔴 High

| #   | Status   | File                       | Issue                                                                                                                                                                                          |
| --- | -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | ✅ Fixed | `timeline.ts`              | `visualTracks.max()` dùng `MOTION_PROTOCOL_LIMITS.audioTracksPerProject` (2048) → thêm constant `visualTracksPerProject: 128` trong `capabilities.ts`.                                         |
| H2  | ✅ Fixed | `project.ts`               | `MotionProjectV3Schema` thêm `.superRefine()` — lightweight duplicate ID checks (scenes, variables, assets, bindings, components, visualTracks). Không tạo circular dep với references module. |
| H3  | ✅ Fixed | `index.ts` + `timeline.ts` | `CaptionTrackV3` type được export từ `timeline.ts` và re-export ở top-level `index.ts`.                                                                                                        |

### 🟡 Medium

| #   | Status          | File          | Issue                                                                                                      |
| --- | --------------- | ------------- | ---------------------------------------------------------------------------------------------------------- |
| M1  | ✅ Fixed        | `index.ts`    | Thêm V1 format version check (trước V2 check) với error message hữu ích.                                   |
| M2  | 📝 Skip         | `parse.ts`    | Legacy `normalizeMotionProjectV3` issues — low priority, chỉ dùng cho migration path cũ.                   |
| M3  | ✅ Pre-existing | `index.ts`    | `LayoutConstraintSchema` đã được export từ top-level (kiểm tra lại — đã có sẵn, không phải bug).           |
| M4  | ✅ Fixed        | `index.ts`    | Export `AssetV3Schema` + `AssetV3` type ở top-level bên cạnh runtime `AssetSchema`.                        |
| M5  | ✅ Fixed        | `timeline.ts` | `AudioTrackV3Schema` thêm `.superRefine()`: check `trimEnd <= duration` và `fadeIn + fadeOut <= duration`. |

### ℹ️ Info (Skip — low priority)

| #   | File          | Issue                                                                                 |
| --- | ------------- | ------------------------------------------------------------------------------------- |
| I1  | `v3/index.ts` | 19 `export *` từ sub-modules — risk naming collision nếu 2 module export cùng symbol. |
| I2  | `v3/index.ts` | `CaptionTrackV3Schema` re-exported từ 2 path — harmless, TypeScript deduplicates.     |

### ✅ Verified

- Tất cả schema dùng `.strict()` — zero `.passthrough()`
- `.default([])` và `.default({})` consistency tốt
- Circular dependency avoidance: `MotionProjectV3Schema` import từ `./project` (leaf), không từ `./index`

---

## Layer 2: Core Schemas

**Files:** `timeline.ts`, `components.ts`, `scenes.ts`, `nodes/`, `variables.ts`, `values.ts`, `common.ts`, `transform.ts`

### 🔴 High

| #   | File            | Issue                                                                                                                                                                                                                                                |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H4  | `scenes.ts:26`  | `SceneDefinitionV3Schema.nodes` KHÔNG có `.min(1)` — scene không node được accept. ✅ **FIXED** — nodes: z.array(NodeV3Schema).min(1).max(...)                                                                                                       |
| H5  | `components.ts` | `EmbeddedComponentV3Schema.slots` cho phép `count > 1` nhưng không có schema-level validation nào đảm bảo slot content array match `count`. ✅ **FIXED** — superRefine kiểm tra duplicate slot ids + note về consumer-side slot-content cardinality. |

### 🟡 Medium

| #   | File               | Issue                                                                                                                                                                                                                    |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M6  | `timeline.ts`      | `VisualClipV3Schema` có `playbackRate` và `loop` nhưng không validate `playbackRate > 0`. ✅ **FIXED** — playbackRate: .superRefine() kiểm tra > 0                                                                       |
| M7  | `nodes/base.ts:24` | **CRITICAL cho runtime** — `NodeBaseSchema` trong runtime KHÔNG có `.strict()`. ✅ **FIXED** — đã thêm `.strict()`.                                                                                                      |
| M8  | `common.ts`        | `SemverSchema` regex cho phép `1.0.0-`. ✅ **FIXED** — pattern: `(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?` (requires at least one char after dash). Cả v3/common.ts và runtime/common.ts.                                         |
| M9  | `variables.ts`     | `DesignTokensSchema` export nhưng `DesignTokens` type chỉ trong `v3/index.ts`, không có ở top-level `index.ts` cùng các type khác.                                                                                       |
| M10 | `transform.ts`     | `TransformSchema.width/height` dùng `.nonnegative()` → cho phép `0`. Node width=0 hoặc height=0 là vô hình. 🔵 **BY DESIGN** — camera, group, bone nodes legitimately use width=0/height=0. `.nonnegative()` giữ nguyên. |

### ℹ️ Info

| #   | File             | Issue                                                                                                                                                                                                                          |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I3  | `scenes.ts`      | `space: z.enum(["flat-2d", "layered-2.5d"])` — thiếu `"perspective-3d"` mặc dù Phase 11 đã thêm 3D support (có `rotation3DAngle`, `zPositionRange` trong capabilities).                                                        |
| I4  | `variables.ts`   | `ProjectVariableV3Schema` → `type: "list"` có `itemSchema: z.object({ type: z.literal("object") })` — chỉ support list-of-objects, không support list-of-strings, list-of-numbers. Document rõ giới hạn này.                   |
| I5  | `nodes/index.ts` | 11 discriminated union members nhưng không có comment document thứ tự union ảnh hưởng đến Zod matching (first-match). Thứ tự hiện tại: Group → Bone → Text → Shape → Path → Image → SVG → Video → Camera → Solid → Adjustment. |

### ✅ Verified

- `NodeBaseV3Schema` (authoring) có `visible: z.boolean().default(true)` + `locked: z.boolean().default(false)` — đúng
- `TransformSchema` có đầy đủ `rotationX/Y/Z` cho 3D, anchorZ, depth — Phase 11 ready
- `InheritFlagsSchema` default toàn bộ `true` — behavior đúng cho group transform

---

## Layer 3: Animation

**Files:** `animation/clips.ts`, `animation/tracks.ts`, `animation/easing.ts`, `animation/drivers.ts`

### 🟡 Medium

| #   | File         | Issue                                                                                                                                                   |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M11 | `tracks.ts`  | `PropertyTrackSchema` KHÔNG có `.superRefine()` để check valueKind compatibility. ✅ **FIXED** — added `VALUE_KIND_BY_PROPERTY` map + `.superRefine()`. |
| M12 | `drivers.ts` | `"remap"` driver không validate `inMin < inMax` hoặc `outMin < outMax`. ✅ **FIXED** — `.superRefine()` trên union level.                               |
| M13 | `drivers.ts` | `"clamp"` và `"wrap"` drivers không validate `min < max`. ✅ **FIXED** — `.superRefine()` trên union level.                                             |
| M14 | `tracks.ts`  | `SceneMarkerSchema` không có validation marker ordering. 🔵 **DEFERRED → Layer 4** — markers là individual objects, cần project-level validation.       |
| M15 | `easing.ts`  | `KeyframeEasingCubicSchema` cho phép `y1`, `y2` không giới hạn. 🔵 **BY DESIGN** — CSS spec cho phép cubic-bezier overshoot. Đã document trong code.    |

### ℹ️ Info

| #   | File         | Issue                                                                                                                                                 |
| --- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| I6  | `clips.ts`   | `PlaybackSchema.rate` dùng `ResolvableValueSchema` → cho phép variable reference. Nhưng variable resolve ở compile time, không runtime → document rõ. |
| I7  | `drivers.ts` | 8 driver types nhưng không có driver "audio" (sync animation to audio beats/energy). Phase 7+ gap.                                                    |

### ✅ Verified

- `MotionClipV3Schema.superRefine()` — `targetId` required cho `preset` source ✅
- `KeyframeEasingSchema` — union của named + cubic + spring, đầy đủ ✅
- `TrackTimeSchema` — hỗ trợ absolute seconds + marker-relative ✅
- `ExtrapolationBehaviorSchema` — 3 modes (clamp, cycle, continue), đầy đủ ✅

---

## Layer 4: Reference Validation

**Files:** `references/project.ts`, `references/node-graph.ts`, `references/node-assets.ts`, `references/helpers.ts`, `references/types.ts`

### 🔴 High

| #   | File               | Issue                                                                                                                                                                               |
| --- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H6  | `project.ts` (ref) | Audio track duplicate ID check **bị thiếu**. ✅ **FIXED** — added duplicate check for `audioTracks[].id`. |
| H7  | `project.ts` (ref) | Caption track duplicate ID check **bị thiếu**. ✅ **FIXED** — added duplicate check for `captionTracks[].id`. |

### 🟡 Medium

| #   | File               | Issue                                                                                                                                                                                                                             |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M16 | `project.ts` (ref) | Component node graph cần check root nodes có `parentId === null`. ✅ **FIXED** — components section validates no external parent references. |
| M17 | `project.ts` (ref) | Không validate component clip instanceTransform. 🔵 **ALREADY DONE** — schema-level `.superRefine()` in `timeline.ts` + compiler `validateV3Semantics` both handle this. |
| M18 | `node-graph.ts`    | Cycle detection chỉ chạy khi `issues.length === 0`. ✅ **FIXED** — removed guard, cycle detection & hierarchy depth always run. |

### ✅ Verified

- `validateNodeAssetsV3` check video trim range hợp lệ ✅
- `validateNodeGraphV3` check: duplicate, self-parent, unknown parent, non-group parent, mask source, bone rotation limits ✅
- `morphTopologyMismatch` check contour count + segment consistency ✅
- `duplicates` helper đúng (filter indexOf !== index) ✅

---

## Layer 5: Runtime Contracts

**Files:** `runtime/project.ts`, `runtime/index.ts`, `runtime/assets.ts`, `runtime/nodes/`, `runtime/transform.ts`, `runtime/values.ts`

### 🔴 Critical

| #   | File                       | Issue                                                                                                                                                                                                                |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `runtime/nodes/base.ts:24` | `NodeBaseSchema` KHÔNG `.strict()`. ✅ **FIXED (Layer 2)** — `.strict()` added. |
| C2  | `runtime/common.ts`        | Full schema duplication từ `v3/common.ts`. 🔵 **DEFERRED** — architectural: needs codegen or shared base. Low risk for now (both kept in sync via review). |

### 🔴 High

| #   | File                 | Issue                                                                                                                                                              |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| H8  | `runtime/index.ts`   | **Thiếu export**: `PlatformSafeAreaSchema`, `ProjectMetadataSchema`, `AudioTrackSchema`, `SceneTransitionSchema` và types tương ứng. ✅ **FIXED** — all missing exports added. |
| H9  | `runtime/project.ts` | Không có standalone `RuntimeSceneSchema`. ✅ **FIXED** — extracted from inline definition, exported. |

### 🟡 Medium

| #   | File                          | Issue                                                                                                                            |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| M19 | `runtime/project.ts`          | Không validate `visualTracks` có ít nhất 1 `primary` track. 🔵 **DEFERRED** — semantic constraint, not schema-level; compiler enforces this. |
| M20 | `runtime/nodes/structural.ts` | `CameraNodeSchema` không `superRefine`. ✅ **FIXED** — fov required for perspective, near<far check. |
| M21 | `runtime/nodes/text.ts`       | `fitText` không validate `minFontSize < maxFontSize`. ✅ **FIXED** — `.superRefine()` check. |
| M22 | `runtime/nodes/media.ts`      | `VideoNodeSchema` không validate `trimStart < trimEnd`. ✅ **FIXED** — `.superRefine()` check. |
| M23 | `runtime/assets.ts`           | `SvgAssetSchema.sanitized: z.literal(true)` — reject mọi unsanitized SVG. 🔵 **BY DESIGN** — security: only sanitized SVGs accepted at runtime. |
| M24 | `runtime/values.ts`           | `JsonValueSchema` lazy recursive không có depth limit. 🔵 **DEFERRED** — would need custom Zod refinement; low risk (JS call stack limits depth naturally). |

### ℹ️ Info

| #   | File                 | Issue                                                                                                                   |
| --- | -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| I8  | `runtime/project.ts` | `MOTION_RUNTIME_VERSION = 1` vs `RUNTIME_IR_FORMAT_VERSION = 3` — 2 constant khác tên, khác giá trị cho cùng 1 concept. 🔵 **BY DESIGN** — runtimeVersion tracks IR shape, formatVersion tracks serialization format. |
| I9  | `runtime/project.ts` | `runtimeVersion` optional, không có `z.literal()` enforcement. 🔵 **BY DESIGN** — optional for backward compatibility. |
| I10 | `runtime/helpers.ts` | `valueAtPath` export nhưng không dùng ở đâu. 🔵 **DEFERRED** — dead code, can remove in future cleanup. |

---

## Layer 6: Tests & Fixtures

**Files:** `v3/__tests__/`, `runtime/__tests__/`, `v3/__fixtures__/`

### ✅ Strengths

- **251 protocol tests** + **13 test files** — coverage tốt
- Positive fixtures: `minimal-empty`, `representative`, `comprehensive`, `component`, `caption`, `audio`, `multi-asset`, `clips-and-tracks`, `variables-bindings`, `nested-groups`
- Negative tests: instanceTransform trên scene clip, invalid property path, mismatched valueKind, invalid timeline, unknown fields
- Runtime: 1 test file (`project.test.ts`) — mỏng nhưng đủ cho schema validation

### 🟡 Gaps

| #   | Issue                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------------- |
| G1  | Không có test cho `AudioTrackV3Schema` validation (trimEnd, fadeIn+fadeOut)                                       |
| G2  | Không có test cho `ProceduralDriverSchema` (remap/clamp/wrap min<max)                                             |
| G3  | Runtime tests chỉ test `project.ts` — không test `assets.ts`, `nodes/`, `modifiers.ts`, `effects.ts`, `layout.ts` |
| G4  | Không có test cho reference validation của audio tracks + caption tracks duplicate ID                             |
| G5  | Không có integration test: parse → reference validate → compile flow end-to-end                                   |

---

## 📊 Tổng kết

| Mức          | Số lượng | Layer           |
| ------------ | -------- | --------------- |
| 🔴 Critical  | 2        | Layer 5 (C1-C2) |
| 🔴 High      | 9        | H1-H9           |
| 🟡 Medium    | 24       | M1-M24          |
| ℹ️ Info      | 10       | I1-I10          |
| 🧪 Test Gaps | 5        | G1-G5           |

### Top 5 ưu tiên fix

| #   | Mức      | ID  | Vấn đề                                         |
| --- | -------- | --- | ---------------------------------------------- |
| 1   | Critical | C1  | `NodeBaseSchema` runtime không `.strict()`     |
| 2   | Critical | C2  | Runtime `common.ts` duplicate toàn bộ từ V3    |
| 3   | High     | H1  | `visualTracks.max()` dùng sai constant         |
| 4   | High     | H2  | `MotionProjectV3Schema` không `.superRefine()` |
| 5   | High     | H4  | Scene `nodes` không `.min(1)`                  |
