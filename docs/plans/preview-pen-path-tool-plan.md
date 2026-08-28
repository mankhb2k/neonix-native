# Pen / Path trên Preview V2 — kế hoạch triển khai

> Trạng thái: đề xuất, chưa bắt đầu.
>
> Mục tiêu: biến nút `Path` ở Stage toolbar thành Pen tool vẽ trực tiếp trên
> Preview. Không tạo EditorShell hay Stage mới; tái sử dụng `EditorProviders`,
> `V2StageViewport`, `StageTransformOverlay`, command/history và Protocol V2 hiện có.

## Quyết định UX đã chốt

Path là một layer V2 (`type: "path"`) gồm một hoặc nhiều `contours`. Trong lúc vẽ,
UI chỉ giữ draft cục bộ; chỉ khi hoàn tất mới ghi một transaction vào document.

| Thao tác | Kết quả |
| --- | --- |
| Chọn Path hoặc phím `P` | Bật Pen mode, cursor crosshair |
| Click Preview | Thêm node thẳng mới |
| Click + drag | Thêm node Bézier (phase curve) |
| Click node đầu | Đóng contour |
| `Enter` | Hoàn tất contour mở |
| `Esc` | Hủy draft, không thay đổi document |
| `Backspace` | Bỏ node cuối trong draft |
| `Shift` | Khóa segment/tangent theo góc 0° / 45° / 90° |
| `Alt` (`Option` trên macOS) | Ngắt hai Bézier handles tại node để chỉnh độc lập / tạo corner |
| `V` | Trở về Select mode |

`Alt` chỉ mang nghĩa **break tangent/corner**, không phải kết thúc path. Muốn bắt đầu
một contour mới: hoàn tất contour hiện tại bằng `Enter`, sau đó vẽ contour tiếp theo.
Trong phạm vi đầu tiên, mỗi lần dùng Pen sẽ tạo một layer Path có một contour; nhiều
contour (lỗ, compound path) là phase sau.

## Ràng buộc kiến trúc

- `MotionProtocolV2` tiếp tục là document nguồn dữ liệu. Không thêm `draftPath`,
  `toolMode`, node hover hay handle UI vào protocol.
- Draft chỉ sống trong React/session state của Stage và bị xóa khi `Esc`, đổi project,
  đổi tool hoặc unmount.
- Tọa độ pointer phải đi qua helper `client → stage → composition`, tôn trọng zoom,
  pan, letterbox và kích thước composition; không lưu pixel DOM vào Protocol.
- Protocol V2 đã có `path.contours`, line segment, cubic segment, `fillRule`, fill và
  stroke. Ưu tiên dùng schema/capability hiện có, không tạo format path song song.
- Khi commit, normalize draft từ composition-space sang path local-space theo frame /
  transform hiện có. Việc này phải bảo toàn vị trí render ở mọi mức stage zoom.
- Một path hoàn tất, một lần sửa node hoặc một lần xóa node tương ứng đúng một history
  transaction; cancel không được tạo history entry.
- Layer Path mới có duration 5 giây, bắt đầu tại playhead, nằm trên cùng visual stack,
  được select sau khi thêm và dùng style mặc định đã thống nhất (fill xám, không stroke).

## Phạm vi không làm trong roadmap này

- Freehand Pencil/Brush, pressure, smoothing và variable-width stroke.
- Boolean path, Shape Builder, masking, path morph/keyframe.
- Multi-contour trong một interaction, import/export SVG path và text-on-path.
- Chỉnh path đồng thời nhiều layer.

---

## Phase 0 — Audit contract và test geometry

- [ ] **P0.1 — Audit Protocol path:** xác nhận schema `V2PathLayer`, command patch có
  thể cập nhật `payload.contours`, capability render, compiler và preview runtime cho
  line/cubic/fill/stroke.
- [ ] **P0.2 — Stage coordinate API:** trích xuất hoặc chuẩn hóa helper duy nhất để đổi
  `PointerEvent.clientX/Y` sang composition point, dùng chung với transform overlay.
- [ ] **P0.3 — Draft model:** định nghĩa `PathDraft`, `DraftNode`, `DraftSegment`,
  `activePointerPoint`, `isClosed`, `toolMode` và trạng thái modifier. Đây là type UI
  nội bộ, không xuất hiện trong document JSON.
- [ ] **P0.4 — Normalization contract:** chốt cách draft composition-space được chuyển
  thành `frame`, `transform` và local contour point mà không thay đổi pixel render.
- [ ] **P0.5 — Hit-testing contract:** xác định vùng click node đầu, node hiện tại,
  segment preview và vùng stage trống; không chặn click của layer dưới khi không vẽ.
- [ ] **P0.6 — Unit tests:** kiểm tra coordinate mapping ở zoom 25/50/90/100/200%, pan
  khác 0, Shift angle snap, ngưỡng đóng contour và normalize/denormalize round-trip.

**Nghiệm thu Phase 0**

- [ ] Có type draft và flow tọa độ rõ ràng, không phụ thuộc DOM pixel.
- [ ] Có test chứng minh draft không lệch khi stage zoom/pan/resize.

**Commit sau Phase 0**

`test(stage): define pen path draft and coordinate contract`

## Phase 1 — Pen tool line path và preview draft

- [ ] **P1.1 — Tool state:** thêm `select | pan | pen` vào stage tool state; Path toolbar
  bật/tắt Pen mode và phím `P` cũng bật Pen. `V`, `H`, Escape tương tác rõ ràng với mode.
- [ ] **P1.2 — Pointer lifecycle:** click stage trống thêm node; pointer capture an toàn;
  click layer vẫn select bình thường khi không ở Pen mode.
- [ ] **P1.3 — Draft renderer:** render node, segment đã xác nhận, segment từ node cuối đến
  pointer và marker khi hover node đầu. Overlay nằm trên preview nhưng không ảnh hưởng
  hit-testing layer ngoài Pen mode.
- [ ] **P1.4 — Completion:** click node đầu để close; `Enter` commit open path; `Esc` cancel;
  `Backspace` bỏ node cuối; không commit path ít hơn hai điểm.
- [ ] **P1.5 — Modifiers:** Shift constrain segment ngay trong preview; hiển thị hướng snap
  rõ ràng nhưng không cần smart-guide nâng cao.
- [ ] **P1.6 — Accessibility:** button Path có trạng thái `aria-pressed`, tooltip `Path (P)`;
  keyboard flow không đụng input/textarea/inspector đang focus.
- [ ] **P1.7 — E2E:** bật P, click nhiều điểm, close/Enter/Esc/Backspace, Shift snap và chuyển
  lại Select bằng V.

**Nghiệm thu Phase 1**

- [ ] Người dùng thấy path nháp chính xác trên Preview; không có layer/document mới cho
  đến lúc Enter hoặc close.
- [ ] Pan/Select/zoom/transform overlay không regression.

**Commit sau Phase 1**

`feat(stage): draw line path drafts with pen tool`

## Phase 2 — Commit Path V2, selection và history

- [ ] **P2.1 — Draft compiler:** chuyển draft line nodes thành `V2PathContour` với start,
  line segments, closed flag và local frame/transform hợp lệ.
- [ ] **P2.2 — Add-layer transaction:** dùng command layer hiện có để add layer + reorder
  top stack trong một transaction; start = playhead, duration = 5 giây.
- [ ] **P2.3 — Default style:** áp dụng fill xám, không stroke, `fillRule: "nonzero"`; Inspector
  hiển thị các field Path đã hỗ trợ thay vì shape-specific field sai nghĩa.
- [ ] **P2.4 — Select after commit:** chọn layer mới, overlay transform hoạt động và timeline/
  sidebar hiển thị đúng icon + clip Path.
- [ ] **P2.5 — Undo/redo:** undo xóa toàn bộ path vừa commit; redo khôi phục byte-for-byte
  geometry/order/timing/style.
- [ ] **P2.6 — Validation tests:** schema Protocol, compiler/runtime preview, history unit test
  và Playwright vẽ → commit → undo → redo.

**Nghiệm thu Phase 2**

- [ ] Một path vẽ xong là một layer `type: "path"` hợp lệ, render đúng tại 25–200% zoom.
- [ ] Một thao tác vẽ chỉ tạo một history entry và không flicker Preview.

**Commit sau Phase 2**

`feat(editor): commit pen drafts as Protocol V2 path layers`

## Phase 3 — Curve Bézier và corner semantics

- [ ] **P3.1 — Drag node while drawing:** click-drag tạo cubic segment với control handles;
  click thuần vẫn tạo line segment.
- [ ] **P3.2 — Tangent model:** thêm incoming/outgoing handle vào draft node; default là mirror
  angle + length để curve mượt.
- [ ] **P3.3 — Alt break:** giữ Alt/Option khi kéo hoặc chỉnh handle làm hai handle độc lập;
  node chuyển sang corner. Thả Alt không tự mirror lại geometry đã tách.
- [ ] **P3.4 — Shift constrain:** Shift constrain hướng tangent/segment theo 45° mà vẫn giữ
  độ dài kéo; Shift + Alt vẫn là handle độc lập nhưng có angular snap.
- [ ] **P3.5 — Render affordances:** hiển thị đường tangent mảnh, handle dễ hit nhưng không che
  transform overlay; cursor/copy rõ ràng cho node, handle và segment.
- [ ] **P3.6 — Tests:** line/cubic serialization, Alt corner, Shift/Alt kết hợp, preview/runtime
  parity và test không sinh số NaN/Infinity khi handle có độ dài 0.

**Nghiệm thu Phase 3**

- [ ] Path có cả line và cubic segment; Alt tạo corner đúng nghĩa, Shift chỉ là constrain.
- [ ] Export/runtime render khớp Preview về hình học path.

**Commit sau Phase 3**

`feat(stage): add bezier pen curves and corner handles`

## Phase 4 — Vector edit mode cho path đã có

- [ ] **P4.1 — Enter edit mode:** chọn một Path rồi Enter/double-click để vào vector edit;
  Enter lần nữa hoặc V để thoát.
- [ ] **P4.2 — Node selection/move:** click chọn node, Ctrl/Cmd click toggle node, Shift click
  range/lasso chỉ khi semantics đã rõ; kéo node patch đúng contour segment lân cận.
- [ ] **P4.3 — Add/remove:** Pen click lên segment để chèn node; Backspace/Delete xóa node có
  guardrail không cho contour còn dưới hai điểm.
- [ ] **P4.4 — Handle editing:** kéo incoming/outgoing handle, chọn mirror mode, Alt break;
  patch chỉ geometry của layer đang edit.
- [ ] **P4.5 — Commit policy:** một node drag là một history entry; Escape trong drag restore
  geometry trước drag; không ghi partial path invalid.
- [ ] **P4.6 — E2E + visual tests:** edit node ở path xoay/scale, layer dưới vẫn click được ngoài
  hit region, undo/redo và stage zoom/pan không lệch.

**Nghiệm thu Phase 4**

- [ ] Có thể sửa node/handle path đã tạo mà stage selection, inspector và timeline vẫn đồng bộ.
- [ ] Không có invisible hitbox che các layer khác.

**Commit sau Phase 4**

`feat(stage): edit V2 path nodes and bezier handles`

## Phase 5 — Multi-contour, inspector và polish

- [ ] **P5.1 — New contour:** trong vector edit mode, Enter kết thúc contour hiện tại và click
  vùng trống bắt đầu contour khác trong cùng layer; hỗ trợ open + closed contours.
- [ ] **P5.2 — Fill rule:** Inspector cho chọn `nonzero`/`evenodd`, có fixture donut để nghiệm thu.
- [ ] **P5.3 — Stroke UI:** bổ sung fill/stroke/width/cap/join chỉ khi capability Protocol/runtime
  hiện có đầy đủ; giữ default mới tạo là fill xám, no stroke.
- [ ] **P5.4 — Snap:** snap node vào stage edge/center, node khác và grid; Ctrl/Cmd tạm tắt snap
  nếu không xung đột shortcut selection.
- [ ] **P5.5 — Performance:** giới hạn preview invalidation vào draft overlay; test path lớn và
  bảo đảm không remount Preview khi chỉ di chuyển pointer.
- [ ] **P5.6 — Documentation:** cập nhật shortcut P/V/H/Shift/Alt/Enter/Esc/Backspace và kế hoạch
  mở rộng Pencil, SVG import, morph trong docs editor.

**Nghiệm thu Phase 5**

- [ ] Một layer hỗ trợ nhiều contour và fill rule chính xác.
- [ ] Bộ test unit + Protocol validation + Playwright vector flow đều xanh.

**Commit sau Phase 5**

`feat(path): complete vector editing and contour workflow`

## Checklist release cuối cùng

- [ ] Không có draft/tool/session metadata trong JSON Protocol V2 export.
- [ ] Preview và export có cùng geometry với line/cubic/closed/open path.
- [ ] Hidden/locked layer policy vẫn được tôn trọng khi vẽ và edit path.
- [ ] Path mới theo playhead, duration 5 giây, top visual order và undo/redo đúng một bước.
- [ ] Desktop keyboard shortcuts không xung đột Select (`V`), Pan (`H`) hay inspector inputs.
