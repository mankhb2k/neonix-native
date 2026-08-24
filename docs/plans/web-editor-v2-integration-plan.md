# Kế hoạch nối Web Editor với Protocol V2

> Trạng thái: đề xuất triển khai.
>
> Mục tiêu: đưa workspace Web và editor trở thành một consumer Protocol V2 hoàn chỉnh,
> từ mở project, chỉnh sửa, preview, autosave đến export, mà không tái sử dụng runtime
> hay mô hình dữ liệu V1.

## 1. Hiện trạng và vấn đề cần giải quyết

Web đã có entrypoint V2 tại `/app` và route editor `/app/editor/[projectId]`.
Hai fixture `shape` và `overlap` được tạo trong `apps/web/lib/v2-editor/projects.ts`.
Route editor hiện import `@/components/editor-v2/V2Editor`, nhưng thư mục/component đó
chưa tồn tại. Vì vậy luồng mở editor chưa thể build hoặc chạy được.

Đồng thời, `apps/web/components/editor`, `apps/web/hooks/editor` và
`apps/web/lib/editor` vẫn là implementation V1 bị đóng băng. Chúng phụ thuộc vào
`MotionProject`, `editor-core`, `compileProjectV1` và snapshot runtime V1. Các lớp này
không được import vào editor mới; ranh giới này đã được kiểm tra bởi
`scripts/validate-v2-consumers.mjs`.

## 2. Phạm vi

### Trong phạm vi

- Workspace hiển thị các project V2 có thể mở và tạo mới.
- Một V2 editor client-side nhận và lưu `MotionProtocolV2`.
- Preview native theo chuỗi `parse -> compileProtocolV2 -> RuntimeProjectV2 ->
  evaluateRuntimeProjectV2 -> PreviewRenderer`.
- Timeline, layer tree, selection, transport và inspector là derived/session state;
  document chuẩn duy nhất vẫn là Atomic Protocol V2.
- Command adapter chỉ thay đổi các field Atomic V2 đã được capability manifest chứng
  nhận.
- Validation, autosave local, export job và các test V2 end-to-end.

### Ngoài phạm vi

- Đọc, chuyển đổi tự động hoặc chạy project V1 ngay trong editor/runtime V2.
- Tái dùng Zustand store, timeline model, stage interaction hay preview adapter V1.
- High-level presets/templates/AI authoring chưa có Compiler A được chứng nhận.
- Expose một atom/effect/mask chưa được capability manifest cho phép.

## 2A. Chiến lược triển khai đã chốt: tái sử dụng `EditorShell`

Không dựng một editor UI thứ hai trong `components/editor-v2`. Editor V2 sẽ dùng lại
`apps/web/components/editor/EditorShell.tsx` và đúng grid 5 vùng đã có:

```text
EditorShell
├── V2EditorHeader       (same header grid/chrome)
├── V2Sidebar            (read-only V2 layer list)
├── V2StageViewport      (V2 compiler/runtime preview)
├── TimelineShellV2      (read-only timeline surface)
└── V2Inspector           (metadata + canonical JSON)
```

Các component V2 này nằm ngay trong `EditorShell` dùng chung, giữ nguyên grid, spacing,
panel chrome và visual language của editor cũ. Trong lúc chuyển đổi, đường chạy V2 không
được import store/editor-core V1; mỗi panel chỉ đọc `MotionProtocolV2` hoặc view-model V2.

### Vertical slice bắt đầu trước tiên

1. **V2 data seam:** tạo V2 document/session provider cho `EditorShell`; document là
   `MotionProtocolV2`, session gồm selection, current time, playback và panel state.
2. **Stage read-only:** thay renderer/stage input của `StageViewport` bằng
   `compileProtocolV2 -> evaluateRuntimeProjectV2 -> PreviewRenderer`, giữ nguyên layout
   và interaction overlay ở mức disabled/preview-only.
3. **Timeline read-only:** giữ vị trí/chrome timeline của editor cũ, thay nguồn rows/clips
   bằng V2 layer view-model cục bộ; chưa gọi `editor-core`, chưa move/trim/command.
4. **Sidebar/inspector read-only:** đọc layer tree và JSON/field metadata từ V2 document;
   chưa mutate document.
5. **Sau khi read path ổn định:** mới nối `EditorCommand`, history, inspector commit,
   timeline move/trim và persistence.

Route `/app/editor/[projectId]` sẽ render `EditorShell` với V2 snapshot trong vertical
slice này. Các component timeline V2 đã được migrate vào `components/editor/timeline/v2`;
không còn route/editor shell riêng dưới `components/editor-v2`.

## 3. Kiến trúc đích

```text
Workspace / Project repository
             |
             v
     MotionProtocolV2 (canonical JSON)
             |
       V2 editor store
       |       |       |
       |       |       +--> autosave / export request
       |       v
       |  derived timeline + layer tree + selection
       v
compileProtocolV2 -> RuntimeProjectV2 -> evaluateRuntimeProjectV2
                                             |
                                             v
                                    @motionvideo/preview-renderer
```

Nguyên tắc bắt buộc:

- Atomic JSON chỉ giữ dữ liệu authoring: composition, assets, layers, timing,
  transform semantic, style và effects được hỗ trợ.
- Matrix4, world transform, paint command, texture/GPU resource và renderer state
  là dữ liệu runtime, không được ghi vào editor document.
- Preview và export nhận cùng V2 document/runtime contract. UI không được tự tính
  transform hay thay đổi paint semantics.
- Mọi command phải parse/validate document trước khi commit; lỗi hiển thị theo
  diagnostic, không làm hỏng document đã hợp lệ cuối cùng.

## 4. Thiết kế dữ liệu và module

Tạo namespace mới `apps/web/lib/v2-editor/` và `apps/web/components/editor-v2/`.
Không đặt code mới vào namespace legacy `lib/editor`.

| Module | Trách nhiệm |
| --- | --- |
| `projects.ts` | Fixture V2 hiện có; thay bằng repository adapter khi persistence sẵn sàng. |
| `project-repository.ts` | `list`, `create`, `load`, `save` V2 document; trả về revision/updatedAt và không nhận V1. |
| `document.ts` | Parse qua `MotionProtocolV2Schema`/`parseMotionProtocol`, clone immutable, IDs và invariant document. |
| `capabilities.ts` | Đọc manifest của protocol/compiler, map atom được chứng nhận sang command/UI. |
| `derive.ts` | Flat layer tree, parent-child tree, stable zIndex order, duration, timeline rows; không serialize output. |
| `commands.ts` | Pure document commands: add, duplicate, delete, reorder, patch transform/style/timing; validate sau mỗi command. |
| `store.ts` | Document V2 + revision là persistent state; selection/playback/zoom/panel/error là session state. |
| `preview-controller.ts` | Compile, prepare text nếu cần, evaluate frame và quản lý lifecycle `PreviewRenderer`. |
| `V2Editor.tsx` | Ghép editor shell, transport, stage, timeline, layer panel, inspector và JSON diagnostics. |

### Store tối thiểu

```ts
type V2EditorState = {
  document: MotionProtocolV2;
  revision: number;
  selectedLayerIds: string[];
  currentFrame: number;
  isPlaying: boolean;
  zoom: number;
  diagnostics: readonly Diagnostic[];
};
```

`timelineRows`, duration, compiled runtime và current paint frame phải được derive/memoize
từ state trên; chúng không là nguồn dữ liệu thứ hai để lưu project.

## 5. Các giai đoạn triển khai

### Giai đoạn 0 — Khóa ranh giới và baseline

- [x] Ghi nhận build/typecheck hiện tại: route `/app/editor/[projectId]` thiếu
   `components/editor-v2/V2Editor`.
- [x] Chạy các validator V2 hiện hữu và lưu kết quả baseline.
- [x] Bổ sung test/lint rule cục bộ nếu cần để `components/editor-v2` và
   `lib/v2-editor` không import các prefix legacy bị freeze.
- [x] Giữ nguyên tất cả file V1 đang có; chúng chỉ được loại bỏ bằng một ticket migration
   riêng sau khi V2 thay thế đầy đủ.

**Hoàn thành khi:** `pnpm validate:v2-consumers` và `pnpm typecheck:v2` có một baseline
rõ ràng, còn lỗi thiếu `V2Editor` được biến thành task có test.

### Giai đoạn 1 — Vertical slice: mở và preview project V2

- [x] Route editor nhận `MotionProtocolV2` và mount trực tiếp `EditorShell` dùng chung.
- [ ] Tách logic preview đã được chứng nhận từ `components/docs/PreviewStage.tsx` thành
   adapter dùng lại được, hoặc tạo adapter mới cùng contract; không import preview
   adapter V1.
- [x] Canvas stage sử dụng `createPreviewRenderer`, ưu tiên WebGPU và báo rõ fallback
   WebGL2/diagnostic.
- [x] Compile bằng `compileProtocolV2`, đánh giá theo frame bằng
   `evaluateRuntimeProjectV2`; sync canvas size với `composition.width/height`.
- [x] Tạo transport tối thiểu: play/pause, seek, current frame/time, duration derive từ
   layer timing. Playback engine chỉ đổi frame, không mutate document.
- [x] Hiển thị read-only layer list và Atomic JSON panel để debug.
- [x] Dựng editor shell 5 vùng cố định: header, sidebar, stage, timeline, inspector;
   các panel dùng layout gap `6px`, không trộn transport vào stage.

**Hoàn thành khi:** `/app/editor/shape` và `/app/editor/overlap` render preview, có
transport, và smoke test xác minh stage + JSON + order overlap.

### Task 4 — Migrate timeline vào `EditorShell`

- [x] Dùng `project.layers[].timing` và `order` làm nguồn duy nhất cho rows/clips V2.
- [x] Đưa timeline vào đúng grid area `timeline` bên dưới stage, không tạo editor route thứ hai.
- [x] Giữ transport/ruler/timecode/zoom và thêm local preview state cho play, seek, zoom.
- [x] Đồng bộ playhead timeline với `currentTime` của V2 stage surface.
- [x] Thêm chọn layer từ row/clip, lưu trong session state `selectedLayerIds`.
- [x] Không import `editor-core`, V1 store hoặc `TimelineClip`/`TimelineLane`.
- [ ] Chưa commit move/trim/selection vào Protocol; các command sẽ làm ở phase 2.

**Kết quả task 4:** timeline đã là read-only V2 view trong `EditorShell`; play/seek/zoom
chỉ thay đổi session preview state và không mutate document JSON.

### Giai đoạn 1.5 — Timeline UI/UX cho `editor-v2` (chưa nối editor-core)

Mục tiêu của giai đoạn này là dựng đúng trải nghiệm nhìn và tương tác cơ bản của
timeline theo editor V1/VSCode-style, nhưng chỉ dùng fixture/derived view-model cục bộ.
Chưa được import `@motionvideo/editor-core`, store V1, hooks V1 hoặc command mutation.
Mọi nút/gesture chưa có logic phải ở trạng thái preview/disabled có giải thích rõ.

#### Ranh giới layout

```text
Header: toàn chiều rộng
┌─────────────┬──────────────────────────┬──────────────┐
│ Sidebar     │ Stage                    │ Inspector    │
│ span 2 rows ├──────────────────────────┤ span 2 rows  │
│             │ Timeline UI              │              │
└─────────────┴──────────────────────────┴──────────────┘
```

- [ ] **V2-TL-UI-01 — Grid placement:** timeline là grid item cột giữa, hàng dưới;
  sidebar/inspector span hai hàng; tất cả panel gap `6px`.
- [ ] **V2-TL-UI-02 — Panel chrome:** timeline có border, background, radius, header
  divider và overflow riêng; không làm stage/inspector thay đổi chiều cao ngoài ý muốn.
- [ ] **V2-TL-UI-03 — Height behavior:** timeline có chiều cao tối thiểu/tối đa rõ ràng,
  stage co giãn theo viewport; không tạo scroll toàn trang khi timeline scroll.
- [ ] **V2-TL-UI-04 — Narrow viewport:** định nghĩa breakpoint khi không đủ 3 cột:
  sidebar/inspector thu gọn hoặc chuyển thành drawer; không để clip bị cắt ngoài màn hình.

#### Transport bar và ruler

- [ ] **V2-TL-UI-05 — Transport shell:** dựng vùng trái/giữa/phải giống V1:
  mode/scope, timecode + play, actions/zoom; button chỉ là UI stub ở giai đoạn này.
- [ ] **V2-TL-UI-06 — Playback affordances:** play/pause/seek hiện trạng thái hover,
  focus, disabled và active; nếu chưa nối clock thì hiển thị tooltip “Preview only”.
- [ ] **V2-TL-UI-07 — Timecode:** hiển thị current time, duration, frame và FPS theo
  fixture V2; dùng monospace/tabular numbers, không hard-code `30fps` trong component.
- [ ] **V2-TL-UI-08 — Zoom controls:** slider, zoom in/out và reset có visual state;
  chỉ thay đổi local UI state, chưa thay đổi layout model trong editor-core.
- [ ] **V2-TL-UI-09 — Ruler:** dựng major/minor ticks, labels, start/end bounds,
  playhead marker và vùng click seek dạng visual; ruler phải đồng bộ cùng một scale.

#### Track/lane surface

- [ ] **V2-TL-UI-10 — Fixture view-model:** tạo mapper cục bộ từ `project.layers[]` sang
  `{ id, label, type, start, duration, order, color }`; không tạo `TimelineClip`/`TimelineLane`.
- [ ] **V2-TL-UI-11 — Row labels:** hiển thị layer name/id, type glyph, visibility/lock
  affordances và selected/hover/focus states.
- [ ] **V2-TL-UI-12 — Clip geometry:** render clip theo start/duration trên cùng một
  pixels-per-second scale; clip ngoài viewport được cắt bằng overflow, không tính virtual list.
- [ ] **V2-TL-UI-13 — Clip styling:** shape/image/text/video có màu/stripe/icon khác nhau;
  chọn màu phải dùng token CSS và đủ contrast.
- [ ] **V2-TL-UI-14 — Empty/loading/error:** có empty timeline, loading skeleton và
  invalid-document diagnostic state; không để vùng trống không giải thích.
- [ ] **V2-TL-UI-15 — Playhead:** đường playhead kéo dài qua ruler và rows, có handle rõ,
  z-index cao hơn clip nhưng không che label; vị trí chỉ derive từ preview time.
- [ ] **V2-TL-UI-16 — Scrollbars:** horizontal scroll cho canvas timeline, vertical scroll
  cho rows khi cần; ruler/labels giữ đúng alignment trong lúc scroll ngang.

#### Interaction affordances (chưa commit dữ liệu)

- [ ] **V2-TL-UI-17 — Hover/select:** hover clip/row, selected clip/row và multi-select
  visual state; click chỉ cập nhật local demo selection.
- [ ] **V2-TL-UI-18 — Drag preview:** drag clip hiển thị ghost/float/insert guide, nhưng
  thả ra không mutate Protocol; hiển thị “interaction preview only”.
- [ ] **V2-TL-UI-19 — Trim preview:** tay nắm trái/phải, cursor resize và duration tooltip;
  chưa gọi command hoặc editor-core.
- [ ] **V2-TL-UI-20 — Marquee preview:** vẽ selection rectangle và highlight rows/clips;
  Escape/Click empty clear local selection.
- [ ] **V2-TL-UI-21 — Keyboard affordances:** hiển thị focus ring và shortcut hint cho
  Space, Home/End, +/-; chỉ bật hành vi không phá document (hoặc để disabled).

#### Component boundary và tài liệu

- [x] **V2-TL-UI-22 — Component split:** tách `TimelineShellV2`, `TimelineTransportV2`,
  `TimelineRulerV2`, `TimelineViewportV2`, `TimelineClipV2` trong
  `components/editor/timeline/v2/`.
- [ ] **V2-TL-UI-23 — Local types:** đặt props/view-model trong `lib/v2-editor/timeline/`
  hoặc ngay namespace V2; không import type từ `@motionvideo/editor-core`.
- [ ] **V2-TL-UI-24 — Design tokens:** bổ sung token cho lane height, ruler, playhead,
  clip colors, selected/hover/ghost/snap guide; không copy CSS selector V1.
- [ ] **V2-TL-UI-25 — Accessibility:** button/input có accessible name, keyboard focus,
  `aria-valuetext` cho ruler/zoom và không dùng màu làm tín hiệu duy nhất.
- [ ] **V2-TL-UI-26 — Screenshot fixtures:** tạo fixture shape/overlap/timing-gap và
  screenshot baseline ở desktop + narrow viewport để nghiệm thu visual.

#### Không làm trong Giai đoạn 1.5

- Không serialize lane/clip/selection/zoom/playhead vào Protocol V2.
- Không gọi `executeTimelineCommand`, `TimelineClip`, `TimelineLane` hoặc bất kỳ hook
  nào dưới `apps/web/hooks/editor`.
- Không thêm drag/drop thật, trim thật, snap thật, undo/redo hoặc persistence.
- Không thay đổi semantics của Runtime/Compiler/Preview để phục vụ UI.

#### Tiêu chí nghiệm thu Giai đoạn 1.5

- [ ] Nhìn đúng layout 5 vùng: header + sidebar + stage + timeline + inspector.
- [ ] Timeline nằm trong grid cột giữa, bên dưới stage; sidebar/inspector span hai hàng.
- [ ] Có transport, ruler, playhead, rows, clips, scrollbars và các visual states chính.
- [ ] Có thể demo hover/select/drag-preview/trim-preview mà không thay đổi JSON V2.
- [ ] Không có import editor-core/V1 trong namespace timeline V2.
- [ ] Typecheck, lint, component tests và screenshot baseline pass.

**Người nghiệm thu:** ____________________  **Ngày:** __________  **Kết quả:** ☐ Đạt ☐ Cần sửa

**Ghi chú nghiệm thu:**

<!-- Ghi rõ task visual còn thiếu, screenshot hoặc issue liên quan tại đây. -->

### Giai đoạn 2 — Document commands và UI chỉnh sửa được

Mục tiêu của giai đoạn này là biến vertical slice read-only thành editor có thể chỉnh sửa
shape/timing/transform, trong khi `MotionProtocolV2` vẫn là nguồn dữ liệu duy nhất.

#### 2A. Document command layer

- [ ] **V2-2.1 — Command contract:** định nghĩa `EditorCommand`, `CommandResult` và
  `Diagnostic`; command lỗi không được commit partial state.
- [ ] **V2-2.2 — Immutable update:** thêm helper clone/patch an toàn cho composition,
  layer và nested payload; không mutate object đang được React/Zustand giữ.
- [ ] **V2-2.3 — Layer identity:** kiểm tra ID hợp lệ, ID duy nhất, parent hợp lệ và
  không tạo cycle; duplicate layer phải sinh ID mới deterministic.
- [ ] **V2-2.4 — Add layer:** thêm rectangle/ellipse shape từ capability manifest với
  frame, transform, timing, style và `zIndex` mặc định hợp lệ.
- [ ] **V2-2.5 — Remove layer:** xóa layer và xử lý rõ quan hệ parent/child; không để
  `parentLayerId` trỏ tới layer đã xóa.
- [ ] **V2-2.6 — Duplicate layer:** duplicate một layer, remap ID và giữ thứ tự/z-index
  deterministic.
- [ ] **V2-2.7 — Patch layer:** chỉnh `frame`, `opacity`, `zIndex`, `timing`,
  `transform`, fill/stroke/corner radius của shape.
- [ ] **V2-2.8 — Validation pipeline:** sau mỗi command chạy schema validation rồi
  `compileProtocolV2`; nếu fail thì giữ nguyên document trước command và trả diagnostic.

#### 2B. History và session state

- [ ] **V2-2.9 — History stack:** lưu document snapshot/patch trước-sau cho undo/redo;
  history không chứa runtime frame, GPU resource hoặc timeline rows.
- [ ] **V2-2.10 — Undo/redo UI:** thêm nút và keyboard shortcut; undo/redo phải render
  lại đúng frame hiện tại.
- [ ] **V2-2.11 — Selection state:** chọn một/nhiều layer, clear selection, selected
  layer không được serialize vào Protocol JSON.
- [ ] **V2-2.12 — Project reset:** đổi/reload project phải reset selection, history,
  diagnostics và playback session theo project mới.

#### 2C. Layer tree và inspector

- [ ] **V2-2.13 — Layer tree derive:** hiển thị hierarchy từ `parentLayerId`, stable
  order theo `zIndex`/ID; group chưa được phép chỉnh nếu chưa certified.
- [ ] **V2-2.14 — Layer selection:** click layer tree chọn layer và đồng bộ với stage.
- [ ] **V2-2.15 — Inspector shape:** hiển thị control cho rectangle/ellipse và disable
  field chưa được capability manifest chứng nhận.
- [ ] **V2-2.16 — Numeric constraints:** clamp/validate kích thước, opacity, timing,
  rotation, scale và z-index theo giới hạn Protocol V2.
- [ ] **V2-2.17 — Inspector commit:** input chỉ commit qua command adapter; không ghi
  thẳng JSON từ component.

#### 2D. Timeline và stage interaction

- [ ] **V2-2.18 — Timeline rows:** derive một row/layer từ timing V2, hiển thị start,
  duration, current frame và z-order; không dùng `TimelineClip`/`TimelineLane` V1.
- [ ] **V2-2.19 — Timeline selection:** click row chọn layer; playhead dùng cùng clock
  với preview stage.
- [ ] **V2-2.20 — Move clip:** kéo layer trên timeline để thay `timing.start`, snap
  theo frame và validate duration không âm.
- [ ] **V2-2.21 — Trim clip:** resize đầu/cuối để chỉnh start/duration qua command.
- [ ] **V2-2.22 — Stage hit test:** hit test theo Runtime V2/paint metadata hoặc geometry
  được chứng nhận; không tự tính CSS/2D matrix trong UI.
- [ ] **V2-2.23 — Stage transform:** drag/scale/rotate layer tạo semantic transform
  command, không ghi Matrix4 vào document.

#### 2E. Test và nghiệm thu Giai đoạn 2

- [ ] **V2-2.24 — Command unit tests:** add/remove/duplicate/patch, validation failure,
  ID/parent/z-index/timing invariants.
- [ ] **V2-2.25 — History tests:** undo/redo liên tiếp, redo bị clear sau command mới,
  đổi project reset history.
- [ ] **V2-2.26 — UI tests:** inspector, layer tree, timeline và stage selection đồng bộ.
- [ ] **V2-2.27 — Browser smoke:** mở shape editor, chọn layer, sửa fill/transform/timing,
  undo/redo và kiểm tra preview thay đổi.
- [ ] **V2-2.28 — JSON invariant check:** sau mỗi thao tác, JSON panel vẫn parse được
  bằng `MotionProtocolV2Schema` và không chứa runtime/session fields.
- [ ] **V2-2.29 — Boundary check:** `validate:v2-consumers` không phát hiện import từ
  `apps/web/components/editor`, `hooks/editor` hoặc `lib/editor`.

#### Tiêu chí nghiệm thu cuối Giai đoạn 2

- [ ] Có thể thêm, chọn, duplicate, chỉnh sửa và xóa shape trong cùng một editor.
- [ ] Có thể chỉnh timing bằng timeline và thấy preview cập nhật theo frame.
- [ ] Có thể chỉnh transform/style bằng inspector hoặc stage gesture.
- [ ] Undo/redo hoạt động cho toàn bộ command đã triển khai.
- [ ] Command lỗi không làm mất document hợp lệ trước đó.
- [ ] Mọi thay đổi đều sinh `MotionProtocolV2` hợp lệ; không có V1 import hoặc Matrix4
  trong persisted/editor state.
- [ ] Unit, component, smoke E2E và các V2 boundary validators đều pass.

**Người nghiệm thu:** ____________________  **Ngày:** __________  **Kết quả:** ☐ Đạt ☐ Cần sửa

**Ghi chú nghiệm thu:**

<!-- Ghi rõ task còn thiếu, lỗi hoặc commit liên quan tại đây. -->

### Giai đoạn 3 — Project repository và autosave

1. Thay fixture-only lookup bằng `V2ProjectRepository` có adapter local trước (IndexedDB
   hoặc storage hiện được phê duyệt); fixture `shape`/`overlap` vẫn làm seed sample.
2. `create` sinh document mặc định V2 hợp lệ với explicit `composition.view`, deterministic
   ID và revision `0`.
3. `load` reject non-V2/invalid document có thông báo recovery; không chạy migration ngầm.
4. Autosave debounce theo revision, chống ghi đè bằng compare-and-swap revision và báo
   conflict rõ ràng.
5. Workspace thay hai link cố định bằng list project V2, create/open/rename/delete
   theo quyền của repository.
6. Chỉ khi có owner persistence backend được xác định mới thêm API/server persistence;
   payload và storage phải là `MotionProtocolV2` đã validate.

**Hoàn thành khi:** reload vẫn giữ project V2 đã chỉnh sửa, không xuất hiện cấu trúc
timeline/selection/runtime trong JSON persisted, và invalid data không làm crash workspace.

### Giai đoạn 4 — Mở rộng certified surface

1. Dẫn capability manifest vào library/toolbar; chỉ liệt kê type đã certified.
2. Bổ sung từng vertical slice riêng cho image, video, text, path, group, effects và
   mask: repository asset -> editor command -> inspector/timeline -> preview -> export
   parity test.
3. Text luôn chạy qua `prepareRuntimeProjectV2Text`/HarfBuzz loader chung trước preview;
   UI không tự layout glyph.
4. Nhóm, effect và mask dùng command/boundary đã chứng nhận; không flatten bằng CSS/canvas
   hay tự tính transform trong UI.
5. Mỗi slice bổ sung fixture deterministic và negative tests cho capability không hỗ trợ.

**Hoàn thành khi:** mọi control nhìn thấy trong editor có test chứng minh JSON hợp lệ,
preview render được, và export có cùng nghĩa runtime.

### Giai đoạn 5 — Export, chất lượng và cutover

1. Sửa export client để gửi chính document/revision V2 được lưu, thay vì chỉ gửi
   `projectId` và revision hard-code `0`; server validates ownership, revision và schema.
2. Theo dõi render job, lỗi preflight và artifact download trong V2 editor.
3. Bổ sung Playwright flows: create -> edit -> autosave -> reload -> preview -> export
   request; mock server chỉ ở test boundary.
4. Chạy pixel parity cho các fixture editor-backed quan trọng qua WebGPU/WebGL2 và
   Remotion. Chỉ accept tolerance đã ghi rõ.
5. Khi V2 đạt feature parity yêu cầu sản phẩm, redirect/cutover các route cũ. Sau một
   release ổn định và có migration tool độc lập (nếu cần), lập ticket riêng để xóa V1.

**Hoàn thành khi:** export từ editor sử dụng đúng revision đã xem trước và toàn bộ V2
quality gates xanh.

## 6. Kiểm thử và quality gates

| Lớp | Bằng chứng bắt buộc |
| --- | --- |
| Document/commands | Unit test schema validity, immutable change, undo/redo, ID/parent/timing/zIndex invariants, unsupported capability fail-closed. |
| Derived UI | Unit test tree/timeline derive không trở thành persisted state; selection và playback không mutate JSON. |
| Preview | Component test compile/evaluate lifecycle, canvas resize, WebGPU fallback WebGL2 và diagnostic errors. |
| Browser | Playwright cho `/app`, `/app/editor/shape`, overlap, edit/reload, keyboard/gesture core và accessibility controls. |
| Render parity | Fixture V2 dùng chung với preview lab, `pnpm e2e:v2-remotion-parity`. |
| Boundary | `pnpm validate:v2-boundary`, `pnpm validate:v2-runtime-boundary`, `pnpm validate:v2-consumers`, `pnpm validate:v2-renderers`, `pnpm validate:v2-core`, `pnpm validate:v2-hard-lock`. |
| Type/test | `pnpm typecheck:v2` và `pnpm test:app`; chạy full relevant workspace tests trước cutover. |

## 7. Rủi ro và quyết định cần chốt

| Rủi ro | Cách xử lý |
| --- | --- |
| Copy UI/logic V1 nhanh nhưng phá boundary | Không import legacy; port behavior qua pure V2 commands/derived selectors, có test boundary. |
| UI expose feature renderer chưa certified | Toolbar/inspector luôn capability-driven và fail-closed. |
| Preview khác export | Cả hai dùng Compiler B/Runtime V2; yêu cầu parity fixture trước khi expose feature. |
| Persist project đang edit bị corrupt | Parse/validate lúc load và trước save, versioned revision, giữ last-valid snapshot. |
| Scope V2 quá rộng | Ship theo vertical slice, bắt đầu shape + overlap; atom sau chỉ vào editor khi end-to-end certified. |

Trước Giai đoạn 3/5, cần xác nhận hai quyết định sản phẩm: nơi lưu project chính thức
(local-only hay backend) và quyền tạo/export project. Chúng thay đổi repository/API nhưng
không thay đổi protocol hay renderer boundary.

## 8. Thứ tự thực hiện đề xuất

1. Giai đoạn 0 và 1: khôi phục route editor bằng V2 preview/transport read-only.
2. Giai đoạn 2: shape editing + timeline/inspector/stage interaction + history.
3. Giai đoạn 3: project lifecycle và autosave.
4. Giai đoạn 4: thêm capability được chứng nhận từng atom một.
5. Giai đoạn 5: export flow, parity, cutover và sau đó mới cân nhắc xóa V1.

Task tiếp theo là nối command/history vào session state đã có, sau khi read-only stage và
timeline đã ổn định trong `EditorShell` dùng chung.
