# Đánh giá kiến trúc và kế hoạch thực thi Timeline

> Phạm vi tài liệu: chỉ tập trung vào timeline của desktop editor và các thư viện trực tiếp phục vụ timeline. Inspector không thuộc phạm vi triển khai của kế hoạch này.

## 1. Kết luận điều hành

Timeline hiện tại đã có nền tảng tốt ở các điểm: model dùng discriminated union, placement/collision có nhiều pure function, playback clock tách khỏi document store, các hot path drag/playhead đã dùng `requestAnimationFrame`, ruler có viewport culling, và unit test đang bao phủ khá tốt các phép toán cốt lõi.

Điểm yếu chính không nằm ở việc “thiếu memo”, mà nằm ở ranh giới kiến trúc và nguồn sự thật:

- Store/domain đang import ngược pure math từ thư mục component.
- `project`, `timelineClips`, `timelineLanes` phải được đồng bộ thủ công qua nhiều action lớn.
- Mutation chưa đi qua một command boundary chung, nên việc thêm undo/redo, trim, transition, group hoặc collaboration sẽ phải sửa nhiều nơi.
- Interaction logic đang trộn React lifecycle, DOM hit-test, gesture session và domain intent.
- Toàn bộ clip DOM vẫn được mount; thiết kế sẽ giảm hiệu năng rõ khi timeline lớn.
- Export đang bake theo interval nhưng chưa giữ local-time offset của animation khi scene bị chia bởi boundary.
- Persistence ghi đồng bộ toàn bộ collection project, chưa phù hợp với document timeline lớn.

Đánh giá hiện tại:

| Khía cạnh | Mức | Nhận định |
|---|---:|---|
| Tính đúng đắn của core placement/playback | Khá | Pure functions và test tốt |
| Tổ chức file | Trung bình | Có phân lớp nhưng còn dependency đảo chiều và file quá lớn |
| Seam cho tính năng tương lai | Trung bình thấp | Model có thể mở rộng, nhưng command/store/UI chưa có boundary ổn định |
| Hook/render safety | Khá | Không thấy render loop hiện hữu; còn thiếu lifecycle cleanup |
| Hiệu năng project nhỏ | Khá | RAF và memo đúng ở nhiều hot path |
| Hiệu năng project lớn | Yếu | Chưa virtualize clip/lane; chưa có performance gate tự động |
| Khả năng thêm undo/redo | Yếu | Mutation phân tán, chưa có transaction/inverse command |

Mục tiêu của kế hoạch không phải viết lại timeline. Mục tiêu là tạo các seam ổn định quanh code đang chạy, rồi di chuyển từng hành vi qua seam đó với test khóa behavior.

## 2. Mục tiêu và ngoài phạm vi

### 2.1. Mục tiêu

1. Có một timeline domain độc lập với React, DOM và Zustand.
2. Mọi mutation timeline đi qua command/application boundary duy nhất.
3. Có invariant validator để phát hiện document hỏng ngay tại boundary.
4. Store có thể khởi tạo theo từng editor instance và dễ test độc lập.
5. Interaction hook chỉ chuyển pointer/keyboard gesture thành domain intent; không tự chứa business rule.
6. Rendering đủ khả năng phục vụ ít nhất 2.000 clips mà không mount toàn bộ clip ngoài viewport.
7. Persistence/export/playback chỉ giao tiếp với timeline qua adapter và stable selector.
8. Việc thêm clip kind, lane policy, snapping mode hoặc edit operation mới không buộc sửa toàn bộ UI/store.
9. Chuẩn bị sẵn seam cho undo/redo nhưng không bắt buộc hoàn thiện toàn bộ UI history ngay ở phase đầu.

### 2.2. Ngoài phạm vi

- Hoàn thiện Inspector hoặc property panel.
- Thiết kế lại visual style của timeline.
- Thêm ngay transition, trim handle, keyframe editor, caption editor hoặc collaboration.
- Thay đổi schema public của `@motionvideo/motion-schema` nếu chưa có ADR riêng.
- Big-bang rewrite toàn bộ store hoặc UI.

## 3. Hiện trạng và bằng chứng

### 3.1. Điểm đang làm tốt

- Timeline clip/lane là discriminated union tại [`model/timeline-types.ts`](apps/web/lib/editor/model/timeline-types.ts).
- Placement được tách thành pure operation tại [`operations/clip-move.ts`](apps/web/lib/editor/operations/clip-move.ts).
- Preview build lane index một lần theo document change và binary search theo frame tại [`preview/compose-layers.ts`](apps/web/lib/editor/preview/compose-layers.ts).
- Playback clock là store riêng tại [`playback/playback-clock-store.ts`](apps/web/lib/editor/playback/playback-clock-store.ts).
- Playhead cập nhật transform bằng imperative DOM thay vì React state mỗi tick tại [`Tracks/Playhead.tsx`](apps/web/components/desktop/editor/timeline/Tracks/Playhead.tsx).
- Time ruler chỉ tạo tick trong visible range tại [`TimeRuler/TimeRuler.tsx`](apps/web/components/desktop/editor/timeline/TimeRuler/TimeRuler.tsx).
- Clip move và marquee đã coalesce pointer event qua RAF.
- Selector selection giữ empty array ổn định, tránh selector trả snapshot mới liên tục.
- Bộ unit test hiện tại chạy qua 102/102 test.

Các điểm này phải được giữ nguyên behavior trong quá trình refactor.

### 3.2. Dependency đảo chiều

Hai store action đang import `timeline-fit` từ `components`:

- [`store/actions/ui-actions.ts`](apps/web/lib/editor/store/actions/ui-actions.ts)
- [`store/actions/project-lifecycle-actions.ts`](apps/web/lib/editor/store/actions/project-lifecycle-actions.ts)

Điều này làm domain/application phụ thuộc UI và đã vi phạm chính ESLint boundary của repo. `timeline-fit` là pure math, phải nằm dưới `lib/editor/timeline`.

### 3.3. Nguồn sự thật bị nhân đôi

`EditorStoreState` đồng thời chứa:

- `project`
- `timelineClips`
- `timelineLanes`

Action phải sửa nhiều cấu trúc và gọi `rebuildMainProject`. Đây là nguyên nhân chính khiến:

- `clip-actions.ts` dài hơn 700 dòng.
- `clipboard-actions.ts` dài hơn 400 dòng.
- Thêm một operation mới dễ bỏ sót scene/audio track/lane/selection.
- Undo/redo khó triển khai vì không có một transaction result duy nhất.

### 3.4. Domain terminology chưa thống nhất

Cùng một khái niệm đang có nhiều tên:

- UI dùng `main`, `overlay`, `audio`.
- Domain lane dùng `base`, `overlay`, `audio`.
- Drag preview dùng `video`, `audio`.
- Một số type còn giữ compatibility alias `main | overlay | audio`.

Compatibility có thể cần cho persistence, nhưng không nên lan vào command API mới. API mới chỉ dùng vocabulary canonical:

- Track family: `visual | audio`.
- Visual role: `base | overlay`.
- Persisted legacy term chỉ tồn tại trong migration adapter.

### 3.5. Interaction logic đang trộn nhiều trách nhiệm

[`useTimelineClipMove.ts`](apps/web/components/desktop/editor/timeline/Tracks/useTimelineClipMove.ts) và [`useTracksDrag.ts`](apps/web/components/desktop/editor/timeline/Tracks/useTracksDrag.ts) đang cùng xử lý:

- Gesture lifecycle.
- RAF scheduling.
- DOM measurement và lane cache.
- Drop policy.
- Ghost rendering state.
- Mapping sang store action.
- Cleanup global cursor/store state.

File lớn không phải vấn đề tự thân; vấn đề là không thể thay hit-test, thêm snapping hoặc thêm gesture mới mà không chạm cùng một khối logic.

### 3.6. Memo đúng nhưng chưa đủ cho scale lớn

`Tracks` có `memo`, nhưng vẫn subscribe toàn bộ `timelineClips`, `timelineLanes`, selection và drag state. Khi các reference này thay đổi, toàn bộ cây lane/clip được reconcile. Tất cả clip vẫn được mount, kể cả ngoài visible time range.

`memo(Tracks)` hiện hữu ích để chặn rerender do parent scroll ngang, nhưng không phải seam hiệu năng lâu dài.

### 3.7. Rủi ro export temporal parity

Exporter chia timeline theo boundary, clone scene và đổi duration, nhưng chưa trim/shift schedule theo local-time offset của segment. Khi overlay bắt đầu giữa một base scene, base scene có thể restart animation ở segment mới.

Phải xem đây là correctness issue của timeline, không phải vấn đề riêng của render worker.

### 3.8. Lifecycle cleanup còn khoảng trống

- Panel resize không quản lý listener thành session có thể cleanup khi unmount/pointer cancel.
- Playhead chưa cancel pending seek RAF và chưa đảm bảo kết thúc scrub khi unmount.
- Global drag state là singleton mutable module; cần xác định rõ owner/session token để tránh cleanup của session cũ xóa state session mới.

Không thấy render loop hiện hữu. Rủi ro hiện tại là stale session/listener và render fan-out, không phải effect loop.

## 4. Nguyên tắc kiến trúc bắt buộc

### 4.1. Dependency chỉ đi một chiều

```text
UI components/hooks
        ↓
Application/store/commands
        ↓
Timeline domain/policies/selectors
        ↓
Schema primitives
```

Infrastructure như persistence/export phụ thuộc domain contract qua adapter. Domain không import React, Zustand, DOM, localStorage, Electron hoặc component.

### 4.2. Command-query separation

- Query/selector không mutate và không có side effect.
- Command là đường duy nhất thay đổi timeline document.
- React hook không gọi chuỗi nhiều store action để hoàn thành một logical edit.
- Một user gesture chỉ tạo tối đa một committed command; preview trong khi kéo là transient interaction state.

### 4.3. Canonical document và derived data

Định nghĩa một aggregate dành cho editor timeline:

```ts
export type TimelineDocument = {
  project: MotionProject;
  lanes: TimelineLane[];
  clips: TimelineClip[];
};
```

Trong phase đầu có thể vẫn giữ shape state hiện tại để giảm phạm vi sửa, nhưng command runner phải nhận/trả về `TimelineDocument`. Sau đó mới cân nhắc lưu aggregate trực tiếp trong store.

Không lưu trong document các dữ liệu có thể derive an toàn như:

- `clipsByLane`
- content end
- visible clip IDs
- selected scene ID
- visual lane index
- ruler ticks

Các index hiệu năng cao phải có cache/memo bên ngoài document và invalidation theo revision.

### 4.4. Domain result có lý do thất bại rõ ràng

Không dùng `null` để đại diện mọi failure. Command/policy trả discriminated result:

```ts
type CommandResult =
  | {
      status: "applied";
      document: TimelineDocument;
      selection?: EditorSelection;
      inverse?: TimelineCommand;
      events: TimelineDomainEvent[];
    }
  | {
      status: "rejected";
      reason:
        | "locked"
        | "collision"
        | "missing-clip"
        | "missing-lane"
        | "unsupported-kind"
        | "invalid-document";
    };
```

UI quyết định toast/cursor/disabled state từ reason; domain không biết UI.

### 4.5. Transient interaction không được ghi vào document

Các state sau thuộc interaction layer:

- pointer origin/current position
- moving clip ID
- ghost geometry
- marquee rectangle
- active drop indicator
- auto-scroll owner
- pending RAF

Chúng không được autosave, không vào undo history và không làm thay đổi canonical timeline trước khi commit.

### 4.6. Mọi extension point phải có contract test

Một seam không được coi là hoàn thành chỉ vì có interface. Nó phải có test chứng minh:

- Có thể thay policy bằng fake implementation.
- Có thể thêm command mới mà không sửa store core.
- Có thể thêm clip variant thử nghiệm và compiler báo exhaustive failure đúng chỗ.
- UI interaction có thể test bằng injected geometry/clock thay vì DOM thật ở mọi case.

## 5. Invariants của timeline

Tạo `validateTimelineDocument(document)` và chạy trong test; ở development có thể chạy sau mỗi committed command.

Danh sách invariant tối thiểu:

1. Có đúng một visual base lane.
2. Mọi lane ID là duy nhất.
3. Mọi clip ID là duy nhất.
4. Mọi clip tham chiếu lane tồn tại và đúng family.
5. Scene clip tham chiếu scene tồn tại.
6. Audio clip tham chiếu audio track và asset hợp lệ.
7. `startTime` hữu hạn và không âm.
8. `duration` hữu hạn và lớn hơn minimum cho phép.
9. Lane cấm overlap không chứa clip overlap.
10. Lane order của từng family liên tục và deterministic.
11. Chỉ base scene IDs xuất hiện theo đúng thứ tự canonical; overlay scene vẫn được giữ trong project.
12. Selection không tham chiếu clip/node đã xóa.
13. Locked lane không bị mutation bởi command thông thường.
14. Hidden/muted flag không làm mất dữ liệu gốc.
15. Không tồn tại empty auto-created lane nếu policy yêu cầu prune; explicit lane được giữ nếu policy cho phép.

Validator không được tự sửa document. Normalize/migration là operation riêng để tránh che giấu bug.

## 6. Kiến trúc thư mục mục tiêu

```text
apps/web/lib/editor/timeline/
  model/
    timeline-types.ts
    timeline-document.ts
    timeline-invariants.ts
    timeline-events.ts
  commands/
    command-types.ts
    command-runner.ts
    add-clip.ts
    move-clip.ts
    split-clip.ts
    delete-clips.ts
    duplicate-clips.ts
    update-lane.ts
  policies/
    placement-policy.ts
    collision-policy.ts
    snapping-policy.ts
    ripple-policy.ts
    zoom-fit-policy.ts
  selectors/
    lane-selectors.ts
    clip-selectors.ts
    visible-range.ts
    compose-layers.ts
  history/
    timeline-history.ts
    transaction.ts
  playback/
    playback-clock-store.ts
    playback-driver.ts
  export/
    timeline-export-adapter.ts
    slice-scene.ts
  persistence/
    timeline-snapshot.ts
    timeline-migrations.ts

apps/web/lib/editor/store/
  create-editor-store.ts
  editor-store-provider.tsx
  selectors.ts
  actions/
    execute-command.ts
    project-lifecycle-actions.ts
    ui-actions.ts

apps/web/components/desktop/editor/timeline/
  Timeline.tsx
  TimelineBoard.tsx
  components/
    TimelineLaneView.tsx
    TimelineClipItem.tsx
    TimeRuler.tsx
    Playhead.tsx
  interactions/
    use-pointer-session.ts
    use-clip-move-session.ts
    use-library-drop-session.ts
    use-marquee-session.ts
    use-timeline-auto-scroll.ts
    dom-geometry-adapter.ts
  view-model/
    use-visible-timeline.ts
    use-timeline-scale.ts
```

Không cần di chuyển toàn bộ trong một commit. Mỗi phase bên dưới chỉ di chuyển phần đã có characterization test.

## 7. Contract/API mục tiêu

### 7.1. Command

```ts
export type TimelineCommand =
  | { type: "clip/add"; draft: ClipDraft; target: PlacementIntent }
  | { type: "clip/move"; clipIds: string[]; target: PlacementIntent }
  | { type: "clip/delete"; clipIds: string[] }
  | { type: "clip/split"; clipIds: string[]; at: number }
  | { type: "lane/update-flags"; laneId: string; patch: LaneFlagPatch }
  | { type: "lane/reorder"; laneId: string; order: number };
```

Sau này thêm `clip/trim`, `transition/add`, `group/create` bằng variant mới. Store runner không cần biết chi tiết từng command ngoài registry/dispatcher.

### 7.2. Placement intent

```ts
export type PlacementIntent =
  | { family: "visual"; role: "base"; desiredStart: number }
  | { family: "visual"; role: "overlay"; laneId: string; desiredStart: number }
  | { family: "visual"; role: "overlay"; createLaneAt: number; desiredStart: number }
  | { family: "audio"; laneId: string; desiredStart: number }
  | { family: "audio"; createLaneAt: number; desiredStart: number };
```

UI không gửi các boolean kết hợp như `insertNewLane + laneId? + insertOrder?`, vì các combination bất hợp lệ rất khó kiểm soát.

### 7.3. Interaction adapter

```ts
type TimelineGeometry = {
  clientPointToTime(clientX: number): number;
  hitTestLane(clientY: number, family: TrackFamily): LaneHit | null;
  visibleTimeRange(): { start: number; end: number };
};
```

Hook nhận interface này. DOM measurement nằm trong adapter; pure interaction state machine có thể test không cần browser.

### 7.4. Store factory

```ts
export function createEditorStore(initial?: Partial<EditorStoreState>): EditorStoreApi;
```

UI dùng Provider theo editor instance. Test tạo store riêng, không dùng module singleton. Đây là seam cần thiết cho multi-window, Storybook, test isolation và tương lai collaboration/session.

## 8. Kế hoạch thực thi chi tiết

### Phase 0 — Khóa behavior và baseline

#### Mục tiêu

Tạo safety net trước khi thay boundary; không đổi behavior production.

#### Công việc

- Bổ sung characterization test cho:
  - Add/move/split/delete/duplicate clip.
  - Move giữa base/overlay/audio.
  - Locked lane, hidden lane, muted lane.
  - Collision và nearest placement.
  - Empty timeline và first-clip fit lifecycle.
  - Copy/paste nhiều clip giữ relative offset.
- Thêm invariant assertions vào fixture/store tests.
- Tạo fixture 20, 100, 500, 2.000 clips thật thay vì chỉ constant checklist.
- Ghi baseline bằng React Profiler/Performance API:
  - mount timeline
  - scroll ngang/dọc
  - drag clip
  - marquee
  - playback 10 giây
- Thêm export parity test có animation bị cắt bởi overlay boundary; test phải fail trước khi fix.
- Sửa lint configuration để source timeline có thể chạy lint độc lập và CI báo đúng lỗi source, không bị Storybook parsing che khuất.

#### Tiêu chí hoàn thành

- Behavior hiện tại được mô tả bằng test.
- Có fixture large timeline tái sử dụng được.
- Có baseline số liệu, không chỉ nhận xét thủ công.
- Không sửa production behavior trong phase này.

### Phase 1 — Sửa dependency boundary và chuẩn hóa vocabulary

#### Mục tiêu

Loại bỏ import từ `lib` lên `components`; tạo namespace timeline domain đầu tiên.

#### Công việc

- Di chuyển `timeline-fit.ts` sang `lib/editor/timeline/policies/zoom-fit-policy.ts`.
- Tách phần pure của `lane-drop-target.ts` sang `lib/editor/timeline/policies/drop-target-policy.ts`.
- Giữ DOM collectors/hit-test trong component interaction adapter.
- Di chuyển hoặc re-export `timeline-types.ts` qua canonical path mới.
- Chuẩn hóa API mới về `visual/base/overlay/audio`.
- Giữ legacy alias chỉ trong parser/migration.
- Thêm ESLint rule/override rõ ràng:
  - `lib/editor/timeline/**` cấm React, Zustand, component, app, DOM globals.
  - `components/**` được import timeline public API, không import `store/internal`.
- Tạo `lib/editor/timeline/index.ts` với public exports có chủ đích; không barrel-export internal helper.

#### Tiêu chí hoàn thành

- Không còn `lib/editor/** -> components/**` import.
- Timeline pure policy test chạy không cần DOM environment.
- UI behavior và snapshot không đổi.
- `eslint` trên phạm vi timeline đạt zero error.

### Phase 2 — TimelineDocument và invariant boundary

#### Mục tiêu

Gom các dữ liệu phải thay đổi atomically vào một domain contract mà chưa cần thay toàn bộ store shape.

#### Công việc

- Tạo `TimelineDocument` và helper `documentFromStoreState`.
- Tạo `validateTimelineDocument` và structured violations.
- Tách parse/migrate/normalize khỏi file `timeline-clips.ts`:
  - model/type guard
  - migrations
  - lane order normalization
  - placement/collision
  - selectors
- Thay helper `null` failure bằng result type ở API mới.
- Tạo selectors/index builders:
  - `lanesById`
  - `clipsById`
  - `clipsByLane`
  - `contentEnd`
  - visual composition index
- Cache index theo document revision hoặc immutable reference; không lưu Map trực tiếp vào persisted state.
- Thêm property-based/fuzz-style test cho chuỗi operation ngẫu nhiên và chạy invariant sau mỗi bước.

#### Tiêu chí hoàn thành

- Có một hàm duy nhất kiểm tra document validity.
- Mọi fixture hiện tại hợp lệ hoặc được migration rõ ràng.
- `timeline-clips.ts` không còn là nơi chứa parser, migration, selector và operation cùng lúc.
- Không thay UI behavior.

### Phase 3 — Command runner và store instance

#### Mục tiêu

Mọi mutation timeline đi qua một application boundary; loại bỏ phụ thuộc vào singleton store trong test/UI mới.

#### Công việc

- Tạo `TimelineCommand`, `CommandResult`, `TimelineDomainEvent`.
- Chuyển lần lượt các operation:
  1. lane flags/reorder
  2. clip move
  3. add clip
  4. delete
  5. split
  6. duplicate
  7. clipboard paste
- Store chỉ còn `executeTimelineCommand(command)` cho mutation mới.
- Các action cũ trở thành compatibility wrapper gọi command runner.
- Command runner:
  - nhận document snapshot
  - apply đúng một transaction
  - validate result trong development/test
  - cập nhật selection atomically
  - phát domain events
- Tạo `createEditorStore()` và Provider theo editor instance.
- Migrate component khỏi `useEditorStore.getState()` toàn cục khi có thể; interaction session nhận store API qua hook/context.
- Dùng stable selector exports thay vì inline selector phức tạp lặp lại.

#### Tiêu chí hoàn thành

- Một user edit tạo đúng một committed command.
- Store tests không chia sẻ singleton state.
- Compatibility action và command mới cho output giống nhau trên characterization fixtures.
- Không component nào import `store/internal`.

### Phase 4 — Transaction và history seam

#### Mục tiêu

Chuẩn bị undo/redo đúng kiến trúc trước khi thêm trim, transition hoặc multi-edit.

#### Công việc

- Mỗi applied command trả inverse command hoặc before/after patch có giới hạn.
- Tạo transaction boundary để group nhiều internal operation thành một history entry.
- Drag preview không vào history; pointer-up commit mới tạo entry.
- Marquee/selection mặc định không vào document history.
- Coalesce các command liên tục nếu cần:
  - keyboard nudge
  - resize/trim drag
  - text/property edit trong tương lai
- Đặt memory budget cho history; không clone toàn bộ project vô hạn.
- Có API `undo`, `redo`, `canUndo`, `canRedo`, nhưng UI có thể bật ở phase sau.

#### Tiêu chí hoàn thành

- Move/split/delete/paste undo và redo khôi phục đúng document + selection.
- Undo không phục hồi transient drag/marquee state.
- Load project mới reset history atomically.
- History không được persist trong project snapshot.

### Phase 5 — Tách interaction session khỏi React component

#### Mục tiêu

Biến drag/drop/marquee thành state machine có thể test và cleanup tin cậy.

#### Công việc

- Tạo reusable pointer session controller hỗ trợ:
  - start/update/commit/cancel
  - pointer capture
  - pointerup/pointercancel/lostpointercapture/Escape
  - unmount cleanup
- Tách clip move, library drop, marquee thành session riêng dùng chung controller.
- Tạo session token/owner cho global drag cursor và auto-scroll; session cũ không được cleanup session mới.
- Inject `TimelineGeometry` vào session.
- DOM adapter chịu trách nhiệm cache rect và invalidation theo:
  - scroll
  - resize
  - lane layout revision
  - zoom revision
- Sidebar drag-over cũng coalesce bằng RAF trước khi hit-test.
- Hook chỉ expose view state nhỏ:
  - active clip
  - ghost
  - drop target
  - marquee rectangle
- Commit session bằng `executeTimelineCommand`.

#### Tiêu chí hoàn thành

- Không còn window listener bị giữ sau unmount/cancel.
- Mỗi interaction có unit test không cần render toàn bộ timeline.
- Một pointer frame chỉ đo geometry tối đa một lần cho mỗi cache revision.
- Không business placement rule trong hook React.

### Phase 6 — Render isolation và virtualization

#### Mục tiêu

Giữ timeline responsive khi số lượng clip/lane tăng lớn.

#### Công việc

- Tách `TimelineLaneView` và `TimelineClipItem`.
- Clip item nhận ID/primitive props ổn định; dùng `memo` sau khi đo profiler chứng minh có lợi.
- Tính visible time range từ scrollLeft, viewport width, pps và overscan.
- Chỉ render clip intersect visible range; selected/moving clip có thể pin ngoài range nếu interaction yêu cầu.
- Virtualize lane theo vertical range khi lane count vượt threshold.
- Duy trì lane/clip index để query visible items gần `O(log n + k)` thay vì scan toàn bộ ở mỗi scroll.
- Scroll position vẫn là UI state/ref; không ghi vào document store.
- Throttle React scroll state theo RAF nếu profiler cho thấy cần; playhead tiếp tục imperative transform.
- Preview giữ clock subscription ở leaf; không để raw `currentTime` làm rerender editor shell.

#### Performance budget đề xuất

Trên fixture 2.000 clips, hardware CI/reference thống nhất:

- Horizontal scroll: không có task > 50ms trong steady state.
- Pointer move/drag: không quá một RAF flush mỗi frame.
- Timeline commit move đơn clip: p95 < 16ms, không tính persistence.
- Selection một clip không reconcile toàn bộ 2.000 clip item.
- Playback không làm `Tracks` rerender mỗi frame.
- Ruler tick DOM giữ bounded theo viewport.
- Số clip DOM gần số clip visible + overscan, không gần tổng clip count.

#### Tiêu chí hoàn thành

- Có automated render-count test hoặc profiler harness cho các boundary quan trọng.
- Fixture 500 và 2.000 clips đạt budget đã thống nhất.
- Memo được giữ/xóa dựa trên measurement, không dựa trên cảm giác.

### Phase 7 — Persistence và export correctness

#### Mục tiêu

Đảm bảo timeline lớn lưu an toàn và output giữ temporal parity.

#### Công việc persistence

- Snapshot timeline có version riêng và migration idempotent.
- Lưu theo project key thay vì serialize toàn bộ collection.
- Chuyển storage lớn sang IndexedDB/OPFS/backend adapter.
- Có dirty revision và saved revision.
- Desktop close thực hiện save handshake; không đóng trước khi flush hoặc user xác nhận bỏ thay đổi.
- Persistence chạy ngoài hot interaction path.
- Migration không được mutate dữ liệu gốc hoặc tự ghi ngược trong read path.

#### Công việc export

- Tạo `sliceScene(scene, localStart, duration)`.
- Shift/trim animation schedule và keyframe khi bake segment.
- Overlay bake dùng đúng local-time offset của từng clip.
- Audio split/duplicate giữ đúng `trimStart`, duration và fade semantics.
- Export adapter chỉ nhận validated `TimelineDocument`.
- Thêm frame parity tests tại:
  - trước boundary
  - đúng boundary
  - sau boundary một frame
  - base gap + overlay
  - hidden/muted lane
  - split audio có trimStart

#### Tiêu chí hoàn thành

- Preview và export tương đương tại temporal boundary đã test.
- Đóng desktop ngay sau edit không mất committed command cuối.
- Migration cũ/mới roundtrip không mất placement.
- Autosave không tạo long task đáng kể trên fixture lớn.

### Phase 8 — Xác nhận seam cho tính năng tương lai

#### Mục tiêu

Chứng minh kiến trúc mở rộng được mà chưa cần ship toàn bộ tính năng mới.

#### Công việc

Thực hiện các spike nhỏ chỉ trong test/branch nội bộ:

- `clip/trim` command dùng command runner/history mà không sửa store core.
- `snappingPolicy` giả có thể thay thế default policy.
- Thêm metadata transition reference giữa hai clip mà không nhét logic vào component.
- Thêm một clip capability thử nghiệm và xác nhận exhaustive switch báo đúng các adapter cần hỗ trợ.
- Tạo hai editor store instance trong cùng test và chứng minh không rò state.

#### Tiêu chí hoàn thành

- Mỗi spike chỉ mở rộng public contract dự kiến, không bypass boundary.
- Xóa spike không ảnh hưởng production behavior.
- ADR ghi lại các quyết định schema cần thiết trước khi phát triển feature thật.

## 9. Ma trận seam cho tính năng tương lai

| Tính năng tương lai | Seam phải dùng | Không được làm |
|---|---|---|
| Trim clip | `clip/trim` command + collision/ripple policy + history | Sửa duration trực tiếp trong component |
| Transition | Transition model/command + preview/export adapter | Nhét transition state vào `TimelineClipItem` local state |
| Snapping | Injectable snapping policy | Hard-code threshold trong nhiều drag hook |
| Multi-clip move | Command nhận `clipIds[]`, transaction atomically | Gọi `moveClip` tuần tự cho từng clip |
| Group/nested timeline | Group command + selector/index adapter | Thêm nhiều nullable field vào clip base mà không có invariant |
| Keyframe timeline | Time-domain model riêng + playback selector | Subscribe toàn editor vào raw playback time |
| Caption/subtitle | Clip capability/track family có contract rõ | Dùng `scene` như catch-all cho mọi loại content |
| Video clip | Clip variant + preview/export capability | `if audio else scene` mặc định |
| Ripple edit | Ripple policy + command result | Shift clip trực tiếp trong UI gesture |
| Collaboration | Serializable command/event + document revision | Đồng bộ Zustand state diff tùy ý qua network |

## 10. Test strategy

### 10.1. Domain unit tests

- Placement, collision, snapping, ripple.
- Invariants.
- Commands và inverse commands.
- Selectors/index.
- Migration idempotency.
- Scene slicing/export offsets.

Không dùng DOM hoặc React cho lớp này.

### 10.2. Application/store contract tests

- Một command chỉ tạo một state commit logic.
- Document + selection cập nhật atomically.
- History reset khi load project.
- Hai store instance độc lập.
- Compatibility action tương đương command mới trong giai đoạn migration.

### 10.3. Interaction tests

- Pointer threshold.
- Commit/cancel/Escape/pointercancel/lost capture.
- Auto-scroll ownership.
- Geometry cache invalidation.
- Session cleanup khi component unmount.

Ưu tiên state-machine test; chỉ một số test cần browser DOM.

### 10.4. Component tests

- Render isolation theo selector.
- Clip item không rerender khi clip khác thay đổi.
- Virtual range và overscan.
- Accessibility keyboard cho playhead/clip/lane.

### 10.5. E2E

- Drag từ library vào base/overlay/audio.
- Move clip giữa lane, insert lane, auto-scroll.
- Marquee + delete + undo/redo.
- Zoom/fit/scroll không lệch tọa độ.
- Save/reload/close desktop.
- Export parity smoke với project fixture chuẩn.

## 11. Quy tắc performance và memo

1. Không thêm `useMemo`/`useCallback` chỉ để “tối ưu” khi chưa có consumer memoized hoặc dependency stability requirement.
2. Selector Zustand không được trả object/array mới mỗi lần nếu không có equality strategy.
3. Playback time subscription phải ở leaf hoặc imperative bridge.
4. Pointer move không gọi document store mutation trước commit.
5. DOM measurement phải được cache theo session/revision và coalesce bằng RAF.
6. Không mount clip ngoài visible range sau Phase 6.
7. Không serialize/persist trong animation frame hoặc pointer hot path.
8. Memo boundary ưu tiên ở lane/clip item, không chỉ ở component root lớn.
9. Mọi optimization phải có benchmark hoặc render-count test giữ lại regression guard.

## 12. Quy tắc code review cho timeline

Một PR timeline không được merge nếu có một trong các dấu hiệu:

- `lib/editor/**` import từ `components`, `hooks` hoặc `app`.
- Component sửa trực tiếp `project`, `timelineClips` hoặc `timelineLanes`.
- Một logical edit gọi nhiều store mutation rời rạc mà không có transaction.
- Domain function đọc DOM, localStorage hoặc global Zustand singleton.
- Hook chứa collision/placement rule mới thay vì gọi policy.
- Selector tạo array/object mới không có memo/equality rõ ràng.
- Pointer/RAF/listener không có cancel/unmount test.
- Thêm clip kind nhưng dùng fallback `else` thay vì exhaustive switch.
- Thêm persisted field nhưng không tăng version/migration/test roundtrip.
- Thay đổi export behavior nhưng không có preview/export parity test.

## 13. Thứ tự PR/commit đề xuất

1. `test(timeline): add invariants and characterization fixtures`
2. `refactor(timeline): move fit and drop policies below UI boundary`
3. `refactor(timeline): introduce TimelineDocument and validation`
4. `refactor(timeline): split timeline-clips parser migration selectors operations`
5. `feat(timeline): add command runner and structured results`
6. `refactor(store): create per-editor store provider`
7. `refactor(timeline): migrate move/add/delete/split to commands`
8. `feat(timeline): add transaction and history core`
9. `refactor(timeline): extract pointer sessions and geometry adapter`
10. `perf(timeline): isolate lane and clip rendering`
11. `perf(timeline): add visible-range virtualization`
12. `fix(timeline-export): preserve local animation time across bake boundaries`
13. `refactor(timeline-persistence): versioned per-project snapshots and close flush`
14. `test(timeline): enforce large-fixture performance budgets`

Mỗi PR phải nhỏ, giữ compatibility wrapper nếu caller chưa migrate, và không trộn refactor boundary với thay đổi UX lớn.

## 14. Rủi ro triển khai và cách giảm thiểu

### Rủi ro: Big-bang rewrite làm mất behavior DnD hiện tại

Giảm thiểu bằng characterization test, compatibility wrapper và migrate từng command.

### Rủi ro: Aggregate mới tạo thêm một nguồn sự thật tạm thời

`TimelineDocument` ban đầu chỉ là input/output view của state hiện tại. Không lưu song song document mới trong store cho đến khi migration cuối cùng diễn ra.

### Rủi ro: Virtualization làm marquee/hit-test bỏ sót clip ngoài viewport

Marquee chỉ nên hit-test visible/intersecting viewport. Các operation trên toàn timeline dùng domain index, không query DOM.

### Rủi ro: History tiêu thụ nhiều bộ nhớ

Dùng inverse command hoặc bounded patch; đặt giới hạn entry/bytes và reset history khi load project.

### Rủi ro: Export fix yêu cầu thay schema

Ưu tiên slice/shift scene trong adapter. Nếu schema không diễn tả trim đúng, tạo ADR và fixture chứng minh trước khi đổi schema package.

### Rủi ro: Performance optimization làm code phức tạp quá sớm

Chỉ merge optimization khi baseline chứng minh bottleneck và có regression test tương ứng.

## 15. Definition of Done toàn kế hoạch

Kế hoạch được xem là hoàn thành khi:

- Timeline domain không import React, DOM, Zustand hoặc component.
- Mọi mutation timeline production đi qua command runner.
- Có invariant validator chạy trong toàn bộ domain/store tests.
- Store tạo được theo từng editor instance.
- Undo/redo core hoạt động cho move/add/delete/split/paste.
- Interaction session cleanup đúng trên commit, cancel và unmount.
- Clip/lane render được isolate và timeline lớn dùng visible-range virtualization.
- Fixture 2.000 clips đạt performance budget đã thống nhất.
- Preview/export giữ temporal parity tại các boundary có test.
- Persistence timeline có version, migration và close-save handshake.
- ESLint/typecheck/unit/E2E timeline đều pass trong CI.
- Việc thêm một command hoặc policy thử nghiệm không cần sửa store core hay bypass boundary.

## 16. Việc nên làm ngay trước khi thêm feature timeline mới

Ưu tiên tuyệt đối bốn hạng mục sau:

1. Phase 0: invariants, characterization tests và performance fixture thật.
2. Phase 1: sửa dependency boundary, chuyển pure policy ra khỏi component.
3. Phase 3 tối thiểu: command runner cho move/add/delete/split.
4. Phase 7 phần export: sửa local-time continuity trước khi tăng độ phức tạp của overlay/transition.

Sau bốn hạng mục này, codebase mới có seam đủ an toàn để bắt đầu trim, transition hoặc keyframe timeline mà không tiếp tục tăng coupling hiện tại.
