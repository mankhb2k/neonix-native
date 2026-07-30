# Editor & Timeline — Audit và kế hoạch remediation

> Cập nhật: 2026-07-29  
> Phạm vi: `apps/web/components/desktop/editor/timeline`, `apps/web/lib/editor`, playback clock, preview, persistence và các consumer trực tiếp của editor store.  
> Trạng thái: kế hoạch kỹ thuật; chưa phải implementation ledger.

## 1. Mục tiêu

Kế hoạch này giải quyết toàn bộ các vấn đề đã xác định trong editor/timeline theo thứ tự an toàn:

1. Không làm mất project hoặc timeline đã lưu.
2. Khóa một domain model rõ ràng cho main, overlay và audio clip.
3. Giữ đúng một playback `currentTime` nhưng không render toàn editor theo clock tick.
4. Loại bỏ render nóng không cần thiết khi scroll, kéo clip và marquee select.
5. Thu nhỏ `editor-store.ts`, loại duplicated state và legacy API không còn consumer.
6. Đưa dependency về đúng chiều: UI phụ thuộc domain/store, không ngược lại.
7. Khôi phục lint, typecheck và bổ sung test cho các invariant quan trọng.

## 2. Đánh giá tổng quan

### Điểm tốt cần giữ

- Playback clock đã được tách khỏi editor store.
- Playback dùng mốc thời gian tuyệt đối, không cộng dồn `dt`.
- Playhead dùng `translate3d()` và coalesce seek bằng `requestAnimationFrame`.
- Timecode subscribe theo frame index thay vì raw floating-point time.
- Time ruler chỉ dựng tick trong viewport.
- Các component sử dụng selector Zustand, không subscribe toàn bộ store.
- Drag cursor và gray ghost đã có một imperative RAF controller dùng chung.

### Điểm cần thay đổi

- Persistence đang có read-side migration phá hủy dữ liệu.
- Timeline clip model chưa biểu diễn đúng loại nội dung.
- Main và overlay đều là visual scene clip nhưng code hiện chia hai logic, làm mất nội dung khi đổi lane và khiến policy va chạm không nhất quán.
- `editor-store.ts` dài 1.641 dòng và chứa cả domain, UI, selection, clipboard, persistence adapter và legacy API.
- Drag/marquee vẫn phát React state update và DOM measurement trên từng pointer event.
- Nhiều control chỉ đổi icon nhưng không thay đổi hành vi thật.
- `lib/editor` đang phụ thuộc `components` và chứa React hook trái với lint boundary hiện có.
- Timeline/editor chưa có test chuyên biệt.

## 3. Quyết định kiến trúc cần khóa trước khi sửa

### 3.1. Store ownership

Chỉ giữ hai runtime store:

| Store | Sở hữu | Không sở hữu |
|---|---|---|
| Playback clock | `currentTime`, `duration`, playback mode, playback rate | Project, selection, zoom, drag metadata |
| Editor store | Editor document, selection gốc, UI preferences, command actions | Playback `currentTime`, DOM rectangles, pointer session nóng |

Không tạo store riêng cho zoom. `timelineZoom` là editor viewport preference và tiếp tục thuộc editor UI state.

Không tạo thêm store cho từng concern nhỏ. Chia source code thành slice/module không đồng nghĩa phải tạo nhiều Zustand instance.

### 3.2. Một playback time

`currentTime` trong playback clock là nguồn duy nhất cho:

```text
currentTime
   ├── Playhead transform: tối đa 60 fps
   ├── Timecode: khi display frame thay đổi
   └── Preview: khi project frame thay đổi
```

Không thêm `liveTime` hoặc `scrubTime` làm nguồn hiển thị thứ hai.

### 3.3. Main và overlay dùng chung visual-clip engine

Main không phải một loại clip khác overlay. Cả hai đều chứa visual scene clip; main chỉ là **base visual lane** có vị trí cố định ở giữa timeline để phân vùng UI:

```text
Overlay visual lanes — compositing phía trên
Overlay visual lanes
──────────────────────────────────────────
Base visual lane — main/background
──────────────────────────────────────────
Audio lanes — playback/mix phía dưới
Audio lanes
```

Hệ quả kiến trúc:

- Main và overlay dùng chung create/move/delete/split/duplicate/copy/paste logic.
- Chuyển base ↔ overlay chỉ đổi `laneId`, `startTime` và lane order; không xóa, clone hoặc dựng lại scene.
- `role: "base" | "overlay"` thuộc lane, không thuộc clip.
- Audio vẫn là clip kind riêng vì có asset, trim, volume và playback semantics khác.
- Preview lấy base scene tại `currentTime`, sau đó compose overlay scene theo lane order.
- Khi base không có active clip, preview hiển thị project background.

Magnetic/ripple không phải clip type hoặc invariant mặc định. Đó là lane/editing policy:

```ts
type VisualLanePolicy = {
  allowOverlap: false;
  rippleMode: boolean;
};
```

Khuyến nghị ban đầu:

- Mỗi visual lane không cho clip overlap trong chính lane đó.
- Base lane có thể có gap; gap hiển thị project background.
- `rippleMode` mặc định `false`; khi sản phẩm bật chế độ magnetic/ripple, command mới dịch các clip phía sau.
- Overlay có thể chuyển sang visual lane khác hoặc tạo lane mới khi vị trí thả bị chiếm.

Nếu canonical project/export hiện chưa biểu diễn được gap trên base lane, Phase 5 phải bổ sung base scheduling cho runtime/compiler hoặc tạm bật ripple compatibility. Không được ép clip model thành “main clip” riêng chỉ để bù thiếu contract export.

### 3.4. Timeline clip là discriminated union

Không dùng `sceneId` giả cho audio hoặc overlay. Model đích:

```ts
type TimelineClip = SceneTimelineClip | AudioTimelineClip;

type SceneTimelineClip = {
  id: string;
  kind: "scene";
  sceneId: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
};

type AudioTimelineClip = {
  id: string;
  kind: "audio";
  audioTrackId: string;
  assetId: string;
  laneId: string;
  startTime: number;
  duration: number;
  name: string;
};

type TimelineLane =
  | {
      id: string;
      kind: "visual";
      role: "base" | "overlay";
      order: number;
      name: string;
      policy: VisualLanePolicy;
    }
  | {
      id: string;
      kind: "audio";
      role: "audio";
      order: number;
      name: string;
    };
```

Overlay scene vẫn là scene thật và phải tồn tại trong editor document; chuyển base ↔ overlay không được tái tạo hoặc xóa nội dung scene. `project.timeline.sceneOrder` được derive từ base lane theo `startTime`; overlay scene không nằm trong base order nhưng vẫn tồn tại trong scene collection/editor document.

## 4. Issue register

| ID | Mức độ | Vấn đề | Tác động chính |
|---|---|---|---|
| DATA-01 | P0 | Load path có thể xóa main timeline của mọi project | Mất dữ liệu |
| DATA-02 | P1 | Một lần mở editor đọc/parse localStorage nhiều lần | Tốn CPU, snapshot có thể lệch |
| DATA-03 | P1 | Persistence fallback coi audio là overlay | Dữ liệu legacy sai |
| MODEL-01 | P1 | Audio/overlay dùng `sceneId` giả | Domain sai, nhiều branch đặc biệt |
| MODEL-02 | P1 | Main/overlay bị tách thành hai visual logic và hard-code magnetic không nhất quán | Mất scene khi đổi lane, gap/overlap khó kiểm soát |
| MODEL-03 | P1 | Audio migration có thể nhét các track overlap vào cùng lane | Lane overlap |
| MODEL-04 | P1 | Clone scene chỉ remap một phần reference graph | Duplicate/split có thể tạo reference lỗi |
| STATE-01 | P1 | `editor-store.ts` là monolith 1.641 dòng | Khó test, khó review, regression cao |
| STATE-02 | P1 | Selection lưu nhiều field dẫn xuất | Dễ lệch state, code lặp |
| STATE-03 | P1 | `overlayScenes` trùng với clips/lanes | Hai nguồn dữ liệu |
| STATE-04 | P2 | Load project không reset toàn bộ transient state | State project trước rò sang project sau |
| PERF-01 | P1 | Scroll làm render lại toàn bộ Tracks | Lag khi nhiều clip |
| PERF-02 | P1 | Clip move set React state và đo mọi lane trên mỗi move | Drag lag |
| PERF-03 | P1 | Marquee query/đo mọi clip trên từng pointer event | Select lag |
| PERF-04 | P2 | Preview filter/sort main clips mỗi frame | CPU thừa khi playback/scrub |
| PERF-05 | P2 | Context menu/EditActions subscribe raw `currentTime` | Render thừa theo clock |
| PLAY-01 | P1 | Clock reset chỉ dựa trên project ID | Reload cùng ID giữ time cũ |
| PLAY-02 | P2 | Duration sync bị lặp trong hai effect | Ownership không rõ |
| PLAY-03 | P2 | `playbackRate` tồn tại nhưng không có API chỉnh | State thừa |
| UX-01 | P1 | Lock/hide/mute và audio preview là control giả | UI sai kỳ vọng |
| UX-02 | P1 | `pointercancel` commit move/marquee | Thay đổi ngoài ý muốn |
| UX-03 | P2 | Clip có `role=button` nhưng thiếu keyboard behavior | Accessibility |
| UX-04 | P2 | Playhead slider thiếu `aria-valuenow`/keyboard seek | Accessibility |
| DND-01 | P1 | MIME/payload khai báo trong sidebar component | Dependency ngược |
| DND-02 | P1 | Drop reset active item trước khi đọc fallback | Audio fallback bị vô hiệu |
| DND-03 | P2 | Global cyan preview dùng scale khác timeline thật | Preview width lệch |
| ARCH-01 | P1 | `lib/editor` import `components` | Vi phạm layer boundary |
| ARCH-02 | P1 | React hook nằm trong pure `lib/editor` | Lint/boundary sai |
| ARCH-03 | P2 | File/hook đặt tên không đúng trách nhiệm | Khó tìm và hiểu code |
| CLEAN-01 | P2 | Legacy API, prop, alias và file không có consumer | Complexity dư thừa |
| SCALE-01 | P2 | Canvas duration đổi đột ngột tại zoom 25 | Scrollbar/playhead có thể nhảy |
| QUALITY-01 | P1 | Targeted lint đang có 22 errors, 38 warnings | Không có quality gate |
| QUALITY-02 | P1 | Typecheck bị chặn bởi Playwright definitions | CI không đáng tin cậy |
| QUALITY-03 | P1 | Không có test timeline/editor/playback | Regression không được khóa |

## 5. Chi tiết vấn đề và đề xuất

### DATA-01 — Read-side migration xóa timeline

**Code hiện tại**

- `apps/web/lib/editor/project-storage.ts:16`
- `apps/web/lib/editor/project-storage.ts:76`
- `apps/web/lib/editor/project-storage.ts:101`

`readAll()` kiểm tra một localStorage flag; nếu flag chưa tồn tại, hàm gọi `emptyAllTimelines()`, ghi ngược dữ liệu đã xóa xuống storage rồi mới trả kết quả.

**Vấn đề**

- Read operation có side effect phá hủy.
- Migration áp dụng cho toàn bộ project cùng lúc.
- Không backup, không rollback, không báo người dùng.
- Flag nằm ngoài stored schema nên khó audit version.

**Đề xuất**

1. Xóa `EMPTY_TIMELINE_FLAG`, `withEmptyTimeline()` và `emptyAllTimelines()` khỏi production load path.
2. Thêm `storageVersion` vào envelope persistence.
3. Tạo `migrateStoredProject(record): StoredProject` pure và idempotent.
4. Migration chỉ chạy khi `record.storageVersion < CURRENT_STORAGE_VERSION`.
5. Trước migration ghi backup hoặc giữ raw record cho đến khi parse/migrate thành công.
6. Viết fixture cho mỗi version cũ.

**Exit gate**

- Gọi `loadProject()` không thay đổi localStorage.
- Migration chạy hai lần cho cùng kết quả.
- Corrupt project không làm ẩn/xóa các project hợp lệ khác.

### DATA-02 — Load project đọc storage nhiều lần

**Code hiện tại**

- `apps/web/components/desktop/editor/DesktopEditorShell.tsx:49`
- `apps/web/lib/editor/project-storage.ts:168`
- `apps/web/lib/editor/project-storage.ts:175`
- `apps/web/lib/editor/project-storage.ts:181`
- `apps/web/lib/editor/project-storage.ts:186`

Shell gọi riêng `loadOverlayScenes`, `loadTimelineClips`, `loadTimelineLanes`; page trước đó cũng đã gọi `loadProject`. Mỗi hàm lại parse toàn bộ storage.

**Đề xuất**

Tạo API snapshot duy nhất:

```ts
type EditorProjectSnapshot = {
  project: MotionProject;
  timelineClips: TimelineClip[];
  timelineLanes: TimelineLane[];
};

loadEditorProjectSnapshot(id): EditorProjectSnapshot | null;
```

Page hoặc shell load đúng một lần rồi truyền snapshot vào editor store.

### DATA-03 — Audio bị serialize thành legacy overlay

**Code hiện tại**

`apps/web/lib/editor/project-storage.ts:114-127` lọc `!isMainLane`, nên audio lane cũng đi vào `OverlaySceneItem`.

**Đề xuất**

- Trong giai đoạn compatibility, chỉ map lane có `kind === "overlay"`.
- Sau migration model, xóa `OverlaySceneItem` khỏi persistence.

### MODEL-01 — TimelineClip không biểu diễn đúng content kind

**Code hiện tại**

- `apps/web/lib/editor/timeline-clips.ts:16`
- `apps/web/lib/editor/editor-store.ts:1091`
- `apps/web/lib/editor/editor-store.ts:914`
- `apps/web/lib/editor/editor-store.ts:923`

**Đề xuất triển khai**

1. Thêm `kind` vào parser ở version mới.
2. Viết migrator:
   - lane main → visual lane `role: "base"` và clip `kind: "scene"`;
   - lane overlay → visual lane `role: "overlay"` và clip `kind: "scene"`;
   - lane audio → `kind: "audio"`.
3. Overlay clip phải trỏ tới scene thật trong editor document.
4. Chuyển base ↔ overlay chỉ đổi lane/start/order; không xóa hoặc dựng lại scene.
5. Update clipboard payload theo discriminated union.
6. Update preview compositor để lấy cả main và overlay scene.

### MODEL-02 — Main/overlay bị tách thành hai visual logic

**Code hiện tại**

- Paste: `apps/web/lib/editor/editor-store.ts:1254-1271`
- Duplicate: `apps/web/lib/editor/editor-store.ts:1377-1393`
- Delete: `apps/web/lib/editor/editor-store.ts:1196-1222`
- Move: `apps/web/lib/editor/timeline-clips.ts:503-519`

**Đề xuất**

Tạo một nhóm pure visual-clip operations dùng cho cả base và overlay:

```ts
function moveVisualClip(
  document: EditorDocument,
  clipId: string,
  target: { laneId: string; startTime: number },
): EditorDocument;

function resolveVisualPlacement(
  lanes: TimelineLane[],
  clips: SceneTimelineClip[],
  target: { laneId: string; startTime: number; duration: number },
): { laneId: string; startTime: number; createLane: boolean };

function applyRippleAfter(
  clips: SceneTimelineClip[],
  fromTime: number,
  delta: number,
): SceneTimelineClip[];
```

Rules:

- Base và overlay gọi chung `moveVisualClip()`.
- Visual lane không cho overlap trong cùng lane.
- Base lane là lane duy nhất có `role: "base"` và không bị xóa/prune.
- Overlay target bị chiếm có thể resolve sang lane trống hoặc tạo overlay lane mới.
- `applyRippleAfter()` chỉ chạy khi lane/editing policy bật `rippleMode`; không chạy mặc định.
- Base gap là hợp lệ và được preview bằng project background.
- `project.timeline.sceneOrder` derive từ base clips đã sort; base timing/gap phải có representation tương ứng trong runtime/export contract.

### MODEL-03 — Audio migration không resolve overlap

**Code hiện tại**

`apps/web/lib/editor/timeline-clips.ts:465-488` tạo một audio lane rồi đưa mọi missing audio track vào lane đó.

**Đề xuất**

- Migrate từng audio track theo start time.
- Với mỗi track, gọi generic `findFreeLane("audio", ...)`.
- Tạo lane mới nếu range overlap.
- Viết test ba track: không overlap, overlap một phần và overlap toàn phần.

### MODEL-04 — Clone scene chưa remap đầy đủ reference

**Code hiện tại**

`apps/web/lib/editor/editor-store.ts:397-423` dùng JSON clone và chỉ remap node ID, parentId, clip ID và targetId.

**Rủi ro**

Các reference khác như constraint target, path/bone reference, binding hoặc extension có thể vẫn trỏ sang ID cũ.

**Đề xuất**

- Chuyển clone sang schema/domain package nơi biết đầy đủ reference graph.
- Dùng một `IdRemapContext` duy nhất.
- Validate project sau clone bằng canonical parser/reference validator.
- Dùng `structuredClone()` cho data copy, nhưng không coi đó là giải pháp remap reference.

### STATE-01 — Editor store monolith

**Code hiện tại**

`apps/web/lib/editor/editor-store.ts` chứa 1.641 dòng.

**Cấu trúc đích**

```text
apps/web/lib/editor/
  model/
    editor-document.ts
    timeline-types.ts
    timeline-invariants.ts
  operations/
    clip-create.ts
    clip-move.ts
    clip-delete.ts
    clip-split.ts
    clip-clipboard.ts
    lane-operations.ts
  persistence/
    project-storage.ts
    project-migrations.ts

apps/web/lib/store/
  editor-store.ts
  editor-selectors.ts
  playback-clock-store.ts

apps/web/hooks/editor/
  use-playback-driver.ts
```

Operations phải là pure functions nhận document và trả document mới. Store action chỉ gọi operation rồi `set()`.

### STATE-02 — Duplicated selection state

**Code hiện tại**

`apps/web/lib/editor/editor-store.ts:60-66` giữ đồng thời clip, scene, overlay và node selection.

**Đề xuất**

Dùng selection union:

```ts
type EditorSelection =
  | { kind: "none" }
  | { kind: "clips"; ids: string[]; primaryId: string }
  | { kind: "node"; sceneId: string; nodeId: string };
```

Selectors derive `selectedClipId`, `selectedSceneId`, `selectedOverlayId`. Không lưu các field dẫn xuất trong state.

### STATE-03 — overlayScenes duplicated state

**Code hiện tại**

`overlayScenesFromClips()` được gọi sau gần như mọi timeline mutation trong `editor-store.ts`; persistence lại có `overlaysFromClips()` khác.

**Đề xuất**

- Giai đoạn migration: derive sidecar chỉ trong persistence adapter.
- Store không giữ `overlayScenes`.
- Sau khi storage version mới ổn định, xóa `overlay-scenes.ts`.

### STATE-04 — Project load chưa reset transient state đầy đủ

**Code hiện tại**

`apps/web/lib/editor/editor-store.ts:481-513` reset selection và zoom nhưng không reset rõ ràng clipboard, drag session, `isOverTimeline` hoặc export state.

**Đề xuất**

Tạo `resetEditorSessionForProject()` với policy rõ:

- Luôn reset drag state và export state.
- Clipboard: quyết định có cho copy xuyên project hay không. Nếu có, payload phải self-contained, gồm audio asset metadata.
- Sidebar tab có thể giữ như preference.
- Zoom reset về 28 theo yêu cầu sản phẩm.
- Playback clock gọi `reset({ duration, time: 0 })` tại cùng orchestration boundary.

### PERF-01 — Scroll render lại toàn bộ Tracks

**Code hiện tại**

- `apps/web/components/desktop/editor/timeline/TimelineBoard.tsx:37`
- `apps/web/components/desktop/editor/timeline/TimelineBoard.tsx:124`
- `apps/web/components/desktop/editor/timeline/Tracks/Tracks.tsx:36`

**Fix ngắn hạn**

1. Xóa props `zoom` và `contentEnd` không dùng khỏi `Tracks`.
2. Export `Tracks = memo(function Tracks...)`.
3. Giữ refs và callback setter ổn định.
4. Profile để xác nhận scroll chỉ render ruler/playhead, không render clip tree.

**Fix dài hạn**

Nếu clip count lớn, virtualize clip DOM theo horizontal viewport. Chưa làm trước khi profiler chứng minh cần thiết.

### PERF-02 — Clip drag cập nhật React theo pointermove

**Code hiện tại**

- `apps/web/components/desktop/editor/timeline/Tracks/useOverlayClipMove.ts:151-188`
- `apps/web/components/desktop/editor/timeline/Tracks/useOverlayClipMove.ts:193-235`

**Đề xuất**

1. Đổi tên hook thành `useTimelineClipMove`.
2. Pointer handler chỉ ghi `{clientX, clientY}` mới nhất vào ref.
3. Một RAF thực hiện:
   - ghost transform/layout;
   - lane hit-test;
   - state transition nếu lane/insert mode thực sự thay đổi.
4. Không gọi `setDragGhostState()` theo từng move; chỉ set metadata khi session bắt đầu.
5. Cache lane rectangles lúc drag bắt đầu.
6. Recompute cache khi scroll, resize hoặc lane structure thay đổi.
7. Dùng một `DragSession` object thay cho 6-7 `useState` song song với `moveUiRef`.

### PERF-03 — Marquee đo mọi clip trên từng event

**Code hiện tại**

`apps/web/components/desktop/editor/timeline/Tracks/useMarqueeSelect.ts:89-188`.

**Đề xuất**

- Cache `{id, rect}` khi vượt threshold bắt đầu marquee.
- RAF-coalesce pointermove.
- Cập nhật marquee DOM imperatively hoặc trong một leaf component riêng.
- So sánh ID set trước khi ghi store.
- Không query/measure lại ở `pointerup`; dùng kết quả RAF cuối đã flush.

### PERF-04 — Preview lookup lặp mỗi frame

**Code hiện tại**

- `apps/web/components/desktop/editor/stage/PreviewStage.tsx:29-51`
- `apps/web/components/desktop/editor/stage/PreviewStage.tsx:153-161`

**Đề xuất**

1. Memo sorted main clips theo `timelineClips/mainLaneId`.
2. Memo `scenesById`.
3. Dùng binary search hoặc cursor index để tìm clip theo global time.
4. Chuyển clock subscription vào `PreviewRuntimeCanvas`; shell preview không subscribe frame tick.
5. Sửa `nodeLabel()` dùng scene đang render, không dùng `project.scenes[0]`.
6. Sau khi overlay model hoàn chỉnh, preview compose background + base + overlay theo z-order.

### PERF-05 — Raw currentTime subscriber ngoài time display

**Code hiện tại**

- `apps/web/components/desktop/editor/timeline/TransportBar/EditActions.tsx:24`
- `apps/web/components/desktop/editor/timeline/Tracks/TimelineClipContextMenu.tsx:51`

**Đề xuất**

- Dùng shared `usePlaybackFrame(fps)` selector.
- Hoặc chỉ validate split tại thời điểm click/select; disabled state cập nhật theo display frame.
- Centralize `canSplitSelectedClips(document, selection, time)` để toolbar, context menu và hotkey dùng chung.

### PLAY-01/02/03 — Clock lifecycle và API

**Code hiện tại**

- `apps/web/components/desktop/editor/timeline/Timeline.tsx:21-33`
- `apps/web/lib/editor/playback/playback-clock-store.ts:5-17`

**Đề xuất**

1. Thêm atomic action:

```ts
reset({ duration, currentTime = 0 }): void;
```

2. Project load orchestration gọi `reset()` kể cả project mới có cùng metadata ID.
3. Clips change bình thường chỉ gọi `setDuration()`.
4. Xóa effect tính duration lần hai.
5. Hoặc thêm `setPlaybackRate()`, hoặc xóa `playbackRate` cho đến khi UI cần.
6. Export vanilla `playbackClockStore` và React adapter `usePlaybackClock` riêng để API imperative rõ nghĩa.

### UX-01 — Control giả

**Code hiện tại**

- Video/audio controls: `apps/web/components/desktop/editor/timeline/Tracks/Tracks.tsx:56-59`
- Sidebar audio preview: `apps/web/components/desktop/editor/sidebar/AudioPanel/AudioPanel.tsx:46-50`
- Undo/redo placeholder: `apps/web/components/desktop/editor/timeline/TransportBar/EditActions.tsx:34-52`

**Đề xuất**

Phase correctness đầu tiên: ẩn control không hoạt động.

Phase feature sau:

- Lane state có `locked`, `muted`, `visible` nếu schema/editor sidecar thực sự hỗ trợ.
- Lock phải chặn move/delete/split theo policy.
- Visible phải ảnh hưởng preview compositor.
- Mute phải ảnh hưởng playback/export hoặc ghi rõ chỉ preview mute.
- Audio preview phải tạo/stop một `HTMLAudioElement` thật.
- Undo/redo chỉ hiện khi command history tồn tại.

### UX-02 — pointercancel commit

**Code hiện tại**

- `apps/web/components/desktop/editor/timeline/Tracks/useOverlayClipMove.ts:322-329`
- `apps/web/components/desktop/editor/timeline/Tracks/useMarqueeSelect.ts:197-204`

**Đề xuất**

Tách handler:

```ts
pointerup     -> flush + commit
pointercancel -> reset + rollback
Escape        -> reset + rollback
```

Thêm pointer capture hoặc session-level window listeners có cleanup idempotent.

### UX-03/04 — Keyboard và ARIA

**Code hiện tại**

- Clip DOM có `role="button"`, `tabIndex=0` nhưng không `onKeyDown`: `Tracks.tsx:258`, `Tracks.tsx:371`, `Tracks.tsx:477`.
- Playhead slider thiếu `aria-valuenow`: `Playhead.tsx:198-202`.

**Đề xuất**

- Enter/Space chọn clip.
- Arrow trái/phải seek một frame; Shift+Arrow seek khoảng lớn hơn.
- Home/End về đầu/cuối.
- Thêm `aria-valuenow`, `aria-valuetext` timecode.
- Nếu chưa hỗ trợ keyboard clip, dùng `<button>` thật thay vì role giả.

### DND-01 — DnD contract nằm trong component

**Code hiện tại**

`useTracksDrag.ts` import `AUDIO_LIBRARY_MIME` từ `AudioPanel.tsx`.

**Đề xuất**

Tạo:

```text
apps/web/lib/editor/dnd/editor-drag-payload.ts
```

Module chứa:

- MIME constants.
- `EditorDragItem` union.
- Serializer/parser/validator.
- Duration normalization.

Sidebar và timeline cùng phụ thuộc module này.

### DND-02 — Audio fallback đọc sau khi state đã reset

**Code hiện tại**

Trong `useTracksDrag.ts:356-373`, `setActiveDragItem(null)` chạy trước nhánh fallback đọc lại active item ở `useTracksDrag.ts:394`.

**Đề xuất**

- Snapshot `activeDragItem` và payload đầu hàm `handleDrop()`.
- Validate payload trước khi reset UI.
- Commit domain action.
- Reset drag session trong `finally`.

### DND-03 — Global drag preview scale không khớp timeline

**Code hiện tại**

`GlobalDragPreview.tsx:46` gọi `zoomToPixelsPerSecond(timelineZoom)` bằng default min/max, trong khi `TimelineBoard` dùng floor/ceiling phụ thuộc viewport và FPS.

**Đề xuất**

- Drag session nhận `pixelsPerSecond` thực từ timeline hit area.
- Hoặc global preview chỉ hiển thị card; gray ghost trong timeline là nguồn kích thước duy nhất.
- Không tính lại timeline scale ở component global bằng thiếu viewport context.

### ARCH-01/02 — Layer boundary sai

**Code hiện tại**

- `editor-store.ts` import zoom constants từ `components/.../timeline-scale`.
- `lib/editor/playback/use-playback-driver.ts` import React.

**Đề xuất**

- Chuyển zoom defaults sang `lib/editor/editor-preferences.ts` hoặc `lib/store/editor-store-config.ts`.
- `timeline-scale.ts` có thể tiếp tục ở component layer nếu chỉ là view math.
- Chuyển `use-playback-driver.ts` sang `hooks/editor`.
- Chuyển Zustand store sang `lib/store` để khớp lint boundary hiện có.
- Không nới lint rule chỉ để hợp thức hóa dependency sai.

### ARCH-03 — Naming không còn đúng

Đổi tên khi behavior đã có test:

| Cũ | Mới |
|---|---|
| `useOverlayClipMove` | `useTimelineClipMove` |
| `overlay-drag-target.ts` | `lane-drop-target.ts` |
| `collectVideoLanes` | `collectSceneLanes` |
| `DragGhostState` | `DragPreviewModel` |
| `activeDragItem` | `dragSession` hoặc `draggedLibraryItem` |
| `TrackVariant="secondary"` | `size="compact"` hoặc dùng lane kind |
| `reorderLane` | `reorderOverlayLane` nếu chỉ hỗ trợ overlay |

### CLEAN-01 — Dead/legacy complexity

Sau khi migration tests pass, xóa:

- `audio-drag-target.ts` deprecated re-export.
- `findFreeOverlayLayer()`.
- `movingOverlayId` và `targetOverlayLayer`.
- `frameLayers?: any[]`.
- `dataLayerIndex`.
- `insertNewLayer` và `layerIndex` khỏi runtime action types.
- Store actions không có consumer: `addSceneFromFrame`, `addOverlaySceneFromFrame`, `moveOverlayScene`, `reorderMainScene`, `promoteMainSceneToOverlay`, `selectScene`, `selectOverlay`.

Không xóa legacy persistence field trước khi migrator version mới đã có fixture.

### SCALE-01 — Zoom threshold discontinuity

**Code hiện tại**

`timeline-scale.ts:148-152` đổi canvas policy tức thời tại zoom 25.

**Đề xuất**

- Thay hard branch bằng pixel-budget function liên tục.
- Giữ `canvasWidth` trong giới hạn min/max và interpolate theo zoom.
- Test zoom 24 → 25 → 26 không làm scrollLeft hoặc playhead nhảy bất thường.
- Giữ load zoom 28 bằng `TIMELINE_ZOOM_ON_PROJECT_LOAD` trong editor preference module.

### QUALITY-01/02/03 — Tooling và test

**Hiện trạng kiểm tra**

Targeted ESLint trên `components/desktop/editor/timeline` và `lib/editor` báo 22 errors, 38 warnings. Các nhóm chính:

- Dependency `lib → components`.
- React import trong pure lib.
- `any` và prop không dùng.
- Effect dependency/cleanup ref.
- `consistent-return`.
- Slider ARIA thiếu field.

Global lint hiện bị dừng khi lint `postcss.config.mjs` do typed rule không có parser services. Typecheck bị dừng bởi named exports của `@playwright/test` trong `e2e/smoke.spec.ts` và `playwright.config.ts`.

**Đề xuất**

1. Sửa ESLint config cho `.mjs` trước để global lint chạy được.
2. Sửa Playwright dependency/type resolution.
3. Thêm Vitest cho pure editor operations và clock store.
4. Giữ Playwright cho interaction/browser behavior.
5. Thêm performance profiling checklist không flaky vào manual release gate.

## 6. Kế hoạch triển khai theo phase

### Phase 0 — Safety net và baseline

**Mục tiêu:** có khả năng chứng minh mỗi refactor không làm mất dữ liệu hoặc đổi behavior ngoài ý muốn.

Tasks:

1. Thêm test runner unit cho web editor.
2. Tạo fixtures:
   - project chỉ main;
   - base visual + overlay visual;
   - main + audio overlap;
   - legacy `track/layerIndex`;
   - project nhiều scene/node reference.
3. Snapshot localStorage trước/after `loadEditorProjectSnapshot()`.
4. Thêm Playwright flow:
   - load project;
   - zoom 28;
   - scrub live;
   - move clip;
   - cancel move;
   - reload và verify persistence.
5. Profile baseline với số lượng 20, 100 và 500 clip.

Exit gate:

- Test tái hiện DATA-01, UX-02 và scroll/drag render count hiện tại.
- Có baseline React Profiler/Performance trace.

### Phase 1 — Fix data safety và project loading

Tasks:

1. Xóa destructive read migration.
2. Tạo versioned persistence envelope và pure migrator.
3. Tạo `loadEditorProjectSnapshot()` đọc một lần.
4. Sửa audio-as-overlay fallback.
5. Reset editor/playback session atomically khi load snapshot.
6. Giữ zoom load-project = 28.

Files chính:

- `lib/editor/project-storage.ts` → `lib/editor/persistence/*`.
- `DesktopEditorShell.tsx`.
- `editor-store.ts` load action.
- Playback clock store.

Exit gate:

- Load không mutate storage.
- Mọi fixture legacy migrate đúng.
- Reload cùng project ID reset time về 0 và zoom về 28.

### Phase 2 — Fix behavior giả và input correctness

Tasks:

1. Ẩn lock/hide/mute/audio-play/undo-redo chưa hoạt động.
2. Tách pointerup/pointercancel.
3. Thêm Escape cancel.
4. Thêm keyboard/ARIA cho playhead và clip.
5. Sửa DnD fallback ordering.
6. Chuyển MIME/payload ra khỏi component.

Exit gate:

- Cancel không commit.
- Không còn control visible nhưng không có effect thật.
- Axe/accessibility smoke không báo slider/button issue cơ bản.

### Phase 3 — Quick performance remediation

Tasks:

1. Memoize Tracks và loại props không dùng.
2. RAF-coalesce internal clip move.
3. Cache lane rectangles trong drag session.
4. RAF-coalesce marquee và cache clip rectangles.
5. Chuyển raw clock subscriber sang frame selector.
6. Memo preview indexes và chuyển clock subscription xuống runtime canvas.
7. Sửa node label theo active scene.

Exit gate:

- Scroll không render clip tree.
- Drag/marquee có tối đa một hot-path flush mỗi animation frame.
- Lane target React state chỉ đổi khi semantic target đổi.
- Preview không sort clips mỗi frame.

### Phase 4 — Tách store theo module, giữ nguyên data model

Mục tiêu phase này là mechanical refactor trước domain migration lớn.

Tasks:

1. Di chuyển pure helpers khỏi `editor-store.ts`.
2. Tách create/move/delete/split/clipboard/lane operations.
3. Store action gọi pure operation.
4. Tạo selectors cho derived data.
5. Thay duplicated selection fields bằng selection union.
6. Di chuyển store/hook đúng layer lint.

Exit gate:

- `editor-store.ts` chỉ còn state assembly/actions mỏng.
- Pure operations có unit test.
- UI behavior và saved format chưa thay đổi.

### Phase 5 — Domain model migration

Tasks:

1. Thêm `TimelineClip.kind` discriminated union.
2. Đổi lane model thành visual `role: "base" | "overlay"` và audio `role: "audio"`.
3. Tạo storage migration version mới.
4. Giữ overlay scene content thật.
5. Thay main/overlay branches bằng visual-clip operations dùng chung.
6. Chuyển base ↔ overlay chỉ bằng lane placement mutation.
7. Thêm visual lane collision policy và optional ripple mode.
8. Cho phép base gap hiển thị project background; bổ sung runtime/export scheduling nếu contract hiện tại chưa hỗ trợ.
9. Audio dùng `audioTrackId/assetId`, không dùng `sceneId` giả.
10. Centralize ID generation và reference remapping.
11. Fix audio lane migration overlap.
12. Update clipboard để payload self-contained theo policy cross-project.

Exit gate:

- Không còn `sceneId` giả.
- Base và overlay dùng chung visual-clip command engine.
- Chuyển base ↔ overlay giữ nguyên scene/node/animation/reference.
- Base/overlay không overlap trong cùng lane; gap và ripple tuân theo policy đã khóa.
- Base gap preview/export cùng biểu diễn project background.
- Mọi migrated fixture parse/validate được.

### Phase 6 — Preview và lane feature thật

Tasks:

1. Preview compose project background + base scene + overlay scenes theo lane order.
2. Implement lane `visible`, `locked`, `muted` trong editor sidecar/schema phù hợp.
3. Lock enforcement trong move/delete/split.
4. Visibility/mute enforcement trong preview/playback/export theo policy.
5. Implement audio preview thật trong sidebar.
6. Chỉ sau đó hiển thị lại các control.

Exit gate:

- Mỗi control có test behavior.
- Preview và export không lệch visibility/mute semantics.

### Phase 7 — Remove legacy và chuẩn hóa naming

Tasks:

1. Xóa legacy runtime fields/actions/files đã liệt kê ở CLEAN-01.
2. Rename hooks/files/types theo ARCH-03.
3. Gộp overlay/audio free-lane algorithm thành generic function.
4. Gộp prune lane thành một pass.
5. Đơn giản hóa `TrackLane` props.
6. Xóa `overlayScenes` khỏi store/persistence version mới.

Exit gate:

- `rg` không còn runtime use của `layerIndex`, `insertNewLayer`, deprecated aliases.
- Không còn file deprecated re-export.
- Folder tree phản ánh đúng responsibility.

### Phase 8 — Zoom continuity, resize và hardening

Tasks:

1. Thay zoom threshold 25 bằng continuous pixel-budget function.
2. Đồng bộ drag preview width với actual timeline scale.
3. Trích xuất reusable panel resize hook/controller.
4. RAF-coalesce panel resize hoặc dùng CSS variable imperative nếu profiler cần.
5. Thêm error handling cho localStorage quota/write failure.

Exit gate:

- Zoom qua 24/25/26 không nhảy canvas/scroll.
- Global preview và gray ghost cùng width.
- Resize không render lại các subtree nặng quá mức cần thiết.

### Phase 9 — Quality gate cuối

Commands bắt buộc:

```powershell
pnpm.cmd --filter @motionvideo/web typecheck
pnpm.cmd --filter @motionvideo/web lint:ci
pnpm.cmd --filter @motionvideo/web test
pnpm.cmd --filter @motionvideo/web e2e
```

Nếu script `test` chưa tồn tại, thêm trong Phase 0.

Release gate:

- 0 lint error/warning trong `lint:ci`.
- Typecheck pass.
- Unit/integration/e2e pass.
- Persistence migration fixtures pass.
- Không có P0/P1 issue còn mở.
- Performance baseline không regression.

## 7. Test matrix chi tiết

### Persistence

- Load không ghi storage.
- Save → load roundtrip giữ project/clips/lanes.
- Corrupt một record không che record khác.
- Legacy overlay/audio migrate đúng kind/lane.
- Reload cùng ID reset transient session nhưng giữ document.
- Quota error được báo/handle, không giả trạng thái đã lưu.

### Timeline domain

- Base và overlay add/paste/duplicate/delete/move/split dùng cùng visual command behavior.
- Chuyển base ↔ overlay giữ scene/node/animation/reference.
- Visual clip không overlap trong cùng lane.
- Base gap hiển thị project background.
- Ripple off giữ nguyên absolute time; ripple on dịch đúng các clip phía sau.
- Audio overlap tạo lane phù hợp.
- Prune lane không đổi order ngoài kind liên quan.
- Split ở sát boundary bị từ chối nhất quán.
- Clone scene remap toàn bộ reference và validate.

### Playback

- Play cuối timeline restart từ 0.
- Scrub dừng playback clock driver.
- Current time clamp khi duration giảm.
- Load project reset time dù ID giống nhau.
- Playhead, timecode và preview cùng frame.

### Interaction

- Pointerup commit move.
- Pointercancel/Escape rollback.
- Marquee chỉ update selection khi ID set đổi.
- Scroll không render Tracks.
- Zoom không làm sai pointer-X-to-time.
- Keyboard playhead seek và clip select hoạt động.

### Preview

- Scene thứ hai dùng đúng text label.
- Scrub qua scene boundary đổi scene đúng frame.
- Overlay z-order đúng lane order.
- Hidden lane không render.
- Muted lane không phát audio theo policy.

## 8. Performance budgets

Các con số sau là target kỹ thuật, không nên biến thành CI assertion dễ flaky nếu chưa có môi trường benchmark ổn định:

- Playhead transform: gần 60 fps trên máy baseline.
- Pointermove: tối đa một RAF flush/frame.
- Preview evaluation: tối đa một lần/video frame mới.
- Scroll: không render lại clip/lane tree nếu clips/lanes/scale không đổi.
- Marquee: DOM rectangles đo một lần/session, trừ khi scroll/resize invalidate cache.
- Không có long task mới trên 50 ms trong fixture 100 clip.
- Fixture 500 clip vẫn scroll/scrub usable; chỉ virtualize khi profiler chứng minh cần.

## 9. Thứ tự commit/PR đề xuất

1. `test(editor): add persistence and timeline regression fixtures`
2. `fix(storage): remove destructive read migration`
3. `refactor(storage): load one editor snapshot`
4. `fix(timeline): cancel pointer sessions without commit`
5. `fix(editor): remove misleading inactive controls`
6. `perf(timeline): isolate tracks from horizontal scroll renders`
7. `perf(timeline): raf-coalesce clip move and marquee`
8. `perf(preview): memoize timeline lookup and isolate frame subscriber`
9. `refactor(editor): extract pure timeline operations from store`
10. `refactor(editor): normalize selection state`
11. `feat(timeline): migrate to discriminated clip model`
12. `refactor(timeline): unify base and overlay visual clip operations`
13. `feat(timeline): add visual lane collision and optional ripple policy`
14. `feat(preview): compose base background and overlay lanes`
15. `feat(timeline): implement real lane controls`
16. `refactor(editor): remove legacy overlay sidecar and aliases`
17. `fix(tooling): restore lint typecheck and editor quality gates`

Không trộn styling redesign với domain migration hoặc performance refactor trong cùng PR.

## 10. Definition of Done tổng thể

Remediation hoàn tất khi:

- Project load không có destructive side effect.
- Persistence có versioned, tested migration.
- Một snapshot load thay cho nhiều lần parse storage.
- Timeline clip model không còn ID giả.
- Main/base và overlay dùng chung visual-clip engine; khác biệt nằm ở lane role/policy.
- Chuyển base ↔ overlay giữ nguyên scene content và chỉ thay placement.
- Visual lane collision, base gap và optional ripple behavior được bảo vệ bởi pure operation và test.
- Editor store không còn monolith chứa toàn bộ domain implementation.
- Selection và overlay sidecar không còn duplicated state.
- Playback clock vẫn là nguồn `currentTime` duy nhất.
- Scroll, clip move và marquee không render nóng toàn timeline.
- Preview không filter/sort clips mỗi frame và dùng đúng active scene.
- Không còn control giả hoặc deprecated runtime API.
- `lib` không import `components`; React hook nằm đúng layer.
- Lint, typecheck, unit tests và e2e đều pass.
- Performance profiling đạt budgets đã thống nhất.

## 11. Các việc không nên làm

- Không rewrite toàn editor trong một PR.
- Không tạo thêm nhiều Zustand store để che monolith; tách pure module trước.
- Không nới lint restriction để hợp thức hóa dependency ngược.
- Không tối ưu bằng `useMemo` tràn lan trước khi loại state update/DOM measurement trong hot path.
- Không xóa legacy persistence field trước khi migration fixtures pass.
- Không bật lại lock/hide/mute trước khi behavior thật và test tồn tại.
- Không virtualize timeline trước khi quick wins và profiler chứng minh cần thiết.
