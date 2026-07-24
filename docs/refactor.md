# Motion Format v2 — Đặc tả refactor

Tài liệu **đã chốt** kiến trúc IR, Component Public API, Bone, và dual surface (Web + Electron).  
Đây là contract triển khai — không còn mục “đang bàn”.

**Liên quan:** `[motion-format-v2.md](./motion-format-v2.md)` (contract normative) · `[fixtures/v2/](./fixtures/v2/)` (regression data) · `[blocks-plan.md](./blocks-plan.md)` · `[../workflow.md](../workflow.md)`

---

## 1. Bối cảnh và mục tiêu

### 1.1. Vấn đề schema v1

```text
Scene → Layer (type + x,y) → animations[{ preset, start, duration }]
```

Đủ CapCut-lite / preset string, nhưng thiếu: property tracks, transform đủ, Component package, bone/rig, ranh giới Web↔Designer.

### 1.2. Mục tiêu v2

| Mục tiêu         | Nội dung                                                                |
| ---------------- | ----------------------------------------------------------------------- |
| Một IR           | Motion Format **v2** (`.mt`) dùng chung Web + Desktop                   |
| Canonical motion | **Property tracks + keyframes**; Preset/AnimOp = recipe biên dịch xuống |
| Component = API  | `.mvc` có **Public API** (Exposed Parameters) — không phải “túi node”   |
| Ba capability    | AI User / Creator / Designer trên **cùng format**, khác quyền ghi       |
| Asset            | Figma/Illustrator → SVG **phẳng**; hierarchy do app tạo trong `.mt`     |
| Migrate          | `v1 → v2` giữ template hiện có                                          |

### 1.3. Định nghĩa sản phẩm một câu

> Desktop (hoặc AI Author) soạn motion nguyên tử + publish Component.  
> Web / AI User chỉ gọi **Public API** của Component → xuất video.  
> App là **animation engine**, không phải design tool.

### 1.4. Năm invariant — không bao giờ phá

```text
1. Motion Format (.mt / .mvc)     — một ngôn ngữ
2. Node Graph (chỉ parentId)     — hierarchy
3. Property Track + Key          — canonical motion
4. Component Public API          — contract consumer
5. Semantic Layer (Role)         — ngôn ngữ AI
```

Mọi thứ khác (Konva/Pixi, Electron, model AI, renderer…) = implementation thay được.

### 1.5. Bốn lớp runtime (+ hai tầng AI-friendly)

```text
Project → Scene → Node Graph → Animation
                 + Variables (dữ liệu)
                 + Semantic Role (nghĩa)
```

AI / Web / Desktop chỉ sửa trong các lớp này (qua capability khác nhau).

---

## 2. Mô hình sản phẩm

### 2.1. Vai trò

| Vai trò            | App      | Được làm                                                   | Không thấy                              |
| ------------------ | -------- | ---------------------------------------------------------- | --------------------------------------- |
| **AI User** (~80%) | Web      | Chọn template/component → điền Public API → xuất MP4       | Node, Bone, Track, Timeline nội bộ      |
| **Creator** (~15%) | Web      | Timeline lite, preset, duration/ease trên clip đã expose   | Bone gizmo, raw node tree               |
| **Designer** (~5%) | Electron | Node, Bone, keyframe, Expose/Lock, Publish `.mvc`          | —                                       |
| **AI Author**      | Planner  | Sinh `.mvc` (internal + Public API) trước/cùng Designer UI | — (vẫn tôn trọng API khi user tiêu thụ) |

### 2.2. Luồng giá trị

```text
Figma SVG (phẳng)
    → Desktop / AI Author: nhóm, bone, timeline, Expose
    → Publish Component (.mvc) + version
    → Registry
    → Web / AI User: chỉ props công khai
    → Compiler → @napi-rs/canvas → FFmpeg → MP4
```

### 2.3. Tầng khái niệm → artifact

Chín “level” (object → property → AnimOp → timing → easing → trigger → preset → pattern → template) **không** thành 9 schema trong `.mt`.

| Trong `.mt` (document)                                                            | Ngoài `.mt` (package / registry)                                       |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Metadata, Assets, Variables, Timeline, Scenes, Bindings, Dependencies, Extensions | Preset, Pattern, Template, Component **definition** (`.mvc`), Registry |

Authoring IR đọc các khái niệm trên; compiler normalize Component/Variable/Preset/Repeat. Renderer chỉ đọc **literal Node + literal Property Track**.

---

## 3. Quy ước vật lý của IR

Mọi file `.mt` / `.mvc` tuân thủ:

### 3.1. Hệ tọa độ (D19)

```text
(0, 0) = góc trên-trái scene/frame
X+ = phải    Y+ = xuống    (web / Canvas 2D / CSS)
Rotation = degrees, cùng chiều Canvas
```

Không dùng Y-up OpenGL trong schema. Preview Konva và export Skia cùng convention.

### 3.2. Đơn vị (D20)

| Lớp                                 | Unit                                                     |
| ----------------------------------- | -------------------------------------------------------- |
| Schema / engine                     | **Pixel**                                                |
| Responsive (đổi tỉ lệ/độ phân giải) | **Compiler** scale — không lưu `%` trong `transform` lõi |

### 3.3. Thời gian (D21)

Mọi `start` / `duration` / `delay` = **giây (**`number` **float)** — ví dụ `0.25`, `1.75`.

- Frame chỉ derived lúc render (`t * fps`), **không** là source of truth trong file.
- UI có thể hiện timecode/frame; convert ↔ giây.

### 3.4. Matrix (D22)

**Không serialize matrix.** Lưu `transform` (mục 4.2); runtime tính `worldMatrix` từ parent chain + inherit flags. AI/keyframe làm việc với `rotation: 45`, không với 16 số.

---

## 4. Intermediate Representation (Motion Format v2)

### 4.1. Nguyên tắc IR

1. Canonical animation = **tracks + keyframes** trên property path ổn định (`transform.opacity`, `style.fill`, …).
2. Preset / AnimOp = sugar → compiler expand / Convert thành tracks.
3. Style/effects (`fill`, `blur`, …) tách khỏi `transform`.
4. Cùng schema Web + Desktop; khác **capability**.
5. Component consumer chỉ thấy **Public API** (mục 6).

### 4.2. Node

```text
Node
├── id, type, name?
├── parentId?                          // D2 — chỉ field hierarchy trong file
├── transform                          // D1 — 13 field
├── style?                             // fill, stroke, …
├── locked?, zIndex?                   // zIndex = draw order (D6)
├── inheritPosition|Rotation|Scale|Opacity?  // D4 — default true
├── maskId?
└── type-specific payload
```

**Types MVP:** `text` | `shape` | `image` | `svg` | `path` | `group` | `bone` | `camera` | …  
**Sau:** rich text, video, stack/grid, Lottie, …

**Id scope (D18):** id **per-scene**; trong `.mvc` = namespace component riêng.

### 4.3. Transform (D1)

Trên mọi Node; path animate: `transform.<field>`.

```text
transform {
  x, y, width, height,
  rotation, scaleX, scaleY,
  anchorX, anchorY,
  opacity, visible,
  flipX, flipY
}
```

- **Không** `skewX` / `skewY` (thêm sau = optional, không phá file cũ).
- `visible` / `opacity` / flip thuộc `transform` (animate được).
- `locked` / `zIndex` ở Node root.

### 4.4. Parenting (D2)

**Chỉ** `parentId` **trong file.** Runtime: `children = groupBy(parentId)`. Không bao giờ serialize cả `parentId` và `children[]`.

- Validate: không cycle; parent cùng scene.
- Xóa node (MVP): children orphan → `parentId = null`.

### 4.5. Inherit flags (D4)

```text
inheritPosition | inheritRotation | inheritScale | inheritOpacity
// thiếu field = true
```

Ví dụ: label trên bar → `inheritScale: false`; badge trên tay → `inheritRotation: false`.

### 4.6. Draw order (D6)

Xếp chồng (không phải align):

```text
Duyệt tree → siblings sort zIndex ↑ (lớn = trên)
         → hòa: thứ tự ổn định trong nodes[]
```

Không field `index` / `siblingIndex`. Bring forward = tăng `zIndex`.

### 4.7. Group và Bone (D10, D3, D7, D15)

**Bone ⊇ Group:** cùng `transform` + con qua `parentId`. Bone thêm semantic **rig**.

|                       | Group       | Bone                                        |
| --------------------- | ----------- | ------------------------------------------- |
| Hierarchy + transform | ✓           | ✓                                           |
| `length?`             | —           | ✓                                           |
| `restRotation?`       | —           | ✓                                           |
| Semantic              | Layout      | Rig                                         |
| Gizmo                 | Transformer | Rotate + **Move Pivot** + **Length** (●──●) |

```text
BoneNode {
  type: "bone"
  length?: number
  restRotation?: number   // thiếu → 0
  // current pose = transform.* — CẤM currentRotation
}
```

| Thao tác   | Ghi                                                                      |
| ---------- | ------------------------------------------------------------------------ |
| Rotate     | `transform.rotation`                                                     |
| Move Pivot | `transform.x` / `y`                                                      |
| Length     | `length`                                                                 |
| Reset Pose | `transform.rotation = restRotation`                                      |
| Set Rest   | `restRotation = transform.rotation`                                      |
| Animate    | Track / AnimOp generic trên `transform.*` — **không** `bone.rotate` (D7) |

**Lộ trình:** sau này `restRotation` có thể migrate → `restTransform` (cùng shape D1).

**IK (D14):** có làm; **schema để chỗ sớm** (`constraints` / `ik` optional); **implement cuối** sau mechanical + gizmo + export. Không Spine/Rive năm 1 (D13).

**Mọi Node** (text, shape, image, chart…) có thể `parentId` → Bone — rig là primitive engine, không chỉ nhân vật.

### 4.8. SVG import (D5)

SVG export = **túi path phẳng** (Figma/AI thường flatten). App:

1. Import → path/rect = node lá, **tự đặt tên** (`path-1`, …)
2. Nhóm trong app → Group, **tự đặt tên** (`group-1`, …)
3. Gắn Bone → persist `parentId` trong `.mt`

Không rely `<g>` semantic từ file xuất. Re-import art không ghi đè hierarchy trừ khi user chọn.

### 4.9. Camera (D9)

`type: "camera"` = **CameraNode** trong cây (không chỉ track ẩn scene).

- Nhiều camera + transition giữa A/B.
- Pan/rotate = `transform.x/y/rotation`; zoom = duy nhất `payload.zoom`. AnimOp `cam.*` compile xuống các property này.
- Scene: `activeCameraId` (hoặc clip cut) — chi tiết khi implement.
- Preset (`focus-target`, …) gắn lên **CameraNode** và compile xuống `transform`/`payload.zoom`.

### 4.10. Animation: Clip, Track, AnimOp

```text
Clip {
  id, targetId?
  schedule: absolute(at) | after(clipId, offset?) | with(clipId, offset?)
  duration                 // giây; key.t clip-relative
  playback: { iterations, direction, rate: ResolvableValue<number> }
  source:
    | { kind: "preset", presetId, params? }
    | { kind: "ops", ops: AnimOp[] }
    | { kind: "tracks", tracks: PropertyTrack[] }   // canonical sau Convert
}

PropertyTrack { targetId, property, keys: [{ t, v, easing? }] }
```

**Easing MVP:** `linear` | `easeIn` | `easeOut` | `easeInOut` | `spring`.  
**AnimOp** (sugar): `move.`_, `scale._`, `rotate`, `fade`, `resize`/`grow`/`shrink`, màu, effects, text ops, `cam.\*` — mỗi op map → property path; áp dụng mọi Node kể cả Bone.

**Convert:** Preset → tracks; optional `derivedFrom` để Reset to preset.

### 4.11. Preset → Pattern → Template

| Artifact  | Vai trò                                               |
| --------- | ----------------------------------------------------- |
| Preset    | Recipe AnimOp + timing mặc định (`fade-up`, `pop`, …) |
| Pattern   | Skeleton node + clips (big-number, process-steps, …)  |
| Template  | Pattern + brand + scene roles (Hook → CTA)            |
| Component | Đóng gói publish — mục 6                              |

Preset id = string; **không** enum cứng trong Zod — registry ở `motion-presets` / template-library.

---

## 5. Project file (`.mt` = tài liệu đang làm)

`.mt` **không** chứa định nghĩa Template / Preset / Pattern / Component / Registry.
Chúng sống ở package (giống npm); Project chỉ **tham chiếu**.

```text
MotionProject v2
├── format: motion-project
├── formatVersion: 2
├── metadata          // name, author, createdAt, updatedAt, aspectRatio, fps, …
├── dependencies      // exact component version + source + integrity
├── assets[]          // D29 — reference only; type mở (image|svg|audio|…|rive|…)
├── variables[]       // D26 — Colors, Strings, Numbers, … (tầng dữ liệu toàn cục)
├── timeline          // sceneOrder + audioTracks
├── scenes[]
│   ├── id, name?, duration, activeCameraId?
│   ├── nodes[]       // flat + parentId; gồm Component Node (D2/D28)
│   └── clips[]       // tracks / preset-source
├── bindings[]        // D24 — Project Variable → Scene Node property
└── extensions?       // D25/D14 — constraints[], events[], plugins… (chừa chỗ)
```

**Asset (D29):** schema chỉ cần `id`, `assetType` (string), `uri`/hash… Runtime quyết định render. Năm 1 implement Image/SVG/Audio/Font; Spine/Lottie/Rive/GLTF = type mở, chưa code.

**Không serialize** `children[]` cạnh `parentId`. **Không lưu** matrix.

Migration v1→v2: `Layer`→`Node`, `x/y`→`transform`, `animations[]`→`Clip` preset-source; bump `MOTION_FORMAT_VERSION = 2`.

---

## 6. Component Public API (D23) — trụ cột sản phẩm

### 6.1. Định nghĩa

**Component (**`.mvc`**) không phải nhóm node.** Component = **API** (Exposed Parameters), giống React props.

```text
Internal (mặc định khóa)
  Nodes, Clips, Tracks, Bones, Camera, Timeline…
Public API
  title, price, productImage, primaryColor,
  animationSpeed, mascotWaveAngle, showBadge, style, …
Events (sau)
Version (D16)
```

Designer / AI Author soạn internal → chọn **Expose ✓ / Lock ❌** → Publish.  
Web / AI User chỉ thấy và sửa Public API.

```json
{
  "componentId": "hero-banner",
  "formatVersion": 2,
  "componentVersion": "1.2.0",
  "props": {
    "title": "Sale 50%",
    "price": "299K",
    "theme": "red",
    "animationSpeed": 1.2
  }
}
```

AI **không** sửa Layer 18 / Bone 3 / Keyframe 42.

### 6.2. Exposed Parameter types (D8)

`string` | `color` | `number` | `boolean` | `image` | `enum`  
(+ sau: `gradient`, `font`, `audio`, …)

```text
ExposedParam {
  id, type, label?, default?
  variableId                     // Public API → Variable → internal Bindings
  semantic?                      // Web/AI User address public meaning only
  min?, max?, options?
}
```

Ví dụ: `mascotWaveAngle: number` → `transform.rotation` của bone — consumer vẫn không thấy Bone (D17 = hệ quả D23).

### 6.3. Expose / Lock

| Nội bộ                                | Mặc định      | Designer               |
| ------------------------------------- | ------------- | ---------------------- |
| Timeline, Camera, hầu hết Bone/Tracks | Lock          | Giữ hoặc mở từng param |
| Text, Color, Image                    | Thường Expose | Tùy chọn               |
| Speed ✓ / Direction ❌                | Từng param    | Granular               |

### 6.4. Semver `.mvc` (D16)

**Major** khi đổi contract consumer có thể gãy:

- Xóa/đổi type hoặc ý nghĩa Public API mà không migrate được
- Xóa public semantic/control/event/slot
- Đổi hành vi đã cam kết làm consumer hoặc scene sync gãy

Internal hierarchy/ID không ảnh hưởng semver trừ khi đã expose; sửa art/timing không đổi hành vi cam kết → patch.
Web pin `componentId@version`.

### 6.5. AI Planner

```text
Prompt → Component Registry → chọn component
      → Fill Public API only → Done
```

Trước khi Electron Designer đủ: **AI Author** vẫn sinh được `.mvc` hợp lệ; user Web chỉ tiêu thụ qua API.

### 6.6. Semantic Layer — Role (D27) ⭐

Slots / ExposedParam **chưa đủ** nếu AI chỉ thấy `title` mà không biết đó là Hook / CTA / Statistic.

```text
Internal Node / Public API
 └── semantic?: { role, key?, tags[] }
```

- Designer gán Role khi soạn `.mvc`.
- Role **không đổi** khi thay art bên trong (đổi SVG, đổi bone) — miễn Public API + Role giữ nguyên.
- AI Author có thể address internal role. Web/AI User chỉ address semantic đã expose trên Public API.

Semantic đứng **ngang hàng** Public API trong moat sản phẩm — không phải label phụ.

### 6.7. Variables (D26) + Data Binding (D24)

Variables = tầng **dữ liệu**, ngang Assets — không phải Node, không phải Component.

```text
Variable { id, type, name, value }   // scalar | image asset ref | list<object>
Binding  { source: variable|context, target: { nodeId, property } }
```

Ví dụ: `{{price}}` trên Text node → Binding → Variable `productPrice`.
AI: `Price = 299K` → mọi binding cập nhật. **Không copy value** vào từng node.

Project binding target luôn gồm `{ sceneId, nodeId, property }` vì Node ID có scope per-scene. Precedence: Component default < Component Node props < Project binding.

### 6.8. Events (D25) — chừa schema

```text
extensions.events[]   // AnimationEnd → play next; Hover → … (năm sau)
extensions.constraints[]  // LookAt, Follow, Path… (D14 IK cùng bag mở)
```

Năm 1: mảng trống / optional. Không implement runtime.

---

## 7. Ứng dụng và rendering

### 7.1. Hai app, một format

|         | `apps/web` (Next.js)                 | `apps/desktop` (**Electron** — D11)        |
| ------- | ------------------------------------ | ------------------------------------------ |
| Vai trò | AI User + Creator                    | Designer                                   |
| Preview | Konva (Canvas trình duyệt)           | Konva + bone gizmo; Pixi sau nếu mesh nặng |
| Chỉnh   | Public API (+ timeline lite Creator) | Full graph + Expose/Publish                |
| Export  | Job → worker                         | Cùng pipeline                              |

### 7.2. Preview vs export

| Lớp           | Công nghệ                                                   |
| ------------- | ----------------------------------------------------------- |
| Preview UI    | Chromium Canvas + **Konva** (Viewport pluggable → Pixi sau) |
| Export frames | `@napi-rs/canvas` **(D12)** → FFmpeg                        |

Không hybrid Pixi+Konva trên Web MVP. Không `@pixi/node` / skia-canvas năm 1 trừ khi sau này benchmark bắt buộc.

```text
Viewport { setCamera, setSelection, … }
Renderer: KonvaRenderer | PixiRenderer
State = .mt  →  renderer chỉ đọc; gizmo chỉ ghi field đã chốt
```

---

## 8. Cấu trúc monorepo

```text
packages/
  motion-schema/     # Zod v2: node, transform, clip, bone, component, migrate-v1
  motion-presets/    # PresetDef catalog
  motion-patterns/
  motion-templates/
  motion-compiler/   # preset→tracks, world matrix, instantiate component + apply props
  motion-runtime/    # evaluate frame; Viewport adapters
apps/
  web/               # Next.js — AI + Creator
  desktop/           # Electron — Designer
```

`template-library` hiện tại bridge dần sang presets/patterns. Preset ids không enum trong Zod.

---

## 9. Lộ trình triển khai

| Pha    | Mục tiêu                                                                                       | Done khi                                                  |
| ------ | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **A**  | IR v2 + Component Public API round-trip; migrator; Lab props→preview; AI Author stub           | 1 `.mvc` mở trên Web chỉ qua props; migrate 1 template v1 |
| **B**  | Creator: timeline lite, preset/duration/ease; 3 pattern v2                                     | big-number, process-steps, compare-2                      |
| **C**  | Electron Designer: Konva, keyframe, Publish, bone gizmo Rotate/Pivot/Length, SVG flatten→group | Publish `.mvc` từ Desktop                                 |
| **C+** | IK (schema sẵn, **code cuối**); Pixi chỉ nếu cần GPU                                           | IK ship sau mechanical ổn                                 |
| **D**  | AI Planner: registry → fill Public API → preview/export                                        | Prompt → props hợp lệ → video                             |

### Không làm (lệch gốc)

- Fork schema Web/Desktop
- Enum cứng mọi preset trong Zod
- Spine/Rive năm 1; IK sớm; gizmo bone chỉ xoay
- `currentRotation`; serialize `children[]` + `parentId`
- Lưu matrix / time-by-frame / Y-up trong `.mt`
- Web AI mở node tree / Bone
- Mài Desktop UI trước khi có 1 Component Public API chạy end-to-end

---

## 10. Checklist triển khai ban đầu

> **Thứ tự:** Fixture → Review → contract normative → Zod/parser/reference validator → Compiler → Runtime.

- [x] `docs/fixtures/v2/` — 5 `.mvc` + 2 `.mt` + AI patch regression
- [x] Chốt vocabulary tại `docs/motion-format-v2.md`
- [x] `motion-schema` v2 là API mặc định; v1 chỉ còn import migrator
- [x] Variables + Bindings + Semantic + Component Node + Asset/Dependency trong Zod
- [x] Extensions bag constraints/events optional
- [x] Conventions: Y+(D19), px(D20), seconds(D21), no matrix(D22), id per-scene(D18)
- [x] `migrate-v1.ts` + regression v1 → canonical v2
- [x] Compiler: binding, Component props, repeater, ResolvableValue, schedule và preset → literal tracks
- [ ] Compiler: worldMatrix đầy đủ cho parent/inherit/mask
- [x] Web editor/storage/import/export dùng MotionProject v2
- [ ] Web: Component Public API form + cùng track evaluator với export
- [x] Runtime export `@napi-rs/canvas` chỉ đọc Normalized Runtime IR
- [ ] Electron scaffold (Pha C)
- [x] `docs/motion-format-v2.md` là contract duy nhất; v1 chỉ còn schema/migrator trong code
- [x] Golden Fixture regression: parse dependency, expand Component/repeater và reject reference hỏng

---

## 11. Chỉ mục quyết định đã chốt (D1–D29)

| ID  | Chủ đề                   | Quyết định                                                                |
| --- | ------------------------ | ------------------------------------------------------------------------- |
| D1  | Transform                | 13 field; không skew                                                      |
| D2  | Parenting                | Chỉ `parentId`; tree derived; **cấm** serialize `children[]`              |
| D3  | Bone fields              | `length?` + `restRotation?`; current = `transform`; cấm `currentRotation` |
| D4  | Inherit                  | position/rotation/scale/opacity; default true                             |
| D5  | SVG                      | Túi path phẳng; app đặt tên + nhóm                                        |
| D6  | Draw order               | Sort `zIndex`; hòa theo `nodes[]`; không `index`                          |
| D7  | Bone anim                | Chỉ `transform.*` / Track; không `bone.rotate`                            |
| D8  | API param types          | string, color, number, boolean, image, enum (+sau)                        |
| D9  | Camera                   | `CameraNode`                                                              |
| D10 | Group vs Bone            | Bone ⊇ Group + length + restRotation + semantic rig                       |
| D11 | Desktop                  | Electron                                                                  |
| D12 | Export canvas            | `@napi-rs/canvas`                                                         |
| D13 | Spine                    | Không implement năm 1; type asset vẫn mở                                  |
| D14 | IK / Constraint          | Schema chỗ trống (`extensions.constraints[]`); implement cuối             |
| D15 | Gizmo                    | Rotate + Move Pivot + Length                                              |
| D16 | `.mvc` semver            | Major theo public observable contract; internal ID chỉ tính khi đã expose |
| D17 | Web × Bone               | Web không thấy Bone                                                       |
| D18 | Id scope                 | Per-scene; component namespace                                            |
| D19 | Coordinates              | (0,0) top-left; Y+ xuống                                                  |
| D20 | Unit                     | Pixel trong engine                                                        |
| D21 | Time                     | Second float                                                              |
| D22 | Matrix                   | Không lưu; runtime tính                                                   |
| D23 | **Component Public API** | Exposed Parameters; Expose/Lock; AI/Web chỉ props                         |
| D24 | **Data Binding**         | Variable ↔ Node/Instance property; không copy value                       |
| D25 | **Event**                | `extensions.events[]` chừa schema; chưa runtime năm 1                     |
| D26 | **Variables**            | Tầng dữ liệu ngang Assets trong `.mt`                                     |
| D27 | **Semantic Role**        | Internal cho Author; Web/AI User chỉ address semantic trên Public API     |
| D28 | **Project vs packages**  | Component Instance là Scene Node; definition/registry là package ngoài    |
| D29 | **Asset opaque**         | `assetType` string mở; runtime quyết định render                          |

---

## 12. Ví dụ tối thiểu

**Track xương (Designer / internal):**

```json
{
  "id": "clip-arm",
  "targetId": "left-arm",
  "start": 0,
  "duration": 0.8,
  "source": {
    "kind": "tracks",
    "tracks": [
      {
        "targetId": "left-arm",
        "property": "transform.rotation",
        "keys": [
          { "t": 0, "v": 0 },
          { "t": 0.8, "v": 45, "easing": "easeOut" }
        ]
      }
    ]
  }
}
```

**Consumer Web / AI (chỉ Public API):**

```json
{
  "componentId": "comp.product-hero",
  "version": "1.0.0",
  "props": {
    "title": "Sale 50%",
    "price": "299K",
    "primaryColor": "#0F766E",
    "productImage": "assets/demo-product.png",
    "animationSpeed": 1.2,
    "showBadge": true
  }
}
```

---

## 13. Quan hệ docs cũ

| Doc                   | Giữ                 | Cập nhật theo v2                  |
| --------------------- | ------------------- | --------------------------------- |
| `motion-format-v2.md` | IR trung tâm        | Node/Track/Component v2 canonical |
| `blocks-plan.md`      | Pattern-first       | Map block → Preset / Pattern      |
| `workflow.md`         | Gốc = mẫu chạy được | Mẫu = Component + Public API      |

---

**Tóm tắt:** `.mt` = document (meta, dependency, assets, variables, timeline, scenes, bindings) · Component Instance = Scene Node · Packages = preset/pattern/template/`.mvc`/registry · Authoring IR compile thành Runtime IR literal · Public semantic không rò internal · parentId-only · không matrix · D1–D29 đã khóa.
