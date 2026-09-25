# CSS paint/effects stabilization roadmap

Mục tiêu: phủ ~90% hiệu ứng CSS motion-graphics dùng hàng ngày (glow, blur,
shadow, blend, gradient text, backdrop kính mờ...) trên `canvaskit-preview`,
với tiêu chuẩn **làm xong 1 hạng mục thì hạng mục đó phải có test khoá lại
hành vi đúng, mới chuyển sang hạng mục tiếp theo** — không dàn trải.

Đây là roadmap thực thi (có trạng thái, cập nhật khi làm), khác
`debt-technical.md` (chỉ ghi nợ chưa làm, xoá mục khi trả xong không giữ
lịch sử). Mục đã xong ở đây **giữ lại** làm bằng chứng phạm vi đã khoá.

## Phát hiện nền tảng của roadmap này

Khi audit case `box-shadow` + `filter: blur()` trên cùng 1 phần tử (quả cầu
glow, pattern cực phổ biến), phát hiện **cả hai hiệu ứng biến mất hoàn
toàn, không lỗi, không cảnh báo** ([chi tiết](#12-box-shadow--filter-trên-cùng-1-phần-tử)).
Root cause không phải bug đơn lẻ mà là **một class bug**:
`boxShadowOverlayBranches()`/`boxShadowBranches()` trong
`packages/canvaskit-preview/src/command/{replay,effects}.ts` được viết theo
kiểu "toàn bộ danh sách ops của effect-program phải khớp đúng pattern
box-shadow từ đầu đến cuối" — bất kỳ op nào khác (từ một effect KHÁC trên
cùng phần tử) xen vào sẽ làm hàm `return null` cho **toàn bộ** chương
trình, không chỉ phần không khớp.

**Hệ quả**: mọi tổ hợp "box-shadow + [filter khác]" trên cùng phần tử đều có
nguy cơ bị ảnh hưởng như nhau. Vì vậy bước đầu của Cấp 1 không phải "sửa
case quả cầu" mà là **liệt kê hết các tổ hợp cùng dạng** rồi xử lý có hệ
thống, kèm test cho từng tổ hợp — đúng tinh thần "làm đến đâu chắc đến đó".

## Nguyên tắc bắt buộc cho mỗi hạng mục

1. **Tái hiện bằng dữ liệu thật trước khi sửa**: compile HTML thật qua
   compiler thật, hoặc dùng `/playground/native-stage` (Custom HTML) chụp
   browser-vs-native để xác nhận có lệch thật, không suy đoán từ đọc code.
2. **Root-cause, không patch triệu chứng**: đọc code tới khi chỉ ra được
   dòng/hàm cụ thể gây lỗi, giải thích được *tại sao* nó gây đúng triệu
   chứng quan sát được.
3. **Sửa xong phải có test hành vi, không chỉ test "không throw"**: cho
   `canvaskit-preview`, test phải assert đúng thứ được vẽ (draw call, filter
   nào được cài, ops nào được diễn giải đúng) — theo đúng convention có sẵn
   trong `packages/canvaskit-preview/test/effects.test.ts`. Cho
   `html-compiler`, test assert đúng Protocol V2 JSON output.
4. **Verify không phá cái cũ**: chạy full test suite của package bị sửa +
   (nếu đụng `html-compiler`) golden-diff 125 fixture.
5. Chỉ chuyển sang hạng mục tiếp theo sau khi bước 1-4 xong cho hạng mục
   hiện tại. Không mở nhiều hạng mục cùng lúc.

## Cấp 1 — Lõi, 90%+ project nào cũng đụng

### 1.0 Case cơ bản độc lập (box-model/layout/text) phải đủ điều kiện trước khi làm case mix

Nguyên tắc bổ sung: **case cơ bản (không tổ hợp) của box-model/paint/text/
layout phải vững trước** khi quay lại sửa case tổ hợp (1.2/1.2b) — sửa mix
trên nền chưa vững sẽ phải quay lại sửa 2 lần.

Audit bằng battery 50 case CSS phổ biến qua compiler thật (không suy đoán):

| Nhóm | Pass/Total | Ghi chú |
| --- | --- | --- |
| Box model (padding/margin/border/box-sizing/min-max/aspect-ratio/overflow/z-index/inset...) | 19/19 | Sạch, không cần sửa gì (sweep bổ sung sau đó phát hiện thêm 2 lỗi paint/box khác, đã sửa — xem bên dưới) |
| Layout (flex/grid/flow) | 11/16 → **12/16 sau khi sửa `grid-template-areas`** | `flex-direction` reverse + `grid-auto-flow` xong sau đó (commit `20357004`, `0374fd4d`) nhưng chưa re-run lại battery gốc để lấy số pass chính xác — không suy đoán con số, ghi lại ở đây để nhắc verify khi cần |
| Text/typography | 6/15 → **8/15 sau khi sửa** | 2 gap tần suất cao nhất đã sửa, còn lại xem bên dưới |

**Đã sửa** (commit `fdcaa167`, có test `test/typography-shorthand.test.ts`):
- **`font` shorthand** (`font: italic 700 24px/1.4 Inter`) — hoàn toàn chưa
  hỗ trợ trước đó, ép người viết CSS (kể cả AI) luôn phải tách riêng
  `font-size`/`font-weight`/`font-family`... trong khi đây là cách viết CSS
  rất phổ biến.
- **`text-transform: uppercase/lowercase/capitalize`** — hoàn toàn chưa hỗ
  trợ, hay dùng cho badge/label motion-graphics. Sửa xong phát hiện thêm 1
  bug con: quên thêm vào `INHERITED_PROPERTIES` nên không kế thừa xuống
  phần tử con — đã sửa cùng lúc, có test khoá riêng cho trường hợp kế thừa.

**Đã sửa** (commit `e1fa6d0a`, `50f36562`, phát hiện thêm trong lúc sweep
xác nhận paint/gradient/box sạch trước khi sang grid, có test trong
`test/paint-css-parity.test.ts`):
- **`background: color-mix(...)` (hoặc bất kỳ token lạ nào) compile
  "thành công" nhưng render trong suốt hoàn toàn im lặng** — cùng root
  cause với bug `background: red` đã sửa trước đó (bộ phân loại token của
  `expandBackground` coi token không nhận diện được là "position" rỗng),
  nhưng lần trước chỉ vá đúng case named-color, chưa vá tận gốc. Giờ token
  lạ nào cũng báo lỗi rõ ràng thay vì bị nuốt.
- `overflow: clip` (cách viết CSS hiện đại thay `hidden`) — thêm làm alias
  của `hidden` (sản phẩm video không có khái niệm scroll nên 2 giá trị này
  tương đương).

**Đã sửa** (commit `adc9f4e2`, có test `test/layout-grid.test.ts`):
- **`grid-template-areas` + `grid-area`** — cách đặt tên vùng grid phổ biến
  nhất, hoàn toàn chưa hỗ trợ trước đó. Hỗ trợ cú pháp tên vùng (không phải
  dạng số `row/col/row/col`, dạng đó báo lỗi rõ ràng nếu dùng). Vùng không
  tạo thành hình chữ nhật (typo dạng "L") bị từ chối thay vì đoán bừa.

**Đã sửa** (commit `20357004`, có test trong `test/layout-flex.test.ts`):
- **`flex-direction: row-reverse`/`column-reverse`** — trước đó chỉ nhận
  `row`/`column`. Tổng quát hoá cờ `rtl` (vốn chỉ dùng cho
  `direction: rtl` trên `row`) thành `reverseMain`, dùng cùng công thức mirror
  vị trí main-axis thay vì phải viết logic duyệt ngược item riêng — tự động
  đúng với `justify-content` (space-between...) vì công thức đó tính trước
  khi mirror.

**Đã sửa** (commit `0374fd4d`, có test trong `test/layout-grid.test.ts`):
- **`grid-auto-flow: column`** — trước đó chỉ đặt được theo hàng
  (row-major). Thêm nhánh tìm ô trống column-major (đảo thứ tự tìm kiếm,
  đảo trục tăng trưởng khi grid tường minh hết chỗ), tái dùng
  `fits()`/`occupy()` sẵn có vì 2 hàm này không quan tâm ý nghĩa
  hàng/cột. `grid-auto-flow: dense` báo lỗi rõ ràng
  (`css-grid-auto-flow-dense-unsupported`) thay vì âm thầm đặt sai theo
  kiểu sparse vì chưa hỗ trợ back-fill ô trống phía trước.

**Layout ở Cấp 1 → 1.0 đã hết gap đã biết** — không còn mục nào trong danh
sách "chưa sửa" của Layout.

**Còn lại, chưa sửa** (Text, tần suất thấp hơn 2 mục đã sửa):
- [ ] `overflow-wrap: break-word` / `word-break: break-all` — cần cho text
      box co giãn với từ dài
- [ ] `vertical-align` — gap đã biết từ trước, chưa sửa
- [ ] `-webkit-line-clamp` — cắt text N dòng, hay dùng cho caption/mô tả
- [ ] `text-decoration-style` khác `solid` (`wavy`/`dotted`/`dashed` underline)
      — chỉ nhận `solid`
- [ ] `text-indent`, `font-variant` — tần suất thấp hơn, có thể để Cấp 2

**Không cần làm** (đã xác nhận không phù hợp với sản phẩm video/motion,
không phải gap thật): `position: sticky` (không có khái niệm scroll),
`float` (CSS legacy, layout hiện đại dùng flex/grid).

**Trạng thái**: 2/2 gap text tần suất cao nhất đã xong. Layout đã xong hết
gap đã biết (`grid-template-areas`, `flex-direction` reverse,
`grid-auto-flow`). Còn 5 gap text tần suất thấp hơn. Box model không cần
làm gì thêm ở Cấp 1.

### 1.1 Audit toàn bộ tổ hợp "box-shadow + hiệu ứng khác" cùng phần tử — XONG

Verify bằng dữ liệu thật cho từng tổ hợp: dựng HTML tối giản, nạp qua
`/playground/native-stage` (Custom HTML), đọc `data-diagnostics` thật trên
canvas + chụp ảnh so sánh có/không có tổ hợp. Không suy đoán từ đọc code.

| Tổ hợp | Kết quả | Bằng chứng |
| --- | --- | --- |
| `box-shadow` + `filter: blur()` | **VỠ** — mất cả 2 hiệu ứng | diagnostic `renderer_effect_unsupported`, ảnh: cạnh sắc, không glow không blur |
| `box-shadow` + `filter: brightness()` | **VỠ** — cùng cơ chế | cùng diagnostic `renderer_effect_unsupported` |
| 2× `box-shadow` + `filter: blur()` | **VỠ** — cùng cơ chế | cùng diagnostic |
| `box-shadow` inset + outer + `filter: blur()` | **VỠ** — cùng cơ chế | cùng diagnostic |
| **`box-shadow` + `backdrop-filter`** | **VỠ — nặng hơn**: shadow biến mất **im lặng, không có diagnostic nào cả** | ảnh: box-shadow một mình glow rõ; thêm `backdrop-filter: blur(12px)` vào cùng phần tử → glow biến mất hoàn toàn, cạnh sắc |
| `box-shadow` + `mix-blend-mode` | An toàn | ảnh: glow hiển thị đúng |
| `box-shadow` + transform 3D (`rotateY`+`perspective`) | An toàn (với hiệu ứng shadow; hình học xoay 3D không nằm trong phạm vi audit này) | ảnh: glow hiển thị đúng cạnh box đã xoay |
| `text-shadow` + `filter` trên text | An toàn — cơ chế hoàn toàn khác (không đi qua `effects`/box-effect) | ảnh: chữ có glow + brightness đúng |

**Kết luận quan trọng**: đây là **2 bug riêng**, không phải 1:
- **Bug A** (`box-shadow` + `filter`, mọi biến thể) — có diagnostic, xem 1.2.
- **Bug B** (`box-shadow` + `backdrop-filter`) — **im lặng hoàn toàn, không
  có diagnostic**, nguy hiểm hơn Bug A vì không ai biết để debug. Thêm mục
  **1.2b** bên dưới.

`mix-blend-mode`, transform 3D và `text-shadow` **không** nằm trong class
bug này — không cần sửa, chỉ cần test khoá lại (chuyển sang mục 1.3).

### 1.2 Box-shadow + filter trên cùng 1 phần tử (Bug A)
- **Xác nhận qua diagnostic thật**: `replay.ts:903` —
  `if (command.effectProgram && !effectFilter.supported) addDiagnostic('skia_effect_unsupported:...')`.
  Diagnostic này bắn ra thật (`renderer_effect_unsupported`) cho mọi biến
  thể shadow+filter đã test — nghĩa là điểm gãy đầu tiên là
  `effectFilterFor()` (`effects.ts:384-403`) trả `supported: false` cho
  chương trình gộp, KHÔNG phải chỉ ở `boxShadowOverlayBranches`
  (`replay.ts:113-163`) như suy đoán ban đầu. `boxShadowOverlayBranches`
  vẫn có cùng lỗi cấu trúc (loop giả định toàn bộ ops là chuỗi shadow) và
  là điểm gãy thứ hai bên trong `drawBoxEffect`, nhưng `effectFilterFor`
  gãy trước nên request còn chưa tới đó theo đường `sourceOnly` bình
  thường.
- **Hiện tại**: cả hai hàm đều được viết theo kiểu "toàn bộ effect-program
  phải khớp đúng pattern shadow (hoặc pattern filter thuần) từ đầu đến
  cuối". CSS hợp lệ ghép [chuỗi ops shadow] + [1 op filter đứng sau, input
  = output của shadow cuối — đúng theo spec: filter áp lên toàn bộ kết quả
  đã có shadow] không khớp bất kỳ pattern nào cả hai hàm biết, nên cả hai
  đều kết luận "không hỗ trợ" / `return null`. Owner render không shadow,
  không filter.
- **Cần làm**: cả `effectFilterFor` (effects.ts) và `boxShadowOverlayBranches`
  (replay.ts) cần nhận diện được "N nhánh shadow ở đầu + phần ops còn lại
  là 1 filter chain hợp lệ ở cuối", thay vì yêu cầu khớp toàn bộ. Vẽ owner +
  mọi nhánh box-shadow vào 1 surface offscreen trước, rồi áp phần ops còn
  lại (blur/color-adjust/...) như 1 ImageFilter cuối khi composite surface
  đó vào canvas chính.
- **Test cần có** (thêm vào `effects.test.ts`, theo đúng style
  `"supports ordered box-shadow lists containing inner and outer branches"`
  đã có): 1 box-shadow + blur() cho ra đúng cấu trúc composite+filter; xác
  nhận `boxShadowOverlayBranches`/hàm thay thế nó parse được phần shadow
  ngay cả khi có op filter theo sau.
- **Trạng thái**: root-cause xong, chưa sửa.

### 1.2b Box-shadow + backdrop-filter trên cùng 1 phần tử (Bug B — im lặng, không có diagnostic)
- **Xác nhận qua ảnh chụp thật**: cùng 1 phần tử, `box-shadow` một mình
  glow hiển thị rõ (ảnh `bd-a-shadow-only-opaque`); thêm
  `backdrop-filter: blur(12px)` vào (`bd-c-shadow+backdrop-opaque-bg`) →
  glow biến mất hoàn toàn, cạnh sắc — **và không có bất kỳ diagnostic nào
  được bắn ra** (`data-diagnostics` chỉ có `renderer_backend_selected`).
  Nguy hiểm hơn Bug A vì không có tín hiệu nào để biết đang render sai.
- **Nghi vấn root-cause** (chưa đọc code xác nhận, chỉ là giả thuyết từ
  hành vi quan sát được): `backdropEffectProgram` và `effectProgram` là 2
  field tách biệt trên `beginLayer`, nhưng đường `shouldSaveLayer`/
  `saveBounds` (`replay.ts:908-974`) tính bounds cho saveLayer dựa trên
  `backdropEffectFilter`/`contentBounds` — có khả năng bounds đó được tính
  hẹp theo backdrop-filter (chỉ đủ cho nội dung + padding blur backdrop)
  và cắt mất phần mở rộng mà box-shadow's halo cần, hoặc box-shadow bị bỏ
  qua hoàn toàn khi nhánh backdrop chiếm quyền merge boxEffect. Cần đọc kỹ
  `replay.ts:908-980` trước khi sửa 1.2 để xác nhận, vì cùng khu vực code.
- **Trạng thái**: quan sát được bằng ảnh, CHƯA root-cause bằng code. Nên
  root-cause + sửa cùng đợt với 1.2 (khu vực code chung `beginLayer`/
  `drawBoxEffect`), không tách rời để tránh sửa 2 lần vào cùng 1 hàm.

### 1.3 Khoá lại các hiệu ứng ĐƠN/tổ hợp AN TOÀN bằng test, việc nào chưa có test bền vững thì bổ sung
Các hiệu ứng sau đã xác nhận render đúng (qua battery 58 case hôm trước +
audit ảnh chụp thật hôm nay) nhưng cần rà xem đã có test canvaskit-preview
cấp draw-call hay chưa, thiếu thì bổ sung để khoá — **không sửa gì, chỉ
viết test** cho các mục này:
**Đã verify lại bằng cách đọc thật code test (2026-09-25) — 2 dòng "đã có,
đủ" bên dưới trước đó SAI, ghi nhầm mà chưa mở file test ra xem**:

- [ ] `filter` chain đơn (blur/brightness/contrast/saturate/hue-rotate/
      grayscale/sepia/invert/drop-shadow) — `effects.test.ts`
      (`packages/canvaskit-preview/test/`) là test cấp draw-call thật (assert
      filter-graph construction), nhưng **`saturate()` KHÔNG có coverage
      thật**: field `saturation` chỉ xuất hiện 3 chỗ trong test
      (dòng 122/220/259), cả 3 đều hardcode `saturation: 1` (giá trị
      neutral/no-op) — ma trận biến đổi saturation thật
      (`src/command/effects.ts` dòng 27-34) chưa từng được test với
      saturation ≠ 1. **Vẫn cần viết test mới**, không phải "xác nhận lại
      cho chắc" như ghi trước đó.
- [x] `backdrop-filter` một mình (không kèm box-shadow) — CONFIRMED đúng:
      `backdrop-replay.test.ts` có 4 test assert trực tiếp arg truyền vào
      `canvas.saveLayer(paint, bounds, filter)`/`clipRect`, cấp draw-call
      thật.
- [ ] **`box-shadow` + `mix-blend-mode`** — audit hôm nay xác nhận render
      đúng bằng ảnh, nhưng **chưa có test draw-call nào** cho tổ hợp này
      lẫn `mix-blend-mode` nói chung. Verify lại: mọi test kit trong
      `packages/canvaskit-preview/test/*.test.ts` đều stub
      `setBlendMode(){}` thành no-op và không bao giờ assert giá trị được
      truyền vào, `BlendMode` chỉ stub mỗi `SrcOver` — 13 giá trị CSS còn
      lại (multiply/screen/overlay/darken/lighten/color-dodge/color-burn/
      hard-light/soft-light/difference/exclusion/hue/saturation/color/
      luminosity) hoàn toàn chưa có test nào đụng tới `blendModeFor()`
      (`src/command/paint.ts` dòng 21-27) — cần viết test mới.
- [ ] **`box-shadow` + transform 3D** — audit hôm nay xác nhận shadow vẫn
      hiển thị đúng qua ảnh, nhưng chưa có test draw-call
- [ ] **`text-shadow` + `filter`** — audit hôm nay xác nhận đúng qua ảnh,
      chưa có test draw-call cho tổ hợp này (test hiện có trong
      `paint-color-functions.test.ts` chỉ parse màu text-shadow/
      drop-shadow riêng lẻ, không phải test tổ hợp trên cùng 1 phần tử)
- [ ] `opacity` phần trăm + animation opacity qua keyframes — `opacity-
      replay.test.ts` CÓ 2 test cấp draw-call thật (assert
      `layerPaints[0].alpha`/`drawPaints[0].alpha`), nhưng cả 2 đều
      **single-frame/tĩnh** (`"composites isolated subtree opacity once..."`
      dòng 43, `"keeps non-isolated drawable opacity..."` dòng 59) —
      **KHÔNG có test nào replay track animation qua nhiều frame/theo thời
      gian**. Dòng "xác nhận opacity animation track được replay đúng theo
      thời gian" ghi trước đó là sai, chưa từng verify — vẫn cần viết test
      multi-frame mới.

## Cấp 2 — Thường gặp, không phải lõi hàng ngày

- Perspective/3D kết hợp box-shadow/filter (nested near-plane, animation)
- clip-path/mask kết hợp filter hoặc shadow
- Animation nhiều track đồng thời trên cùng property (đã có cơ chế merge
  cho animation-name, nhưng transform+filter+shadow cùng animate 1 lúc thì
  chưa audit)
- Gradient text kết hợp filter/shadow (background-clip:text + text-shadow +
  filter cùng lúc)

## Cấp 3 — Hiếm, ghi vào `debt-technical.md` khi gặp, không chủ động làm trước

- `oklch()`/`lab()`/`color()` (named colors CSS Color 3, `rgb()`/`hsl()` đã
  xong — xem commit `aaf7dfd2`)
- Gradient color-stop dạng độ dài tuyệt đối (`20px`, hiện chỉ nhận `%`)
- Bất cứ gì chỉ xảy ra ở animation/transform cực đoan hiếm gặp

## Trạng thái hiện tại

**1.0 (case cơ bản độc lập)**:
- Box model: sạch (19/19 case gốc), cộng thêm 2 lỗi phát hiện qua sweep
  xác nhận (`color-mix()` im lặng render trong suốt, `overflow: clip` bị
  từ chối) — cả 2 đã sửa, commit `e1fa6d0a`/`50f36562`.
- Paint/gradient: sạch, xác nhận lại qua cùng đợt sweep.
- Text: 6/15 → 8/15 (2/2 gap tần suất cao nhất: `font` shorthand,
  `text-transform`, đã xong, commit `fdcaa167`). Còn 5 gap tần suất thấp
  hơn chưa sửa (`overflow-wrap`/`word-break`, `vertical-align`,
  `-webkit-line-clamp`, `text-decoration-style` khác `solid`,
  `text-indent`/`font-variant`).
- Layout: `grid-template-areas` + `grid-area` (commit `adc9f4e2`),
  `flex-direction` reverse (commit `20357004`), `grid-auto-flow` (commit
  `0374fd4d`) đều đã xong. Hết gap layout đã biết ở 1.0.

**1.1 (audit tổ hợp box-shadow) xong** — xác nhận 2 bug riêng (1.2:
shadow+filter, có diagnostic; 1.2b: shadow+backdrop-filter, im lặng không
diagnostic) và 3 tổ hợp an toàn (blend-mode, transform 3D, text-shadow).

**Thứ tự tiếp theo** (đúng nguyên tắc "case cơ bản đủ điều kiện trước case
mix" — 1.2/1.2b tạm giữ nguyên, chưa động vào):
1. ~~`flex-direction` reverse + `grid-auto-flow` (layout, còn lại của
   1.0)~~ — XONG.
2. `overflow-wrap`/`word-break`, `vertical-align`, `-webkit-line-clamp`,
   `text-decoration-style`, `text-indent`/`font-variant` (5 gap text còn
   lại — mục tiếp theo)
3. Quay lại 1.2 + 1.2b (case mix box-shadow) sau khi 1.0 xong hoàn toàn.

Không mở nhiều mục cùng lúc trong danh sách trên.
