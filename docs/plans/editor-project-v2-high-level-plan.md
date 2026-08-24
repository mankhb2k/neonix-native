# Kế hoạch EditorProjectV2: high-level editor → Atomic Protocol V2

> Trạng thái: đề xuất, chưa bắt đầu migration.
>
> Quyết định kiến trúc: `EditorProjectV2` là nguồn dữ liệu authoring chính. Nó có track,
> clip/segment và UI order. `MotionProtocolV2` là output atomic cho preview/export;
> `order` trong Protocol chỉ dùng cho paint/z-index, không dùng để tạo lane UI.

## Đích kiến trúc

```text
EditorProjectV2
  ├─ tracks: trackId, kind, purpose, uiOrder
  ├─ clips: timing, trackId, stackRank, content
  └─ editor commands/history
              ↓ lowerEditorProjectV2()
MotionProtocolV2
  ├─ root/child atom có id và order duy nhất theo sibling scope
  └─ audio tracks/clips chuẩn Protocol
              ↓ compileProtocolV2()
RuntimeProjectV2 → Preview / Export
```

`apps/web/components/editor/EditorShell.tsx` tiếp tục được tái sử dụng. Không tạo UI
`V2Editor` thứ hai. Web chỉ giữ session state như selection, playhead, zoom và panel state.

## Quy ước dữ liệu bắt buộc

- `trackId` và `uiOrder` là metadata high-level, không đi vào `MotionProtocolV2` vì schema
  Protocol V2 là strict.
- `stackRank` là ý định z-index high-level. Lower compiler sort theo `stackRank`, tie-break
  theo stable `clip.id`, rồi gán `layer.order` từ `0..n` để mọi atom có order duy nhất.
- Lane timeline được dựng từ `trackId`; không còn dựng từ `layer.order`.
- Audio chỉ vào audio track. Visual track có `purpose` (`caption`, `media`, `shape`, `free`)
  làm placement policy mềm, không phải ràng buộc render.
- Split nằm ngoài phạm vi roadmap này; V2 hiện không có UI hay command Split.

---

## Phase 0 — Khóa contract và baseline

- [ ] **P0.1 — Chốt format:** định nghĩa `EditorProjectV2`, `EditorTrack`, `EditorClip`,
  `EditorCompileResult` và versioning (`format: "motion-editor"`, `editorVersion: 2`).
- [ ] **P0.2 — Chốt boundary:** phân biệt persistent authoring state với session-only state
  (selection, playhead, zoom, panel visibility).
- [ ] **P0.3 — Chốt identity:** quy tắc stable `clip.id`, `track.id`, protocol `layer.id`,
  mapping clip ↔ layer và xử lý ID khi duplicate/split.
- [ ] **P0.4 — Chốt policy:** quy tắc placement mặc định: text → caption, image/video → media,
  shape → shape/free, audio → audio track.
- [ ] **P0.5 — Baseline test:** fixture gồm caption nhiều segment trên cùng track, image/video,
  shape overlay, audio và group tối thiểu.

**Nghiệm thu Phase 0**

- [ ] Schema high-level, ví dụ JSON và invariants được review/chốt.
- [ ] Có fixture đủ chứng minh `trackId` tách biệt với `stackRank`.

## Phase 1 — Editor-core high-level model

- [ ] **P1.1 — Model:** tạo module thuần TypeScript trong `packages/editor-core/src/v2/authoring/`;
  không phụ thuộc React, Next.js, Zustand hay DOM.
- [ ] **P1.2 — Schema/validation:** kiểm tra ID unique, track tồn tại, timing hợp lệ, loại clip
  hợp với track kind và không chứa runtime/GPU state.
- [ ] **P1.3 — Selectors:** derive duration, clips-by-track, lane rows, visible range và layer tree
  từ `EditorProjectV2`.
- [ ] **P1.4 — Stack allocator:** sort deterministic theo `stackRank + clip.id`; hỗ trợ normalize
  paint order mà không thay đổi `trackId`.
- [ ] **P1.5 — Unit tests:** validate lỗi, selection projection, caption nhiều clip cùng lane,
  deterministic sort và sibling scope.

**Nghiệm thu Phase 1**

- [ ] Core có thể tạo timeline view-model từ high-level document mà không cần Protocol V2.
- [ ] Caption nhiều word/segment chỉ tạo một lane UI.

## Phase 2 — Lower compiler: EditorProjectV2 → MotionProtocolV2

- [ ] **P2.1 — Visual lowering:** mỗi visual clip lower thành một Protocol layer atom với ID ổn định,
  frame/transform/style/payload/timing đúng semantic.
- [ ] **P2.2 — Order lowering:** cấp `order` unique `0..n` cho từng sibling scope; order lớn hơn
  được vẽ sau và nằm trên.
- [ ] **P2.3 — Audio lowering:** map high-level audio tracks/clips sang `audio.tracks[]`, asset,
  trim, gain, fade và timing Protocol.
- [ ] **P2.4 — Group lowering:** lower parent/child theo `parentLayerId`; cấp order độc lập theo
  scope của từng parent.
- [ ] **P2.5 — Compile result:** trả mapping `clipIdByLayerId`, `layerIdByClipId`, diagnostics và
  source map để preview/stage selection quay về editor clip.
- [ ] **P2.6 — Gate:** output bắt buộc qua `MotionProtocolV2Schema` và `compileProtocolV2` trước
  khi được xem là hợp lệ.
- [ ] **P2.7 — Golden tests:** cùng high-level input luôn sinh JSON Protocol giống hệt; không có
  duplicate order; timeline track metadata không xuất hiện trong output.

**Nghiệm thu Phase 2**

- [ ] Mọi Protocol layer sinh ra có `order` unique đúng sibling scope.
- [ ] Runtime preview của output render đúng z-index và timing fixture.

## Phase 3 — Commands, transaction và history ở high-level

- [ ] **P3.1 — Command contract:** `addClip`, `patchClip`, `moveClip`, `moveClips`,
  `deleteClips`, `duplicateClip`, `reorderTrack`, `setStackRank`.
- [ ] **P3.2 — Atomic transaction:** command lỗi không commit partial state; diagnostics trả về
  editor UI.
- [ ] **P3.3 — History:** undo/redo lưu high-level inverse transaction, bao gồm cả track assignment;
  không lưu runtime frame hay renderer resource.
- [ ] **P3.4 — Delete:** multi-select delete theo clip; delete group xử lý subtree đúng thứ tự.
- [ ] **P3.5 — Tests:** move lane không đổi z-index; bring-forward không đổi track; undo/redo
  khôi phục cả timing, trackId và stackRank.

**Nghiệm thu Phase 3**

- [ ] Snap, Undo, Redo và Delete hiện có được chuyển sang high-level command boundary.
- [ ] Không còn UI command mutate trực tiếp `MotionProtocolV2`.

## Phase 4 — Migration và persistence envelope

- [ ] **P4.1 — Envelope:** tạo persistent `EditorProjectV2` repository/envelope; browser storage,
  autosave và server payload lưu high-level document thay vì session state.
- [ ] **P4.2 — Import migration:** raw `MotionProtocolV2` cũ được nâng thành high-level project;
  mặc định mỗi visual layer tạo một track riêng để không làm thay đổi layout cũ.
- [ ] **P4.3 — Caption grouping:** migration/tool cho phép gom các text layer vào `track.caption` mà
  không đổi Protocol render result.
- [ ] **P4.4 — Compatibility:** export vẫn emit Protocol V2; import Protocol không có metadata có
  fallback rõ ràng.
- [ ] **P4.5 — Tests:** round-trip `EditorProjectV2 → Protocol → import` và autosave/load fixture.

**Nghiệm thu Phase 4**

- [ ] Reload editor giữ track/lane UI, clip timing và paint stack.
- [ ] Export không chứa `trackId`, `uiOrder`, selection hay zoom.

## Phase 5 — Migrate EditorShell sang high-level source

- [ ] **P5.1 — Surface provider:** `EditorSurfaceProvider` giữ `EditorProjectV2`; memoize
  `lowerEditorProjectV2()` cho stage/export.
- [ ] **P5.2 — Timeline:** `TimelineShell` đọc `tracks/clips` high-level; lane UI dựng theo
  `trackId`, không còn `order = lane`.
- [ ] **P5.3 — Sidebar/inspector:** sidebar hiển thị clip/track; inspector sửa high-level command;
  stage hit-test dùng compiler source map để select editor clip.
- [ ] **P5.4 — Header/library:** shape/text/image/video được tạo dưới dạng high-level clip và dùng
  policy placement mặc định.
- [ ] **P5.5 — Preview:** `PreviewStage` chỉ nhận Protocol output derive từ high-level document;
  không có channel sửa Protocol ngược từ UI.
- [ ] **P5.6 — E2E:** add, select, move, trim, delete, undo/redo, preview và reload.

**Nghiệm thu Phase 5**

- [ ] Caption nhiều clip nằm cùng một track trên timeline.
- [ ] Đổi track không đổi stage z-index; đổi z-index không đổi track UI.

## Phase 6 — Track UX và policy placement

- [ ] **P6.1 — Track management:** tạo/đổi tên/xóa/reorder track, lock/mute/hide khi capability
  đã rõ; audio track tách visual track.
- [ ] **P6.2 — Drag rules:** kéo dọc đổi `trackId`; kéo ngang đổi timing; modifier/command rõ ràng
  để đổi stackRank khi cần.
- [ ] **P6.3 — Caption workflow:** tạo caption track, đặt nhiều text segment cùng hàng, thêm label
  và styling lane phù hợp.
- [ ] **P6.4 — Stack UI:** expose Bring Forward/Send Backward hoặc z-index inspector riêng; không
  dùng drag lane để thay đổi paint order.
- [ ] **P6.5 — UX tests:** media/image/video, caption, shape và audio không tạo lane rối khi thêm
  nhiều segment.

**Nghiệm thu Phase 6**

- [ ] Timeline thể hiện track như CapCut nhưng Protocol output vẫn atomic/deterministic.
- [ ] Nhóm caption 20+ segment vẫn nằm gọn trên một lane.

## Phase 7 — Export, cleanup và cutover

- [ ] **P7.1 — Export:** export job nhận Protocol output từ lower compiler; render/export không đọc
  metadata timeline high-level.
- [ ] **P7.2 — Diagnostics:** lỗi high-level, lowering, schema và runtime được map về clip/track UI.
- [ ] **P7.3 — Remove adapter:** gỡ dần `timelineCommandToV2` và projection cũ `order = lane` sau
  khi Phase 5 ổn định.
- [ ] **P7.4 — Regression:** visual golden, compiler golden, e2e editor và performance timeline lớn.
- [ ] **P7.5 — Documentation:** cập nhật architecture docs, migration guide và command contract.

**Nghiệm thu Phase 7**

- [ ] Editor mở/lưu high-level project, preview/export Protocol V2, không có V1 runtime/store
  trên đường chạy V2.
- [ ] Các adapter direct-Protocol cũ được đánh dấu deprecated hoặc gỡ bỏ an toàn.
