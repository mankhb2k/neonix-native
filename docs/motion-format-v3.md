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
timeline.visualTracks: VisualTrackV3[]    // main + overlay track lanes
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

Khác biệt chính:

| V2 (đã bỏ) | V3 (canonical) |
|---|---|
| `timeline.sceneOrder: string[]` | `timeline.visualTracks: VisualTrackV3[]` |
| `scene.transition` | `visualClip.transitionIn / transitionOut` |
| Một lane duy nhất | Nhiều track lane (`main` + `overlay`) |
| Scene-level transition | Clip-level transition |
| Không có loop/playbackRate | Có loop, playbackRate, opacity |

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
        { "id": "title", "type": "text", "parentId": null,
          "transform": { "x": 0, "y": 0, "width": 1080, "height": 200,
            "rotation": 0, "scaleX": 1, "scaleY": 1,
            "anchorX": 0.5, "anchorY": 0.5, "opacity": 1, "visible": true },
          "payload": { "content": { "kind": "plain", "text": "Hello" } } }
      ]
    },
    {
      "id": "outro",
      "duration": 2,
      "nodes": [
        { "id": "end-text", "type": "text", "parentId": null,
          "transform": { "x": 0, "y": 0, "width": 1080, "height": 200,
            "rotation": 0, "scaleX": 1, "scaleY": 1,
            "anchorX": 0.5, "anchorY": 0.5, "opacity": 1, "visible": true },
          "payload": { "content": { "kind": "plain", "text": "Thanks" } } }
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
          { "id": "c1", "source": { "kind": "scene", "sceneId": "intro" }, "start": 0, "duration": 3 },
          { "id": "c2", "source": { "kind": "scene", "sceneId": "outro" }, "start": 3, "duration": 2 }
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

## Migration từ V2

V2 projects (`formatVersion: 2`) **không còn được hỗ trợ**. Để migrate dữ liệu cũ:

1. Export V2 project JSON
2. Chạy migration script (nếu có trong `scripts/`)
3. Import V3 project JSON

Parser chính thức (`parseMotionProject`) sẽ từ chối V2 data với thông báo lỗi:

> "V2 motion projects are no longer supported. Please migrate your project to V3 format."
