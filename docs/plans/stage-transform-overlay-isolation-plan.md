# StageTransformOverlay Isolation Plan

## Implementation status

Phases 0-8 da trien khai. `StageTransformOverlay.tsx` chi con ghep hook va view; gesture lifecycle o `use-stage-transform.ts`, hitbox/handles o cac view component rieng, command/keyframe/text-resize policy o `editor-core`, runtime query o adapter, va `stageInteractionStore` khong con transform override.

Stage UI tools now follow the canonical namespace: `selection`, `transform`, `text`, `shape`, and `shared`; renderer and tool layer remain at the stage root.

Regression coverage da bo sung cho static/group transform, keyframe transform, text resize policy va architecture boundary. Test editor tong the con hai loi docs doc lap voi stage: `DocsOverview.tsx` khong parse duoc trong `docs-v2.test.ts`, va `preview-lab.test.ts` dang ky vong 10 fixture Phase 6 trong khi du lieu co 11 fixture.

## Mục tiêu

Thu gọn `apps/web/components/editor/stage/StageTransformOverlay.tsx` thành
DOM/view adapter của stage editor.

Component cuối cùng chỉ nên:

- nhận state đã chuẩn hóa;
- chuyển pointer/keyboard event thành input thuần;
- gọi stage interaction API;
- hiển thị selection bounds, handles và snap guides;
- gửi `EditorCommand` đã được tạo bởi package chuyên trách.

Component không nên tự sở hữu:

- runtime sampling;
- keyframe semantics;
- transform commit semantics;
- text resize policy;
- document mutation;
- runtime frame preview state.

## Trạng thái triển khai

- Phase 0 — hoàn tất: đã thêm architecture guard cho stage overlay, kiểm tra
  editor stage dùng frame từ playback và đưa runtime sampling hiện tại qua
  named adapter `apps/web/lib/editor/stage/runtime-query.ts`.
- Phase 1–8 — chưa triển khai.

## Luồng đích

```text
DOM pointer event
  -> web stage adapter
  -> editor-core stage session
  -> editor-core preview/commit resolver
  -> EditorCommand
  -> EditorProviders dispatch
  -> editor-runtime transient preview
  -> playback-engine
  -> RuntimeFrameV3
  -> Skia renderer
```

Overlay bounds và snap guides chỉ là interaction chrome. Chúng không được
sửa `RuntimeFrameV3` và không được trở thành nguồn preview thứ hai của stage.

## Ownership contract

| Trách nhiệm | Owner mới |
| --- | --- |
| Pointer capture, DOM event, CSS, JSX | `apps/web/components/editor/stage` |
| Client/composition coordinate conversion | `editor-core` |
| Move/resize/rotate session | `editor-core` |
| Snapping và constraints | `editor-core` |
| World bounds, hit-test, selection box | `editor-core` |
| Keyframe-aware transform patch | `editor-core` |
| Text resize command policy | `editor-core` |
| Browser font/text measurement | Web text adapter |
| Runtime sampling | `editor-runtime` adapter |
| Clock, duration, ended, authoritative frame | `playback-engine` |
| Preview frame paint | `EditorStageRenderer` + Skia |
| History/document mutation | `editor-core` + provider bridge |

## Phase 0 — Đóng baseline và guard

### Công việc

- Chụp behavior hiện tại của move, group move, resize, rotate, text resize,
  keyframe edit, snap và cancel.
- Thêm architecture test cho `StageTransformOverlay`:
  - không import trực tiếp `@motionvideo/editor-runtime` value API;
  - không tự gọi compiler/evaluator;
  - không tự sửa `RuntimeFrameV3`;
  - không tạo history/document store.
- Thêm test đảm bảo `EditorStageRenderer` nhận frame từ playback khi editor mode.
- Ghi rõ `stageInteractionStore` chỉ được phép chứa overlay guides/commit handoff.

### Tiêu chí hoàn tất

- Có test regression cho cả ba gesture move/resize/rotate.
- Có test phân biệt preview transient và document canonical.
- Guard fail nếu component quay lại runtime sampling hoặc frame mutation.

## Phase 1 — Chuẩn hóa input/output của stage interaction

### Công việc

Chuẩn hóa web adapter thành input thuần:

```ts
type StagePointerInput = {
  pointerId: number;
  clientX: number;
  clientY: number;
  modifiers: PointerModifiers;
  viewport: StageViewportMetrics;
};
```

Mở rộng `editor-core` stage session để trả về một kết quả nhất quán:

```ts
type StageInteractionResult = {
  preview: StagePreview;
  guides: readonly StageGuide[];
  command: EditorCommand | null;
  diagnostics: readonly EditorDiagnostic[];
};
```

Web không tự tính lại delta sau khi `session.commit()`.

### Tiêu chí hoàn tất

- `StageTransformOverlay` không dựng lại commit patch từ `preview`.
- `StageCommitResult.command` hoặc API tương đương là nguồn command duy nhất.
- Preview và commit dùng cùng transform semantics.

## Phase 2 — Đưa keyframe semantics về editor-core

### Công việc

Bổ sung API thuần trong `packages/editor-core/src/interactions/stage`:

```ts
buildStageTransformCommand({
  document,
  layers,
  evaluatedLayers,
  time,
  transform,
}): EditorCommand | null
```

API phải xử lý:

- single layer và multi-layer;
- static transform;
- keyframed transform;
- move, resize, rotate;
- local playhead time;
- giữ nguyên inverse command do command applier tạo.

Tách logic path mapping hiện nằm trong component, ví dụ:

- `transform.translate.x`;
- `transform.translate.y`;
- `transform.scale.x/y`;
- `transform.rotate.z`;
- `frame.width/height`.

### Tiêu chí hoàn tất

- Không còn `buildPlayheadTransformPatch` được gọi trực tiếp từ component
  trong commit path.
- Test static/keyframe transform cho move/resize/rotate.
- Test preview và commit cho cùng một input tạo ra cùng semantics.

## Phase 3 — Cô lập runtime sampling

### Công việc

- Tạo một runtime query boundary rõ ràng trong `apps/web/lib/editor/playback`
  hoặc package `editor-runtime`.
- Component không import trực tiếp `sampleEditorLayerAtTime`.
- Query boundary nhận document generation và time, trả về evaluated layer/
  interaction snapshot.
- Ưu tiên dùng frame/snapshot đang có từ playback; chỉ sample authoring layer
  khi cần tạo command cho layer có keyframe.
- Không để mỗi render của overlay sample toàn bộ visual layer nhiều lần.

### Tiêu chí hoàn tất

- `StageTransformOverlay.tsx` không còn import value từ `editor-runtime`.
- Có cache hoặc memoization theo `documentGeneration + currentTime`.
- Overlay không tự tạo runtime frame.
- Stage và inspector có thể dùng chung query contract.

## Phase 4 — Tách text resize khỏi transform controller

### Công việc

Tách toàn bộ logic text-specific khỏi `finishResize()`:

- minimum width;
- browser measurement;
- timeout;
- fallback line-height/line-count;
- wrapped text resize;
- auto-size/corner scale.

Tạo adapter riêng:

```text
stage-text-resize-adapter.ts
  browser measurement -> TextLayoutMeasurement
```

Và core resolver:

```ts
resolveTextResizeCommand({
  layer,
  evaluatedLayer,
  resize,
  measurement,
}): EditorCommand | null
```

Web chỉ đo text và truyền measurement vào core.

### Tiêu chí hoàn tất

- `finishResize()` không còn chứa fallback layout policy.
- Text resize không làm thay đổi canonical document trước khi commit.
- Có test fixed-width, auto-width, corner scale và minimum width.

## Phase 5 — Tách controller khỏi view

Chia file thành các module nhỏ:

```text
components/editor/stage/
  StageTransformOverlay.tsx       # composition/root view
  StageTransformHandles.tsx       # handles + rotation zones
  StageLayerHitboxes.tsx          # visual layer hit targets
  use-stage-selection-model.ts    # active/selected view model
  use-stage-transform.ts          # pointer/session lifecycle
  stage-text-resize-adapter.ts    # browser measurement bridge
```

### Ranh giới

`StageTransformOverlay.tsx` chỉ còn:

- gọi các hook;
- render guides;
- render hitboxes;
- render selection box/handles.

`use-stage-transform.ts` chỉ còn:

- pointer capture;
- coordinate conversion;
- gọi `createStageSession`;
- dispatch preview/commit result.

### Tiêu chí hoàn tất

- Root overlay dưới khoảng 250–300 dòng.
- Không có logic keyframe/text measurement trong view.
- Không có document mutation trực tiếp trong các view component.

## Phase 6 — Loại bỏ preview state trùng lặp

### Công việc

- Đổi `StagePreviewOverrides` thành state overlay thuần, hoặc loại bỏ nếu
  selection box có thể lấy trực tiếp từ `StagePreviewPayload`.
- Đổi tên `stageInteractionStore` thành `stageOverlayStore` nếu vẫn cần.
- Giữ lại snap guides và commit handoff nếu cần cho DOM overlay.
- Xóa mọi field có ý nghĩa runtime transform override.
- Kiểm tra transition:

```text
pointer move -> playback transient frame
pointer up    -> canonical command
new frame     -> clear overlay handoff
```

### Tiêu chí hoàn tất

- Chỉ playback là nguồn frame preview.
- Overlay store không chứa transform override có thể thay đổi render frame.
- Không còn flicker hoặc lệch giữa selection bounds và Skia frame.

## Phase 7 — Dọn EditorProviders boundary

### Công việc

- Giữ React state và persistence trong `EditorProviders`.
- Đưa stage-specific commit orchestration ra hook/service riêng.
- Provider chỉ nhận `EditorCommand` hoặc `EditorTransaction` đã hoàn chỉnh.
- Không để provider phải biết move/resize/rotate/keyframe semantics.
- Đồng bộ preview clear khi:
  - commit thành công;
  - cancel;
  - document reload;
  - playback dispose.

### Tiêu chí hoàn tất

- Provider không chứa stage transform policy.
- Provider không gọi runtime sampling.
- Preview command và canonical command có cùng document generation contract.

## Phase 8 — Test và migration cleanup

### Test cần có

#### `packages/editor-core/test`

- geometry/bounds/hit-test;
- snap constraints;
- move/resize/rotate session;
- static transform commit;
- keyframe transform commit;
- group transform commit;
- text resize command;
- preview/commit equivalence.

#### `apps/web/lib/editor/__tests__`

- pointer-to-composition adapter;
- overlay lifecycle;
- preview clear/cancel;
- runtime query boundary;
- browser text measurement adapter.

#### `apps/web/e2e`

- move layer;
- resize text;
- rotate layer;
- keyframe transform;
- cancel gesture;
- commit frame equals preview frame;
- hidden/locked layer behavior.

### Verification commands

```bash
pnpm --filter @motionvideo/editor-core test
pnpm --filter @motionvideo/editor-core typecheck
pnpm --filter @motionvideo/editor-core lint
pnpm exec tsc -p apps/web/tsconfig.editor.json --noEmit
pnpm exec vitest run apps/web/lib/editor/__tests__
pnpm run test:editor
```

## Definition of Done

- `StageTransformOverlay` không import runtime sampling.
- Web không tự tạo keyframe-aware transform command.
- Web không tự quyết định text resize policy.
- `editor-core` tạo command commit duy nhất cho stage transform.
- Playback là nguồn duy nhất của authoritative preview frame.
- Overlay store chỉ phục vụ guides/selection/DOM handoff.
- Preview và committed frame dùng cùng semantics.
- Stage view/controller đã được tách thành các file có trách nhiệm đơn nhất.
- Architecture guard và E2E test ngăn regression.

## Thứ tự triển khai khuyến nghị

```text
Phase 0
  -> Phase 1
  -> Phase 2
  -> Phase 3
  -> Phase 4
  -> Phase 5
  -> Phase 6
  -> Phase 7
  -> Phase 8
```

Không nên chia file trước Phase 1–4. Nếu tách sớm, logic hiện tại chỉ bị phân
tán sang nhiều file mà ownership vẫn chưa được giải quyết.
