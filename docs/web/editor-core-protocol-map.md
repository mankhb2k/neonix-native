# Editor-Core ↔ Protocol Map

> Bản đồ ánh xạ thuật ngữ + dữ liệu từ `editor-core` sang protocol V1.
>
> File này **không** định nghĩa protocol mới. Nó chỉ giải thích `editor-core`
> đang gọi cái gì, và mỗi cái tên đó ánh xạ sang phần nào của protocol, docs,
> hoặc guide. Source of truth của protocol nằm ở `@motionvideo/motion-protocol`
> và `docs/guide` — file này là cầu nối, không phải nguồn.
>
> Bổ trợ cho [editor-vocabulary.md](./editor-vocabulary.md) (glossary chung),
> [editor-playback.md](./editor-playback.md) (ranh giới playback), và
> [editor-interactions-fix-plan.md](./editor-interactions-fix-plan.md) (ranh giới
> tầng interaction: gesture → intent → command adapter).

---

## 1. Mục tiêu

- Không định nghĩa protocol mới.
- Giải thích mỗi tên trong `editor-core` đang trỏ vào đâu trong protocol.
- Khoá ranh giới: protocol object vs derived editor model vs session state.
- Cho reviewer biết một tên là canonical, compat alias, hay legacy cần migrate.

---

## 2. Source of truth matrix

| Tên                                               | Lớp                   | Ghi JSON? | Vị trí                                             |
| ------------------------------------------------- | --------------------- | --------- | -------------------------------------------------- |
| `project.layers[]`                                | protocol (motion V1)  | ✅        | `@motionvideo/motion-protocol`                     |
| `project.layers[].timing`                         | protocol              | ✅        | in/out của layer                                   |
| `project.layers[].animations[]`                   | protocol              | ✅        | keyframes animation (key `t` local)                |
| Project length                                    | derived               | ❌        | `max` root `timing.start + duration`               |
| `project.assets[]` / `variables[]` / `bindings[]` | protocol              | ✅        | media/font, biến, liên kết variable → prop         |
| `TimelineClip`                                    | derived editor model  | ❌        | `editor-core/src/timeline/model/timeline-types.ts` |
| `TimelineLane`                                    | derived editor model  | ❌        | cùng file trên                                     |
| `TimelineDocument`                                | aggregate editor-core | ❌        | bọc `project` + `clips` + `lanes`                  |
| selection / playback / zoom                       | session state         | ❌        | chỉ sống trong store, không serialize              |

Quy tắc vàng:

- `project.layers[]` là source of truth duy nhất cho cây layer.
- `TimelineClip` / `TimelineLane` là dữ liệu **dẫn xuất** cho UI timeline — không
  được serialize vào project.
- selection / playback / zoom là trạng thái phiên, không thuộc protocol JSON.

---

## 3. Bảng ánh xạ thuật ngữ

| Tên editor-core                            | Nghĩa thực tế                         | Ánh xạ protocol / ghi chú                                                           |
| ------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------- |
| `TimelineClip.sceneId`                     | id của **root visual layer**          | `project.layers[].id` — tên compat, chưa rename                                     |
| `ComposedLayer.layerId`                    | root layer id trong protocol          | nguồn từ `clip.sceneId` (`compose-layers.ts`)                                       |
| `base lane` (`lane.role === "base"`)       | lane visual gốc của editor            | root visual layer                                                                   |
| `overlay lane` (`lane.role === "overlay"`) | lane visual dẫn xuất cho UI           | root visual layer                                                                   |
| `audio lane` (`lane.role === "audio"`)     | lane audio dẫn xuất                   | audio root layer (`zIndex < 0`)                                                     |
| `OverlaySceneItem`                         | legacy persistence side-car           | **deprecated** — dùng lanes + clips                                                 |
| `layerFromFrameDraft`                      | tạo root visual layer từ `FrameDraft` | trả về `MotionLayer`                                                                |
| `cloneLayerWithNewIds`                     | clone protocol layer với ids mới      | `MotionLayer` in/out; remap `parentLayerId` cho **toàn bộ** subtree (nested groups) |
| `resolveBaseStartTime`                     | tính start time cho base lane         | alias `resolveMainStartTime` deprecated                                             |
| `resolveLaneKind`                          | phân loại lane                        | alias `resolveLaneTrackKind`                                                        |
| `packRootLayersToTimeline`                 | bung root layers thành timeline clips | alias `visualTracksToTimelineClips` deprecated                                      |
| `ensureBaseLane`                           | đảm bảo lane base tồn tại             | alias `ensureMainLane` deprecated                                                   |
| `isBaseLane`                               | predicate lane base                   | alias `isMainLane` deprecated                                                       |
| `FrameDraftShape`                          | shape canonical                       | `rectangle` / `ellipse` / `polygon` (KHÔNG `rect`/`circle`)                         |

---

## 4. Legacy names còn tồn tại

| Tên compat                                | Nghĩa thật                     | Trạng thái                                         |
| ----------------------------------------- | ------------------------------ | -------------------------------------------------- |
| `TimelineClip.sceneId`                    | root visual layer id           | compat, chưa rename (timeline model migration lớn) |
| `TimelineClip.kind === "scene"`           | clip trỏ tới một root layer    | compat (`isSceneClip`)                             |
| `resolveMainStartTime`                    | = `resolveBaseStartTime`       | deprecated alias                                   |
| `resolveLaneTrackKind`                    | = `resolveLaneKind`            | deprecated alias                                   |
| `visualTracksToTimelineClips`             | = `packRootLayersToTimeline`   | deprecated wrapper                                 |
| `ensureMainLane`                          | = `ensureBaseLane`             | deprecated alias                                   |
| `isMainLane`                              | = `isBaseLane`                 | deprecated alias                                   |
| `uiTrackKindForLane`                      | trả `TimelineTrackKind` cho UI | compat/UI term                                     |
| `sceneFromFrameDraft`                     | = `layerFromFrameDraft`        | deprecated alias                                   |
| `cloneSceneWithNewIds`                    | = `cloneLayerWithNewIds`       | deprecated alias                                   |
| `OverlaySceneItem` / `parseOverlayScenes` | legacy side-car đọc doc cũ     | deprecated, parse-only                             |

Quy tắc:

- Legacy alias phải giữ nguyên tham chiếu tới canonical (đừng copy logic).
- Không thêm thuật ngữ cũ mới.
- Khi migrate xong web/desktop, xoá alias.

---

## 5. Quy tắc đặt tên cho code mới

- **Protocol object**: dùng `layer` (`MotionLayer`, `rootLayer`, `childLayer`).
- **Derived timeline item**: dùng `clip` / `lane` (`TimelineClip`, `TimelineLane`).
- **Legacy adapter**: phải ghi `legacy` hoặc `@deprecated`.
- **Không thêm synonym mới**: không `rect`/`circle` (chỉ `rectangle`/`ellipse`),
  không `scene` cho layer, không `track` cho lane, không `node` cho layer.
- **Hàm đổi protocol JSON** phải đặt tên `apply*` / `commit*` / `execute*` và nói rõ
  nó chạm vào `project.layers`.

### Determinism / ID policy

- `defaultCreateId` dùng counter toàn process (không `Math.random`) — deterministic
  trong một run, nhưng **không độc lập với thứ tự** (id phụ thuộc số lần đã gọi trước).
- Test / golden / fixture cần id tái lập **phải inject** `createId` qua
  `CommandContext` (xem `deterministic-commands.test.ts`, web `withDeterministicIds`).
- Lane id đã deterministic và tách khỏi order: `lane.base`, `lane.overlay.N`, `lane.audio.N`.

---

## 6. Checklist review khi thêm API mới

1. Tên này thuộc protocol hay editor?
2. Có 1-1 với docs/guide không?
3. Có phải compat alias không? (nếu có, phải ghi `@deprecated` + giữ cùng tham chiếu)
4. Có đang reuse từ cũ nhưng đổi nghĩa không? (ví dụ `clip` cho cả animation và UI)
5. Hàm có chạm protocol JSON không? (tên phải nói rõ `apply`/`commit`/`execute`)
6. Nếu tạo id mới, có cần deterministic không? (dùng injection, đừng dựa counter global)
