# `@motionvideo/motion-protocol`

**Standard Zod Validation Schema** và **TypeScript Type System** cho Motion Format V3 — the **only authoring protocol**. Package này đóng vai trò là hợp đồng dữ liệu chuẩn hóa (Canonical Contract) duy nhất giữa **Authoring Tools (Editor / AI Generator)**, **Component Registry** và **Renderer Engine**.

> **V3 is the only authoring protocol.** `formatVersion` must be `3`. Compat layer and V2 authoring types have been permanently removed from the source tree. All public APIs use neutral canonical names (`EffectSchema`, `BrandSchema`, `NodeTimingSchema` — no `V2` suffix).

> **For AI agents / MCP / Skills:** Generate `MotionProjectV3`. Use `visualTracks` (not `sceneOrder`). Transitions live on `VisualClip.transitionOut`. Runtime IR is produced by `@motionvideo/motion-compiler` — you only author the project JSON.

---

## 🎯 Mục đích & Triết lý Thiết kế

1. **Single Source of Truth cho Format v3**: Định nghĩa chính xác cấu trúc dữ liệu cho Project (`.mt`), Component (`.mvc`), Patch, và Normalized IR. Editor, AI planner, compiler và hai bridge render (Pixi / Remotion) đều validate cùng một schema — không có “schema riêng theo engine”.

2. **Authoring IR vs. Runtime IR Pipeline**:
   - **Authoring IR** (`MotionProjectV3`, `MotionComponentV3`): Định dạng dành cho Editor & AI. Hỗ trợ biến (`variables`), tham số công khai (`publicParams`), binding, component instances (`type: "component"`), repeat directives, presets, text animators, caption tracks, và layout modifiers.
   - **Runtime IR** (`MotionRuntimeProject`): Định dạng dành riêng cho Renderer. Toàn bộ biến đã được resolve thành giá trị literal, component instances đã được flatten/expand, repeat nodes được clone, presets & text animators được biên dịch thành keyframe tracks thực tế. Ranh giới chuyển đổi nằm ở `@motionvideo/motion-compiler`.

3. **An toàn dữ liệu nghiêm ngặt (Strict Validation & Bounds)**:
   - Sử dụng Zod `discriminatedUnion` và `.strict()` nhằm reject thuộc tính lạ hoặc dữ liệu rác.
   - Cấm giá trị numeric không hữu hạn (`NaN`, `Infinity`).
   - Kiểm soát giới hạn cứng qua `MOTION_PROTOCOL_LIMITS` (internal, [`src/capabilities.ts`](./src/capabilities.ts)) — áp dụng cho cả V3 authoring lẫn runtime IR.

4. **Normalize tại biên parse**: Payload cũ (ví dụ `payload.text`) được chuẩn hóa khi gọi `parseMotionProject`. Serializer chỉ ghi shape mới (`payload.content`). File cũ vẫn đọc được, file ghi ra luôn đồng nhất.

5. **Property Capability Registry + AI matrix**: Quản lý từ vựng thuộc tính (animate / bind / public UI) và bảng [`AI_SCHEMA_CAPABILITY_MATRIX`](./src/ai-schema-capability.ts) ghi rõ capability nào đã đi xuyên suốt schema → compile → runtime → paint → Pixi → Remotion. AI allowlist chỉ mở khi gate E2E xanh.

---

## 📁 Cấu trúc Package

Package gồm các module chính trong [`src/`](./src):

- [`index.ts`](./src/index.ts): Export chính. Cung cấp alias canonical (`MotionProject`, `Node`, `Scene`, `parseMotionProject`, …) và re-export capabilities / AI matrix.
- [`v3/`](./src/v3): Schema v3 chia theo domain (authoring format):
  - `common`, `values`, `transform`, `effects`, `layout`, `modifiers`, `assets`, `variables`
  - `nodes/` — text, geometry, media, structural, paint, base
  - `animation/` — clips (gồm `scene-end`), tracks, easing, drivers
  - `captions.ts`, `source-ref.ts`, `project.ts`, `component.ts`, `runtime.ts`
  - `parse.ts` — parse + normalize + serialize
  - `patch.ts`, `references/` — kiểm tra tham chiếu sau Zod
- [`capabilities.ts`](./src/capabilities.ts): `MOTION_PROTOCOL_LIMITS` (internal) và bảng đăng ký khả năng thuộc tính (`motionPropertyCapability`) cho AI/UI.
- [`ai-schema-capability.ts`](./src/ai-schema-capability.ts): Ma trận E2E cho AI schema expansion (phiên bản `ai-schema.1`).
- [`scene-registry.ts`](./src/scene-registry.ts): Registry template scene theo role (`hook`, `solution`, `cta`, …).

---

## 🧩 Các Artifact Schemas Chính

```text
JSON Input  ──► normalizeLegacyMotionInput()
                       │
                       ▼ Structural + Limit Validation (Zod)
             Typed MotionProjectV3 / MotionComponentV3 (Authoring IR)
                       │
                       ▼ Reference validation
                       │
                       ▼ Compiler (@motionvideo/motion-compiler)
             MotionRuntimeProject (Literal, Flat, Renderer-Ready)
                       │
                       ▼ Runtime evaluate → PaintCommandBuffer
             Pixi preview  /  Remotion export
```

| Schema / Type                                   | Version | Mô tả                                                                                                          |
| ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------- |
| `MotionProjectV3Schema` / `MotionProject`       | `3`     | File dự án chuyển động (`.mt`): `scenes`, `assets`, `variables`, `timeline` (audio + caption), `dependencies`. |
| `MotionComponentV3Schema` / `MotionComponentV3` | `3`     | Linh kiện tái sử dụng (`.mvc`): `publicParams`, `bindings`, `nodes`, `clips`, `cutoutRigs`, `actions`.         |
| `MotionRuntimeProjectSchema`                    | `3`     | Runtime IR đã biên dịch, chỉ literal — dành cho Renderer.                                                      |
| `MotionPatchSchema`                             | `1`     | Bản vá trên surface công khai (biến dự án hoặc props của Component Instance).                                  |
| `SceneComponentRegistrySchema`                  | `1`     | Catalog linh kiện scene cho AI/Editor template picker.                                                         |

---

## 📐 Cấu trúc Dữ liệu Chi tiết (Core Schemas)

### 1. Scene Graph & Node Types (`NodeV3`)

Mọi đối tượng không gian đều thuộc về một `Scene`. Các Node tổ chức theo cây với `TransformV3`. `NodeV3` là Discriminated Union theo trường `type`:

- **`group`**: Gom cụm và phân cấp không gian.
- **`bone`**: Khung xương cut-out (`payload.length`, `payload.restRotation`).
- **`text`**: Văn bản rich/plain (xem mục Text bên dưới), font, fill, tùy chọn `textAnimator` (phân đoạn từ/chữ bằng `Intl.Segmenter`).
- **`shape`**: Hình học cơ bản (`rectangle`, `ellipse`, `polygon`) — fill/stroke solid hoặc gradient, `dash`.
- **`path`**: Đường cong vector/Bézier với `contours`, `segments` (line/cubic) và Path Morph targets.
- **`image` / `svg` / `video`**: Media liên kết `payload.assetId` (video có `trimStart`, `muted`, …).
- **`camera`**: Camera 2D (`payload.zoom`, `payload.parallaxStrength`).
- **`solid`**: Mảng màu phẳng (`width`, `height`, `color`) — cũng dùng cho scene background synthetic.
- **`adjustment`**: Layer chỉnh `brightness`, `contrast`, `saturation`.

#### Thuộc tính mở rộng trên Node

- **Transform** (`TransformV3`): `x`, `y`, `depth` (2.5D parallax), `width`, `height`, `rotation`, `scaleX`, `scaleY`, `anchorX`, `anchorY` (0..1), `opacity`, `visible`, `flipX`, `flipY`.
- **Masking**: Tối đa một quan hệ `mask: { sourceNodeId, mode, sourceVisibility }` với mode `clip` / `alpha` / `inverse-alpha` / `luma` / `inverse-luma`.
- **Effects Stack** (`EffectV3`): `blur`, `shadow`, `glow`, `color-adjust`.
- **Blend mode**: `normal` | `multiply` | `screen` | `add` | `darken` | `lighten` | `overlay` — đồng bộ NodeBase → snapshot → paint `setTransform` → Pixi / Remotion.
- **Modifiers**: `motion-path`, `path-morph`, `secondary-motion`, `trim-path`, `path-bend`, `constraint`, `parallax`, `layout`, `layout-item`.
- **Repeater**: Lặp node theo grid / linear / radial kèm stagger thời gian.
- **Timing** (Layer Mode): `timing: { start, duration }` — không có thì hiện cả scene.

---

### 2. Text — plain & rich runs

Trước đây text chỉ có `payload.text` (chuỗi thuần). Hiện tại shape canonical là **`payload.content`**:

```ts
content:
  | { kind: "plain"; text: string }
  | { kind: "runs"; runs: RichTextRun[] }   // tối đa MOTION_PROTOCOL_LIMITS.richTextRuns
```

Mỗi `RichTextRun` có `id` duy nhất trong node, `text`, và `style` tùy chọn (fill, fontAssetId, fontWeight, italic, fontScale, letterSpacing, highlight).

Typography cấp node vẫn nằm cạnh `content`: `fontSize`, `fontWeight`, `align`, `wrap`, `lineHeight`, `letterSpacing`, `maxLines`, `overflow`, `fitText`, `counterProgress`.

**Normalize tự động khi parse:**

```ts
// Input cũ
{ text: "Hello", fontSize: 48 }

// Sau parse
{ content: { kind: "plain", text: "Hello" }, fontSize: 48 }
```

Helper tiện dụng:

- `getTextPayloadPlain(payload)` — lấy chuỗi phẳng (plain hoặc nối các runs).
- `setTextPayloadPlain(payload, text)` — ghi lại dạng `content.kind = "plain"`.
- `normalizeTextPayloadInput(raw)` — chuẩn hóa một payload thô.

Paint/runtime mang thêm typography + runs + `SourceRef` (`kind: "text-run"`) để click-to-edit từng đoạn trong preview. Measurement / wrap dùng chung ở compile (`text-layout`); painter **không** chạy lại layout.

---

### 3. Hệ thống Chuyển động (Clips, Tracks & Keyframes)

- **`Clip`**: Thuộc `Scene`, định nghĩa khoảng thời gian cho một (hoặc nhóm) target.
  - **Schedule** (`ClipScheduleSchema`):
    - `absolute` — neo theo giây scene
    - `after` / `with` — phụ thuộc clip khác
    - **`scene-end`** — neo theo cuối scene: `{ offset }` với `0` = kết thúc đúng cuối scene (đổi `duration` vẫn giữ exit bám đuôi)
  - **Playback**: `iterations`, `direction` (`normal` / `reverse` / `alternate`), `rate`
  - **Source**: tracks thủ công, hoặc **`{ kind: "preset", presetId, params? }`** — đây là **entrypoint preset duy nhất** (không dùng `node.motionPresets`). Registry typed + expand nằm ở motion-compiler.
- **`Track`**: Nhắm property path (`transform.x`, `style.fill`, …) với danh sách `keys[]`.
- **`Keyframe`**: `t` (giây relative clip), `v`, `easing` — `linear` / `easeIn` / `easeOut` / `easeInOut` / `step`, hoặc `cubic-bezier` / `spring`.

---

### 4. Asset Declarations (`AssetV3`)

Assets là Discriminated Union theo `assetType`, kèm metadata bắt buộc cho loader/renderer:

- **`image`**: `mimeType`, `width`, `height`, `pixelFormat`, `hasAlpha`.
- **`svg`**: `mimeType: image/svg+xml`, `width`, `height`, `viewBox`, `sanitized: true`.
- **`video`**: `duration`, `fps`, codecs, `hasAudio` (+ metadata audio nếu có tiếng).
- **`audio`**: `duration`, `codec`, `sampleRate`, `channels`, và tùy chọn **`analysis`** (xem dưới).
- **`font`**: `family`, `weight`, `style`, `localeCoverage`.

#### AudioAnalysis (metadata nhịp — không phải STT)

```ts
analysis?: {
  version: number;           // bắt buộc để migrate / recompute
  algorithm?: string;
  bpm?: number;              // 20..400
  beats?: { time, strength?, downbeat? }[];
  energy?: { sampleRateHz, values: number[] };
}
```

Beat phải sorted và nằm trong `duration` asset; số lượng bị giới hạn bởi `audioBeatsPerAsset` / `audioEnergySamples`. Tool planner (`findBeatNear`, `summarizeEnergy`, …) nằm ở **ai-planner** và **không** nhét raw energy vào prompt model.

---

### 5. Variables, Public API & Component Bindings

- **Variables** (`VariableV3`): `number`, `string`, `color`, `boolean`, `asset`, `enum`, hoặc `list`.
- **Public Parameters** (`PublicParamV3`): Expose biến ra UI Component với gợi ý control:
  - `group`: `content | style | motion | layout | audio`
  - `control`: `text | textarea | color-picker | slider | toggle | asset-picker | enum`
  - `capability`: `basic | advanced | designer-only`
- **Component Bindings**: Liên kết biến công khai với thuộc tính bên trong Node/Clip/Track.
- **Thứ tự resolve**: mặc định Component &lt; props Instance &lt; binding cấp Project.

---

### 6. Timeline, Audio, Caption & Visual Tracks

- **`timeline.visualTracks`**: Danh sách các track visual (`primary`, `overlay`, `background`) với `VisualClip[]` — mỗi clip có `source` (`scene` hoặc `component`), `start`, `duration`, và `transitionOut`.
- **`audioTracks`**: BGM / voiceover / SFX với `start`, `trimStart`, `volume`, `loop`, `fadeIn` / `fadeOut`.
- **`captionTracks`**: Caption là **timeline content** (giây project global), không gắn tùy ý vào một text node.

Một `CaptionTrack` gồm:

- `tokens[]` — từng từ/token có `start` / `end`, optional `speakerId` / `confidence`
- `segmentation` — quy tắc chia cue (maxLines, maxWordsPerCue, gapThreshold, …)
- `style` — font, fill, safeArea (`tiktok` / `reels` / …), vị trí, active/inactive word
- `animation.presetId` — `none` | `word-pop` | `karaoke` | `active-highlight` | `bounce`

Compiler chia token → cues deterministic; runtime biết token nào active theo frame; click preview map về `SourceRef` (`caption-token` / `caption-cue`). Speech-to-text **không** thuộc package này — chỉ nhận `CaptionToken[]` đã có.

#### Visual Clip Transitions (V3)

Transition nằm trên `VisualClip.transitionOut`, không còn trên `Scene`:

| type        | Ý nghĩa ngắn gọn                             |
| ----------- | -------------------------------------------- |
| `cut`       | Cắt cứng (mặc định)                          |
| `fade`      | Fade qua màu nền (`color?`) — khác crossfade |
| `crossfade` | Hai clip chồng alpha                         |
| `slide`     | Đẩy / phủ theo hướng (`push` \| `cover`)     |
| `wipe`      | Reveal kiểu mask (`softness?`)               |
| `zoom`      | Zoom composition `in` \| `out`               |

> **Lưu ý:** V3 authoring chỉ dùng `VisualClip.transitionOut`. `scene.transition` không còn tồn tại trong schema V3.

Evaluator composition dùng chung ở motion-runtime (một layer plan cho preview và export).

#### Scene background (command, không phải field Scene)

AI/editor dùng `setSceneBackground` → tạo/cập nhật node ổn định `id: "__scene_background__"` (`solid`, full canvas, `zIndex` rất thấp). Không thêm primitive background riêng trên `SceneV3`.

---

### 7. Layout (compile-time)

Không tạo primitive `flex` mới — mở rộng stack hiện có:

- `padding`: số hoặc `EdgeInsets` `{ top, right, bottom, left }` (số được normalize thành 4 cạnh)
- `align`: thêm `stretch`
- `justify`: `start` | `center` | `end` | `space-between` (mặc định `start`)
- `wrap` tùy chọn

Modifier **`layout-item`** mang `LayoutItemPolicy`: `width` / `height` = `fixed` | `content` | `fill`, grow/shrink, min/max, `alignSelf`.

Layout chỉ chạy ở compile/edit với `TextMeasurementProvider` deterministic; painter chỉ nhận transform đã bake.

---

### 8. SourceRef — click-to-edit

Khi preview cần map vùng paint về authoring:

| kind            | Cần có                      |
| --------------- | --------------------------- |
| `text-run`      | `nodeId`, `runId`           |
| `caption-token` | `captionTrackId`, `tokenId` |
| `caption-cue`   | `captionTrackId`, `cueId`   |
| `node`          | `nodeId`                    |
| `clip`          | `clipId`                    |

`sourceRefKey(ref)` tạo khóa ổn định để gắn lên paint / hit-test.

---

### 9. Capability Registry & Limits (`capabilities.ts`)

- **`MOTION_PROTOCOL_LIMITS`**: Giới hạn kích thước/số lượng (ví dụ max 2 000 nodes/scene, 10 000 keys/track, 64 rich-text runs, 4 096 caption tokens/track, 10 000 beats/asset, …).
- **`motionPropertyCapability`**: Tra cứu từng property:
  - `valueKind`: `number`, `color`, `angle`, `vec2`, `boolean`, `string`, `asset`, `path`, `gradient`, `json`
  - `animatable` / `bindable` / `public`
  - `runtimeSupport`: `evaluated` hoặc `compile-time`

---

## 🎬 Danh sách Thuộc tính Hỗ trợ Keyframe Animation

Các thuộc tính dưới đây có `animatable: true` trong [`capabilities.ts`](./src/capabilities.ts):

### 1. Transform (mọi Node)

- `transform.x`, `transform.y` — vị trí (px)
- `transform.depth` — parallax 2.5D (−8 … 8)
- `transform.width`, `transform.height`
- `transform.rotation` — độ; nội suy shortest path
- `transform.scaleX`, `transform.scaleY`
- `transform.anchorX`, `transform.anchorY` — 0 … 1
- `transform.opacity` — 0 … 1
- `transform.visible`, `transform.flipX`, `transform.flipY`

### 2. Theo loại Node

- **Text**: `payload.text` (chuỗi plain qua capability path), `payload.fontSize`, `payload.counterProgress`, `style.fill`
- **Shape / Path**: `style.fill`, `fillOpacity`, `stroke`, `strokeWidth`, `strokeOpacity`, `dashOffset`, `payload.cornerRadius` (shape)
- **Image / SVG**: `payload.assetId`
- **Solid**: `payload.width`, `payload.height`, `payload.color`
- **Camera**: `payload.zoom`, `payload.parallaxStrength`
- **Adjustment**: `payload.brightness`, `contrast`, `saturation`

### 3. Modifiers

- Motion path: `modifiers.<id>.progress`
- Trim path: `start`, `end`, `offset`
- Path bend: `amount`
- Morph / secondary: `weight`

### 4. Effects

- Blur / Glow / Shadow / Color Adjust — các field `radius`, `offset*`, `intensity`, `color`, …

### 5. Easing (`KeyframeEasingSchema`)

- Presets: `linear`, `easeIn`, `easeOut`, `easeInOut`, `step`
- `{ type: "cubic-bezier", x1, y1, x2, y2 }`
- `{ type: "spring", stiffness, damping, mass? }`

---

## 🧠 AI Schema Capability Matrix

Trước khi bật command mới trên AI allowlist, kiểm tra ma trận E2E:

```ts
import {
  AI_SCHEMA_CAPABILITY_VERSION,
  AI_SCHEMA_CAPABILITY_MATRIX,
  aiSchemaCapabilityReady,
  listAiSchemaProductionCapabilities,
  aiSchemaCapabilityPromptBlock,
} from "@motionvideo/motion-protocol";
```

Mỗi hàng có các cột: `schema`, `compiler`, `runtime`, `paint`, `pixi`, `remotion`, `ai`.  
`aiSchemaCapabilityReady(row)` = sáu cột đầu đều `"yes"`. Các phase gồm presets, rich text, caption, layout, transition, audio beats, blend + background.

---

## 🛠️ API & Hướng dẫn Sử dụng

### 1. Validate và Parse Project / Component

```ts
import {
  parseMotionProject,
  parseMotionComponentV3,
  serializeMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";

// Parse & Validate JSON Project (.mt) — đã gồm normalize
try {
  const project: MotionProject = parseMotionProject(rawJsonData);
  console.log("Project hợp lệ:", project.metadata.id);
} catch (error) {
  console.error("Lỗi Schema / Reference Validation:", error);
}

// Serialize — chỉ ghi shape đã normalize (ví dụ content, không còn payload.text)
const jsonString = serializeMotionProject(project);
```

### 2. Làm việc với Text

```ts
import {
  getTextPayloadPlain,
  setTextPayloadPlain,
} from "@motionvideo/motion-protocol";

const plain = getTextPayloadPlain(textNode.payload);

textNode.payload = setTextPayloadPlain(textNode.payload, "Nội dung mới");
```

### 3. Áp dụng Patch

```ts
import { applyMotionProjectV3Patch } from "@motionvideo/motion-protocol";

const result = applyMotionProjectV3Patch(project, {
  format: "motion-patch",
  formatVersion: 1,
  baseRevision: 1,
  operations: [
    {
      op: "updateVariable",
      variableId: "var.primaryColor",
      changes: { value: "#FF0055" },
    },
  ],
});
```

### 4. Tra cứu Property Capability cho AI / Inspector

```ts
import {
  publicMotionPropertyCapabilities,
  motionPropertyCapability,
} from "@motionvideo/motion-protocol";

const textCapabilities = publicMotionPropertyCapabilities("text");

const cap = motionPropertyCapability("text", "transform.x");
console.log("Animatable:", cap?.animatable); // true
```

---

## 🤖 Skills & Agent Surface (V3-only)

Skills là instruction template được validate bởi protocol. Mỗi skill có `MotionSkillManifest` + output `MotionProjectV3`.

**5 built-in skills** trong [`src/v3/skills.ts`](./src/v3/skills.ts):

| Skill ID             | Loại     | Mô tả                                     |
| -------------------- | -------- | ----------------------------------------- |
| `motion/brand-intro` | template | Brand intro với logo + text reveal        |
| `motion/hook`        | template | Hook ngắn (3-5s) grab attention           |
| `motion/solution`    | template | Solution step với problem → solution flow |
| `motion/cta`         | template | Call-to-action cuối video                 |
| `motion/outro`       | template | Outro với branding + social links         |

**Skill validation:** `validateMotionSkillOutput(manifest, output)` — reject nếu output chứa V2 fields (`sceneOrder`, `scene.transition`, `formatVersion: 2`).

**Authoring rules cho AI agents:**

- Luôn dùng `MotionProjectV3` (formatVersion: 3)
- Timeline dùng `visualTracks`, không dùng `sceneOrder`
- Transitions nằm trên `VisualClip.transitionOut`, không trên `Scene`
- Runtime IR do compiler sinh — agent chỉ cần tạo project JSON hợp lệ

---

## 📦 Ranh giới Package

| Thuộc motion-protocol                  | Không thuộc package này                              |
| -------------------------------------- | ---------------------------------------------------- |
| Zod schemas, limits, SourceRef         | Speech-to-text                                       |
| Parse normalize / serialize            | Đo text bằng DOM                                     |
| Property vocabulary + AI matrix        | Expand preset / bake caption cue (`motion-compiler`) |
| Shape `AudioAnalysis` / `CaptionTrack` | Tool beat planner (`ai-planner`)                     |
|                                        | Evaluate composition / paint (`motion-runtime`)      |
|                                        | Pixi / Remotion painters                             |

---

## 📄 Tài liệu Tham chiếu liên quan

- Kế hoạch mở rộng AI schema: [`ai-motion-protocol-expansion-plan.md`](../../ai-motion-protocol-expansion-plan.md)
- Compiler: [`packages/motion-compiler`](../motion-compiler)
- Runtime / paint: [`packages/motion-runtime`](../motion-runtime)
- AI planner: [`packages/ai-planner`](../ai-planner)

### Kiểm thử trong package

```bash
pnpm --filter @motionvideo/motion-protocol test
pnpm --filter @motionvideo/motion-protocol typecheck
```

---

## 📜 Source of Truth Contract

```text
Authoring source of truth:   MotionProjectV3     (formatVersion: 3)
Editing source of truth:     MotionProjectV3Patch  (patch format)
Runtime source of truth:     MotionRuntimeProject  (compiler output, not authored)
Timeline source of truth:    visualTracks          (not sceneOrder)
Transition source of truth:  VisualClip.transitionOut  (not scene.transition)
```

Mọi consumer (editor, AI planner, compiler, MCP server, render providers) đều sử dụng cùng một contract này. Không có đường dẫn V2 ẩn nào còn tồn tại.
