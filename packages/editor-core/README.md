# `@motionvideo/editor-core`

`editor-core` la lop domain thuan cua editor. Package nay khong phu thuoc React, DOM, Zustand, hay UI framework nao. No gom toan bo logic "business" cua timeline/document de app web, app desktop, test, va cac lop adapter co the dung chung.

## Editor core gom gi?

### 1. Document va canonical projection

- Mo hinh document/timeline chinh
- Chuyen doi giua frame draft, scene, clip, lane
- Tao document canonical va dong bo du lieu timeline

### 2. Selection va clipboard

- Quan ly selection cho clip/lane/doi tuong
- Tinh toan selectors cho trang thai dang chon
- Copy/paste clipboard cho timeline

### 3. Command system va timeline actions

- Command pattern de thuc thi thay doi tren document
- `executeTimelineCommand`
- Timeline context actions
- Property commands va property execution

### 4. Operations

- Move clip
- Move nhieu clip theo group
- Lane flags: mute, hide, lock, v.v.
- Resize collision resolution
- Placement adapters cho visual/audio

### 5. Geometry va policy

- Timeline geometry
- Viewport layout
- Lane rows
- Track kind / lane kind resolution
- Visible range selectors
- Drop target policy
- Snapping policy
- Zoom-fit policy
- CapCut ruler scale va ruler ticks

### 6. History

- Undo/redo data model
- History manager
- History coalescing

### 7. Playback

- Playback driver
- Frame <-> time helpers
- Logic chung cho transport clock thuan

### 8. Preview composition

- Compose visual layers tai global time
- Tim active clip tai mot moc thoi gian
- Tao visual lane index cho preview/render

### 9. Export

- Slice scene
- Bake timeline sang MotionProject / export snapshot

### 10. Internal compat helpers

Mot so helper dung lai tu app store/legacy layer duoc gom vao day de app co the chia se logic:

- `uid`
- `mapNode`
- `nodeText`
- `updateVariable`
- `sceneFromFrameDraft`
- `cloneSceneWithNewIds`
- `stageSizeForAspect`

## Public API chinh

```ts
import {
  executeTimelineCommand,
  moveClipGroup,
  applyLaneFlagPatch,
  resolveCollisionsAfterResize,
  createPlaybackDriver,
  playbackFrameIndex,
  composeVisualLayersAtTime,
  buildExportProject,
} from "@motionvideo/editor-core";
```

## Module map

| Nhom | Chuc nang |
|---|---|
| `document/` | Document model, canonical projection |
| `selection/` | Selection state va selectors |
| `timeline/model/` | Kieu du lieu timeline chinh |
| `timeline/commands/` | Command types va command runner |
| `timeline/actions/` | Timeline context actions |
| `timeline/geometry/` | Timeline geometry, viewport layout, lane rows |
| `timeline/policies/` | Snapping, zoom-fit, ruler ticks, drop target |
| `timeline/selectors/` | Visible range, track kind, scene-order clips |
| `timeline/internal/` | Compatibility helpers va adapters noi bo |
| `operations/` | Clip move, group move, lane flags |
| `history/` | Undo/redo va coalesce |
| `properties/` | Property commands, registry, mixed state |
| `playback/` | Playback driver va frame-time helpers |
| `preview/` | Compose visual layers |
| `export/` | Slice scene va build export project |
| `overlay-scenes/` | Overlay scene helpers |
| `testing/` | Fixtures va helper cho test |

## Khong co trong editor-core

- React components
- DOM measurement
- Pointer capture / gesture hooks
- Zustand store
- UI shell, CSS, layout cua app
- Renderer-specific code nhu Pixi, Remotion, canvas painting

Neu mot tinh nang can UI hoac gesture, no thuong nam o `@motionvideo/editor-interactions` hoac `@motionvideo/editor-react`.

## Dependencies

- `@motionvideo/motion-schema`
- `@motionvideo/motion-runtime`

## Lua chon thiet ke

`editor-core` co y dinh giu "pure" de:

- test de
- import duoc tu nhieu app
- khong bi nut voi React/DOM
- co the tach sang package khac neu can

