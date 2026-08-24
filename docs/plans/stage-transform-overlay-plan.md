# Stage Transform Overlay V2 — kế hoạch thực hiện

## Mục tiêu

Thêm khung thao tác trực tiếp trên preview/stage của `EditorShell`, dùng chung cho
shape, text, image và video. Khi chọn layer, người dùng có thể nhìn thấy bounding
box của layer và thao tác di chuyển, resize hoặc xoay như design tham chiếu.

Không tạo một stage/editor mới. Toàn bộ UI nằm trong folder stage hiện có, tái sử
dụng selection, command dispatcher, history và coordinate system của editor V2.

## Phạm vi UX

### Single selection

```text
        [corner] ───── [top] ───── [corner]
             │                         │
        [left]     selected object     [right]
             │                         │
        [corner] ─── [bottom] ─── [corner]
                         │
                    [rotate]
```

- Kéo phần thân của box: di chuyển layer.
- 4 handle góc: resize theo X và Y.
- 4 handle giữa cạnh: resize theo một trục.
- Rotate handle nằm dưới tâm cạnh dưới.
- Text dùng chính overlay này; khung bám vào bounds đã render của layer text.
- Overlay chỉ hiện khi layer đang tồn tại tại `currentTime` và selection có đúng một
  visual layer. Audio/group không hiển thị transform overlay ở phase đầu.

### Multi-selection

- Phase đầu: chỉ render bounding box tổng để biểu thị selection.
- Move nhiều layer được phép: mọi layer nhận cùng `translate` delta.
- Resize và rotate multi-selection chưa triển khai cho đến khi có group transform
  semantics rõ ràng, nhằm tránh thay đổi anchor/sizing ngoài ý muốn.

### Quy ước thao tác

- `Shift` khi resize: giữ aspect ratio.
- `Alt` khi resize: resize từ tâm (phase resize).
- `Shift` khi rotate: snap theo bậc 45°.
- Arrow: nudge 1px; `Shift + Arrow`: nudge 10px (phase polish).
- Thao tác pointer có preview cục bộ trong lúc kéo; chỉ commit command khi thả chuột.
- Mỗi thao tác hoàn tất là đúng một history entry để undo/redo một lần.

## Ràng buộc dữ liệu

- Protocol V2 vẫn là nguồn dữ liệu chuẩn. Không thêm field `uiBounds`, `selection`,
  `dragState` hoặc `alignment` vào protocol.
- Move ghi patch cho `transform.translate.x/y`.
- Resize dùng field kích thước/scale đã được capability của từng type hỗ trợ; không
  tạo shape/text variant riêng chỉ phục vụ stage UI.
- Rotate ghi patch `transform.rotate.z`.
- Mọi command đi qua transaction/command layer hiện có để validation, preview,
  sidebar, timeline và history cùng nhận một document state.
- Tọa độ pointer được chuyển từ client space → stage viewport → composition space;
  không dùng pixel DOM trực tiếp làm giá trị protocol.

## Phases và checklist nghiệm thu

## Phase 0 — Contract, inventory và geometry

- [x] **T0.1 — Audit stage hiện có:** xác định stage canvas, transform render,
  selection overlay hiện hữu (nếu có), zoom, pan và pointer host đang được dùng.
- [x] **T0.2 — Bounds contract:** tạo một interface nội bộ cho `StageLayerBounds`
  (x, y, width, height, rotation, anchor) và mapping từ V2 visual layer.
- [x] **T0.3 — Coordinate helpers:** chuẩn hoá các helper client/stage/composition và
  kiểm tra zoom, viewport resize, stage letterbox.
- [x] **T0.4 — Capability matrix:** chốt layer nào move/resize/rotate ở phase đầu;
  text resize bằng scale hay frame size phải dùng đúng capability hiện tại.
- [x] **T0.5 — Command contract:** định nghĩa payload preview và commit cho move,
  resize, rotate; command invalid không được để lại partial document state.
- [x] **T0.6 — Test geometry:** unit tests cho đổi tọa độ, clamp và bounds ở zoom
  khác nhau.

**Nghiệm thu Phase 0**

- [x] Có mapping rõ ràng từ stage coordinate đến Protocol V2 fields.
- [x] Có test chứng minh transform không lệch khi stage zoom/resize.

**Commit sau Phase 0**

`docs(stage): define V2 transform overlay contract`

## Phase 1 — Transform overlay read-only

- [x] **T1.1 — Giữ folder stage cũ:** thêm component overlay vào folder stage hiện
  có; không tạo `V2Stage` hoặc một EditorShell khác.
- [x] **T1.2 — Single-selection frame:** render border mảnh, 4 corner handles, 4
  side handles và rotate handle theo design tham chiếu.
- [x] **T1.3 — Positioning:** overlay bám chính xác rendered bounds, kể cả shape có
  rotation và text có kích thước nội dung khác frame.
- [x] **T1.4 — Visibility:** ẩn khi selection trống, layer bị hidden, layer không có
  mặt tại current time, hoặc type không hỗ trợ visual transform.
- [x] **T1.5 — Accessibility:** handles có `aria-label`, focus state và không chặn
  interaction của preview ngoài vùng selection.
- [x] **T1.6 — Visual regression:** fixture cho rectangle, ellipse và text ở zoom
  50%, 100%, 200%.

**Nghiệm thu Phase 1**

- [x] Chọn shape/text trên sidebar, timeline hoặc stage đều cho cùng một overlay.
- [x] Khung và handles không gây flicker preview, không lệch khi scroll/resize cửa sổ.

**Commit sau Phase 1**

`feat(stage): render V2 transform selection overlay`

## Phase 2 — Move trực tiếp trên stage

- [x] **T2.1 — Pointer session:** kéo thân overlay qua pointer host hiện có, có
  pointer capture và cancellation an toàn.
- [x] **T2.2 — Local preview:** cập nhật vị trí overlay/layer trong lúc kéo mà không
  tạo history entry liên tục.
- [x] **T2.3 — Commit move:** khi pointer up, tạo một transaction patch
  `transform.translate.x/y`; Escape hoặc pointer cancel trả về document cũ.
- [x] **T2.4 — Snap cơ bản:** snap vào tâm stage, cạnh stage và cạnh/tâm layer khác;
  có ngưỡng pixel đã quy đổi theo zoom.
- [x] **T2.5 — Multi move:** selected visual layers nhận chung delta trong một
  transaction; không thay đổi order hoặc track UI.
- [x] **T2.6 — History + tests:** verify undo/redo, snap, move dưới zoom và move
  nhiều layer.

**Nghiệm thu Phase 2**

- [x] Kéo object thay đổi stage, inspector, sidebar và document V2 đồng bộ.
- [x] Một lần kéo tương ứng đúng một Undo/Redo entry.
- [x] Kéo nhiều layer không làm lệch khoảng cách tương đối giữa chúng.

**Commit sau Phase 2**

`feat(stage): move selected V2 layers from preview`

## Phase 3 — Resize

- [x] **T3.1 — Resize math:** chuyển delta của 8 handles sang frame/scale patch,
  giữ anchor phía đối diện cố định trong composition space.
- [x] **T3.2 — Type policy:** shape/image/video/text/path đều resize bằng `frame`
  và `transform.translate`; text content/layout không bị reflow ngoài ý muốn.
- [x] **T3.3 — Modifiers:** Shift giữ tỉ lệ, Alt resize từ tâm; khi dùng chung, hai
  modifier vẫn giữ đúng tâm và aspect ratio.
- [x] **T3.4 — Guardrails:** min size 8 composition px, finite number validation,
  không scale âm và không lật object trong phase này.
- [x] **T3.5 — Preview/commit:** preview cục bộ khi drag và một patch command khi
  thả; hủy pointer không ghi document.
- [x] **T3.6 — Tests:** unit test east/west resize, center/aspect modifier,
  opposite-edge compensation, rotated bounds và finite patch; E2E test drag handle
  trên shape và kiểm tra inspector đồng bộ.

**Nghiệm thu Phase 3**

  - [x] Resize không làm object trôi khỏi cạnh/anchor đối diện.
  - [x] Shift/Alt hoạt động đúng, document V2 vẫn parse/compile hợp lệ.

**Commit sau Phase 3**

`feat(stage): resize V2 layers with transform handles`

## Phase 4 — Rotate

- [ ] **T4.1 — Rotate interaction:** kéo rotate handle và tính góc quanh anchor/pivot
  của layer trong composition space.
- [ ] **T4.2 — Rotate preview:** hiển thị góc tạm thời trong lúc kéo, overlay quay
  đồng bộ với object.
- [ ] **T4.3 — Angle snap:** Shift snap 0°, 45°, 90°... với threshold rõ ràng.
- [ ] **T4.4 — Commit/history:** patch `transform.rotate.z` trong một transaction;
  Escape/cancel restore state.
- [ ] **T4.5 — Tests:** góc qua 0°/360°, layer có anchor khác tâm, snap và undo/redo.

**Nghiệm thu Phase 4**

- [ ] Rotate handle thao tác chính xác ở mọi zoom và không nhảy góc khi qua 360°.
- [ ] Inspector rotation và preview luôn đồng bộ.

**Commit sau Phase 4**

`feat(stage): rotate V2 layers from preview`

## Phase 5 — Multi-select, keyboard và polish

- [ ] **T5.1 — Multi bounds:** render bounds tổng cho multi-selection; chỉ body drag
  được enable, resize/rotate disabled có chủ đích.
- [ ] **T5.2 — Keyboard nudge:** Arrow/Shift+Arrow nudge selection, tôn trọng snap
  và tạo một history entry theo interaction session.
- [ ] **T5.3 — Selection coherence:** shift range và Ctrl/Cmd toggle từ sidebar,
  timeline, stage dùng cùng selection state.
- [ ] **T5.4 — Responsive:** overlay và handles vẫn usable ở stage hẹp; không làm
  inspector/sidebar hiện lại ở responsive breakpoint.
- [ ] **T5.5 — E2E regression:** select → move → resize → rotate → undo/redo,
  multi move, timeline/playhead không regression.
- [ ] **T5.6 — Documentation:** cập nhật README stage/editor interaction và mô tả
  các modifier keys.

**Nghiệm thu Phase 5**

- [ ] Single-layer move/resize/rotate hoàn chỉnh; multi-select move ổn định.
- [ ] Không có UI-specific field lọt vào Protocol V2.
- [ ] Test unit/integration/e2e liên quan đều xanh.

**Commit sau Phase 5**

`feat(stage): complete V2 direct transform interactions`

## Ngoài phạm vi hiện tại

- Resize/rotate đồng thời nhiều layer.
- Flip âm, skew/perspective transform và 3D gizmo.
- Crop trực tiếp trên stage cho image/video.
- Keyframe transform, motion path và graph editor.
- Smart guides nâng cao, distribute/align trực tiếp bằng overlay.
