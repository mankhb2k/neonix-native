# Motion Project V3 — Chi Tiết Triển Khai Từng Phase

> Derived from [`motion-project-v3-refactor-plan.md`](./motion-project-v3-refactor-plan.md)
>
> Cập nhật: 2026-08-10

Mỗi task được chia thành **Mục tiêu → Subtask → File cần chạm → Acceptance criteria → Estimate**.

---

## Phase 1 — Freeze V2 Baseline

**Mục tiêu:** Đảm bảo mọi thay đổi v3 không làm vỡ output hiện tại. Build "golden wall" bằng fixtures và snapshots.

### Task 1.1: Kiểm kê fixtures v2 hiện có

| #     | Subtask           | Chi tiết                                                                                                                         |
| ----- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 | Audit test files  | `grep_search` tất cả file `*.test.ts` trong `motion-protocol`, `motion-compiler`, `motion-runtime` để liệt kê fixture đang dùng. |
| 1.1.2 | Phân loại fixture | Chia thành: (a) project JSON fixture, (b) compile output fixture, (c) runtime frame fixture, (d) render parity fixture.          |
| 1.1.3 | Ghi nhận gap      | So sánh với danh sách mong muốn (8 loại fixture bên dưới), ghi lại fixture nào đang thiếu.                                       |

**Fixtures cần có:**

| #   | Loại fixture         | Mô tả                                                 | File dự kiến                                  |
| --- | -------------------- | ----------------------------------------------------- | --------------------------------------------- |
| F1  | `minimal-empty`      | Project rỗng hợp lệ                                   | `fixtures/v2/minimal-empty.project.json`      |
| F2  | `single-scene`       | 1 scene, 1 text node                                  | `fixtures/v2/single-scene.project.json`       |
| F3  | `multi-asset`        | Scene với text + image + svg + video + audio nodes    | `fixtures/v2/multi-asset.project.json`        |
| F4  | `clips-and-tracks`   | Scene với clips dùng property tracks + presets        | `fixtures/v2/clips-and-tracks.project.json`   |
| F5  | `captions`           | Scene với caption track                               | `fixtures/v2/captions.project.json`           |
| F6  | `transition`         | Scene với transition (fade/crossfade/slide/wipe/zoom) | `fixtures/v2/transition.project.json`         |
| F7  | `variables-bindings` | Project với variables + project bindings              | `fixtures/v2/variables-bindings.project.json` |
| F8  | `component-instance` | Project dùng component instance                       | `fixtures/v2/component-instance.project.json` |

**Acceptance:** Có ít nhất 8 file `.project.json` trong `packages/motion-protocol/src/__fixtures__/v2/`.

### Task 1.2: Tạo round-trip test cho v2

| #     | Subtask                                                                   | File                                                          | Chi tiết                                                                                                               |
| ----- | ------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1.2.1 | Viết `parse -> serialize -> parse` helper                                 | `packages/motion-protocol/src/v2/__tests__/roundtrip.test.ts` | Dùng `parseMotionProjectV2` + `serializeMotionProjectV2`, assert `deepStrictEqual(parse(serialize(project)), project)` |
| 1.2.2 | Test từng fixture F1-F8                                                   | (cùng file)                                                   | Mỗi fixture: parse → serialize → parse → so sánh                                                                       |
| 1.2.3 | Test canonical sort                                                       | (cùng file)                                                   | Serialize 2 lần → output giống hệt (deterministic key order)                                                           |
| 1.2.4 | Test negative: invalid JSON, wrong formatVersion, missing required fields | (cùng file)                                                   | Assert `parseMotionProjectV2` throw đúng Zod error                                                                     |

**Acceptance:** `pnpm.cmd --filter @motionvideo/motion-protocol test` pass. 8 round-trip tests + 5+ negative tests.

### Task 1.3: Tạo compile snapshot test

| #     | Subtask                                      | File                                                               | Chi tiết                                                                    |
| ----- | -------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 1.3.1 | Tạo helper `compileAndSnapshot(fixturePath)` | `packages/motion-compiler/src/__tests__/compile-snapshots.test.ts` | Gọi `compileMotionProjectV2`, serialize `NormalizedMotionProjectV2` ra JSON |
| 1.3.2 | Snapshot từng fixture F1-F8                  | (cùng file)                                                        | Mỗi fixture → compile → snapshot JSON → assert khớp golden                  |
| 1.3.3 | Lưu golden snapshots                         | `packages/motion-compiler/src/__fixtures__/v2-compile-goldens/`    | Mỗi fixture có 1 file `.runtime.json` tương ứng                             |
| 1.3.4 | Thêm --update-snapshots flag                 | (cùng file)                                                        | Cho phép cập nhật golden khi schema thay đổi có chủ ý                       |

**Acceptance:** 8 compile snapshots khớp golden. `pnpm.cmd --filter @motionvideo/motion-compiler test` pass.

### Task 1.4: Tạo runtime frame fingerprint test

| #     | Subtask                                       | File                                                               | Chi tiết                                                     |
| ----- | --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| 1.4.1 | Chọn key frames                               | Mỗi fixture: frame 0, frame giữa, frame cuối                       | Dùng `frameIndexAtTime` để tính frame index                  |
| 1.4.2 | Viết helper `fingerprintFrame(runtime, time)` | `packages/motion-runtime/src/__tests__/frame-fingerprints.test.ts` | Gọi `evaluateCompositionFrameV3`, lấy structural fingerprint |
| 1.4.3 | Snapshot fingerprint từng fixture             | (cùng file)                                                        | Lưu fingerprint JSON, assert deterministic                   |
| 1.4.4 | Lưu golden fingerprints                       | `packages/motion-runtime/src/__fixtures__/v2-frame-goldens/`       | Mỗi fixture có 3 frame fingerprints                          |

**Acceptance:** Frame fingerprints deterministic và reproducible. Test pass.

### Task 1.5: Tạo Pixi/Remotion parity fixture

| #     | Subtask                                  | File                                                      | Chi tiết                                         |
| ----- | ---------------------------------------- | --------------------------------------------------------- | ------------------------------------------------ |
| 1.5.1 | Chọn 1 fixture đại diện (F3 multi-asset) | —                                                         | Dùng làm parity baseline                         |
| 1.5.2 | Render Pixi preview frame                | `packages/pixi-renderer/src/__tests__/parity.test.ts`     | Snapshot pixel ở frame 0, frame giữa, frame cuối |
| 1.5.3 | Render Remotion export frame             | `packages/remotion-renderer/src/__tests__/parity.test.ts` | Snapshot pixel cùng 3 frames                     |
| 1.5.4 | So sánh pixel diff                       | Dùng `pixel-diff` từ motion-runtime                       | Ngưỡng: mean absolute error < 0.5 / 255          |

**Acceptance:** Pixi và Remotion output pixel-gần-giống-hệt trên 3 key frames.

### Task 1.6: Thêm migration guard

| #     | Subtask                                           | File                                                              | Chi tiết                                                      |
| ----- | ------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| 1.6.1 | Assert v2 schema không thay đổi meaning           | `packages/motion-protocol/src/v2/__tests__/schema-freeze.test.ts` | Deep-freeze check: snapshot của `MotionProjectV2Schema.shape` |
| 1.6.2 | Assert `formatVersion: 2` luôn parse qua v2 path  | (cùng file)                                                       | `parseMotionProjectV2({ formatVersion: 2, ... })` thành công  |
| 1.6.3 | Assert `formatVersion: 3` KHÔNG parse qua v2 path | (cùng file)                                                       | `parseMotionProjectV2({ formatVersion: 3, ... })` throw       |

**Acceptance:** Schema freeze tests pass. V3 không lọt qua v2 parser.

### Gate checklist Phase 1

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/pixi-renderer test
pnpm.cmd --filter @motionvideo/remotion-renderer test
```

- [ ] Tất cả test pass
- [ ] 8 v2 fixtures được kiểm kê
- [ ] Round-trip test pass
- [ ] Compile snapshots khớp golden
- [ ] Frame fingerprints deterministic
- [ ] Pixi/Remotion parity trong ngưỡng

---

## Phase 2 — Add V3 Protocol Types Beside V2

**Mục tiêu:** Giới thiệu schema v3 song song với v2, không đổi consumer.

### Task 2.1: Tạo cấu trúc thư mục v3

| #     | Subtask             | File                                                                                |
| ----- | ------------------- | ----------------------------------------------------------------------------------- |
| 2.1.1 | Tạo thư mục         | `packages/motion-protocol/src/v3/`                                                  |
| 2.1.2 | Tạo sub-directories | `nodes/`, `animation/`, `references/`, `migrations/`, `__tests__/`, `__fixtures__/` |

### Task 2.2: Implement `v3/common.ts`

| #     | Subtask                                       | Chi tiết                                                                                                           |
| ----- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 2.2.1 | Define `MOTION_PROJECT_V3_FORMAT_VERSION = 3` | Constant, export                                                                                                   |
| 2.2.2 | Define `MOTION_WORKSPACE_FORMAT_VERSION = 1`  | Constant cho workspace manifest                                                                                    |
| 2.2.3 | Re-export shared primitives từ v2             | `IdSchema`, `SemverSchema`, `FiniteNumberSchema`, `PropertyPathSchema`, `SemanticSchema`, `LocaleIdentifierSchema` |
| 2.2.4 | Define `ColorHexSchema`                       | `z.string().regex(/^#[0-9a-fA-F]{6}$/)`                                                                            |
| 2.2.5 | Define `NonNegativeIntegerSchema`             | `z.number().int().nonnegative()`                                                                                   |
| 2.2.6 | Define `PositiveNumberSchema`                 | `z.number().positive().finite()`                                                                                   |
| 2.2.7 | Define `NormalizedRatioSchema`                | `z.number().min(0).max(1).finite()`                                                                                |

### Task 2.3: Implement `v3/metadata.ts`

| #     | Subtask                             | Chi tiết                                                                                                                                     |
| ----- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.3.1 | Define `ProjectMetadataV3Schema`    | `{ id: Id, name: string, description?: string, locale: string, industry?: string, tags?: string[], createdAt?: string, updatedAt?: string }` |
| 2.3.2 | Define type `ProjectMetadataV3`     | `z.infer<typeof ProjectMetadataV3Schema>`                                                                                                    |
| 2.3.3 | Validation: `locale` dùng BCP 47    | Reuse `LocaleIdentifierSchema`                                                                                                               |
| 2.3.4 | Validation: timestamps ISO 8601 UTC | `z.string().datetime()` optional                                                                                                             |

### Task 2.4: Implement `v3/composition.ts`

| #     | Subtask                                                      | Chi tiết                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.4.1 | Define `SafeAreaSchema`                                      | `{ top, right, bottom, left: NormalizedRatio }`                                                                                                                                                                                                      |
| 2.4.2 | Define `MotionBlurDefaultsSchema`                            | `{ samples, shutterAngle, shutterPhase }`                                                                                                                                                                                                            |
| 2.4.3 | Define `CompositionSettingsSchema`                           | `{ width: NonNegativeInteger, height: NonNegativeInteger, fps: PositiveNumber, background: ColorHex, colorSpace: 'srgb', pixelAspectRatio?: PositiveNumber, audioSampleRate: 44100 \| 48000, safeArea?: SafeArea, motionBlur?: MotionBlurDefaults }` |
| 2.4.4 | Define type `CompositionSettings`                            | `z.infer<typeof CompositionSettingsSchema>`                                                                                                                                                                                                          |
| 2.4.5 | Validation: `width > 0`, `height > 0`, `fps in [1, 120]`     | `.refine()`                                                                                                                                                                                                                                          |
| 2.4.6 | Default: `audioSampleRate = 48000`, `background = '#ffffff'` | `.default()`                                                                                                                                                                                                                                         |

### Task 2.5: Implement `v3/capabilities.ts`

| #     | Subtask                                      | Chi tiết                                                                                                                              |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 2.5.1 | Define capability ID enum string             | `'projection.orthographic-2d' \| 'projection.layered-2.5d' \| 'projection.perspective-3d' \| 'effect.blur' \| 'effect.shadow' \| ...` |
| 2.5.2 | Define `ProjectCapabilityRequirementsSchema` | `{ required: string[], optional?: string[], experimental?: string[] }`                                                                |
| 2.5.3 | Define type                                  | `z.infer<>`                                                                                                                           |

### Task 2.6: Implement `v3/variables.ts`

| #     | Subtask                              | Chi tiết                                                                                                                                                               |
| ----- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.6.1 | Reuse v2 `VariableV2Schema` làm base | Thêm kind `list` với `itemSchema` rõ ràng hơn                                                                                                                          |
| 2.6.2 | Define `ProjectVariableV3Schema`     | Union discriminated: string, color, number, boolean, asset, enum, list                                                                                                 |
| 2.6.3 | Define `DesignTokensSchema`          | `{ colors?: Record<string, ColorHex>, fonts?: Record<string, Id>, spacing?: Record<string, number>, radii?: Record<string, number>, motion?: Record<string, number> }` |
| 2.6.4 | Define `ProjectBindingV3Schema`      | Giống v2 `ProjectBindingSchema` nhưng target có thể là `sceneId \| componentId`                                                                                        |

### Task 2.7: Implement `v3/assets.ts`

| #     | Subtask                     | Chi tiết                                                                                                                        |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2.7.1 | Define `AssetBaseV3Schema`  | `{ id: Id, assetType: AssetKind, uri: string, integrity?: string }`                                                             |
| 2.7.2 | Define `ImageAssetV3Schema` | Extend base + `{ mimeType, width, height, pixelFormat?, hasAlpha? }`                                                            |
| 2.7.3 | Define `SvgAssetV3Schema`   | Extend base + `{ mimeType, width, height, viewBox?, sanitized }`                                                                |
| 2.7.4 | Define `VideoAssetV3Schema` | Extend base + `{ mimeType, width, height, duration, fps, codec?, pixelFormat?, audioCodec?, audioSampleRate?, audioChannels? }` |
| 2.7.5 | Define `AudioAssetV3Schema` | Extend base + `{ mimeType, duration, codec?, sampleRate, channels }`                                                            |
| 2.7.6 | Define `FontAssetV3Schema`  | Extend base + `{ mimeType, family, weight, style, localeCoverage? }`                                                            |
| 2.7.7 | Define `AssetV3Schema`      | Discriminated union của 5 loại trên                                                                                             |
| 2.7.8 | Define type `AssetV3`       | `z.infer<>`                                                                                                                     |

### Task 2.8: Implement `v3/nodes/`

| #     | Subtask               | File                                                                                          | Chi tiết                                                                                                                                    |
| ----- | --------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.8.1 | `nodes/base.ts`       | Define `NodeBaseV3Schema`                                                                     | `{ id, type, name?, parentId, zIndex?, transform, timing?, semantic?, effects?, blendMode?, mask?, inheritFlags, visible, locked? }`        |
| 2.8.2 | `nodes/base.ts`       | Define `TransformV3Schema`                                                                    | `{ x, y, depth?, width, height, rotation, scaleX, scaleY, anchorX, anchorY, opacity, visible, flipX, flipY }` — reuses v2                   |
| 2.8.3 | `nodes/text.ts`       | Define `TextNodeV3Schema`                                                                     | Extend base + `payload: { content, fontAssetId?, fontSize, color, alignment, ... }`                                                         |
| 2.8.4 | `nodes/media.ts`      | Define `ImageNodeV3Schema`, `SvgNodeV3Schema`, `VideoNodeV3Schema`                            | Extend base + `payload: { assetId, fit }`                                                                                                   |
| 2.8.5 | `nodes/media.ts`      | Define `CameraNodeV3Schema`                                                                   | Extend base + `payload: { projection: 'orthographic' \| 'perspective', zoom?, parallaxStrength?, focalLength?, fieldOfView?, near?, far? }` |
| 2.8.6 | `nodes/structural.ts` | Define `GroupNodeV3Schema`, `BoneNodeV3Schema`, `SolidNodeV3Schema`, `AdjustmentNodeV3Schema` | Extend base                                                                                                                                 |
| 2.8.7 | `nodes/geometry.ts`   | Define `ShapeNodeV3Schema`, `PathNodeV3Schema`                                                | Extend base                                                                                                                                 |
| 2.8.8 | `nodes/index.ts`      | Define `NodeV3Schema`                                                                         | Discriminated union, bỏ `component` type                                                                                                    |
| 2.8.9 | `nodes/index.ts`      | Define type `NodeV3`                                                                          | `z.infer<>`                                                                                                                                 |

### Task 2.9: Implement `v3/animation/`

| #     | Subtask                | File                           | Chi tiết                                                                                  |
| ----- | ---------------------- | ------------------------------ | ----------------------------------------------------------------------------------------- |
| 2.9.1 | `animation/clips.ts`   | Define `MotionClipV3Schema`    | `{ id, targetId?, schedule: Schedule, duration, playback: Playback, source: ClipSource }` |
| 2.9.2 | `animation/clips.ts`   | Define `ScheduleSchema`        | Discriminated union: `absolute`, `scene-end`, `after`, `with`                             |
| 2.9.3 | `animation/tracks.ts`  | Define `PropertyTrackV3Schema` | Giống v2                                                                                  |
| 2.9.4 | `animation/easing.ts`  | Re-export từ v2                | `KeyframeEasingV2Schema`                                                                  |
| 2.9.5 | `animation/drivers.ts` | Re-export từ v2                | `ProceduralDriverSchema`                                                                  |

### Task 2.10: Implement `v3/scenes.ts`

| #      | Subtask                                                | Chi tiết                                                                                                                                                           |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.10.1 | Define `SceneDefinitionV3Schema`                       | `{ id, name?, duration, semantic?, space: 'flat-2d' \| 'layered-2.5d', markers?, motionBlur?, drivers?, nodes: NodeV3[], clips: MotionClipV3[], activeCameraId? }` |
| 2.10.2 | **KHÔNG có `transition`**                              | Đây là điểm khác biệt chính với v2                                                                                                                                 |
| 2.10.3 | Define type `SceneDefinitionV3`                        | `z.infer<>`                                                                                                                                                        |
| 2.10.4 | Validation: `activeCameraId` reference node cùng scene | `.refine()`                                                                                                                                                        |

### Task 2.11: Implement `v3/components.ts`

| #      | Subtask                              | Chi tiết                                                                                                       |
| ------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 2.11.1 | Define `PublicParamV3Schema`         | Giống v2 `PublicParamV2Schema`                                                                                 |
| 2.11.2 | Define `EmbeddedComponentV3Schema`   | `{ id, version, integrity, publicParams, variables, nodes, bindings, actions, variants?, assetDependencies? }` |
| 2.11.3 | Define `ComponentDependencyV3Schema` | `{ componentId, version, source?, integrity }`                                                                 |
| 2.11.4 | Define `PluginDependencySchema`      | `{ pluginId, version, integrity }`                                                                             |
| 2.11.5 | Define `ProjectDependenciesV3Schema` | `{ compiler: { range }, components: ComponentDependency[], plugins?: PluginDependency[] }`                     |

### Task 2.12: Implement `v3/timeline.ts`

| #      | Subtask                                                             | Chi tiết                                                                                                                                                             |
| ------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.12.1 | Define `TransitionV3Schema`                                         | Discriminated union: `cut`, `fade`, `crossfade`, `slide`, `wipe`, `zoom`                                                                                             |
| 2.12.2 | Define `VisualClipV3Schema`                                         | `{ id, source: SceneSource \| ComponentSource, start, duration, trimStart?, playbackRate?, loop?, opacity?, transitionIn?: Transition, transitionOut?: Transition }` |
| 2.12.3 | Define `VisualTrackV3Schema`                                        | `{ id, role: 'main' \| 'overlay', order, muted?, clips: VisualClip[] }`                                                                                              |
| 2.12.4 | Define `AudioTrackV3Schema`                                         | `{ id, role: 'bgm' \| 'voiceover' \| 'sfx', assetId, start, duration, trimStart, trimEnd?, playbackRate, volume, loop, fadeIn, fadeOut, muted? }`                    |
| 2.12.5 | Define `CaptionTrackV3Schema`                                       | Giống v2 `CaptionTrackSchema`                                                                                                                                        |
| 2.12.6 | Define `ProjectTimelineV3Schema`                                    | `{ duration?, workArea?, markers?, visualTracks, audioTracks, captionTracks }`                                                                                       |
| 2.12.7 | Chú ý: `visualTracks` là mảng, KHÔNG phải `sceneOrder` string array | Đây là thay đổi lớn nhất so với v2                                                                                                                                   |

### Task 2.13: Implement `v3/extensions.ts` và `v3/provenance.ts`

| #      | Subtask         | File                                | Chi tiết                                                                           |
| ------ | --------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| 2.13.1 | `extensions.ts` | Define `NamespacedExtensionsSchema` | `z.record(z.string().regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/), z.unknown())` |
| 2.13.2 | `provenance.ts` | Define `ProjectProvenanceSchema`    | `{ workspaceId?, sourceHash?, bundleProfile?, sourceMap? }` — NOT in render hash   |
| 2.13.3 | `provenance.ts` | Define `SourceMapSchema`            | `{ scenes?, components?, variables?, assets? }` mỗi cái là `Record<Id, string>`    |

### Task 2.14: Implement root `v3/index.ts` — `MotionProjectV3Schema`

| #      | Subtask                          | Chi tiết                                                                                                                                                                                         |
| ------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.14.1 | Assemble `MotionProjectV3Schema` | `{ format: 'motion-project', formatVersion: 3, metadata, composition, capabilities, dependencies, tokens, variables, assets, components, scenes, timeline, bindings, provenance?, extensions? }` |
| 2.14.2 | Define type `MotionProjectV3`    | `z.infer<typeof MotionProjectV3Schema>`                                                                                                                                                          |
| 2.14.3 | Export all sub-types             | Barrel export từ `v3/index.ts`                                                                                                                                                                   |

### Task 2.15: Tạo minimal + representative v3 fixtures

| #      | Subtask                       | File               | Chi tiết                                                  |
| ------ | ----------------------------- | ------------------ | --------------------------------------------------------- |
| 2.15.1 | `minimal-empty.project.json`  | `__fixtures__/v3/` | Project v3 rỗng, tất cả arrays rỗng                       |
| 2.15.2 | `representative.project.json` | `__fixtures__/v3/` | 1 scene, visual track, audio, captions, tokens, variables |
| 2.15.3 | `invalid-format-version.json` | `__fixtures__/v3/` | `formatVersion: 3` nhưng sai field khác                   |

### Task 2.16: Viết test cho v3 schema

| #      | Subtask            | File                          | Chi tiết                                                            |
| ------ | ------------------ | ----------------------------- | ------------------------------------------------------------------- |
| 2.16.1 | Positive tests     | `v3/__tests__/schema.test.ts` | Parse minimal + representative fixtures                             |
| 2.16.2 | Negative tests     | (cùng file)                   | Unknown fields reject, missing required fields, invalid enum values |
| 2.16.3 | Isolated parser    | (cùng file)                   | Assert `formatVersion: 3` không parse qua `parseMotionProjectV2`    |
| 2.16.4 | Discriminator test | (cùng file)                   | `format: "motion-project"` + `formatVersion: 3` → v3 path           |
| 2.16.5 | Extensions test    | (cùng file)                   | Valid namespaced extensions accepted, invalid namespace rejected    |

### Task 2.17: Export v3 từ package barrel

| #      | Subtask                          | File                                       | Chi tiết                                                                                   |
| ------ | -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 2.17.1 | Thêm v3 barrel export            | `packages/motion-protocol/src/v3/index.ts` | Export tất cả schemas và types                                                             |
| 2.17.2 | Thêm vào main barrel (có prefix) | `packages/motion-protocol/src/index.ts`    | `export * as V3 from './v3'` hoặc `export { MotionProjectV3, MotionProjectV3Schema, ... }` |
| 2.17.3 | KHÔNG đổi `MotionProject` alias  | Vẫn là `MotionProjectV2`                   |

### Gate checklist Phase 2

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
```

- [ ] `MotionProjectV3Schema` parse minimal fixture
- [ ] `MotionProjectV3Schema` parse representative fixture
- [ ] Unknown fields reject (trừ `extensions`)
- [ ] `formatVersion: 3` không parse qua v2
- [ ] Tất cả v2 tests vẫn pass
- [ ] v3 types export được từ package

---

## Phase 3 — V2 To V3 Migration

**Mục tiêu:** Migrate v2 project → v3 project một cách deterministic.

### Task 3.1: Tạo migration module

| #     | Subtask             | File                                                     | Chi tiết                                                                                         |
| ----- | ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 3.1.1 | Tạo file migration  | `packages/motion-protocol/src/v3/migrations/v2-to-v3.ts` | Export `migrateMotionProjectV2ToV3(project, options?)`                                           |
| 3.1.2 | Define options type | (cùng file)                                              | `{ assetMetadataResolver?, defaultComposition?: Partial<CompositionSettings>, locale?: string }` |
| 3.1.3 | Define return type  | (cùng file)                                              | `{ project: MotionProjectV3, diagnostics: MigrationDiagnostic[] }`                               |

### Task 3.2: Implement từng migration rule

| #      | Rule                                 | V2 → V3 mapping chi tiết                                                                                                                                                                   |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 3.2.1  | **Aspect ratio → dimensions**        | `9:16` → `1080x1920`, `16:9` → `1920x1080`, `1:1` → `1080x1080`. Nếu `options.defaultComposition` có width/height thì override.                                                            |
| 3.2.2  | **FPS**                              | `metadata.fps` → `composition.fps`. Default `30` nếu thiếu.                                                                                                                                |
| 3.2.3  | **Background**                       | `metadata.brand.primaryColor` (nếu có) → `composition.background`. Fallback `#ffffff`.                                                                                                     |
| 3.2.4  | **Safe area**                        | `metadata.safeArea` → `composition.safeArea`                                                                                                                                               |
| 3.2.5  | **Design tokens**                    | `metadata.designTokens` → `tokens`. Map `colors`, `fonts`, `spacing`.                                                                                                                      |
| 3.2.6  | **Brand**                            | `metadata.brand` → `tokens.colors` (primary/secondary) + `tokens.fonts` (nếu `logoAssetId` → asset variable).                                                                              |
| 3.2.7  | **sceneOrder → visualTracks**        | Tạo 1 `VisualTrack` với `role: "main"`, `order: 0`. Mỗi sceneId → 1 `VisualClip` với `source: { kind: "scene", sceneId }`. `start` tính sequential (clip bắt đầu sau clip trước kết thúc). |
| 3.2.8  | **scene.transition → transitionOut** | Transition của scene N → `transitionOut` của visual clip N.                                                                                                                                |
| 3.2.9  | **Audio tracks**                     | Map từng field. Thêm `duration` nếu thiếu (từ asset metadata resolver). Thêm `playbackRate: 1.0` default.                                                                                  |
| 3.2.10 | **Caption tracks**                   | Copy nguyên.                                                                                                                                                                               |
| 3.2.11 | **Extensions**                       | `extensions.constraints` → `extensions["com.moticlip.constraints"]`, `extensions.events` → `extensions["com.moticlip.events"]`                                                             |
| 3.2.12 | **Component dependencies**           | Copy sang `dependencies.components[]`                                                                                                                                                      |

### Task 3.3: Implement diagnostic emission

| #     | Diagnostic code               | Trigger condition                                      | Severity |
| ----- | ----------------------------- | ------------------------------------------------------ | -------- |
| 3.3.1 | `MIG_MISSING_AUDIO_DURATION`  | Audio track không có duration và resolver không trả về | warning  |
| 3.3.2 | `MIG_TRANSITION_OVERFLOW`     | Transition duration > clip/scene duration              | warning  |
| 3.3.3 | `MIG_UNSUPPORTED_COMPONENT`   | Component dependency version không resolve được        | error    |
| 3.3.4 | `MIG_BRAND_FONT_UNRESOLVED`   | Brand font không map được font asset                   | warning  |
| 3.3.5 | `MIG_ASPECT_PRESET_AMBIGUOUS` | Aspect ratio preset map qua default dimensions         | info     |
| 3.3.6 | `MIG_SCENE_ORDER_EMPTY`       | `sceneOrder` rỗng, dùng scene array order              | info     |

### Task 3.4: Tạo golden migration fixtures

| #     | Subtask                            | File                                                                |
| ----- | ---------------------------------- | ------------------------------------------------------------------- |
| 3.4.1 | v2 minimal → v3 minimal            | `__fixtures__/migration/v2-minimal.in.json` + `v2-minimal.out.json` |
| 3.4.2 | v2 sceneOrder → v3 visualTracks    | `scene-order.in.json` + `scene-order.out.json`                      |
| 3.4.3 | v2 transition → v3 clip transition | `transition.in.json` + `transition.out.json`                        |
| 3.4.4 | v2 brand/designTokens → v3 tokens  | `brand.in.json` + `brand.out.json`                                  |
| 3.4.5 | v2 audio → v3 audio                | `audio.in.json` + `audio.out.json`                                  |

### Task 3.5: Viết migration tests

| #     | Subtask                        | File                             | Chi tiết                                                               |
| ----- | ------------------------------ | -------------------------------- | ---------------------------------------------------------------------- |
| 3.5.1 | Golden tests                   | `v3/migrations/v2-to-v3.test.ts` | Mỗi cặp in/out: parse v2 → migrate → assert deepStrictEqual với golden |
| 3.5.2 | Determinism test               | (cùng file)                      | Migrate cùng input 2 lần → output giống hệt                            |
| 3.5.3 | Diagnostic tests               | (cùng file)                      | Mock resolver để trigger từng diagnostic code                          |
| 3.5.4 | Round-trip: v2 → v3 → parse v3 | (cùng file)                      | Assert v3 output parse được bởi `MotionProjectV3Schema`                |

### Gate checklist Phase 3

- [ ] Migration deterministic (cùng input → cùng output)
- [ ] 5 golden tests pass
- [ ] Mỗi diagnostic code có test
- [ ] v3 output luôn parse được
- [ ] v2 tests không bị ảnh hưởng

---

## Phase 4 — Parse API And Compatibility Surface

**Mục tiêu:** Cho phép app adopt v3 dần dần qua unified parse API.

### Task 4.1: Implement `parseMotionProjectAny`

| #     | Subtask                                                                | File                                        | Chi tiết                                                                                                          |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 4.1.1 | Define tagged union type                                               | `packages/motion-protocol/src/parse-any.ts` | `type ParsedMotionProject = { version: 2, project: MotionProjectV2 } \| { version: 3, project: MotionProjectV3 }` |
| 4.1.2 | Implement discriminator logic                                          | (cùng file)                                 | Đọc `format` + `formatVersion` → route đúng parser                                                                |
| 4.1.3 | Implement `parseMotionProjectAny(input: unknown): ParsedMotionProject` | (cùng file)                                 | Gọi `normalizeLegacyMotionInput` trước khi parse                                                                  |
| 4.1.4 | Error handling                                                         | (cùng file)                                 | Ném `MotionProjectParseError` với code + path thay vì Zod error thô                                               |

### Task 4.2: Implement `parseMotionProjectV3`

| #     | Subtask                                                      | File                                       | Chi tiết                                |
| ----- | ------------------------------------------------------------ | ------------------------------------------ | --------------------------------------- |
| 4.2.1 | `parseMotionProjectV3(input: unknown): MotionProjectV3`      | `packages/motion-protocol/src/v3/parse.ts` | Validate + reference check              |
| 4.2.2 | `serializeMotionProjectV3(project: MotionProjectV3): string` | (cùng file)                                | `JSON.stringify` với canonical key sort |
| 4.2.3 | Reference validation                                         | (cùng file)                                | Gọi `validateMotionProjectV3References` |

### Task 4.3: Implement version-aware `normalizeLegacyMotionInput`

| #     | Subtask                              | File                                       | Chi tiết                         |
| ----- | ------------------------------------ | ------------------------------------------ | -------------------------------- |
| 4.3.1 | Mở rộng `normalizeLegacyMotionInput` | `packages/motion-protocol/src/v2/parse.ts` | Hỗ trợ cả v3 text payload format |
| 4.3.2 | Đảm bảo backward compat              | (cùng file)                                | v2 tests vẫn pass                |

### Task 4.4: Quyết định canonical alias strategy

| #     | Subtask                       | Chi tiết                                             |
| ----- | ----------------------------- | ---------------------------------------------------- |
| 4.4.1 | Short term (hiện tại)         | `MotionProject = MotionProjectV2`                    |
| 4.4.2 | Migration phase (sau Phase 5) | `MotionProject = MotionProjectV2 \| MotionProjectV3` |
| 4.4.3 | Final phase (sau Phase 12)    | `MotionProject = MotionProjectV3`                    |

### Task 4.5: Generate JSON Schema

| #     | Subtask             | File                                      | Chi tiết                                          |
| ----- | ------------------- | ----------------------------------------- | ------------------------------------------------- |
| 4.5.1 | Tạo script generate | `scripts/generate-json-schema.ts`         | Dùng `zod-to-json-schema` hoặc `z.toJSONSchema()` |
| 4.5.2 | Generate v2 schema  | `packages/motion-protocol/schema/v2.json` | Output JSON Schema Draft-07                       |
| 4.5.3 | Generate v3 schema  | `packages/motion-protocol/schema/v3.json` | Output JSON Schema Draft-07                       |
| 4.5.4 | Add CI check        | `.github/workflows/`                      | Assert generated schema up-to-date                |

### Gate checklist Phase 4

- [ ] `parseMotionProjectAny` parse cả v2 và v3
- [ ] `serializeMotionProjectV3` output parse-able
- [ ] JSON Schema generation reproducible
- [ ] Apps có thể load v2 qua unified API

---

## Phase 5 — Compiler V3 Entry Point

**Mục tiêu:** Compiler là con đường duy nhất từ v3 authoring → runtime IR.

### Task 5.1: Tạo `compileMotionProjectV3`

| #     | Subtask                             | File                                         | Chi tiết                                                                                                                 |
| ----- | ----------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 5.1.1 | Tạo entry point                     | `packages/motion-compiler/src/compile-v3.ts` | `compileMotionProjectV3(project: MotionProjectV3, options?: CompileV3Options): CompileResult<NormalizedMotionProjectV2>` |
| 5.1.2 | Define `CompileV3Options`           | (cùng file)                                  | `{ profile?: 'embedded-components' \| 'flattened-components', textMeasurementProvider?, assetMetadataProvider? }`        |
| 5.1.3 | Keep `compileMotionProject` working | `packages/motion-compiler/src/index.ts`      | Detect version → route                                                                                                   |

### Task 5.2: Compile `composition` → runtime metadata

| #     | Subtask                            | Chi tiết                                          |
| ----- | ---------------------------------- | ------------------------------------------------- |
| 5.2.1 | Map `composition.width/height/fps` | Vào `NormalizedMotionProjectV2` metadata/viewport |
| 5.2.2 | Map `composition.background`       | Thành default solid background layer              |
| 5.2.3 | Map `composition.colorSpace`       | Vào runtime color metadata                        |
| 5.2.4 | Map `composition.audioSampleRate`  | Vào runtime audio context                         |
| 5.2.5 | Map `composition.safeArea`         | Vào runtime viewport constraints                  |
| 5.2.6 | Map `composition.motionBlur`       | Default motion blur settings                      |

### Task 5.3: Compile `timeline.visualTracks` → composition plan

| #     | Subtask                                | Chi tiết                                                                        |
| ----- | -------------------------------------- | ------------------------------------------------------------------------------- |
| 5.3.1 | Iterate `visualTracks[]` đúng order    | Sort theo `track.order`                                                         |
| 5.3.2 | Với mỗi `VisualClip`: resolve `source` | `scene` source: lookup scene by ID. `component` source: lookup component by ID. |
| 5.3.3 | Compile clip timing                    | `start`, `duration`, `trimStart` → clip local time range                        |
| 5.3.4 | Compile `playbackRate`                 | Scale scene time                                                                |
| 5.3.5 | Compile `loop`                         | Wrap scene time modulo duration                                                 |
| 5.3.6 | Compile `opacity`                      | Apply clip-level opacity multiplier                                             |
| 5.3.7 | Compile `transitionIn/transitionOut`   | Generate transition layer plan                                                  |
| 5.3.8 | Output: `CompiledCompositionTimeline`  | Array of resolved clips with timing maps                                        |

### Task 5.4: Compile scene-local clips → runtime tracks

| #     | Subtask                       | Chi tiết                                            |
| ----- | ----------------------------- | --------------------------------------------------- |
| 5.4.1 | Iterate `scene.clips[]`       | Mỗi clip → expand preset (nếu có) → property tracks |
| 5.4.2 | Compile `PropertyTrack[]`     | Resolve keys, easing, pre/post behavior             |
| 5.4.3 | Compile `targetId`            | Map clip target → node ID trong scene               |
| 5.4.4 | Compile `schedule`            | Resolve absolute/relative timing → clip start time  |
| 5.4.5 | Output: `RuntimeSceneTrack[]` | Đã resolve time, không còn schedule abstraction     |

### Task 5.5: Resolve variables và bindings

| #     | Subtask                           | Chi tiết                                                      |
| ----- | --------------------------------- | ------------------------------------------------------------- |
| 5.5.1 | Build variable map                | `Map<variableId, resolvedValue>` từ `variables[]`             |
| 5.5.2 | Resolve `ProjectBinding[]`        | Mỗi binding: lookup variable → apply vào target property path |
| 5.5.3 | Resolve token references          | `tokens.fonts.*` → lookup font asset                          |
| 5.5.4 | Resolve asset variable references | `type: "asset"` → verify asset tồn tại                        |
| 5.5.5 | Error: unresolved variable        | Diagnostic với path `variables[id].value`                     |

### Task 5.6: Compile components

| #     | Subtask                         | Chi tiết                                                                   |
| ----- | ------------------------------- | -------------------------------------------------------------------------- |
| 5.6.1 | Detect component instances      | Scene node `type: "component"` → lookup `components[]`                     |
| 5.6.2 | Profile: `embedded-components`  | Copy definition vào runtime, namespace IDs                                 |
| 5.6.3 | Profile: `flattened-components` | Expand component nodes thành normal nodes, resolve bindings, namespace IDs |
| 5.6.4 | Verify `integrity`              | Component hash khớp `dependencies[].integrity`                             |
| 5.6.5 | Error: missing component        | Diagnostic nếu component ID không trong `components[]`                     |

### Task 5.7: Bake text layout và captions

| #     | Subtask                | Chi tiết                                                 |
| ----- | ---------------------- | -------------------------------------------------------- |
| 5.7.1 | Iterate text nodes     | Dùng `defaultTextMeasurementProvider` để estimate        |
| 5.7.2 | Bake text layout input | `fontSize`, `fontFamily`, `maxWidth` → `TextLayoutInput` |
| 5.7.3 | Compile captions       | `compileCaptionTracks()` → `CompiledCaptionTrack[]`      |
| 5.7.4 | Segment caption tokens | `segmentTextUnits()` → runtime-ready cue data            |

### Task 5.8: Build compile cache key

| #     | Subtask                             | Chi tiết                           |
| ----- | ----------------------------------- | ---------------------------------- |
| 5.8.1 | Include `projectHash`               | Từ canonical serializer            |
| 5.8.2 | Include `compilerVersion`           | `COMPILER_VERSION` constant        |
| 5.8.3 | Include `protocolVersion`           | `MOTION_PROJECT_V3_FORMAT_VERSION` |
| 5.8.4 | Include `capabilityRegistryVersion` | Hash của capability registry       |
| 5.8.5 | Include `componentDependencyHashes` | Mỗi component → `integrity` hash   |
| 5.8.6 | `buildCompileCacheKeyV3()`          | Return `string` key                |

### Task 5.9: Compiler diagnostics

| #     | Diagnostic code                    | Condition                              |
| ----- | ---------------------------------- | -------------------------------------- |
| 5.9.1 | `CMP_UNRESOLVED_VARIABLE`          | Variable reference không tồn tại       |
| 5.9.2 | `CMP_UNRESOLVED_COMPONENT`         | Component ID không trong dependencies  |
| 5.9.3 | `CMP_UNRESOLVED_ASSET`             | Asset ID trong node không tồn tại      |
| 5.9.4 | `CMP_UNRESOLVED_PRESET`            | Preset ID không trong registry         |
| 5.9.5 | `CMP_CYCLE_DETECTED`               | Parent/mask/modifier cycle             |
| 5.9.6 | `CMP_COMPONENT_INTEGRITY_MISMATCH` | Component hash không khớp              |
| 5.9.7 | `CMP_BINDING_TYPE_MISMATCH`        | Variable type không khớp property kind |
| 5.9.8 | `CMP_CLIP_TARGET_MISSING`          | Clip targetId không tồn tại            |

### Task 5.10: Viết compiler tests

| #      | Subtask                           | File                                                        |
| ------ | --------------------------------- | ----------------------------------------------------------- |
| 5.10.1 | Compile minimal v3 project        | `packages/motion-compiler/src/__tests__/compile-v3.test.ts` |
| 5.10.2 | Compile representative v3 project | (cùng file)                                                 |
| 5.10.3 | Assert runtime IR validates       | Dùng `NormalizedMotionProjectV2Schema.parse()`              |
| 5.10.4 | Assert no unresolved constructs   | Check không có `$ref` hoặc placeholder                      |
| 5.10.5 | Test từng diagnostic code         | Mock input để trigger                                       |

### Gate checklist Phase 5

```powershell
pnpm.cmd --filter @motionvideo/motion-compiler test
```

- [ ] `compileMotionProjectV3` hoạt động
- [ ] Minimal v3 compiles
- [ ] Representative v3 compiles
- [ ] Runtime IR validates
- [ ] No unresolved variables/components/assets/presets
- [ ] Tất cả diagnostic codes có test
- [ ] Compile cache key deterministic

---

## Phase 6 — Runtime IR VNext

**Mục tiêu:** Runtime IR đại diện v3 composition semantics, không leak authoring concerns.

### Task 6.1: Quyết định tên type

| #     | Subtask                         | Chi tiết                                                                     |
| ----- | ------------------------------- | ---------------------------------------------------------------------------- |
| 6.1.1 | Chọn alias                      | `NormalizedMotionProjectV2` → alias `MotionRuntimeIR`                        |
| 6.1.2 | Giữ `NormalizedMotionProjectV2` | Không xóa type cũ, chỉ thêm alias                                            |
| 6.1.3 | `PreparedRuntimeProject`        | Giữ trong `motion-protocol` (hiện tại), cân nhắc move sang `motion-compiler` |

### Task 6.2: Thêm composition-level runtime metadata

| #     | Subtask                                         | File                                         | Chi tiết                                                                     |
| ----- | ----------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------- |
| 6.2.1 | Define `RuntimeCompositionMetadata`             | `packages/motion-protocol/src/v2/runtime.ts` | `{ width, height, fps, background, colorSpace, audioSampleRate, safeArea? }` |
| 6.2.2 | Add field vào `NormalizedMotionProjectV2Schema` | (cùng file)                                  | `composition: RuntimeCompositionMetadataSchema`                              |
| 6.2.3 | Migration: cũ → mới                             | (cùng file)                                  | Schema version bump nếu cần                                                  |

### Task 6.3: Thêm runtime visual track plan

| #     | Subtask                     | File                                            | Chi tiết                                                                                                                        |
| ----- | --------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 6.3.1 | Define `RuntimeVisualClip`  | (cùng file)                                     | `{ id, source: RuntimeClipSource, start, duration, trimStart?, playbackRate?, loop?, opacity?, transitionIn?, transitionOut? }` |
| 6.3.2 | Define `RuntimeVisualTrack` | (cùng file)                                     | `{ id, role, order, muted?, clips: RuntimeVisualClip[] }`                                                                       |
| 6.3.3 | Add vào runtime schema      | (cùng file)                                     | `timeline: { visualTracks?, audioTracks, captionTracks }`                                                                       |
| 6.3.4 | **Giữ `sceneOrder`**        | Backward compat: v2 compile vẫn ra `sceneOrder` |

### Task 6.4: Thêm source refs

| #     | Subtask                         | Chi tiết                                           |
| ----- | ------------------------------- | -------------------------------------------------- |
| 6.4.1 | Define `RuntimeSourceRef`       | `{ projectPath: string[], sourceModule?: string }` |
| 6.4.2 | Attach vào mỗi runtime scene    | `sourceRef: { scenes: { [sceneId]: string } }`     |
| 6.4.3 | Mục đích: debug + error mapping | Không dùng trong render hash                       |

### Task 6.5: Thêm runtime hash inputs

| #     | Subtask                              | Chi tiết                                     |
| ----- | ------------------------------------ | -------------------------------------------- |
| 6.5.1 | Define field `runtimeHash`           | Optional, được set bởi compiler              |
| 6.5.2 | Define field `compilerVersion`       | String, set bởi compiler                     |
| 6.5.3 | Define field `capabilityFingerprint` | String, hash của capability registry đã dùng |

### Task 6.6: Viết runtime IR tests

| #     | Subtask                                     | File                                                               |
| ----- | ------------------------------------------- | ------------------------------------------------------------------ |
| 6.6.1 | Validate runtime IR standalone              | `packages/motion-protocol/src/v2/__tests__/runtime-schema.test.ts` |
| 6.6.2 | Round-trip: serialize → parse runtime IR    | (cùng file)                                                        |
| 6.6.3 | Assert không có `Map` trong serialized form | (cùng file)                                                        |

### Gate checklist Phase 6

- [ ] Runtime IR serializable (không `Map`)
- [ ] `NormalizedMotionProjectV2Schema` vẫn parse được old output
- [ ] New runtime metadata fields có trong compiled output
- [ ] Runtime IR validates standalone

---

## Phase 7 — Composition Evaluator V3

**Mục tiêu:** Evaluate visual tracks thay vì chỉ `sceneOrder`.

### Task 7.1: Implement `evaluateCompositionFrameV3`

| #     | Subtask                    | File                                                     | Chi tiết                                                                               |
| ----- | -------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 7.1.1 | Tạo evaluator              | `packages/motion-runtime/src/evaluate-composition-v3.ts` | `evaluateCompositionFrameV3(runtime, globalTime, options?): EvaluatedCompositionFrame` |
| 7.1.2 | Resolve active clips       | (cùng file)                                              | Lọc visual clips active tại `globalTime`                                               |
| 7.1.3 | Resolve scene local time   | (cùng file)                                              | `sceneTime = (globalTime - clipStart - trimStart) * playbackRate`, wrap nếu loop       |
| 7.1.4 | Evaluate từng active scene | (cùng file)                                              | Gọi `evaluateFrame()` cho mỗi scene                                                    |
| 7.1.5 | Merge overlay tracks       | (cùng file)                                              | Overlay trên main, deterministic order                                                 |

### Task 7.2: Implement transition resolver

| #     | Subtask                    | File                                                 | Chi tiết                                                |
| ----- | -------------------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| 7.2.1 | `resolveTransitionLayer()` | `packages/motion-runtime/src/transition-resolver.ts` | Nhận 2 clip + transition config → transition layer plan |
| 7.2.2 | `cut`                      | Trả về empty (instant switch)                        |
| 7.2.3 | `fade`                     | From scene → to scene opacity crossfade              |
| 7.2.4 | `crossfade`                | Cả 2 scenes render, opacity crossfade                |
| 7.2.5 | `slide`                    | Translate push/cover                                 |
| 7.2.6 | `wipe`                     | Clip mask reveal                                     |
| 7.2.7 | `zoom`                     | Scale transform transition                           |

### Task 7.3: Implement audio plan resolver

| #     | Subtask                   | File                                               | Chi tiết                                                                      |
| ----- | ------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| 7.3.1 | `resolveAudioPlanV3()`    | `packages/motion-runtime/src/audio-render-plan.ts` | Resolve v3 audio tracks tại global time                                       |
| 7.3.2 | Handle duration/trim/rate | (cùng file)                                        | Audio lifetime dựa trên `duration` + `trimStart` + `trimEnd` + `playbackRate` |
| 7.3.3 | Handle fade/fadeOut       | (cùng file)                                        | Volume envelope                                                               |

### Task 7.4: Implement caption resolver

| #     | Subtask                   | File                                              | Chi tiết                          |
| ----- | ------------------------- | ------------------------------------------------- | --------------------------------- |
| 7.4.1 | `resolveCaptionStateV3()` | `packages/motion-runtime/src/caption-resolver.ts` | Active captions tại global time   |
| 7.4.2 | Token highlight           | (cùng file)                                       | Token-level active/inactive state |

### Task 7.5: Viết test fixtures cho transitions

| #     | Subtask                              | Chi tiết                                                        |
| ----- | ------------------------------------ | --------------------------------------------------------------- |
| 7.5.1 | `cut` fixture                        | 2 scenes, cut transition, test at before/start/middle/end/after |
| 7.5.2 | `fade` fixture                       | Test opacity interpolation                                      |
| 7.5.3 | `crossfade` fixture                  | Test both scenes visible                                        |
| 7.5.4 | `slide` fixture                      | Test translate                                                  |
| 7.5.5 | `wipe` fixture                       | Test clip reveal                                                |
| 7.5.6 | `zoom` fixture                       | Test scale                                                      |
| 7.5.7 | Assert same frame → same fingerprint | Determinism check                                               |

### Gate checklist Phase 7

```powershell
pnpm.cmd --filter @motionvideo/motion-runtime test
```

- [ ] 6 transition fixtures pass
- [ ] Frame fingerprints deterministic
- [ ] Hit-test matches paint snapshot
- [ ] Audio plan đúng duration/lifetime
- [ ] Caption state đúng active/inactive

---

## Phase 8 — Paint, Pixi, Remotion, Playback Adoption

**Mục tiêu:** Consumers chỉ đọc runtime/evaluated contracts.

### Task 8.1: Pixi renderer adoption

| #     | Subtask                      | File                          | Chi tiết                                         |
| ----- | ---------------------------- | ----------------------------- | ------------------------------------------------ |
| 8.1.1 | Update frame input type      | `packages/pixi-renderer/src/` | Chấp nhận `EvaluatedCompositionFrame`            |
| 8.1.2 | Remove authoring field reads | (cùng file)                   | Không import `MotionProjectV3`                   |
| 8.1.3 | Render overlay layers        | (cùng file)                   | Duyệt `layers[]` theo thứ tự                     |
| 8.1.4 | Render transitions           | (cùng file)                   | Transition layers từ `EvaluatedLayer.transition` |

### Task 8.2: Remotion renderer adoption

| #     | Subtask                      | File                              | Chi tiết                              |
| ----- | ---------------------------- | --------------------------------- | ------------------------------------- |
| 8.2.1 | Update frame input type      | `packages/remotion-renderer/src/` | Chấp nhận `EvaluatedCompositionFrame` |
| 8.2.2 | Render overlay + transitions | (cùng file)                       | Giống Pixi                            |
| 8.2.3 | Export parity test           | (cùng file)                       | Pixi vs Remotion frame pixel diff     |

### Task 8.3: Playback engine adoption

| #     | Subtask                     | File                            | Chi tiết                                              |
| ----- | --------------------------- | ------------------------------- | ----------------------------------------------------- |
| 8.3.1 | Update load type            | `packages/playback-engine/src/` | `MotionRuntimeIR` thay vì `NormalizedMotionProjectV2` |
| 8.3.2 | Remove compile in play loop | (cùng file)                     | Assert không gọi compiler trong RAF                   |
| 8.3.3 | Preload runtime IR          | (cùng file)                     | Load + prepare một lần                                |

### Task 8.4: Render worker adoption

| #     | Subtask                  | File                         | Chi tiết                                                                                                        |
| ----- | ------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 8.4.1 | Compile v3 before render | `packages/render-contracts/` | Worker nhận v3 project, compile → runtime, render                                                               |
| 8.4.2 | Update render manifest   | (cùng file)                  | Thêm `projectHash`, `runtimeHash`, `compilerVersion`, `protocolVersion`, `capabilityFingerprint`, `assetHashes` |

### Task 8.5: Capability preflight

| #     | Subtask                           | File                                               | Chi tiết                                      |
| ----- | --------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| 8.5.1 | `preflightCapabilities()`         | `packages/motion-runtime/src/capability-ledger.ts` | So sánh `capabilities.required` với supported |
| 8.5.2 | Hard error nếu thiếu required     | (cùng file)                                        | Throw `CapabilityPreflightError`              |
| 8.5.3 | Warning nếu thiếu optional        | (cùng file)                                        | Diagnostic                                    |
| 8.5.4 | Block nếu experimental + flag off | (cùng file)                                        | Kiểm tra `FeatureFlag`                        |

### Gate checklist Phase 8

- [ ] Pixi và Remotion render cùng composition plan
- [ ] Pixel diff trong ngưỡng
- [ ] Export không compile khác preview
- [ ] Playback không compile trong RAF loop
- [ ] Capability preflight hoạt động

---

## Phase 9 — Editor And AI Adoption

**Mục tiêu:** Chuyển authoring surfaces từ v2 → v3.

### Task 9.1: Editor project creation

| #     | Subtask                  | File                        | Chi tiết                       |
| ----- | ------------------------ | --------------------------- | ------------------------------ |
| 9.1.1 | `createEmptyProjectV3()` | `packages/editor-core/src/` | Tạo `MotionProjectV3` mặc định |
| 9.1.2 | Update new project flow  | (cùng file)                 | Default → v3 thay vì v2        |

### Task 9.2: Editor persistence

| #     | Subtask             | File        | Chi tiết                                     |
| ----- | ------------------- | ----------- | -------------------------------------------- |
| 9.2.1 | `loadProject()`     | (cùng file) | Dùng `parseMotionProjectAny`, detect version |
| 9.2.2 | `saveProject()`     | (cùng file) | Serialize theo version hiện tại              |
| 9.2.3 | Migration prompt    | (cùng file) | Nếu mở v2 → hỏi "Migrate to v3?"             |
| 9.2.4 | Auto-migrate policy | (cùng file) | Setting: auto-migrate / ask / keep-v2        |

### Task 9.3: Editor timeline projection

| #     | Subtask                 | File        | Chi tiết                              |
| ----- | ----------------------- | ----------- | ------------------------------------- |
| 9.3.1 | v2 compat projection    | (cùng file) | Map `sceneOrder` → visual track UI    |
| 9.3.2 | v3 canonical projection | (cùng file) | Map `visualTracks` → timeline UI      |
| 9.3.3 | Edit commands           | (cùng file) | Move/trim/reorder → ghi `visualClips` |

### Task 9.4: Editor state isolation

| #     | Subtask                           | File                                       | Chi tiết                                                                       |
| ----- | --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| 9.4.1 | Define editor state schema        | `packages/editor-core/src/editor-state.ts` | `currentTime, playing, selectedIds, zoom, scroll, activePanel, stageTransform` |
| 9.4.2 | Tách khỏi project JSON            | (cùng file)                                | Editor state file riêng, không trong `.mt`                                     |
| 9.4.3 | Assert không leak vào render hash | Test                                       | Xóa editor state → hash không đổi                                              |

### Task 9.5: AI schema adoption

| #     | Subtask                    | File                   | Chi tiết                                               |
| ----- | -------------------------- | ---------------------- | ------------------------------------------------------ |
| 9.5.1 | Update prompt schema block | `packages/ai-planner/` | Dùng v3 JSON Schema                                    |
| 9.5.2 | Capability-gated allowlist | (cùng file)            | Chỉ allow field có capability tương ứng                |
| 9.5.3 | v3 command patching        | (cùng file)            | Variables, tokens, visual clips, scene nodes, captions |
| 9.5.4 | Critic checks              | (cùng file)            | Validate v3 timeline/capability invariants             |

### Gate checklist Phase 9

- [ ] AI generate được minimal v3 project
- [ ] Editor: open v2 → migrate → save v3 → compile → preview
- [ ] Undo/redo commit canonical v3 transactions
- [ ] Editor state không trong project JSON

---

## Phase 10 — Workspace And Linker

**Mục tiêu:** Hỗ trợ multi-file project; renderers không biết workspace shape.

### Task 10.1: Tạo package `motion-workspace`

| #      | Subtask      | Chi tiết                                           |
| ------ | ------------ | -------------------------------------------------- |
| 10.1.1 | Tạo package  | `packages/motion-workspace/package.json`           |
| 10.1.2 | Dependencies | `@motionvideo/motion-protocol: workspace:*`, `zod` |
| 10.1.3 | Main entry   | `src/index.ts`                                     |

### Task 10.2: Implement `MotionWorkspaceManifestSchema`

| #      | Subtask | File            | Chi tiết                                                                                                                                |
| ------ | ------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 10.2.1 | Schema  | `src/schema.ts` | `{ format: "motion-workspace", formatVersion: 1, id, entry: { timeline, assets }, imports: { tokens, variables, scenes, components } }` |
| 10.2.2 | Type    | (cùng file)     | `MotionWorkspaceManifest`                                                                                                               |

### Task 10.3: Implement `MotionWorkspaceReader`

| #      | Subtask           | File            | Chi tiết                                                                                                                                       |
| ------ | ----------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 10.3.1 | Interface         | `src/loader.ts` | `{ readText(path): Promise<string>, readBinary(path): Promise<Uint8Array>, exists(path): Promise<boolean>, resolve(from, specifier): string }` |
| 10.3.2 | Memory reader     | `src/loader.ts` | `createMemoryReader(files: Map<string, string>)`                                                                                               |
| 10.3.3 | Filesystem reader | `src/loader.ts` | `createFilesystemReader(root: string)`                                                                                                         |

### Task 10.4: Implement linker pipeline

| #       | Step                      | File                  | Chi tiết                                               |
| ------- | ------------------------- | --------------------- | ------------------------------------------------------ |
| 10.4.1  | Read manifest             | `src/linker.ts`       | Parse `workspace.mt`                                   |
| 10.4.2  | Parse modules             | (cùng file)           | Parse từng file imported (scene, component, variables) |
| 10.4.3  | Resolve paths             | (cùng file)           | Relative → absolute                                    |
| 10.4.4  | Detect import cycles      | (cùng file)           | DFS trên import graph                                  |
| 10.4.5  | Validate module-local IDs | (cùng file)           | ID không trùng trong module                            |
| 10.4.6  | Resolve assets/components | (cùng file)           | Lookup từ manifest                                     |
| 10.4.7  | Namespace instances       | (cùng file)           | Prefix scope cho component instances                   |
| 10.4.8  | Merge variables/tokens    | (cùng file)           | Merge theo thứ tự import                               |
| 10.4.9  | Build canonical project   | (cùng file)           | Assemble `MotionProjectV3`                             |
| 10.4.10 | Validate cross-references | (cùng file)           | Scene → component → asset                              |
| 10.4.11 | Canonical serialize       | `src/canonicalize.ts` | Sort keys, deterministic output                        |
| 10.4.12 | Compute hash              | `src/canonicalize.ts` | `sourceHash`                                           |

### Task 10.5: Implement bundle profiles

| #      | Subtask                | File            | Chi tiết                              |
| ------ | ---------------------- | --------------- | ------------------------------------- |
| 10.5.1 | `embedded-components`  | `src/linker.ts` | Giữ component definitions + instances |
| 10.5.2 | `flattened-components` | `src/linker.ts` | Expand thành normal nodes             |

### Task 10.6: Security: block absolute paths

| #      | Subtask                  | Chi tiết                                 |
| ------ | ------------------------ | ---------------------------------------- |
| 10.6.1 | Validate portable bundle | Không có path tuyệt đối                  |
| 10.6.2 | Validate source map      | Path workspace-relative, POSIX separator |

### Task 10.7: Viết tests

| #      | Subtask                       | File                                                    |
| ------ | ----------------------------- | ------------------------------------------------------- |
| 10.7.1 | Memory linker test            | `src/__tests__/linker.test.ts`                          |
| 10.7.2 | Cycle detection test          | (cùng file)                                             |
| 10.7.3 | Semantic equivalence test     | (cùng file): workspace bundle == single-file v3 project |
| 10.7.4 | Source map deterministic test | (cùng file)                                             |
| 10.7.5 | Absolute path rejection test  | (cùng file)                                             |

### Gate checklist Phase 10

- [ ] Workspace bundle = single-file v3 project (về semantic)
- [ ] Source map deterministic
- [ ] Absolute paths rejected
- [ ] Renderers không import `motion-workspace`

---

## Phase 11 — Hashing, Manifests, And Determinism

**Mục tiêu:** Preview/export reproducible và debuggable.

### Task 11.1: Implement canonical serializer

| #      | Subtask                                                            | File                                              | Chi tiết                                          |
| ------ | ------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------- |
| 11.1.1 | `canonicalizeProjectV3(project: MotionProjectV3): MotionProjectV3` | `packages/motion-protocol/src/v3/canonicalize.ts` | Sort arrays theo declaration order + ID tie-break |
| 11.1.2 | Sort object keys                                                   | (cùng file)                                       | Alphabetical key order trong JSON                 |
| 11.1.3 | Sort: scenes theo timeline order                                   | (cùng file)                                       | Theo `visualTracks` clip order                    |
| 11.1.4 | Sort: nodes theo `zIndex` then ID                                  | (cùng file)                                       | Stability guarantee                               |
| 11.1.5 | Sort: clips theo `start` time then ID                              | (cùng file)                                       |                                                   |
| 11.1.6 | Sort: tracks theo `t` key                                          | (cùng file)                                       |                                                   |

### Task 11.2: Implement hashing

| #      | Subtask                                                                                                | File                                            | Chi tiết                   |
| ------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------- |
| 11.2.1 | `hashProjectV3(project: MotionProjectV3): string`                                                      | `packages/motion-protocol/src/v3/hash.ts`       | SHA-256 của canonical JSON |
| 11.2.2 | Exclude từ hash: `provenance`, `metadata.createdAt`, `metadata.updatedAt`, `extensions` (trừ declared) | (cùng file)                                     | Strip trước khi hash       |
| 11.2.3 | `hashRuntime(runtime: MotionRuntimeIR): string`                                                        | (cùng file)                                     | SHA-256 của runtime JSON   |
| 11.2.4 | `hashSource(files: Map<string, string>): string`                                                       | `packages/motion-workspace/src/canonicalize.ts` | Hash workspace modules     |

### Task 11.3: Implement render manifest

| #      | Subtask                | File                             | Chi tiết                                                                                                                    |
| ------ | ---------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 11.3.1 | `RenderManifestSchema` | `packages/render-contracts/src/` | `{ projectHash, runtimeHash, compilerVersion, protocolVersion, capabilityFingerprint, assetHashes, fontHashes, timestamp }` |
| 11.3.2 | Generate từ compiler   | (cùng file)                      | Compiler output → manifest                                                                                                  |

### Task 11.4: Deterministic time quantization

| #      | Subtask                                        | File                                         | Chi tiết                        |
| ------ | ---------------------------------------------- | -------------------------------------------- | ------------------------------- |
| 11.4.1 | `quantizeTime(t: number, fps: number): number` | `packages/motion-runtime/src/determinism.ts` | Round về nearest frame boundary |
| 11.4.2 | `quantizeFrame(frame: number): number`         | (cùng file)                                  | Integer frame index             |

### Task 11.5: Viết tests

| #      | Subtask                            | File                     |
| ------ | ---------------------------------- | ------------------------ |
| 11.5.1 | Same project → same hash           | `__tests__/hash.test.ts` |
| 11.5.2 | Different project → different hash | (cùng file)              |
| 11.5.3 | Provenance change → hash unchanged | (cùng file)              |
| 11.5.4 | Timestamp change → hash unchanged  | (cùng file)              |
| 11.5.5 | Render manifest reproducibility    | (cùng file)              |

### Gate checklist Phase 11

- [ ] Same semantic → same `projectHash`
- [ ] Same runtime → same `runtimeHash`
- [ ] Render manifest reproducible
- [ ] Provenance/timestamps excluded from hash

---

## Phase 12 — Remove V2 As Canonical

**Mục tiêu:** Hoàn tất migration, v3 là canonical.

### Task 12.1: Flip canonical alias

| #      | Subtask                                       | File                                    | Chi tiết                           |
| ------ | --------------------------------------------- | --------------------------------------- | ---------------------------------- |
| 12.1.1 | `MotionProject = MotionProjectV3`             | `packages/motion-protocol/src/index.ts` | Đổi alias                          |
| 12.1.2 | `MotionProjectV2` giữ lại                     | (cùng file)                             | Export explicit: `MotionProjectV2` |
| 12.1.3 | `MotionProjectSchema = MotionProjectV3Schema` | (cùng file)                             | Default schema                     |
| 12.1.4 | `parseMotionProject` → v3                     | (cùng file)                             | Default parse                      |

### Task 12.2: Deprecate v2 paths

| #      | Subtask                                 | Chi tiết                  |
| ------ | --------------------------------------- | ------------------------- |
| 12.2.1 | `parseMotionProjectV2` → `@deprecated`  | JSDoc tag                 |
| 12.2.2 | `MotionProjectV2Schema` → `@deprecated` | JSDoc tag                 |
| 12.2.3 | `compileMotionProject` → route v3       | Fallback v2 nếu version 2 |

### Task 12.3: Stop v2 emission

| #      | Subtask                   | File                    | Chi tiết                                   |
| ------ | ------------------------- | ----------------------- | ------------------------------------------ |
| 12.3.1 | New project → v3 only     | `packages/editor-core/` | `createEmptyProject` → v3                  |
| 12.3.2 | Editor commands → v3 only | (cùng file)             | Không ghi `sceneOrder`, `scene.transition` |
| 12.3.3 | AI generation → v3 only   | `packages/ai-planner/`  | Prompt dùng v3 schema                      |

### Task 12.4: Verifications

| #      | Subtask                      | Chi tiết                                      |
| ------ | ---------------------------- | --------------------------------------------- |
| 12.4.1 | `rg "timeline.sceneOrder"`   | Chỉ còn trong migration/tests/legacy adapters |
| 12.4.2 | `rg "scene.transition"`      | Chỉ còn trong migration/tests/legacy adapters |
| 12.4.3 | New projects are v3          | Integration test                              |
| 12.4.4 | v2 projects still importable | Migration path test                           |

### Gate checklist Phase 12

- [ ] `MotionProject` alias → v3
- [ ] v2 importable qua migration
- [ ] New projects v3 only
- [ ] Không còn `sceneOrder`/`scene.transition` trong production code

---

## Test Matrix Tổng Hợp

Sau mỗi phase, chạy:

```powershell
pnpm.cmd --filter @motionvideo/motion-protocol test
pnpm.cmd --filter @motionvideo/motion-compiler test
pnpm.cmd --filter @motionvideo/motion-runtime test
pnpm.cmd --filter @motionvideo/playback-engine test
pnpm.cmd --filter @motionvideo/pixi-renderer test
pnpm.cmd --filter @motionvideo/remotion-renderer test
pnpm.cmd --filter @motionvideo/render-contracts test
pnpm.cmd --filter @motionvideo/motion-workspace test
```

### V3-specific test suites

| #   | Suite                                | Phase | File dự kiến                                    |
| --- | ------------------------------------ | ----- | ----------------------------------------------- |
| 1   | protocol v3 positive fixtures        | 2     | `v3/__tests__/schema.test.ts`                   |
| 2   | protocol v3 negative fixtures        | 2     | (cùng file)                                     |
| 3   | v2 → v3 migration goldens            | 3     | `v3/migrations/v2-to-v3.test.ts`                |
| 4   | v3 compile snapshots                 | 5     | `__tests__/compile-v3.test.ts`                  |
| 5   | v3 evaluated frame fingerprints      | 7     | `__tests__/frame-fingerprints-v3.test.ts`       |
| 6   | v3 transition fixtures               | 7     | `__tests__/transition-fixtures.test.ts`         |
| 7   | v3 audio plan fixtures               | 7     | `__tests__/audio-plan-v3.test.ts`               |
| 8   | v3 caption/cue fixtures              | 7     | `__tests__/caption-resolver-v3.test.ts`         |
| 9   | Pixi/Remotion parity over v3 runtime | 8     | `__tests__/parity-v3.test.ts`                   |
| 10  | editor command transaction fixtures  | 9     | `__tests__/editor-v3-transactions.test.ts`      |
| 11  | AI generation/patch fixtures         | 9     | `__tests__/ai-v3-generate.test.ts`              |
| 12  | workspace linker tests               | 10    | `motion-workspace/src/__tests__/linker.test.ts` |
| 13  | hash determinism tests               | 11    | `__tests__/hash.test.ts`                        |

---

## File Manifest Tổng Hợp

### Files mới cần tạo

```text
packages/motion-protocol/src/v3/
  index.ts
  common.ts
  metadata.ts
  composition.ts
  capabilities.ts
  assets.ts
  variables.ts
  components.ts
  scenes.ts
  timeline.ts
  extensions.ts
  provenance.ts
  parse.ts
  canonicalize.ts
  hash.ts
  nodes/
    index.ts
    base.ts
    text.ts
    media.ts
    geometry.ts
    structural.ts
  animation/
    index.ts
    clips.ts
    tracks.ts
    easing.ts
    drivers.ts
  references/
    index.ts
    types.ts
    project.ts
    node-graph.ts
    clips.ts
    assets.ts
  migrations/
    v2-to-v3.ts
  __tests__/
    schema.test.ts
    parse.test.ts
  __fixtures__/
    v3/
      minimal-empty.project.json
      representative.project.json
    migration/
      v2-minimal.in.json
      v2-minimal.out.json
      scene-order.in.json
      scene-order.out.json
      transition.in.json
      transition.out.json
      brand.in.json
      brand.out.json
      audio.in.json
      audio.out.json

packages/motion-compiler/src/
  compile-v3.ts
  timeline-v3.ts
  __tests__/
    compile-v3.test.ts
  __fixtures__/
    v2-compile-goldens/
    v3-compile-goldens/

packages/motion-runtime/src/
  evaluate-composition-v3.ts
  transition-resolver.ts
  caption-resolver.ts
  __tests__/
    frame-fingerprints.test.ts
    frame-fingerprints-v3.test.ts
    transition-fixtures.test.ts
    audio-plan-v3.test.ts
    caption-resolver-v3.test.ts

packages/motion-workspace/
  package.json
  tsconfig.json
  src/
    index.ts
    schema.ts
    loader.ts
    resolver.ts
    linker.ts
    canonicalize.ts
    source-map.ts
    __tests__/
      linker.test.ts
```

### Files cần sửa

```text
packages/motion-protocol/src/
  index.ts                            (thêm v3 export, flip alias)
  v2/parse.ts                         (normalizeLegacyMotionInput mở rộng)

packages/motion-compiler/src/
  index.ts                            (thêm compile-v3, route version)
  compile-result.ts                   (thêm CompileV3Options)
  compile-cache.ts                    (thêm buildCompileCacheKeyV3)

packages/motion-runtime/src/
  index.ts                            (thêm export mới)
  evaluated-frame.ts                  (extend cho v3)
  evaluated-composition-frame.ts      (extend cho v3)
  audio-render-plan.ts                (thêm resolveAudioPlanV3)
  diagnostics.ts                      (thêm diagnostic codes)
  cancellation.ts                     (đã có)
  version-policy.ts                   (đã có)

packages/pixi-renderer/src/           (update type imports)
packages/remotion-renderer/src/       (update type imports)
packages/playback-engine/src/         (update type imports)
packages/render-contracts/src/        (render manifest update)
packages/editor-core/src/             (v3 creation/persistence/edit)
packages/ai-planner/src/              (v3 schema prompt)
```
