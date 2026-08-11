# Motion Project V3 — Canonical Authoring Format

> **Status**: Canonical source of truth. Đây là format duy nhất được chấp nhận bởi tất cả product paths (editor, compiler, runtime, preview, export).
>
> **Format discriminator**: `"format": "motion-project"`, `"formatVersion": 3`
>
> **Root parser**: `parseMotionProject()` — chỉ chấp nhận `formatVersion: 3`. Dữ liệu `formatVersion: 2` bị từ chối với thông báo lỗi rõ ràng.

---

## Root Fields

```text
MotionProjectV3 {
  format: "motion-project"
  formatVersion: 3
  metadata:       ProjectMetadataV3       // identity, locale, industry, tags
  composition:    CompositionSettings     // render surface (width, height, fps, background...)
  capabilities:   CapabilityRequirements  // preflight (required, optional, experimental)
  dependencies:   ProjectDependenciesV3   // compiler range, component deps, plugins
  tokens:         DesignTokens            // colors, fonts, spacing, radii, motion
  variables:      ProjectVariableV3[]     // typed project variables
  assets:         AssetV3[]               // image, svg, video, audio, font assets
  components:     EmbeddedComponentV3[]   // embedded component definitions
  scenes:         SceneDefinitionV3[]     // scene definitions (node graph, clips, drivers)
  timeline:       ProjectTimelineV3       // visual/audio/caption track layout
  bindings:       ProjectBindingV3[]      // variable bindings (scene nodes, composition)
  provenance:     ProjectProvenance?      // origin tracking (optional)
  extensions:     NamespacedExtensions    // namespaced custom data
}
```

## Timeline Model: `visualTracks` replaces `sceneOrder`

**V2 model (ĐÃ LOẠI BỎ):**

```text
timeline.sceneOrder: string[]              // ordered scene IDs
scene.transition: SceneTransition          // scene-level transition
```

**V3 model (CANONICAL):**

```text
timeline.visualTracks: VisualTrackV3[]    // timeline track/lane for scenes (main + overlay)
timeline.audioTracks: AudioTrackV3[]
timeline.captionTracks: CaptionTrackV3[]

VisualTrackV3 {
  id, role ("main"|"overlay"), order, muted
  clips: VisualClipV3[]
}

VisualClipV3 {
  id
  source: { kind: "scene", sceneId } | { kind: "component", componentId }
  start, duration, trimStart, playbackRate, loop, opacity
  transitionIn:  TransitionV3?    // clip-level (KHÔNG PHẢI scene-level)
  transitionOut: TransitionV3?
}
```

### Quy Tắc Track / Layer

Trong tài liệu này, dùng cùng một ngôn ngữ:

- `timeline track/lane` là lane của scene trong `timeline.visualTracks` với `role` `main` hoặc `overlay`.
- `timeline layer` là node layer bên trong một scene, được sắp bởi `node.zIndex`.
- `track.order` quyết định track/lane nào nằm trên hay dưới.
- `node.zIndex` quyết định layer nào nằm trên trong cùng scene.

Khi có nhiều visual track/lane, thứ tự chồng lớp được quyết định bởi `VisualTrackV3.order`:

- `order` nhỏ hơn vẽ trước, nằm dưới.
- `order` lớn hơn vẽ sau, nằm trên.
- `role` chỉ mô tả ý nghĩa của track/lane, không tự tạo độ ưu tiên tuyệt đối.
- `node.zIndex` chỉ áp dụng bên trong từng scene để sắp xếp node nội bộ.

Ví dụ:

```json
{
  "timeline": {
    "visualTracks": [
      {
        "id": "main-track",
        "role": "main",
        "order": 0,
        "clips": [
          {
            "id": "clip-base",
            "source": { "kind": "scene", "sceneId": "scene-base" },
            "start": 0,
            "duration": 5
          }
        ]
      },
      {
        "id": "overlay-track",
        "role": "overlay",
        "order": 1,
        "clips": [
          {
            "id": "clip-logo",
            "source": { "kind": "scene", "sceneId": "scene-logo" },
            "start": 2,
            "duration": 3,
            "opacity": 0.8
          }
        ]
      }
    ]
  }
}
```

Trong ví dụ này, `overlay-track` nằm trên `main-track` vì `order: 1 > 0`. Bên trong `scene-logo`, node nào có `zIndex` cao hơn sẽ nằm trên node khác trong cùng scene. Nói ngắn gọn: track/lane chồng nhau bằng `order`, còn layer trong scene chồng nhau bằng `zIndex`.

Khác biệt chính:

> **V2 đã bị loại bỏ hoàn toàn.** Bảng dưới đây chỉ để tham khảo lịch sử, không phải hướng dẫn migration.

| V2 (đã bỏ)                      | V3 (canonical)                            |
| ------------------------------- | ----------------------------------------- |
| `timeline.sceneOrder: string[]` | `timeline.visualTracks: VisualTrackV3[]`  |
| `scene.transition`              | `visualClip.transitionIn / transitionOut` |
| Một lane duy nhất               | Nhiều track/lane (`main` + `overlay`)     |
| Scene-level transition          | Clip-level transition                     |
| Không có loop/playbackRate      | Có loop, playbackRate, opacity            |

## Group Layer Semantics

### Tổng Quan

Một `group` node (`type: "group"`) là một **timeline layer thực sự** — không phải folder thụ động. Nó có timing, transform, z-order, animation, effects riêng, và có thể chứa các child layer bên trong. Child layer có timing **relative với parent**, không relative với scene.

```text
Scene                                   ← implicit root
  group.character        parentId: null  ← root layer, direct child of scene
    group.upper-body     parentId: group.character
      group.head-rig     parentId: group.upper-body
        head-image       parentId: group.head-rig
```

### Thuật Ngữ

| Thuật ngữ             | Ý nghĩa                                                                 |
|------------------------|--------------------------------------------------------------------------|
| `timeline track/lane`  | Lane của scene trong `timeline.visualTracks` (`main`, `overlay`)        |
| `timeline layer`       | Node layer bên trong một scene                                          |
| `group layer`          | Node `type: "group"` có thể chứa child layer                            |
| `root layer`           | Node có `parentId: null`, trực thuộc scene                              |
| `child layer`          | Node có `parentId` trỏ đến một node khác                                |

> ⚠️ Không dùng `track`, `lane`, và `layer` thay thế cho nhau.

### Parent Relationship

- Node `parentId: null` → relative với scene (root layer).
- Node `parentId` → relative với parent node (child layer).
- `group` node là **real layer** với đầy đủ timing/transform/animation.
- Hiện tại, chỉ `group` node mới được phép có children (có thể mở rộng sau).

### Timing (Parent-Relative)

Timing của child được tính **relative với parent**, không relative với scene:

```text
nodeGlobalStart = parentGlobalStart + node.timing.start
nodeGlobalEnd   = min(parentGlobalEnd, nodeGlobalStart + node.timing.duration)
```

**Default timing**: Nếu `node.timing` bị thiếu:
- `start = 0`
- `duration = parent effective duration`

**Visibility**: Một child chỉ visible khi scene time nằm trong timing range của **tất cả ancestor**.

**Ví dụ**:

```text
group.character     timing: { start: 5, duration: 4 }   → global 5–9
group.upper-body    timing: { start: 1, duration: 2 }   → global 6–8 (5+1 → 5+1+2)
group.head-rig      timing: { start: 0.5, duration: 1.5 } → global 6.5–8 (6+0.5 → 6+0.5+1.5)
head-image          timing: { start: 0, duration: 1 }   → global 6.5–7.5 (6.5+0 → 6.5+0+1)
```

### Z Order (Sibling-Local)

`zIndex` chỉ có ý nghĩa giữa các **sibling** (cùng `parentId`). Một child có `zIndex` cao không thể vượt ra ngoài parent group:

```text
Scene
  group.character     zIndex 1    ← root sibling
    head              zIndex 99   ← child, chỉ so với sibling cùng parent
  title               zIndex 2    ← root sibling, luôn nằm TRÊN group.character
```

`head` (zIndex 99) nằm **trong** group.character (zIndex 1), không thể render trên `title` (zIndex 2).

### Transform & Animation

Group layer có cùng quyền animation như mọi node khác:
- `transform`, `opacity`, `visible`, `timing`, `zIndex`
- `effects`, `blendMode`, `mask`, `modifiers`
- Animation clips target `group.id`

Khi group transform thay đổi, **tất cả child layer di chuyển theo**. Khi child transform thay đổi, nó được evaluate trong **group local coordinate space**.

### Compositing

Group payload hỗ trợ `compositing`:

```json
{ "compositing": { "mode": "pass-through" } }
```

- **`pass-through`**: Children render trong parent context, kế thừa transform/timing/visibility của parent.
- **`isolate`**: Children render vào offscreen surface trước, sau đó group opacity/effects/blend/mask mới áp dụng lên toàn bộ group.

### JSON Ví Dụ: Ba Cấp Group Lồng Nhau

```json
{
  "id": "scene.character-demo",
  "duration": 10,
  "nodes": [
    {
      "id": "group.character",
      "type": "group",
      "parentId": null,
      "zIndex": 3,
      "timing": { "start": 5, "duration": 4 },
      "transform": {
        "x": 540, "y": 960, "width": 500, "height": 700,
        "rotation": 0, "scaleX": 1, "scaleY": 1,
        "anchorX": 0.5, "anchorY": 0.5,
        "opacity": 1, "visible": true, "flipX": false, "flipY": false
      },
      "payload": { "compositing": { "mode": "pass-through" } }
    },
    {
      "id": "group.upper-body",
      "type": "group",
      "parentId": "group.character",
      "zIndex": 2,
      "timing": { "start": 1, "duration": 2 },
      "transform": {
        "x": 0, "y": -120, "width": 360, "height": 380,
        "rotation": 0, "scaleX": 1, "scaleY": 1,
        "anchorX": 0.5, "anchorY": 0.5,
        "opacity": 1, "visible": true, "flipX": false, "flipY": false
      },
      "payload": { "compositing": { "mode": "pass-through" } }
    },
    {
      "id": "group.head-rig",
      "type": "group",
      "parentId": "group.upper-body",
      "zIndex": 3,
      "timing": { "start": 0.5, "duration": 1.5 },
      "transform": {
        "x": 0, "y": -140, "width": 180, "height": 180,
        "rotation": 0, "scaleX": 1, "scaleY": 1,
        "anchorX": 0.5, "anchorY": 0.5,
        "opacity": 1, "visible": true, "flipX": false, "flipY": false
      },
      "payload": { "compositing": { "mode": "isolate" } }
    },
    {
      "id": "head-image",
      "type": "image",
      "parentId": "group.head-rig",
      "zIndex": 0,
      "timing": { "start": 0, "duration": 1 },
      "transform": {
        "x": 0, "y": 0, "width": 160, "height": 160,
        "rotation": 0, "scaleX": 1, "scaleY": 1,
        "anchorX": 0.5, "anchorY": 0.5,
        "opacity": 1, "visible": true, "flipX": false, "flipY": false
      },
      "payload": { "assetId": "asset.head" }
    }
  ]
}
```

## Transitions

Transition là thuộc tính của **clip**, không phải của scene:

```json
{
  "id": "clip-intro",
  "source": { "kind": "scene", "sceneId": "intro" },
  "start": 0,
  "duration": 3,
  "transitionIn": { "type": "fade", "duration": 0.5, "easing": "easeOut" },
  "transitionOut": { "type": "slide", "duration": 0.3, "direction": "left" }
}
```

Các loại transition được hỗ trợ: `cut`, `fade`, `crossfade`, `slide`, `wipe`, `zoom`.

## Editor UI State

**Editor UI state KHÔNG phải là một phần của V3 project JSON.** Các trường sau thuộc về editor state và không được lưu vào project:

- Vị trí scroll/viewport của timeline
- Tab đang mở
- Node đang được chọn
- Trạng thái undo/redo stack
- Panel layout
- Zoom level
- Playhead position hiện tại

Editor lưu các state này riêng (localStorage, IndexedDB, hoặc file workspace riêng). `MotionProjectV3` chỉ chứa dữ liệu authoring thuần túy.

## Ví dụ

### Minimal Empty Project

```json
{
  "format": "motion-project",
  "formatVersion": 3,
  "metadata": {
    "id": "my-project",
    "name": "My Project",
    "locale": "vi-VN"
  },
  "composition": { "width": 1920, "height": 1080, "fps": 30 },
  "capabilities": {},
  "dependencies": { "compiler": { "range": ">=1.0.0" }, "components": [] },
  "tokens": {},
  "variables": [],
  "assets": [],
  "components": [],
  "scenes": [],
  "timeline": { "visualTracks": [], "audioTracks": [], "captionTracks": [] },
  "bindings": []
}
```

### Multi-Scene Project (xem `packages/motion-protocol/src/v3/__fixtures__/multi-scene.project.json`)

Dự án với 2 scene (intro + outro) được sắp xếp trong một `visualTrack`:

```json
{
  "format": "motion-project",
  "formatVersion": 3,
  "metadata": { "id": "multi-scene", "name": "Multi Scene", "locale": "vi-VN" },
  "composition": { "width": 1080, "height": 1920, "fps": 30 },
  "capabilities": {},
  "dependencies": { "compiler": { "range": ">=1.0.0" }, "components": [] },
  "tokens": {},
  "variables": [],
  "assets": [],
  "components": [],
  "scenes": [
    {
      "id": "intro",
      "duration": 3,
      "nodes": [
        {
          "id": "title",
          "type": "text",
          "parentId": null,
          "transform": {
            "x": 0,
            "y": 0,
            "width": 1080,
            "height": 200,
            "rotation": 0,
            "scaleX": 1,
            "scaleY": 1,
            "anchorX": 0.5,
            "anchorY": 0.5,
            "opacity": 1,
            "visible": true
          },
          "payload": { "content": { "kind": "plain", "text": "Hello" } }
        }
      ]
    },
    {
      "id": "outro",
      "duration": 2,
      "nodes": [
        {
          "id": "end-text",
          "type": "text",
          "parentId": null,
          "transform": {
            "x": 0,
            "y": 0,
            "width": 1080,
            "height": 200,
            "rotation": 0,
            "scaleX": 1,
            "scaleY": 1,
            "anchorX": 0.5,
            "anchorY": 0.5,
            "opacity": 1,
            "visible": true
          },
          "payload": { "content": { "kind": "plain", "text": "Thanks" } }
        }
      ]
    }
  ],
  "timeline": {
    "visualTracks": [
      {
        "id": "main",
        "role": "main",
        "order": 0,
        "clips": [
          {
            "id": "c1",
            "source": { "kind": "scene", "sceneId": "intro" },
            "start": 0,
            "duration": 3
          },
          {
            "id": "c2",
            "source": { "kind": "scene", "sceneId": "outro" },
            "start": 3,
            "duration": 2
          }
        ]
      }
    ]
  },
  "bindings": []
}
```

### Transition Project (xem `packages/motion-protocol/src/v3/__fixtures__/transition.project.json`)

### Component Project (xem `packages/motion-protocol/src/v3/__fixtures__/component.project.json`)

### Caption Project (xem `packages/motion-protocol/src/v3/__fixtures__/caption.project.json`)

### Audio Project (xem `packages/motion-protocol/src/v3/__fixtures__/audio.project.json`)

## JSON Schema

JSON Schema (Draft-07) được generate tự động từ `MotionProjectV3Schema`:

```bash
pnpm --filter @motionvideo/motion-protocol generate:schema
```

Output: `packages/motion-protocol/schema/v3.json`

Schema này chỉ chứa `visualTracks`, không chứa `sceneOrder`.

## Rejected V2 Input

V2 projects (`formatVersion: 2`) **không còn được hỗ trợ**. Parser chính thức (`parseMotionProject`) sẽ từ chối V2 data:

> "V2 motion projects are no longer supported."

Các field bị reject: `timeline.sceneOrder`, `scene.transition`, `formatVersion: 2`.

## Rendering Pipeline (Provider-Neutral)

MotionProjectV3 không phụ thuộc vào renderer cụ thể. Pipeline chuẩn:

```text
MotionProjectV3 (authoring JSON)
       │
       ▼  @motionvideo/motion-compiler
MotionRuntimeProject  (formatVersion 3, flat, literal-only)
       │
       ▼  @motionvideo/motion-runtime
PaintCommandBuffer  (evaluated per-frame paint commands)
       │
       ├──► @motionvideo/pixi-renderer      → preview in-browser (WebGL/Canvas)
       ├──► @motionvideo/remotion-renderer   → export MP4/GIF (server-side)
       └──► future: canvas/headless provider  → thumbnail, headless CI
```

### Provider Expectations

| Provider         | Package                          | Input              | Output           | Use Case             |
| ---------------- | -------------------------------- | ------------------ | ---------------- | -------------------- |
| Pixi Preview     | `@motionvideo/pixi-renderer`     | PaintCommandBuffer | WebGL draw calls | Editor preview, MCP  |
| Remotion Export  | `@motionvideo/remotion-renderer` | PaintCommandBuffer | MP4, GIF, still  | Export, CI           |
| Future: Canvas   | (planned)                        | PaintCommandBuffer | 2D canvas draw   | Thumbnail generation |
| Future: Headless | (planned)                        | PaintCommandBuffer | pixel buffer     | CI snapshot testing  |

### MCP Preview/Export Provider

MCP server sử dụng `@motionvideo/playback-engine` để preview và export:

- **Preview mode**: Pixi renderer chạy trong browser context
- **Export mode**: Remotion renderer chạy server-side với composition parameters

Cả hai đều nhận `MotionRuntimeProject` đã compile — không chạy compiler trong renderer.
