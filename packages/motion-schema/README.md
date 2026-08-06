# `@motionvideo/motion-schema`

Standard **Zod Validation Schema** và **TypeScript Type System** cho Motion Format v2. Package này đóng vai trò là hợp đồng dữ liệu chuẩn hóa (Canonical Contract) duy nhất giữa **Authoring Tools (Editor / AI Generator)**, **Component Registry** và **Renderer Engine**.

---

## 🎯 Mục đích & Triết lý Thiết kế

1. **Single Source of Truth cho Format v2**: Định nghĩa chính xác cấu trúc dữ liệu cho Project (`.mt`), Component (`.mvc`), Patch, và Normalized IR.
2. **Authoring IR vs. Runtime IR Pipeline**:
   - **Authoring IR** ([`MotionProjectV2`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L1143), [`MotionComponentV2`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L1049)): Định dạng dành cho Editor & AI. Hỗ trợ biến (`variables`), tham số công khai (`publicParams`), binding, component instances (`type: "component"`), repeat directives, presets, và text animators.
   - **Normalized Runtime IR** ([`NormalizedMotionProjectV2`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L1234)): Định dạng dành riêng cho Renderer. Toàn bộ biến đã được resolve thành giá trị literal, component instances đã được flatten/expand, repeat nodes được clone, presets & text animators được biên dịch thành keyframe tracks thực tế.
3. **An toàn dữ liệu nghiêm ngặt (Strict Validation & Bounds)**:
   - Sử dụng Zod `discriminatedUnion` và `.strict()` nhằm reject thuộc tính lạ hoặc dữ liệu rác.
   - Cấm giá trị numeric không hữu hạn (`NaN`, `Infinity`).
   - Kiểm soát giới hạn cứng qua [`MOTION_V2_LIMITS`](file:///d:/NextJS/moticlip/packages/motion-schema/src/capabilities.ts#L1) (giới hạn số node, clip, keyframe, mảng, kích thước asset, độ sâu hierarchy, etc.) nhằm ngăn ngừa tràn bộ nhớ và tấn công DOS.
4. **Property Capability Registry**: Quản lý tập từ vựng thuộc tính (vocabulary ledger) cho Editor và AI Engine để biết rõ thuộc tính nào có thể animate, bind, hoặc expose lên giao diện UI.

---

## 📁 Cấu trúc Package

Package gồm các module chính trong [`src/`](file:///d:/NextJS/moticlip/packages/motion-schema/src):

- [`index.ts`](file:///d:/NextJS/moticlip/packages/motion-schema/src/index.ts): Export chính của package. Cung cấp các alias canonical (`MotionProject`, `Node`, `Scene`, `parseMotionProject`, v.v.).
- [`v2.ts`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts): Compatibility barrel — `export * from "./v2/index"`.
- [`v2/`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2): Schema v2 chia theo domain (`common`, `values`, `nodes/`, `animation/`, `component`, `project`, `runtime`, `references/`, `parse`, `patch`, …).
- [`capabilities.ts`](file:///d:/NextJS/moticlip/packages/motion-schema/src/capabilities.ts): Khai báo [`MOTION_V2_LIMITS`](file:///d:/NextJS/moticlip/packages/motion-schema/src/capabilities.ts#L1), bảng đăng ký khả năng của thuộc tính ([`motionPropertyCapability`](file:///d:/NextJS/moticlip/packages/motion-schema/src/capabilities.ts#L147)) và hàm validate thuộc tính công khai cho AI/UI Controls.
- [`scene-registry.ts`](file:///d:/NextJS/moticlip/packages/motion-schema/src/scene-registry.ts): Schema quản lý Scene Component Registry ([`SceneComponentRegistrySchema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/scene-registry.ts#L55)) để phân loại template theo roles (`hook`, `solution`, `cta`, v.v.) và map domains.

---

## 🧩 Các Artifact Schemas Chính

```text
JSON Input  ──► parseMotionProject() / parseMotionComponentV2()
                       │
                       ▼ Structural + Limit Validation
             Typed MotionProject / MotionComponentV2 (Authoring IR)
                       │
                       ▼ Compiler Process
             Normalized Runtime IR (Literal, Flat, Renderer-Ready)
```

| Schema / Type | Version | Mô tả |
|---|---|---|
| [`MotionProjectV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L1143) / [`MotionProject`](file:///d:/NextJS/moticlip/packages/motion-schema/src/index.ts#L15) | `2` | Schema file dự án chuyển động (`.mt`). Chứa danh sách `scenes`, `assets`, `variables`, `audioTracks`, `timeline`, `dependencies`. |
| [`MotionComponentV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L1049) / `MotionComponentV2` | `2` | Schema linh kiện chuyển động tái sử dụng (`.mvc`). Chứa `publicParams`, `bindings`, `nodes`, `clips`, `cutoutRigs`, `actions`. |
| [`NormalizedMotionProjectV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L1234) | `2` | Runtime IR đã biên dịch, chỉ chứa giá trị literal dành riêng cho Renderer. |
| [`MotionPatchSchema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L1174) | `1` | Bản vá (Patch) thao tác trên surface công khai (sửa biến dự án hoặc `props` của Component Instance). |
| [`SceneComponentRegistrySchema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/scene-registry.ts#L55) | `1` | Registry danh mục linh kiện scene dùng cho AI/Editor template picker. |

---

## 📐 Cấu trúc Dữ liệu Chi tiết (Core Schemas)

### 1. Scene Graph & Node Types ([`NodeV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L670))

Mọi đối tượng không gian đều thuộc về một `Scene`. Các Node được tổ chức theo hình cây với [`TransformV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L111). [`NodeV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L670) là một Discriminated Union phân loại theo trường `type`:

- **`group`**: Node nhóm dùng để gom cụm và phân cấp không gian.
- **`bone`**: Khung xương phục vụ Cut-out character rigging (`payload.length`, `payload.restRotation`).
- **`text`**: Văn bản với font, size, fill, và tùy chọn `textAnimator` (phân đoạn từ/chữ cái bằng `Intl.Segmenter`).
- **`shape`**: Hình học cơ bản (`rectangle`, `ellipse`, `polygon`) hỗ trợ nét đứt `dash`, fill/stroke gradient hoặc solid.
- **`path`**: Đường cong Vector/Bézier phức tạp với nhiều `contours`, `segments` (line/cubic) và Path Morphing targets.
- **`image`**: Hình ảnh raster liên kết tới asset bitmap (`payload.assetId`).
- **`svg`**: Vector SVG liên kết tới asset vector (`payload.assetId`).
- **`video`**: Đoạn video phát trong canvas (`payload.assetId`, `trimStart`, `muted`).
- **`camera`**: Camera 2D điều khiển viewport render (`payload.zoom`, `payload.parallaxStrength`).
- **`solid`**: Mảng màu nền phẳng (`width`, `height`, `color`).
- **`adjustment`**: Layer hiệu ứng hình ảnh (chỉnh `brightness`, `contrast`, `saturation`).
- **`component`**: Component Instance (chỉ tồn tại ở Authoring IR, sẽ được compiler bung ra ở Runtime IR).

#### Thuộc tính mở rộng trên Node:
- **Transform** ([`TransformV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L111)): `x`, `y`, `depth` (2.5D parallax), `width`, `height`, `rotation`, `scaleX`, `scaleY`, `anchorX`, `anchorY` (0..1), `opacity`, `visible`, `flipX`, `flipY`.
- **Masking**: Mỗi Node chỉ nhận tối đa 1 quan hệ `mask: { sourceNodeId, mode: "clip" | "alpha" | "inverse-alpha", sourceVisibility }`.
- **Effects Stack** ([`EffectV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L52)): Xếp chồng các hiệu ứng pixel (`blur`, `shadow`, `glow`, `color-adjust`).
- **Modifiers**: Bộ điều chỉnh chuyển động (`motion-path`, `path-morph`, `secondary-motion`, `trim-path`, `path-bend`, `constraint`).
- **Repeater Directive**: Lặp node theo dạng grid/linear/radial kèm stagger thời gian.

---

### 2. Hệ thống Chuyển động (Clips, Tracks & Keyframes)

- **`Clip`**: Thuộc về `Scene`, định nghĩa khoảng thời gian chạy cho 1 Node mục tiêu.
  - **Schedule** ([`ClipScheduleSchema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L685)): `absolute.at`, `after.clipId`, hoặc `with.clipId`.
  - **Playback** ([`PlaybackSchema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L691)): Số lần lặp (`iterations`), hướng (`normal`, `reverse`, `alternate`), và tốc độ (`rate`).
  - **Tracks**: Danh sách các đường biến đổi thuộc tính (`targetProperty`).
- **`Track`**: Nhắm đến thuộc tính cụ thể (ví dụ `transform.x`, `style.fill`, `modifiers.mp1.progress`) chứa danh sách `keys[]`.
- **`Keyframe`**: Chứa mốc thời gian `t` (giây, tương đối theo clip), giá trị `value` (literal hoặc resolvable ref), và phương thức nội suy `easing`:
  - Easing chuẩn: `linear`, `easeIn`, `easeOut`, `easeInOut`, `step`.
  - Easing nâng cao: `cubic-bezier` (4 điểm điều khiển) hoặc `spring` (lực lò xo: `mass`, `stiffness`, `damping`).

---

### 3. Asset Declarations ([`AssetV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L194))

Assets được định nghĩa dạng Discriminated Union theo `assetType`, đi kèm metadata bắt buộc nhằm phục vụ renderer & loader:
- **`image`**: `mimeType`, `width`, `height`, `pixelFormat`, `hasAlpha`.
- **`svg`**: `mimeType: image/svg+xml`, `width`, `height`, `viewBox`, `sanitized: true`.
- **`video`**: `mimeType`, `width`, `height`, `duration`, `fps`, `videoCodec`, `pixelFormat`, `hasAudio` (kèm thông số audio chi tiết nếu `hasAudio: true`).
- **`audio`**: `mimeType`, `duration`, `codec`, `sampleRate`, `channels`.
- **`font`**: `mimeType`, `family`, `weight`, `style`, `localeCoverage`.

---

### 4. Variables, Public API & Component Bindings

- **Variables** ([`VariableV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L223)): Khai báo biến thuộc loại `number`, `string`, `color`, `boolean`, `asset`, hoặc `json`.
- **Public Parameters** ([`PublicParamV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L970)): Expose biến ra ngoài interface của Component với các gợi ý UI controls:
  - `group`: `content | style | motion | layout | audio`.
  - `control`: `text | textarea | color-picker | slider | toggle | asset-picker | enum`.
  - `capability`: `basic | advanced | designer-only`.
- **Component Bindings** ([`ComponentBindingSchema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L954)): Liên kết biến công khai với thuộc tính bên trong của Node/Clip/Track.
- **Priority Resolving**: Giá trị mặc định Component < Payload Props của Instance < Binding cấp Project.

---

### 5. Timeline & Audio Tracks

- **`timeline.sceneOrder`**: Thứ tự phát sóng canonical của các scene.
- **Scene Transition** ([`SceneTransitionSchema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L1091)): Hiệu ứng chuyển cảnh giữa các scene liền kề: `cut` (thời lượng 0), `fade`, hoặc `crossfade`.
- **`audioTracks`**: Danh sách nhạc nền (BGM), voiceover, hiệu ứng âm thanh (SFX) với cấu hình `startTime`, `trimStart`, `duration`, `volume`, `loop`, và `fadeIn/fadeOut`.

---

### 6. Capability Registry & Limits ([`capabilities.ts`](file:///d:/NextJS/moticlip/packages/motion-schema/src/capabilities.ts))

- **[`MOTION_V2_LIMITS`](file:///d:/NextJS/moticlip/packages/motion-schema/src/capabilities.ts#L1)**: Bảng giới hạn kích thước và số lượng phần tử nhằm đảm bảo hiệu năng và tính ổn định tuyệt đối (vd: max 2,000 nodes/scene, 10,000 keys/track, max 32,768px kích thước asset, 64 cấp hierarchy depth, v.v.).
- **[`motionPropertyCapability`](file:///d:/NextJS/moticlip/packages/motion-schema/src/capabilities.ts#L147)**: Kiểm tra thông số năng lực của từng property:
  - `valueKind`: Kiểu dữ liệu (`number`, `color`, `angle`, `vec2`, `boolean`, `string`, `asset`, `path`, `gradient`, `json`).
  - `animatable`: Có thể tạo keyframe track hay không.
  - `bindable`: Có thể gán biến (variable binding) hay không.
  - `public`: Có xuất hiện trên giao diện AI / Inspector UI hay không.
  - `runtimeSupport`: `evaluated` (hỗ trợ animate ở runtime) hoặc `compile-time` (chỉ resolve khi build).
---

## 🎬 Danh sách Thuộc tính Hỗ trợ Keyframe Animation (Animatable Properties)

Toàn bộ các thuộc tính dưới đây được quản lý tại [`capabilities.ts`](file:///d:/NextJS/moticlip/packages/motion-schema/src/capabilities.ts) với `animatable: true`, cho phép tạo mốc chuyển động (Keyframe Track):

### 1. Khung Transform không gian (Áp dụng cho mọi Node)
- `transform.x`, `transform.y`: Tọa độ vị trí X, Y (px).
- `transform.depth`: Độ sâu không gian 2.5D Parallax (-8 đến 8).
- `transform.width`, `transform.height`: Kích thước chiều rộng và chiều cao container.
- `transform.rotation`: Góc xoay (độ), tự động nội suy góc quay ngắn nhất (Shortest Path).
- `transform.scaleX`, `transform.scaleY`: Tỷ lệ thu phóng trục X và Y.
- `transform.anchorX`, `transform.anchorY`: Điểm neo Anchor point (0 đến 1).
- `transform.opacity`: Độ mờ đục toàn bộ Node (0 đến 1).
- `transform.visible`: Trạng thái ẩn/hiện ở mốc thời gian (Step transition).
- `transform.flipX`, `transform.flipY`: Lật đối tượng theo chiều ngang / chiều dọc.

### 2. Thuộc tính riêng của từng loại Node
- **Text Node (`text`)**: `payload.text` (đổi chuỗi chữ), `payload.fontSize` (cỡ chữ), `payload.counterProgress` (hiệu ứng số đếm 0..1), `style.fill` (màu chữ).
- **Shape Node (`shape`) & Path Node (`path`)**: `style.fill` (màu nền Solid/Gradient), `style.fillOpacity`, `style.stroke` (màu viền), `style.strokeWidth` (độ dày viền), `style.strokeOpacity`, `style.dashOffset` (chuyển động nét đứt), `payload.cornerRadius` (bo góc Shape).
- **Image & SVG Node (`image`, `svg`)**: `payload.assetId` (đổi asset hình ảnh/vector theo mốc thời gian).
- **Solid Node (`solid`)**: `payload.width`, `payload.height`, `payload.color` (màu phẳng).
- **Camera Node (`camera`)**: `payload.zoom` (thu phóng camera 2D), `payload.parallaxStrength` (cường độ Parallax).
- **Adjustment Layer (`adjustment`)**: `payload.brightness` (-1..1), `payload.contrast` (0..4), `payload.saturation` (0..4).

### 3. Modifiers (Bộ điều chỉnh chuyển động nâng cao)
- `modifiers.<id>.progress`: Tiến độ trượt trên đường cong **Motion Path** (0..1).
- `modifiers.<id>.start`, `modifiers.<id>.end`, `modifiers.<id>.offset`: Tiến độ và offset đường vẽ **Trim Path**.
- `modifiers.<id>.amount`: Độ uốn cong **Path Bend** (-1..1).
- `modifiers.<id>.weight`: Trọng số biến hình **Path Morphing** / **Secondary Motion** (0..1).

### 4. Hiệu ứng Pixel (Effects Stack)
- **Blur**: `effects.<id>.radius`.
- **Shadow**: `effects.<id>.offsetX`, `offsetY`, `blur`, `color`, `opacity`.
- **Glow**: `effects.<id>.radius`, `intensity`, `opacity`, `color`.
- **Color Adjust**: `effects.<id>.brightness`, `contrast`, `saturation`.

### 5. Phương thức Nội suy Easing ([`KeyframeEasingV2Schema`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L733))
- **Presets**: `linear`, `easeIn`, `easeOut`, `easeInOut`, `step`.
- **Cubic-Bézier**: `{ type: "cubic-bezier", x1, y1, x2, y2 }` (nội suy đường cong 4 điểm mút mượt như After Effects).
- **Spring**: `{ type: "spring", stiffness, damping, mass }` (mô phỏng nảy lò xo vật lý).

---

## 🛠️ API & Hướng dẫn Sử dụng

### 1. Validate và Parse Project / Component

```ts
import {
  parseMotionProject,
  parseMotionComponentV2,
  serializeMotionProject,
  type MotionProject,
} from "@motionvideo/motion-schema";

// Parse & Validate JSON Project (.mt)
try {
  const project: MotionProject = parseMotionProject(rawJsonData);
  console.log("Project ID hợp lệ:", project.id);
} catch (error) {
  console.error("Lỗi Schema Validation:", error);
}

// Serialize Project thành JSON String
const jsonString = serializeMotionProject(project);
```

### 2. Áp dụng Patch Dữ liệu ([`applyMotionPatch`](file:///d:/NextJS/moticlip/packages/motion-schema/src/v2.ts#L2133))

```ts
import { applyMotionPatch, type MotionPatch } from "@motionvideo/motion-schema";

const patchData = {
  format: "motion-patch",
  formatVersion: 1,
  baseRevision: 1,
  operations: [
    {
      op: "set",
      target: { kind: "variable", id: "var.primaryColor" },
      value: "#FF0055",
    },
  ],
};

const updatedProject = applyMotionPatch(project, patchData);
```

### 3. Tra cứu Property Capability cho AI Engine

```ts
import { publicMotionPropertyCapabilities, motionPropertyCapability } from "@motionvideo/motion-schema";

// Lấy toàn bộ thuộc tính công khai có thể tương tác của loại Node "text"
const textCapabilities = publicMotionPropertyCapabilities("text");

// Kiểm tra khả năng animate của thuộc tính "transform.x"
const cap = motionPropertyCapability("text", "transform.x");
console.log("Animatable:", cap?.animatable); // true
```

---

## 📄 Tài liệu Tham chiếu liên quan

- Normative Spec: [`docs/motion-format-v2.md`](../../docs/motion-format-v2.md)
- Design Upgrade & Rebaseline: [`docs/v2-upgrade.md`](../../docs/v2-upgrade.md)
- Primitives Catalog: [`docs/primitives-object.md`](../../docs/primitives-object.md)
- Schema Freeze Checklist: [`docs/p0-schema-freeze-checklist.md`](../../docs/p0-schema-freeze-checklist.md)
- Verification Gate: `pnpm validate:v2-fixtures`

