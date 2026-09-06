# Kế hoạch tối ưu editor theo mô hình OpenPencil

> Trạng thái: Phase 0–7 đã triển khai phần core; các phase tiếp theo chỉ còn hardening/E2E.
>
> Phạm vi: history transaction, stage drag/resize/rotate, snap, selection frame và text auto-size cho Motion Protocol V2.

## 1. Kết quả cần đạt

Sau refactor, editor phải có cảm giác tương tác trực tiếp như Figma/OpenPencil:

- Khi kéo layer, hình và selection frame di chuyển cùng nhau trong từng frame render.
- Pointer move không ghi liên tục vào document, database, history hoặc kích hoạt compile toàn project.
- Một gesture từ `pointerdown` đến `pointerup` chỉ tạo đúng một history entry.
- `Escape` hủy gesture và trả UI về đúng trạng thái trước khi kéo, không tạo history.
- Snap theo cạnh và tâm của canvas/layer, giữ ngưỡng ổn định theo pixel màn hình ở mọi mức zoom.
- Snap guide được render đồng bộ với vị trí object đã snap.
- Frame của text tự vừa với nội dung đã shape bằng đúng font đang render.
- User không cần nhập `Width`/`Height` cho text auto-size.
- Resize text auto-size chỉ thay đổi transform của chữ; intrinsic text frame vẫn do editor tự đo lại.
- Preview, selection, hit-test, inspector, export và undo/redo dùng chung một nguồn hình học.

## 2. Vấn đề của kiến trúc hiện tại

### 2.1 Stage preview đang đi qua canonical document

`StageTransformOverlay.tsx` đang dùng coalesced command trong lúc pointer di chuyển để object đi theo selection. Cách này giúp UI nhìn đúng ngay, nhưng mỗi pointer move vẫn có thể:

- tạo document mới trong React state;
- kích hoạt compile/evaluate runtime;
- khởi động lại debounce lưu project 700 ms;
- làm history và cancel gesture phức tạp;
- gây giật khi project nhiều layer hoặc text/video nặng.

Coalescing chỉ giảm số entry cuối cùng trong undo stack, không biến thay đổi đó thành preview rẻ.

### 2.2 Snap mới chỉ so sánh tọa độ translate

`packages/editor-core/src/interactions/stage/constraints.ts` hiện snap `next.x` và `next.y` vào mảng edge. Nó chưa tính đầy đủ:

- left, center, right của toàn selection;
- top, center, bottom của toàn selection;
- cặp cạnh đối diện giữa object đang kéo và target;
- threshold theo stage zoom;
- target cùng parent và nested transform;
- priority giữa canvas, object, guide, pixel và geometry;
- độ dài guide từ source đến target.

### 2.3 Text frame là dữ liệu nhập tay

Motion Protocol V2 hiện yêu cầu mọi layer có `frame.width/height`. Với text, editor vẫn hiển thị và cho sửa hai field này như shape. Vì frame cũ có thể rộng hơn text thật nên selection box bị quá dài.

Runtime đã shape glyph bằng HarfBuzz, nhưng chưa trả về một measurement contract dùng chung để editor cập nhật intrinsic frame. Nếu đo bằng DOM hoặc công thức `text.length * fontSize`, selection sẽ lệch với Preview, nhất là với kerning, ligature, tiếng Việt, Arabic, emoji và font fallback.

## 3. Điều học từ OpenPencil

Các file tham chiếu trong clone local:

- [`open-pencil/packages/vue/src/shared/input/move.ts`](../../open-pencil/packages/vue/src/shared/input/move.ts): pointer move ghi vào preview graph; pointer up khôi phục vị trí gốc rồi commit vị trí cuối.
- [`open-pencil/packages/scene-graph/src/preview.ts`](../../open-pencil/packages/scene-graph/src/preview.ts): preview mutation có cache invalidation riêng và không tạo undo entry.
- [`open-pencil/packages/vue/src/shared/input/move-snap.ts`](../../open-pencil/packages/vue/src/shared/input/move-snap.ts): snap theo bounds của cả selection và đổi world delta về parent-local delta.
- [`open-pencil/packages/scene-graph/src/snap.ts`](../../open-pencil/packages/scene-graph/src/snap.ts): so sánh left/center/right và top/center/bottom, chọn correction gần nhất theo từng trục.
- [`open-pencil/packages/core/src/editor/text/auto-resize.ts`](../../open-pencil/packages/core/src/editor/text/auto-resize.ts): tự đo lại text khi nội dung hoặc typography thay đổi.
- [`open-pencil/packages/core/src/canvas/text/index.ts`](../../open-pencil/packages/core/src/canvas/text/index.ts): dùng paragraph engine để lấy `getLongestLine()` và `getHeight()` thay vì ước lượng bằng DOM.
- [`open-pencil/packages/core/src/editor/undo.ts`](../../open-pencil/packages/core/src/editor/undo.ts): history lưu forward/inverse của một hành động hoàn chỉnh.

Nguyên tắc cần áp dụng, không sao chép nguyên xi implementation:

1. Canonical document chỉ đổi khi gesture hoàn tất.
2. Preview state có lifecycle và cache invalidation riêng.
3. Renderer và selection cùng đọc preview override.
4. Text measurement phải đến từ cùng shaping engine với renderer.
5. History lưu ý định của user theo transaction, không lưu từng pointer event.

## 4. Kiến trúc mục tiêu

```text
Pointer / keyboard / inspector
            |
            v
    Interaction session
    begin -> preview -> commit/cancel
            |
      +-----+------------------+
      |                        |
      v                        v
Transient preview store   Canonical command bus
      |                   (chỉ khi commit)
      v                        |
Runtime renderer               +--> Motion Protocol V2 document
Selection + hit-test           +--> Undo/redo history
Snap guides                    +--> Debounced persistence
Inspector preview              +--> Runtime compile/export
```

Ba loại state phải được tách rõ:

| State | Nội dung | Có persist | Có history |
| --- | --- | --- | --- |
| Canonical document | Motion Protocol V2 hợp lệ | Có | Có |
| Interaction preview | delta/patch tạm của move, resize, rotate, text scale | Không | Không |
| UI state | selection, hover, active tool, guides, pointer | Không | Không |

Không thêm `isDragging`, snap guide, DOM pixel hoặc preview patch vào JSON V2.

## 5. Interaction transaction

### 5.1 Contract chung

Tạo một transaction API duy nhất cho stage:

```ts
type StageInteraction = {
  id: string;
  kind: "move" | "resize" | "rotate" | "text-scale";
  selectedLayerIds: readonly string[];
  startedAt: { screen: Point; composition: Point };
  originals: ReadonlyMap<string, LayerGeometrySnapshot>;
  preview: ReadonlyMap<string, LayerPreviewPatch>;
  guides: readonly SnapGuide[];
};
```

Lifecycle:

1. `begin`: snapshot canonical values, capture pointer, chưa đổi document.
2. `preview`: tính delta từ snapshot gốc, snap, cập nhật transient preview tối đa một lần mỗi animation frame.
3. `commit`: tạo một command từ snapshot gốc đến preview cuối, validate V2, ghi một history entry rồi clear preview.
4. `cancel`: clear preview và guides; canonical document không cần rollback vì chưa từng bị đổi.

### 5.2 Quy tắc input

- Chỉ bắt đầu drag sau khi vượt ngưỡng 3 px màn hình để phân biệt click và drag.
- Dùng pointer capture; xử lý cả `pointercancel`, mất capture, đổi project và unmount.
- `Escape` hủy interaction đang chạy trước khi xử lý deselect/tool cancel.
- `Shift` constrain trục khi move và giữ tỷ lệ khi resize.
- `Alt` resize từ tâm.
- `Ctrl/Cmd` tạm tắt snap trong gesture; shortcut cuối cùng cần được test tránh xung đột hệ điều hành.
- Không dùng state closure cũ để tính delta; mọi preview luôn tính từ `originals`.

## 6. History và persistence

### 6.1 Transaction policy

- Move nhiều layer là một entry với một command/inverse command.
- Resize, rotate và text scale: mỗi gesture là một entry.
- Edit inspector liên tục có thể coalesce theo `layerId + propertyPath`, nhưng phải kết thúc group khi blur, Enter, selection đổi hoặc property khác được sửa.
- Nudge bằng phím mũi tên được group trong một khoảng idle ngắn; pointer gesture không dùng idle coalescing.
- Duplicate + drag là một transaction để undo xóa toàn bộ duplicate vừa tạo.
- Cancel hoặc gesture không thay đổi giá trị không tạo entry.
- Command mới sau undo phải xóa redo stack.
- Selection không bắt buộc nằm trong Protocol, nhưng history operation có thể lưu `selectionBefore/After` để UX undo ổn định.

### 6.2 Giới hạn history

Tiếp tục dùng command/inverse command thay vì snapshot toàn document. Giữ guard hiện tại `MAX_HISTORY_ENTRIES` và `MAX_HISTORY_BYTES` trong giai đoạn đầu; chỉ đổi con số sau khi có telemetry hoặc benchmark.

Mỗi entry nên có metadata:

```ts
type HistoryEntry = {
  id: string;
  label: string;
  timestamp: number;
  forward: readonly EditorCommand[];
  inverse: readonly EditorCommand[];
  selectionBefore?: readonly string[];
  selectionAfter?: readonly string[];
};
```

### 6.3 Persistence policy

- Preview state tuyệt đối không kích hoạt `saveEditorProject`.
- Chỉ canonical revision sau commit mới được debounce và gửi server.
- Khi save đang chạy mà có commit mới, lưu revision mới nhất sau response hoặc dùng serialized save queue.
- Conflict phải giữ local document và history, không âm thầm thay bằng server document.
- Chuyển project khi đang gesture phải cancel preview trước, sau đó flush hoặc xử lý save queue theo policy hiện tại.

## 7. Move và DnD trên stage

### 7.1 Preview transform

Renderer nhận một map override theo layer ID:

```ts
type LayerPreviewPatch = {
  translateDelta?: { x: number; y: number };
  scaleMultiplier?: { x: number; y: number };
  rotationDelta?: number;
  frameOverride?: { width: number; height: number };
};
```

Delta được áp sau giá trị animation đã evaluate tại playhead. Selection box, hit-test và inspector preview phải dùng cùng evaluated geometry này. Không dựng một bản sao Protocol document rồi compile toàn bộ ở mỗi pointer move.

### 7.2 Multi-selection và hierarchy

- Tính một world-space bounds cho toàn selection.
- Chỉ move root selected layers; nếu parent và child cùng được select thì không cộng delta hai lần vào child.
- Snap trong world space, sau đó đổi correction về local space của từng parent bằng inverse matrix.
- Với multi-selection, giữ khoảng cách tương đối tuyệt đối giữa các layer.
- Bước đầu chỉ cho drop/reparent khi UX và command đã rõ; move không được vô tình đổi parent.
- Asset kéo từ sidebar vào stage dùng cùng transaction framework nhưng là `insert` transaction, không trộn với native HTML drag preview.

### 7.3 Animation-aware edit

Preview move là visual delta trên kết quả đã sample ở playhead. Khi commit:

- nếu property có keyframe đúng tại playhead, cập nhật keyframe đó;
- nếu auto-key đang bật, tạo keyframe tại playhead;
- nếu không có keyframe và auto-key tắt, cập nhật base transform;
- nếu track đang điều khiển property nhưng playhead không có keyframe, editor phải hiển thị quyết định rõ thay vì ghi đè im lặng.

Phần này triển khai sau preview transaction cơ bản, nhưng API preview phải hỗ trợ ngay từ đầu để không phải refactor lần hai.

## 8. Snap engine

### 8.1 Hình học

Mỗi rect cung cấp ba anchor trên mỗi trục:

```text
X: left, centerX, right
Y: top,  centerY, bottom
```

So sánh tất cả cặp hợp lệ giữa moving selection và target. Chọn correction có độ lệch nhỏ nhất độc lập trên trục X và Y; giữ tất cả guide đồng hạng tại correction thắng.

Target phase đầu:

- cạnh và tâm composition;
- visible/unlocked sibling layers cùng parent;
- explicit guides nếu sau này có ruler;
- pixel grid ở mức zoom phù hợp.

Không snap vào layer đang select, descendant của selection, hidden layer hoặc target khác coordinate context chưa được normalize.

### 8.2 Threshold và priority

- Ngưỡng mặc định: 5 px màn hình.
- Quy đổi sang composition unit: `thresholdWorld = 5 / effectiveZoom`.
- Priority đề xuất: geometry handle > explicit guide > object/canvas > pixel.
- Khi hai candidate cùng priority, chọn khoảng cách nhỏ hơn; nếu bằng nhau, ưu tiên center alignment để UX ổn định.
- Hysteresis 1–2 px màn hình giúp object không rung giữa hai target gần nhau.

### 8.3 Guide model

```ts
type SnapGuide = {
  axis: "x" | "y";
  position: number;
  from: number;
  to: number;
  source: "canvas" | "object" | "guide" | "pixel";
  targetId?: string;
};
```

Guide được render trong stage overlay bằng composition coordinates, không phải DOM coordinates. Clear guide khi cancel, commit, pointer mất capture hoặc snap bị disable.

### 8.4 Rotation

- Phase đầu dùng world AABB của rotated layer để snap move, giống hướng OpenPencil.
- Selection một layer vẫn render bằng rotated quad thật, không dùng AABB làm outline.
- Phase sau mới bổ sung oriented-edge/geometry snap nếu cần độ chính xác vector.
- Rotate giữ `Shift` để snap góc 15°; guide góc là một loại guide riêng.

## 9. Selection frame

Một layer có ba khái niệm bounds:

| Bounds | Ý nghĩa |
| --- | --- |
| Intrinsic frame | `frame.width/height` trong local space, chưa transform |
| World quad | bốn góc intrinsic frame sau parent/local transform |
| Visual bounds | bounds mở rộng bởi stroke/effect nếu cần hit-test hoặc fit viewport |

Quy tắc UI:

- Single selection: outline bám world quad; 8 handle nằm đúng giữa cạnh/góc bằng transform, không cộng padding vào frame.
- Multi-selection: outline dùng union world AABB trong phase đầu.
- Handle có hit area 12–16 px màn hình nhưng dot chỉ 6–8 px; hit area không được làm lệch tâm dot.
- Layer và selection luôn lấy geometry từ `canonical + preview override`, vì vậy chúng di chuyển cùng nhau.
- Hit-test dùng cùng matrix/bounds với selection, không dựng một rect DOM độc lập có logic khác.
- Stroke/effect có thể nằm ngoài frame nhưng không làm thay đổi intrinsic layout frame.

## 10. Text frame tự động

### 10.1 Contract đã chốt

Text mới tạo trực tiếp trong editor mặc định là `auto-width-height`:

- width = độ rộng line dài nhất sau shaping;
- height = tổng line box theo `lineHeight`;
- không thêm padding UI vào frame;
- xuống dòng chỉ theo ký tự newline trong mode này, không tự wrap theo một width cũ;
- text rỗng dùng width tối thiểu 1 composition unit và height bằng một line box để vẫn có caret/selection.

Text frame dùng typographic/layout bounds, không dùng ink bounds của riêng glyph đang hiển thị. Điều này giữ baseline và chiều cao ổn định khi đổi từ chữ `a` sang `g`, dấu tiếng Việt hoặc ký tự khác có ascender/descender.

### 10.2 Sizing mode trong Protocol V2

`V2TextLayoutSchema` nên có field rõ nghĩa, vì V2 strict schema hiện chưa phân biệt frame do user đặt hay do layout sinh ra:

```ts
sizing: "auto-width-height" | "fixed-width-auto-height" | "fixed";
```

Semantics:

| Mode | Width | Height | Use case |
| --- | --- | --- | --- |
| `auto-width-height` | Derived | Derived | Text tạo trong editor, label/title |
| `fixed-width-auto-height` | Authored | Derived | Paragraph có wrap |
| `fixed` | Authored | Authored | HTML/CSS box, clip/ellipsis |

HTML compiler phải map theo CSS đã resolve:

- không khai báo width/height: `auto-width-height`;
- width cố định, height auto: `fixed-width-auto-height`;
- width và height cố định hoặc overflow/ellipsis phụ thuộc box: `fixed`.

Không dùng compatibility/legacy mode. Vì app đang development, chạy migration một lần để bổ sung `sizing` cho text V2 hiện có.

### 10.3 Measurement source of truth

Không dùng DOM `getBoundingClientRect`, Canvas 2D `measureText` hoặc công thức ước lượng. Mở rộng `packages/motion-runtime/src/visual/text-layout.ts` để export một kết quả layout dùng chung:

```ts
type TextLayoutMeasurement = {
  width: number;
  height: number;
  lineCount: number;
  lines: readonly {
    advance: number;
    baseline: number;
  }[];
  ascender: number;
  descender: number;
  resolvedFontAssetIds: readonly string[];
};
```

Measurement phải chạy bằng HarfBuzz và exact font binary mà Preview sử dụng. Runtime hiện đã có glyph runs và line advance; nên mở rộng pipeline đó thay vì shape lần thứ hai bằng engine khác.

Các thay đổi bắt buộc invalidate measurement:

- source text, language, direction, writing mode, whitespace;
- font asset/fallback, family, weight, style, stretch, variation;
- font size, line height, letter spacing, word spacing;
- chunk/span style, `dx`, `dy`, `rotate`, `textLength`;
- wrap, content width, max lines và sizing mode.

Font chưa load thì dùng Noto Sans fallback để có preview, nhưng chỉ ghi frame canonical sau khi font mục tiêu đã resolve. Khi custom font load xong, remeasure một lần và commit frame cùng typography change trong một transaction để tránh history thừa.

### 10.4 Intrinsic frame và transform

Với text auto-size:

```text
intrinsic frame = measurement(text + typography)
world quad      = transform(intrinsic frame)
selection       = world quad
```

`frame.width/height` vẫn được persist trong JSON V2 dưới dạng derived deterministic value để runtime/export không phụ thuộc editor. User không trực tiếp chỉnh hai số này.

Với mode auto, các SVG length dạng phần trăm phụ thuộc frame có thể gây vòng lặp layout. Compiler/editor phải normalize font size và spacing về composition units trước khi đo, hoặc reject document auto-size có dependency vòng.

### 10.5 Resize semantics cho text

Đây là hành vi được ưu tiên theo yêu cầu hiện tại:

- Kéo handle không đổi sizing mode và không ghi width/height bằng tay.
- Corner handle thay đổi `transform.scale.x/y` đồng đều khi giữ ratio mặc định.
- Side handle chỉ thay đổi `transform.scale.x` hoặc `transform.scale.y`, cho phép kéo giãn chữ nhưng intrinsic text frame không đổi.
- `Shift` đảo trạng thái giữ tỷ lệ theo convention cuối cùng của editor; cần thống nhất với shape resize.
- `Alt` scale từ tâm, giữ visual center.
- During drag chỉ ghi scale vào preview override.
- Pointer up commit scale/anchor/translate trong một history entry; frame vẫn bằng measurement.
- Đổi text/font/font size sau đó sẽ remeasure intrinsic frame, còn scale transform đang có vẫn được giữ.

Inspector cho text `auto-width-height`:

- ẩn input Width/Height hoặc hiển thị read-only kèm badge `Auto`;
- vẫn hiển thị Scale X/Scale Y để user thấy kết quả resize;
- có action `Reset scale` đưa scale về 1;
- nếu sau này cho đổi sang paragraph mode, action `Fixed width` phải là lựa chọn rõ ràng, không tự đổi mode chỉ vì user kéo side handle.

### 10.6 Anchor compensation

Khi measurement làm intrinsic frame đổi, editor phải giữ đúng điểm neo nhìn thấy:

- text align left giữ cạnh trái;
- center giữ tâm;
- right giữ cạnh phải;
- vertical align tương tự theo trục Y;
- layer có rotation/parent transform cần tính compensation trong local space rồi đổi qua parent matrix.

Nếu không có bước này, đổi nội dung hoặc font sẽ làm text “nhảy” dù alignment đúng.

### 10.7 Trường hợp đặc biệt

- Multiline explicit newline: width là max advance; height là số line × line height.
- `fixed-width-auto-height`: width không đổi, height remeasure sau wrap.
- RTL/Arabic: dùng shaped advance và direction, không suy từ số ký tự.
- Vertical writing: hoán đổi logic inline/block axis, không đơn giản đổi width/height sau cùng.
- Emoji/fallback font: measurement gom glyph runs từ tất cả font đã resolve.
- Text path: không chạy paragraph auto-frame; frame lấy từ path layout/visual path bounds trong phase riêng.
- Stroke/effect: không cộng vào intrinsic frame; có thể cộng vào visual bounds cho hit-test/fit.
- Animated text/font size: canonical frame là authored/base measurement; tại playhead, selection preview cần lấy evaluated text metrics. Chỉ persist frame mới khi user commit thay đổi tại keyframe/base tương ứng.

## 11. Kế hoạch triển khai theo phase

### Phase 0 — Khóa invariant và baseline test

- [ ] Ghi test tái hiện layer đi sau selection, save bị kích hoạt trong drag, snap lệch ở zoom và text frame quá dài.
- [ ] Thêm fixture text: Noto Sans, custom font, multiline, Vietnamese combining marks, RTL, emoji fallback, letter spacing.
- [ ] Đo baseline compile/render count trong một drag 2 giây.
- [ ] Chốt API geometry: local frame, world quad, visual bounds và matrix conversion.

Nghiệm thu:

- [ ] Test fail đúng với các lỗi hiện tại và có số liệu baseline để so sánh.

Commit đề xuất: `test(editor): capture stage interaction and text sizing baselines`

### Phase 1 — Preview store và transaction lifecycle

- [ ] Tạo transient `StageInteractionStore` ngoài canonical editor document.
- [ ] Thêm `begin/update/commit/cancel` và pointer capture cleanup.
- [ ] Bỏ `applyCoalescedCommand` khỏi hot path của pointer move.
- [ ] Một `requestAnimationFrame` chỉ publish preview mới nhất một lần.
- [ ] Selection overlay đọc preview patch.

Nghiệm thu:

- [ ] Drag/cancel không đổi serialized document, revision, undo stack hoặc persistence status.
- [ ] Pointer up tạo đúng một command.

Commit đề xuất: `refactor(stage): add transient interaction transactions`

### Phase 2 — Runtime preview override

- [ ] Cho `PreviewStage`/runtime nhận transform override map theo layer ID.
- [ ] Áp override sau animation sampling và trước world matrix/render command.
- [ ] Hit-test và selection dùng cùng evaluated preview geometry.
- [ ] Invalidate transform/bounds cache, không invalidate font/image/vector resource nếu chỉ move.

Nghiệm thu:

- [ ] Object và selection frame cùng vị trí trong toàn bộ drag.
- [ ] Không compile toàn project và không gọi save trong pointer move.

Commit đề xuất: `feat(runtime): render transient stage transform overrides`

### Phase 3 — Snap engine và smart guides

- [x] Thay snap `x/y` hiện tại bằng anchor-pair solver cho selection bounds.
- [x] Thêm canvas/sibling targets, selected exclusion và zoom-normalized threshold.
- [ ] Chuyển world correction về parent-local delta.
- [x] Render guide line đúng `from/to`; thêm disable modifier.
- [ ] Thêm hysteresis cho snap lock/unlock.
- [ ] Dùng cùng solver cho move; resize snap triển khai sau khi move ổn định.

Nghiệm thu:

- [ ] Snap cảm giác giống nhau ở zoom 25%, 100% và 400%.
- [ ] Multi-selection giữ spacing và snap theo bounds toàn nhóm.

Commit đề xuất: `feat(stage): add world-space object snapping and guides`

### Phase 4 — History, cancel và persistence hardening

- [x] Chuẩn hóa metadata history và selection before/after.
- [ ] Group inspector/nudge theo policy riêng, không dùng chung với gesture preview.
- [ ] Kiểm tra undo/redo cho move, resize, rotate, duplicate-drag và multi-selection.
- [x] Thêm single-flight serialized save guard để không gửi đồng thời cùng revision khi commit liên tiếp.
- [ ] Test project switch/unmount/pointercancel trong gesture.

Nghiệm thu:

- [ ] Một gesture = một undo; Escape = không undo; commit mới sau undo xóa redo.
- [ ] Network log không có request save từ preview.

Commit đề xuất: `refactor(editor): harden transactional history and persistence`

### Phase 5 — Text sizing mode và measurement API

- [x] Thêm `payload.layout.sizing` vào V2 schema, compiler, runtime validation và types.
- [x] Export measurement từ HarfBuzz text layout pipeline.
- [x] Thêm cache key/invalidation cho toàn bộ typography dependencies.
- [x] Tạo command helper remeasure text và cập nhật derived frame + anchor compensation.
- [x] Cập nhật HTML compiler mapping cho ba sizing mode.
- [x] Viết migration cho text V2 hiện tại; không tạo legacy reader.

Nghiệm thu:

- [ ] Frame text bằng paragraph measurement với exact font và không dài theo frame cũ.
- [ ] JSON sau update vẫn parse strict V2 và Preview/export đồng nhất.

Commit đề xuất: `feat(text): add deterministic auto-sized V2 text frames`

### Phase 6 — Text selection và transform resize

- [x] Selection frame lấy intrinsic measured frame và transform hiện tại.
- [x] Với auto text, route resize handles sang scale transform thay vì frame resize.
- [ ] Corner/side/Alt/Shift hoạt động theo contract ở mục 10.5.
- [x] Inspector đổi Width/Height sang read-only `Auto`, thêm Scale X/Y và Reset scale.
- [x] Remeasure khi sửa text/font/style và giữ đúng alignment anchor cơ bản.

Nghiệm thu:

- [ ] User không cần tự tính width/height.
- [ ] Kéo resize làm chữ và selection thay đổi đồng thời, frame nguồn vẫn đúng measurement.
- [ ] Undo text scale chỉ cần một lần.

Commit đề xuất: `feat(editor): scale auto-sized text without manual frames`

### Phase 7 — Animation-aware geometry

- [x] Preview delta trên transform/frame đã evaluate tại playhead.
- [x] Commit đúng base property hoặc keyframe theo policy: keyframe hiện hữu được cập nhật, thuộc tính chưa keyframe sửa base; helper đã sẵn sàng cho auto-key.
- [x] Keyframe diamond/inspector phản ánh giá trị evaluated nhưng không ghi history sớm.
- [x] Text frame được remeasure cho typography `font.size` keyframe và tạo frame keyframe tương ứng cho text auto-size.

Nghiệm thu:

- [x] Move/scale ở playhead không làm layer nhảy khi thả chuột.
- [x] Undo khôi phục đúng track/keyframe và base value.

Commit đề xuất: `feat(animation): make stage transforms keyframe-aware`

## 12. File map dự kiến

| Khu vực | File hiện tại / file mới dự kiến |
| --- | --- |
| UI transaction | `apps/web/components/editor/stage/StageTransformOverlay.tsx` |
| Preview store | `apps/web/lib/editor/state/stage-interaction-store.ts` (mới) |
| Runtime bridge | `apps/web/components/docs/PreviewStage.tsx`, `StageViewport.tsx` |
| Session core | `packages/editor-core/src/interactions/stage/session.ts` |
| Snap solver | `packages/editor-core/src/interactions/stage/snap.ts` (mới), thay logic trong `constraints.ts` |
| Geometry/matrix | `apps/web/lib/editor/stage/transform.ts`, helper mới trong editor-core nếu đủ generic |
| History | `apps/web/components/editor/EditorProviders.tsx`, `apps/web/lib/editor/state/history-policy.ts` |
| V2 text schema | `packages/motion-protocol/src/v2/layers/text.ts` |
| Text shaping/measure | `packages/motion-runtime/src/visual/text-layout.ts`, `types.ts` |
| Compiler mapping | `packages/motion-compiler/src/compiler/index.ts`, HTML compiler text lowering |
| Inspector | `apps/web/components/editor/inspector/SchemaInspector.tsx` |
| Migration | `apps/web/scripts/migrate-project-revisions-v2.ts` hoặc script version mới |

## 13. Test matrix

### Unit

- Snap mọi cặp L/C/R và T/C/B, tie-break, hysteresis, zoom threshold.
- World/local delta qua parent scale/rotation.
- Transaction begin/preview/commit/cancel và no-op gesture.
- History forward/inverse cho single/multi-layer.
- Text measurement theo font, weight, style, spacing, multiline, RTL, emoji.
- Anchor compensation cho left/center/right và rotation.

### Integration

- Renderer, selection và hit-test nhận cùng preview patch.
- Preview transform không đổi serialized V2 document.
- Remeasure text sinh strict-valid V2 và không tạo save loop.
- Font load/fallback/custom font đổi measurement đúng một lần.

### E2E

- Kéo layer liên tục rồi thả, undo một lần, redo một lần.
- Kéo rồi Escape; reload project vẫn ở vị trí cũ.
- Snap cạnh/tâm ở nhiều zoom; giữ Ctrl/Cmd để tắt snap.
- Multi-select move, nested parent transform, rotated layer.
- Chọn text frame cũ quá dài: frame co về đúng nội dung.
- Sửa nội dung/font/font size: frame tự cập nhật và không nhảy anchor.
- Resize text bằng corner/side: chữ và selection đi cùng, Width/Height vẫn Auto.
- Text có keyframe ở playhead: commit đúng track.

## 14. Performance budget

- Pointer preview tối đa một update mỗi `requestAnimationFrame`.
- Mục tiêu input-to-paint dưới 16.7 ms ở fixture editor chuẩn.
- Move thuần không re-shape text, decode asset, rebuild vector mesh hoặc compile project.
- Text chỉ remeasure khi measurement dependency đổi; transform-only preview tái sử dụng glyph layout.
- Không có save request và không tăng undo stack trong active gesture.
- Memory preview được giải phóng ngay khi commit/cancel/unmount.

## 15. Definition of Done

- [ ] Layer và selection frame luôn di chuyển cùng nhau, không còn “khung đi trước, hình đi sau”.
- [ ] Move/resize/rotate không mutate canonical document trong pointer move.
- [ ] Snap có cạnh, tâm, guide và threshold ổn định theo zoom.
- [ ] Một gesture tạo đúng một history entry; Escape không tạo entry.
- [ ] Persistence chỉ chạy sau canonical commit.
- [ ] Text mới mặc định auto width + auto height.
- [ ] Text frame được đo bằng exact shaping engine và vừa với nội dung.
- [ ] Text auto-size không cho user sửa Width/Height thủ công.
- [ ] Resize text thay transform, không biến frame derived thành frame authored.
- [ ] Preview, selection, hit-test, inspector và export đồng nhất.
- [ ] Protocol V2 strict validation, unit/integration/E2E và migration đều xanh.

## 16. Thứ tự ưu tiên khuyến nghị

Không làm text auto-size trước preview transaction. Thứ tự an toàn là:

1. Preview transaction và runtime override.
2. Snap/guide và history hardening.
3. Text measurement + V2 sizing mode.
4. Text transform resize.
5. Animation-aware commit.

Nếu làm measurement trước nhưng stage vẫn mutate document theo từng pointer move, resize text sẽ shape font, compile và save liên tục — đúng phần tốn chi phí nhất của editor.
