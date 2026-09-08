# Kế hoạch cô lập Web Editor

## Mục tiêu

Biến `apps/web` thành lớp host/adapter/view của editor:

- nhận input từ DOM và chuyển thành input thuần;
- gọi command/API của các package chuyên trách;
- quản lý lifecycle của React, DOM, media element và resource browser;
- hiển thị state, diagnostics, `RuntimeFrameV3` và pixels từ Skia.

Web editor không được tự sở hữu domain logic, runtime evaluation, transport clock,
project duration hoặc mutation trực tiếp trên `MotionProtocolV2`.

## Trạng thái triển khai

- Phase 0 — hoàn tất: đã thêm architecture guard cho compiler/runtime/playback/
  renderer execution trong editor UI và browser hooks.
- Phase 1 — hoàn tất phần command/history boundary: batch command, inverse
  transaction, history entry, coalescing và history memory policy đã chuyển vào
  `editor-core`.
- Phase 2 — đã triển khai phần stage/playhead cốt lõi: V2 geometry,
  hit-test, move/resize/rotate patch và keyframe-aware patch đã chuyển vào
  `editor-core`; sampling dùng canonical compiler sampler qua runtime adapter.
- Phase 3 — đã triển khai runtime session: thêm
  `packages/editor-runtime`, cache compile theo document identity/generation và
  playback controller không còn import compiler/evaluator trực tiếp.
- Phase 4 — hoàn tất editor renderer boundary: thêm `EditorStageRenderer`; editor
  nhận runtime snapshot từ `editor-runtime`, paint theo frame authoritative từ
  playback, không chạy end-sampling/direct evaluate trong editor path. `PreviewStage`
  chỉ chuẩn bị resource/text cho Skia rồi publish runtime đã chuẩn bị ngược về
  playback session. Direct docs preview vẫn giữ nguyên.
- Phase 5 — hoàn tất transient stage preview: stage dùng patch từ `editor-core`,
  runtime session tạo/evaluate transient project, playback phát frame preview;
  không còn sửa matrix `RuntimeFrameV3` trong web.
- Phase 6 — hoàn tất duration/ended boundary: editor transport đọc duration,
  current time và ended từ playback snapshot/store; timeline projection không còn
  là nguồn duration playback thứ hai.
- Phase 7 — hoàn tất web adapter cleanup: library command construction và
  `LibraryPayload` đã chuyển vào `editor-core`; web chỉ giữ DOM drag/drop,
  resource/API bridge và React state adapter. Architecture guard đã bao phủ cả
  `lib/editor`.

## Phạm vi

### Trong phạm vi phase này

- Chỉ cô lập editor chính dưới `apps/web/components/editor`, `apps/web/hooks/editor`
  và `apps/web/lib/editor`.
- Chuẩn hóa một luồng editor từ input, command, runtime, playback đến Skia.
- Tách editor path khỏi các direct runtime path đang nằm trong component dùng chung.

### Ngoài phạm vi phase này

- `apps/web/components/docs/**` và `apps/web/lib/docs/**`.
- Direct preview, debug lab, fixture lab và transport riêng của docs.
- Việc refactor `docs/preview/skia`.

Các phần docs sẽ được xử lý trong một phase riêng sau khi editor canonical path
đã ổn định. Trong phase này chỉ cần bảo đảm thay đổi cho editor không phá vỡ docs.

## Luồng canonical duy nhất

```text
DOM event
  -> Web adapter chuyển thành input thô
  -> editor-core tạo interaction intent / EditorCommand
  -> editor-core commit document và tạo inverse command
  -> motion-compiler compile Protocol V2 thành RuntimeProjectV3
  -> motion-runtime validate/evaluate runtime
  -> playback-engine sở hữu clock, seek, ended và scheduling
  -> Web nhận RuntimeFrameV3 + transport snapshot
  -> skia-renderer vẽ frame
  -> React hiển thị UI/state
```

## Ownership contract

| Thành phần | Sở hữu | Không được sở hữu |
| --- | --- | --- |
| `editor-core` | Document command, inverse command, transaction, history policy, selection, timeline/stage geometry, interaction intent, draft preview | React, DOM, runtime evaluation, media element, renderer, transport clock |
| `motion-compiler` | Lowering Protocol V2 thành `RuntimeProjectV3` | UI command, selection, DOM, playback state |
| `motion-runtime` | Runtime validation, frame evaluation, transform runtime, text layout, media plans, canonical duration | Authoring mutation, undo/redo, pointer gesture, React, browser lifecycle |
| `playback-engine` | Clock, play/pause/seek, rate, ended, readiness, scheduling, backend delivery | Document editing, compiler policy, timeline layout, pixels |
| `skia-renderer` | Paint `RuntimeFrameV3` thành pixels | Timeline, document mutation, transport, runtime evaluation |
| `apps/web` | React UI, DOM bridge, API/persistence bridge, resource lifecycle, renderer adapter, diagnostics display | Reimplementing command, runtime, duration, ended, evaluator hoặc transport semantics |

## Hiện trạng và điểm cần xử lý

### 1. Editor stage đang trộn hai vai trò

[`apps/web/components/preview/PreviewStage.tsx`](../../apps/web/components/preview/PreviewStage.tsx)
đang vừa:

- compile Protocol V2;
- evaluate runtime frame;
- prepare text và media resource;
- chạy direct preview;
- nhận frame từ playback;
- tạo renderer và paint frame.

Trong editor, [`playback-controller-v3.ts`](../../apps/web/lib/editor/playback/playback-controller-v3.ts)
đã compile và evaluate runtime. Vì vậy `PreviewStage` có nguy cơ compile/evaluate
lần hai và tạo hai runtime snapshot cho cùng một document.

### 2. Editor path còn có logic runtime-like

Các phần cần loại khỏi editor path:

- `previewSampleTimeAtEnd()` tự tính thời điểm cuối từ layer;
- direct `evaluateRuntimeProjectV3()` trong `paintFrame()`;
- direct `compileProtocolAtTime()` cho editor frame;
- tính project duration từ layer/audio trong UI;
- tự chạy `requestAnimationFrame` để làm transport;
- `applyStagePreviewOverrides()` sửa matrix của `RuntimeFrameV3` sau runtime evaluation.

### 3. Web editor có stage geometry riêng

`apps/web/lib/editor/stage/transform.ts` tính world quad, bounds và hit testing.
Đây là editor overlay logic, không phải runtime renderer logic, nhưng có nguy cơ
drift với transform semantics của runtime. Phần thuần này nên được đưa về
`editor-core` hoặc có contract test chung với runtime.

### 4. Text measurement là adapter hợp lệ

`apps/web/lib/editor/text/measurement.ts` có thể gọi compiler/runtime để dùng
font browser và HarfBuzz. Web chỉ cung cấp resource loader; text shaping và
measurement semantics vẫn thuộc runtime.

## Các nguyên tắc bất biến

1. Mọi mutation của `MotionProtocolV2` đi qua `editor-core`.
2. Web không tự tạo patch document từ pointer/keyboard/timeline gesture.
3. Web không tự tính project duration cho playback.
4. Web không tự quyết định `ended`.
5. Web không tự chạy transport clock.
6. Một document generation chỉ được compile một lần trong editor runtime session.
7. Một playback tick chỉ phát ra một authoritative `RuntimeFrameV3`.
8. Editor stage chỉ paint frame được cung cấp từ runtime/playback.
9. UI có thể tính layout CSS và đọc DOM metrics, nhưng không được biến chúng
   thành domain decision ngoài package chuyên trách.

## Kế hoạch triển khai

### Phase 0 — Đóng contract và thêm architecture guard

**Công việc**

- Tạo architecture test cho editor path.
- Cấm `evaluateRuntimeProjectV3` trong `components/editor`, `hooks/editor`,
  `lib/editor` ngoại trừ adapter runtime được chỉ định.
- Cấm `compileProtocolAtTime` trong editor UI.
- Cấm tính project duration/ended trong editor UI.
- Cấm direct document mutation ngoài `editor-core`.

**Tiêu chí hoàn thành**

- Guard fail nếu editor UI tạo runtime frame hoặc transport riêng.
- Các đường docs hiện tại không bị thay đổi trong phase này.

### Phase 1 — Gom document command và history

**Công việc**

- Đưa transaction nhiều command vào `editor-core`.
- Đưa inverse transaction và history policy vào `editor-core`.
- Đưa remove subtree, selection-before/after và command labeling khỏi
  `EditorProviders`.
- Chuẩn hóa API dạng `dispatch(intent)`, `undo()` và `redo()`.

**Kết quả mong muốn**

```text
Web event
  -> editor-core intent
  -> editor-core transaction
  -> document + inverse
  -> Web chỉ cập nhật view/persistence
```

**Tiêu chí hoàn thành**

- Web không còn tự loop `applyEditorCommand` để ghép transaction.
- Undo/redo không chứa domain decision trong React component.
- Test command/history nằm ở `editor-core`.

### Phase 2 — Đưa interaction logic ra khỏi Web

**Công việc**

Di chuyển hoặc hợp nhất các phần thuần sau vào `editor-core`:

- stage world quad, bounds và hit testing;
- move/resize/rotate patch;
- keyboard selection policy;
- timeline move/trim/marquee/seek;
- library drop placement;
- viewport/coordinate conversion có tính domain;
- draft preview và commit command.

Web chỉ truyền input thô:

```ts
{
  pointerId,
  clientX,
  clientY,
  modifiers,
  viewportMetrics,
}
```

`editor-core` trả về preview, intent, command hoặc diagnostics.

**Tiêu chí hoàn thành**

- Stage geometry, hit-test, move/resize/rotate patch và keyframe patch không còn
  bản cài đặt riêng trong web.
- Component chỉ bind event, gọi core và render kết quả.
- Pure stage interaction test đã chuyển về `packages/editor-core/test`.

Keyboard selection, alignment/anchor policy và library command construction
còn là phần cleanup tiếp theo của Phase 2; timeline policies đã có owner
trong `editor-core` nhưng các hook DOM vẫn giữ vai trò host.

### Phase 3 — Tạo runtime session canonical

**Công việc**

Tạo một adapter runtime độc lập với React/DOM, ưu tiên package mới:

```text
packages/editor-runtime/
```

Adapter này sở hữu:

- document generation;
- compile cache;
- runtime project snapshot;
- runtime validation;
- kết nối `RuntimeProjectV3` với `playback-engine`;
- frame/time/diagnostics event.

`playback-engine` vẫn chỉ nhận `RuntimeProjectV3`; adapter không đưa compiler vào
playback-engine.

**Tiêu chí hoàn thành**

- `loadDocument()` compile một lần cho mỗi generation.
- Playback luôn đọc duration từ `RuntimeProjectV3.durationUs`.
- Web controller không trực tiếp import compiler/evaluator; session là owner của
  compile/evaluate orchestration.

### Phase 4 — Tách editor renderer khỏi direct preview

**Công việc**

Tách `PreviewStage` thành hai boundary:

```text
EditorStageRenderer
  nhận RuntimeFrameV3 + resources
  gọi skia-renderer.paintFrame()
```

Trong phase này chỉ refactor editor mode. Direct preview mode của component được
giữ nguyên để xử lý ở phase docs sau.

`EditorStageRenderer` không được chứa:

- `compileProtocol`;
- `compileProtocolAtTime`;
- `evaluateRuntimeProjectV3`;
- project duration calculation;
- transport RAF;
- end-of-project sampling policy.

**Tiêu chí hoàn thành**

- Editor stage chỉ vẽ frame do playback phát ra.
- Editor frame paint không còn end-sampling/direct evaluate; direct docs path không
  bị đổi.
- Chuẩn hóa `EditorStageRenderer` là boundary tiếp nhận playback frame.
- Resource/text preparation trong shared host chỉ là browser adapter; runtime
  snapshot và frame authoritative vẫn do `editor-runtime`/playback cung cấp.

### Phase 5 — Chuẩn hóa transient stage preview

**Công việc**

Đã thay `applyStagePreviewOverrides()` trong web bằng draft contract:

```text
pointer move
  -> editor-core draft command
  -> compiler/runtime evaluate draft
  -> playback/preview nhận frame
```

Preview transform không commit vào document chính cho tới khi gesture kết thúc,
nhưng cũng không được sửa matrix runtime trực tiếp trong UI sau khi evaluate.

**Tiêu chí hoàn thành**

- Web không sửa `RuntimeFrameV3`; `PreviewStage` chỉ paint frame từ playback.
- `StageTransformOverlay` dùng patch từ `editor-core`, tạo transient document và
  gửi qua `editor-runtime`/playback để compile/evaluate.
- Preview và commit dùng cùng một transform semantics.
- Playback giữ transient runtime riêng, không thay đổi document/history/duration
  canonical trong lúc gesture.
- Không có khác biệt giữa frame preview và frame sau commit ngoài thời điểm commit.

### Phase 6 — Thu hồi duration và ended về runtime/playback

**Công việc**

- Xóa duration calculation khỏi editor preview path.
- Xóa end sampling dựa riêng trên `project.layers` trong editor path.
- Web đọc `durationUs` từ playback snapshot.
- Web đọc `ended` từ playback state.
- Phân biệt rõ metadata duration, source duration và playback duration.

**Tiêu chí hoàn thành**

```text
duration = playback.snapshot().durationUs
ended = playback.snapshot().state === "ended"
currentTime = playback.snapshot().timeUs
```

Không còn nguồn duration thứ hai cho editor transport.

Phase 6 đã hoàn tất cho editor transport: `TimelineShell` đọc duration từ
transport snapshot; projection chỉ còn cung cấp clip/lane geometry và authored
extent phục vụ layout. `ended` và `currentTime` tiếp tục chỉ đến từ playback
event/store. Các duration dùng trong inspector/clip authoring vẫn là metadata của
layer/asset, không phải playback duration.

### Phase 7 — Thu gọn Web thành adapter/view layer

**Công việc**

- `components/editor`: chỉ render UI.
- `hooks/editor`: bind DOM event và subscribe state.
- `lib/editor`: chỉ giữ adapter, API, browser resource và integration boundary.
- Xóa code duplicate sau khi các package mới đã nhận ownership.
- Chuyển pure tests về package tương ứng.
- Giữ integration/E2E tests ở web.

**Tiêu chí hoàn thành**

- Web không có domain mutation logic.
- Web không có runtime evaluator.
- Web không có transport clock.
- Web không tính project duration.
- Web nhận state từ package và hiển thị state.

Phase 7 đã hoàn tất phần trong phạm vi editor: pure library command test nằm ở
`packages/editor-core/test`, còn web library code chỉ xử lý pointer/window/DOM
drop host và gọi command API. Các adapter được phép gọi browser/runtime package
được đặt tên rõ trong architecture guard; compiler/evaluator/playback execution
không được lọt vào UI/browser helper ngoài adapter đó.

## Phân loại test sau refactor

| Loại test | Vị trí |
| --- | --- |
| Editor command, inverse, transaction | `packages/editor-core/test` |
| Timeline/stage interaction | `packages/editor-core/test` |
| Runtime duration/evaluation/media plan | `packages/motion-runtime/test` hoặc `src/**/*.test.ts` hiện tại |
| Compiler lowering | `packages/motion-compiler/test` hoặc test hiện tại |
| Playback clock/ended/backend | `packages/playback-engine/test` |
| Skia paint/resource contract | `packages/skia-renderer/test` |
| Runtime session integration | package runtime-session mới |
| React adapter và DOM wiring | `apps/web/lib/editor/**/__tests__`, integration test |
| Browser E2E | `apps/web/e2e` |

Docs/debug tests không thuộc phạm vi di chuyển trong kế hoạch này và sẽ được
đánh giá ở kế hoạch docs riêng.

## Definition of Done

- Editor có một luồng duy nhất từ command đến runtime frame.
- Không có duplicate compile/evaluate trong editor.
- Không có duplicate duration/ended calculation trong editor.
- Không có duplicate transport clock.
- `PreviewStage` editor chỉ làm renderer/resource host.
- Web chỉ làm bridge giữa DOM/API/package và hiển thị state.
- Architecture guards và integration tests chứng minh boundary.

Các docs preview hiện tại vẫn giữ nguyên hành vi; việc cô lập chúng là phase tiếp theo.
