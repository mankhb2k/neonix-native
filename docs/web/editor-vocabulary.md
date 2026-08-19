# Từ vựng Editor

> Bảng chú giải ưu tiên protocol cho web editor.
>
> Nguyên tắc vàng:
>
> - Một thuật ngữ chỉ nên mang một nghĩa.
> - Nếu thuật ngữ đã tồn tại trong protocol, hãy dùng đúng thuật ngữ của protocol.
> - Nếu thuật ngữ chỉ dùng trong editor, hãy đánh dấu rõ là dẫn xuất (derived) hoặc chỉ dành cho UI.

---

## 1. Quy tắc đặt tên chuẩn

Dùng các mặc định sau trong code mới:

- `Layer` cho đối tượng protocol trong `project.layers`
- `Asset` cho bản ghi asset trong `project.assets`
- `Binding` cho liên kết variable → prop
- `Variable` cho biến của project
- `Component` cho định nghĩa component
- `ComponentInstance` cho layer có `type: "component"`
- `AnimationClip` cho `layer.animations[]`
- `TimelineClip` cho layer được chiếu lên timeline (view dẫn xuất)
- `TimelineDocument` cho trạng thái editor dẫn xuất bao bọc project
- `TimelineLane` cho hàng lane dẫn xuất của editor
- `Selection` cho trạng thái chọn trong phiên editor
- `Node` chỉ dùng cho duyệt cây tổng quát, không dùng làm thuật ngữ protocol

Tránh dùng cùng một từ cho nhiều khái niệm khác nhau.

---

## 2. Thuật ngữ chuẩn

| Thuật ngữ           | Nghĩa                                                        | Ánh xạ tới                                          | Ghi chú                                                  |
| ------------------- | ------------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------- |
| `Layer`             | Phần tử project chuẩn trong cây layer                        | `project.layers[]`                                  | Thuật ngữ protocol chính cho nút visual/audio trong cây. |
| `Root layer`        | Layer cấp gốc trong `project.layers`                         | phần tử `project.layers[]` có `parentLayerId: null` | Root layer không phải timeline lane.                     |
| `GroupLayer`        | Layer có children                                            | `type: "group"`                                     | Nút chứa trong cây layer.                                |
| `AudioLayer`        | Layer audio chuẩn                                            | `type: "audio"`                                     | Audio là layer, không phải clip.                         |
| `ComponentInstance` | Layer khởi tạo một component                                 | `type: "component"`                                 | Lớp bao quanh phần bên trong component.                  |
| `Asset`             | Tham chiếu media hoặc font                                   | `project.assets[]`                                  | Đừng bao giờ gọi đây là clip.                            |
| `Variable`          | Biến có tên của project                                      | `project.variables[]`                               | Nguồn dữ liệu cho các giá trị dùng chung.                |
| `Binding`           | Liên kết từ variable tới public prop                         | `project.bindings[]`                                | Chỉ dùng khi nói về nối variable.                        |
| `AnimationClip`     | Keyframe animation trên một visual layer                     | `layer.animations[]`                                | Protocol — không phải thanh tím trên UI.                 |
| `TimelineClip`      | Layer (hoặc audio) **chiếu** lên timeline: `startTime`, `duration`, `laneId` | editor-core / store dẫn xuất                          | **Gọi “clip timeline” trong hội thoại là được**; trong code dùng đủ `TimelineClip`. |
| `Clip strip`        | Hình chữ nhật bo góc trên lane — chrome UI của một `TimelineClip` | `ClipStrip.tsx`, `data-testid="timeline-clip-*"`    | Chỉ UI. Nói “strip” khi muốn tách khỏi data model.       |
| `TimelineDocument`  | Aggregate của editor: project + trạng thái timeline dẫn xuất | document của editor-core                            | Không thuộc protocol JSON.                               |
| `TimelineLane`      | Hàng lane dẫn xuất dùng bởi UI timeline                      | editor-core / web store                             | Thuộc tầng UI, không phải protocol chuẩn.                |
| `Selection`         | Trạng thái chọn hiện tại của editor                          | trạng thái phiên editor                             | Chỉ dành cho UI.                                         |
| `HistoryEntry`      | Snapshot undo/redo                                           | lịch sử editor                                      | Chỉ dành cho UI/phiên.                                   |
| `Node`              | Phần tử cây tổng quát                                        | chỉ dùng khi duyệt nội bộ                           | Tránh trong public API khi `Layer` chính xác hơn.        |

---

## 3. Thuật ngữ mơ hồ cần tránh

### `clip`

**Trên timeline UI:** gọi ngắn là **clip** (hoặc **clip timeline**) là ổn — ý là `TimelineClip` / thanh trên lane, **không** phải `Layer` trong JSON và **không** phải `AnimationClip` trong `layer.animations[]`.

Trong **code / review**, không dùng `clip` trần khi có thể nhầm tầng:

| Bạn muốn nói… | Dùng |
| --- | --- |
| Thanh tím/xanh trên timeline (data + hành vi move/trim) | `TimelineClip` |
| Chỉ phần vẽ (fill, label, border, trim handle) | **Clip strip** |
| Một `Layer` trong `project.layers[]` | `Layer` |
| Một mục trong `layer.animations[]` (animation) | `AnimationClip` |
| File media trong library | `Asset` |

Vì sao phân tách:

- Một **Layer** tồn tại trong JSON; **TimelineClip** là cách editor đặt layer đó lên hàng + thời gian (view-only packing, không ghi `laneId` vào V1).
- `clip` trần dễ lẫn animation clip, media, và hành động “cắt clip”.

### `node`

Không dùng `node` một mình trong code public mới.

Hãy dùng một trong các tên sau:

- `Layer` khi đối tượng là dữ liệu protocol chuẩn
- `LayerNode` khi muốn nói tới nút cây trong duyệt cây của editor
- `SceneNode` khi code thực sự nói về duyệt scene graph

Vì sao:

- `node` quá chung chung, không cho người đọc biết đối tượng là chuẩn, dẫn xuất, hay chỉ dành cho UI.
- Trong codebase này, `layer` đã được dành riêng cho nghĩa protocol.

### `scene`

Chỉ dùng `scene` khi code thực sự nói tới scene wrapper hoặc container cấp scene.

Tránh dùng `scene` như một từ đồng nghĩa chung cho:

- layer
- project
- timeline clip
- stage preview

### `track`

Chỉ dùng `track` khi code nói về ngữ nghĩa track trên timeline.

Tránh dùng `track` cho:

- protocol layer
- mục tiêu selection
- nút scene graph

---

## 4. Thuật ngữ chỉ dành cho editor

| Thuật ngữ           | Nghĩa                                                       | Ghi chú                                                                                 |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Derived`           | Được tính toán từ dữ liệu project chuẩn                     | Không được lưu như protocol JSON.                                                       |
| `View model`        | Shape thân thiện với UI, dẫn xuất từ protocol hoặc document | Phải rõ là dẫn xuất.                                                                    |
| `UI state`          | Trạng thái editor chỉ trong phiên                           | Zoom, cuộn, panel hiện tại, phiên kéo thả, v.v.                                         |
| `Timeline viewport` | Vùng hiển thị của UI timeline                               | Chỉ để xem.                                                                             |
| `TimelineClip`      | Layer chiếu lên timeline (start/duration/lane)              | Dẫn xuất; ánh xạ 1 layer (hoặc audio) → một “clip” trên UI.                            |
| `Clip strip`        | Widget hình chữ nhật của một clip trên lane                 | `ClipStrip.tsx`; border trắng khi selected.                                              |
| `Stage viewport`    | Vùng xem trước hiển thị trên canvas                         | Chỉ để xem.                                                                             |
| `Layer tree`        | Cây UI hiển thị phân cấp layer                              | Có thể dẫn xuất từ `project.layers`.                                                    |
| `Breadcrumbs`       | UI đường dẫn drill-down group                               | Chỉ dành cho UI.                                                                        |
| `Inspector`         | Panel chỉnh sửa thuộc tính                                  | Đọc/ghi trường protocol thông qua command.                                              |
| `Palette`           | UI để chèn hoặc chọn asset/phần tử                          | Không phải dữ liệu chuẩn.                                                               |
| `Overlay`           | Lớp UI phủ trên stage/timeline                              | Không phải dữ liệu protocol trừ khi thuật ngữ nói rõ về overlay clip hoặc overlay lane. |

---

## 5. Hướng dẫn ánh xạ

### Từ protocol sang từ vựng editor

| Khái niệm protocol           | Thuật ngữ editor ưu tiên | Tránh                                                |
| ---------------------------- | ------------------------ | ---------------------------------------------------- |
| `project.layers[]`           | `Layer`                  | `node`, `clip`                                       |
| `type: "group"`              | `GroupLayer`             | `group node`                                         |
| `type: "audio"`              | `AudioLayer`             | `audio clip`                                         |
| `type: "component"`          | `ComponentInstance`      | `component node`                                     |
| `project.assets[]`           | `Asset`                  | `media clip`                                         |
| `project.variables[]`        | `Variable`               | `data binding`                                       |
| `project.bindings[]`         | `Binding`                | `link`, `wire`                                       |
| `layer.animations[]`         | `AnimationClip`          | `clip`, `TimelineClip`                               |
| layer trên timeline (derived) | `TimelineClip`           | `clip` trần trong API, `Layer` khi ý là JSON          |
| chrome strip trên lane       | **Clip strip**           | `TimelineClip` khi chỉ nói UI                         |
| lane dẫn xuất của editor     | `TimelineLane`           | `track` nếu code không thực sự nói về timeline track |
| document dẫn xuất của editor | `TimelineDocument`       | `project document`                                   |

### Từ hành động editor sang hiệu ứng protocol

| Tên hành động editor     | Nghĩa                                        | Nên chạm vào                             |
| ------------------------ | -------------------------------------------- | ---------------------------------------- |
| `selectLayer`            | Chọn một layer chuẩn                         | chỉ trạng thái selection                 |
| `selectNode`             | Chọn cây tổng quát, nếu còn giữ              | chỉ trạng thái selection                 |
| `commitNodeTransform`    | Commit cử chỉ transform cho layer đang chọn  | `project.layers[].transform`             |
| `executeTimelineCommand` | Áp dụng command timeline một cách nguyên tử  | `project` + trạng thái timeline dẫn xuất |
| `applyAiProject`         | Chấp nhận output project do AI tạo           | `project` + lịch sử                      |
| `loadProject`            | Nạp project và trạng thái dẫn xuất vào store | chỉ trạng thái store                     |

Nếu một hàm làm thay đổi protocol JSON, tên hàm phải nói rõ điều đó.

---

## 6. Chính sách đặt tên khuyến nghị cho code mới

### Nên dùng các tiền tố sau

- `select...` cho trạng thái chọn
- `load...` cho nạp dữ liệu
- `apply...` cho thay đổi protocol/project đến từ nguồn bên ngoài
- `commit...` cho cử chỉ người dùng trở thành mutation có thể undo
- `resolve...` cho dẫn xuất thuần túy
- `build...` cho xây dựng dữ liệu dẫn xuất
- `compute...` cho toán thuần túy

### Nên dùng các hậu tố sau

- `...Id` cho id chuẩn
- `...Path` cho đường dẫn duyệt/phạm vi
- `...State` cho trạng thái phiên
- `...View` cho shape dẫn xuất chỉ dành cho UI
- `...Document` cho trạng thái aggregate của editor
- `...Command` cho ý định mutation

### Tránh các mẫu sau

- `data` trừ khi ngữ cảnh cực kỳ rõ ràng
- `stuff`
- `temp`
- `misc`
- `thing`
- `node` như thuật ngữ public khi `layer` có sẵn

---

## 7. Danh sách kiểm tra khi review

Khi review code, hãy tự hỏi:

1. Đối tượng này là dữ liệu protocol chuẩn, dữ liệu document dẫn xuất, hay UI state?
2. Tên có khớp với tầng lưu trữ không?
3. Cùng một từ có thể chỉ một khái niệm khác ở nơi khác không?
4. Người mới có biết đây là protocol, editor, hay UI không?
5. Nếu code làm thay đổi dữ liệu, tên hàm có nói rõ là `apply`, `commit`, hay `execute` không?

Nếu câu trả lời cho bất kỳ câu nào là không rõ, hãy đổi tên trước khi thêm hành vi mới.

---

## 8. Mặc định gợi ý cho repo này

- Dùng `Layer` cho tên đối tượng protocol.
- Chỉ dùng `LayerNode` hoặc `SceneNode` trong code duyệt cây.
- Dùng `TimelineClip` cho timeline clip dẫn xuất của editor.
- Dùng `AnimationClip` cho `layer.animations[]` của protocol.
- Dùng `TimelineLane` cho hàng lane dẫn xuất.
- Dùng `Selection` cho trạng thái chọn của editor.
- Chỉ dùng `Document` khi nó chứa trạng thái editor dẫn xuất, không chỉ protocol JSON.
- Dùng **float** / **ghost** / **playhead** / **insert line** / **snap guide** đúng như mục 9 — không gọi float là insert line.

---

## 9. Chrome timeline (float, ghost, playhead)

Tên dùng chung cho chrome timeline (web + desktop). Dùng trong code, test, và review — **không** gọi float là “khối cyan”.

Protocol document vẫn là `MotionProjectV1`. Mọi thứ dưới đây là **editor chrome**, không phải JSON.

### Mảnh chrome

| Thuật ngữ | Nghĩa | Trông như |
| --- | --- | --- |
| **`TimelineClip`** / **clip** (timeline) | Layer (hoặc audio) chiếu lên một hàng — data + hành vi move/trim | Một “clip” trên timeline |
| **Clip strip** | Chrome UI của `TimelineClip` trên lane | Rect bo góc (overlay tím, Main teal, audio) — `ClipStrip.tsx` |
| `TimelineLane` / **row** | Một hàng ngang trên timeline | Band `--timeline-track-lane` |
| **Playhead** | Thời điểm hiện tại của phiên. Không lưu trong V1 | Kim + handle; overlay viewport — **không** cuộn dọc theo lane, luôn cao hết panel |
| **Ruler** | Vạch thời gian phía trên track | `00:00`, `00:03`, … |
| **Float** | Bản sao clip **đang kéo**. Bám pointer, **nằm trên** ghost | Cùng fill + label với strip (`timeline-clip-move-float`) |
| **Ghost** | Placeholder tại **điểm thả** (time + lane hoặc khe insert) | Xám `#38383e` / fill nhạt (`timeline-clip-move-ghost`, `library-drop-ghost`) |
| **Library card** | Bubble vuông khi kéo item library **ngoài** timeline | Card 68px (`library-drag-preview`) |
| **Insert line** | Line ngang 1px khi tạo **lane mới** trong khe | Teal `#14B8A6` (`timeline-insert-indicator`) |
| **Snap guide** | Line dọc 1px khi nam châm dính mép clip | Teal `#14B8A6` (`timeline-clip-snap-guide`) |
| **Marquee** | Hình chữ nhật chọn khi kéo vùng trống | Viền accent |

`Overlay` trong mục 4 là lớp UI phủ stage/timeline. Overlay **clip** trên timeline là `TimelineClip` kind overlay (fill `--timeline-clip-overlay`), không phải insert line.

### Thứ tự chồng (trên → dưới) khi kéo

```text
float          ← đang cầm (chrome clip thật, position: fixed, z-[80])
insert / snap
ghost          ← chỗ sẽ rơi nếu thả (z-20 lane / z-30 insert / z-35 library)
source strip   ← clip gốc, invisible / mờ khi đang kéo
lane
```

Ví dụ: kéo overlay “Hình chữ nhật bo góc” → **float** là rect tím + label đó; **ghost** xám tại time đích; **insert line** chỉ khi pointer nằm trong khe giữa các lane.

Library → timeline: **library card** theo pointer cho tới khi vào timeline; trên timeline card ẩn, **float** (chrome clip) thay thế.

### Không phải float

- Insert line và snap guide là **vạch dẫn**, không phải clip.
- Desktop từng hardcode overlay strip `#0F766E` (teal). Web overlay là `--timeline-clip-overlay` (tím). Float dùng `clipVisualClass`, không dùng màu teal của insert line.

### File liên quan

- Web: `apps/web/components/editor/timeline/viewport/ClipMoveOverlays.tsx`, `LibraryDropGhostOverlay.tsx`, `TimelineClipFloat.tsx`
- Desktop: `apps/desktop/gui/editor/timeline/viewport/TimelineOverlays.tsx`
- Strip: `apps/web/components/editor/timeline/clips/ClipStrip.tsx` (`clipVisualClass`)

---

## 10. Core vs envelope (atomic render core)

| Thuật ngữ | Nghĩa | Lưu disk? |
| --------- | ----- | --------- |
| **Core project** | `MotionProjectV1` nguyên tử — composition, layers, assets, components, metadata (id/name/locale) | Có (JSON core) |
| **Authoring envelope** | Sugar editor: tokens, variables, bindings, layout draft, metadata extras, audit, display names | Sidecar web |
| **expandAuthoringToCore** | Biến session → core trước save/compile | — |
| **sanitizeEditorProject** | Cleanup sau mutation (chuỗi rỗng, unwrap) — **không** strip sugar | — |

Field **audit/debug** (`capabilities`, `dependencies`, `provenance`, `extensions`) chỉ envelope — không core.

`layer.name` / display label → `envelope.layerDisplayNames[layerId]`.

Opacity animate path core: `opacity` (không `appearance.opacity`).

---

## 11. Độ dài project và animation

- **Project length** không phải field JSON. Derive: `max(root.timing.start + root.timing.duration)`. Không root → `0`.
- **Layer property animation** sống trên `layer.animations[]` (local time của layer).
- **Component prop animation** sống trên `payload.props.<propId>` keyframes.
- **UI timeline** (lanes, `TimelineClip`, playhead) là session/projection — không phải `project.timeline`. Authoring JSON không có `timeline`.
- Runtime IR vẫn stamp `timeline.duration` lúc compile; đó không phải authoring.

---

## 12. Quy tắc cuối

Nếu một cái tên có thể mang hai nghĩa, nó chưa sẵn sàng cho code dùng chung.
