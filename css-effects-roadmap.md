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

**Đã sửa** (commit `3a0172c7`, có test `test/line-clamp.test.ts`):
- **`-webkit-line-clamp`** — cắt text N dòng kèm ellipsis, hay dùng cho
  caption/mô tả trong lower-third. Đa số hạ tầng runtime đã có sẵn
  (`maxLines`, ellipsize dòng cuối) — chỉ cần html-compiler route đúng vào
  path đó. `display: -webkit-box` được chuẩn hoá về `block`;
  `-webkit-box-orient: vertical` mới thật sự kích hoạt clamp.

**Đã sửa** (commit `ee8255df`, có test `test/text-indent-variant.test.ts` +
test runtime thật trong `motion-runtime/src/visual/text-layout.test.ts`):
- **`text-indent`** — trường mới xuyên suốt cả chain (schema Protocol V2 →
  motion-compiler → motion-runtime), chỉ dịch dòng đầu tiên của khối
  (kể cả giá trị âm/hanging-indent), không đụng các dòng wrap sau.
- **`font-variant: small-caps`** — trường `smallCaps` đã có sẵn trong schema
  Protocol nhưng chưa ai set/đọc. Runtime yêu cầu OpenType feature `smcp`
  qua HarfBuzz — an toàn no-op nếu font không hỗ trợ (xác nhận trực tiếp
  với Inter-400.ttf: glyph id/vị trí giống hệt có/không có request), không
  làm synthetic fallback (cần shape 2 lần, ngoài phạm vi). `font` shorthand
  trước đó từ chối `small-caps`, giờ mở rộng đúng thành longhand.

**Đã sửa** (commit `c64875fd`, có test `test/word-break.test.ts` + test
runtime thật trong `motion-runtime/src/visual/text-layout.test.ts`):
- **`word-break: break-all`** — map vào enum `wrap` mới thêm giá trị
  `character` (đã có sẵn trong schema nhưng runtime coi như `none`, chưa
  từng implement thật). `wrapLineByClusters()` mới bẻ dòng ở bất kỳ ranh
  giới grapheme cluster nào qua `Intl.Segmenter`, bỏ qua ranh giới từ/space.
- **`overflow-wrap` / `word-wrap: break-word`** — enum `wrap` mới thêm giá
  trị `word-break-long`. Bẻ dòng theo từ như bình thường, chỉ bẻ ký tự cho
  1 từ khi từ đó một mình không vừa cả dòng trống — khác `break-all` (bẻ
  lung tung). `word-break: break-all` thắng khi cả 2 cùng đặt, đúng thứ tự
  cascade CSS thật. `white-space: nowrap` vẫn tắt wrap hoàn toàn bất kể 2
  thuộc tính này.

**Đã sửa** (commit `f583389f`, có test `test/vertical-align.test.ts` + test
runtime thật trong `motion-runtime/src/visual/text-layout.test.ts`):
- **`vertical-align`** (`baseline`/`sub`/`super`/length) — trường
  `baselineShift` per-span đã có sẵn trong schema nhưng trước đó
  motion-compiler chỉ đọc `firstSpan` (áp cho cả text, không phải riêng
  từng span) và bỏ qua hẳn 2 keyword `subscript`/`superscript` (map cứng về
  0). Giờ áp đúng cho TỪNG span riêng (`<sup>`/`<sub>` lồng trong câu chỉ
  dịch đúng phần chữ đó). `top`/`bottom`/`middle`/`text-top`/`text-bottom`
  báo lỗi rõ ràng thay vì render sai vị trí (các giá trị này cần biết
  line-box metrics, trường SVG-style `baseline-shift` không diễn đạt
  được). Đã verify chiều dấu (positive=xuống, negative=lên) bằng dữ liệu
  thật trước khi chốt, không suy đoán từ đọc code.

**Còn lại, chưa sửa** (Text, tần suất thấp hơn các mục đã sửa):
- [ ] `vertical-align` — gap đã biết từ trước, chưa sửa
- [ ] `text-decoration-style` khác `solid` (`wavy`/`dotted`/`dashed` underline)
      — chỉ nhận `solid`

**Không cần làm** (đã xác nhận không phù hợp với sản phẩm video/motion,
không phải gap thật): `position: sticky` (không có khái niệm scroll),
`float` (CSS legacy, layout hiện đại dùng flex/grid).

**Trạng thái**: 2/2 gap text tần suất cao nhất đã xong. Layout đã xong hết
gap đã biết (`grid-template-areas`, `flex-direction` reverse,
`grid-auto-flow`). `-webkit-line-clamp`, `text-indent`, `font-variant:
small-caps`, `overflow-wrap`/`word-break`, `vertical-align` đã xong. Còn 1
gap text (`text-decoration-style` khác `solid`) — mục lớn nhất trong 5 gap,
đụng cả 2 renderer (canvaskit-preview + export-renderer). Box model không
cần làm gì thêm ở Cấp 1.

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
đủ" bên dưới trước đó SAI, ghi nhầm mà chưa mở file test ra xem** — và sau
đó đã viết đủ test còn thiếu cho cả 6 mục (cùng ngày):

- [x] `filter` chain đơn (blur/brightness/contrast/saturate/hue-rotate/
      grayscale/sepia/invert/drop-shadow) — `effects.test.ts` đã có test cấp
      draw-call cho cả chain, nhưng **`saturate()` trước đó chỉ có coverage
      với giá trị neutral (`saturation: 1`, no-op)** — ma trận biến đổi
      saturation thật (`src/command/effects.ts` dòng 27-34) chưa từng được
      test với saturation ≠ 1. Đã thêm 2 test mới: `saturate(0%)` (khớp
      đúng công thức luminance-preserving grayscale) và `saturate(180%)`
      (oversaturate, mỗi hàng ma trận vẫn tổng = 1), commit `f1680805`.
- [x] `backdrop-filter` một mình (không kèm box-shadow) — CONFIRMED đúng từ
      trước: `backdrop-replay.test.ts` có 4 test assert trực tiếp arg
      truyền vào `canvas.saveLayer(paint, bounds, filter)`/`clipRect`, cấp
      draw-call thật. Không cần thêm gì.
- [x] **`box-shadow` + `mix-blend-mode`** — trước đó hoàn toàn chưa có test
      draw-call nào cho tổ hợp này lẫn `mix-blend-mode` nói chung (mọi test
      kit đều stub `setBlendMode(){}` thành no-op, không assert giá trị).
      Đã thêm: (1) `command-paint.test.ts` — cả 16 giá trị CSS
      mix-blend-mode map đúng qua `blendModeFor()`, kể cả fallback SrcOver
      cho tên lạ; (2) `command-replay.test.ts` — beginLayer có cả
      `blendMode` lẫn box-shadow `effectProgram` vẫn set đúng blend mode
      trên saveLayer paint của layer VÀ effect graph vẫn được nhận diện
      (không bị blend mode làm rớt). Commit `f1680805`.
- [x] **`box-shadow` + transform 3D** — trước đó chưa có test draw-call.
      Đã thêm test trong `command-replay.test.ts`: box-shadow effect filter
      được áp lên ảnh snapshot đã chiếu (qua nhánh `drawVertices`/mesh
      projective) thay vì âm thầm rơi về đường vẽ phẳng 2D. Verify test này
      thật sự phân biệt được 2 nhánh bằng cách tạm xoá perspective term và
      xác nhận assertion fail đúng như kỳ vọng. Commit `f1680805`.
- [x] **`text-shadow` + `filter`** — trước đó chỉ có test parse màu riêng lẻ
      (`paint-color-functions.test.ts`), không phải test tổ hợp trên cùng 1
      phần tử. Đã thêm test trong `command-replay.test.ts`: graph
      blur+contrast+drop-shadow gộp cài đặt trực tiếp lên saveLayer paint
      của layer chứa `drawText` thật (khác box-shadow: graph này không có
      alpha-mask nguồn "box" nên không phải sourceOnly, không cần pass
      offscreen riêng). Verify non-vacuous tương tự (xoá effectProgram →
      assertion fail). Commit `522b29e7`.
- [x] `opacity` phần trăm + animation opacity qua keyframes — `opacity-
      replay.test.ts` trước đó chỉ có 2 test single-frame/tĩnh, KHÔNG có
      test nào replay track animation qua nhiều frame/theo thời gian (dòng
      cũ "xác nhận đã replay đúng theo thời gian" là sai, chưa từng
      verify). Đã thêm 2 test multi-frame: track opacity thường (per-frame
      alpha độc lập trên từng lần gọi replay riêng, mô phỏng 3 frame đã
      evaluate) và track group `compositeAlpha` qua ranh giới saveLayer
      isolate qua nhiều frame. Commit `f1680805`.

**1.3 giờ đã xong** — cả 6 mục đều có test draw-call thật, không mục nào
còn thiếu.

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
  `text-transform`, đã xong, commit `fdcaa167`). `-webkit-line-clamp`
  (commit `3a0172c7`), `text-indent` + `font-variant: small-caps` (commit
  `ee8255df`), `overflow-wrap`/`word-break` (commit `c64875fd`),
  `vertical-align` (commit `f583389f`) cũng đã xong. Còn 1 gap:
  `text-decoration-style` khác `solid`.
- Layout: `grid-template-areas` + `grid-area` (commit `adc9f4e2`),
  `flex-direction` reverse (commit `20357004`), `grid-auto-flow` (commit
  `0374fd4d`) đều đã xong. Hết gap layout đã biết ở 1.0.

**1.1 (audit tổ hợp box-shadow) xong** — xác nhận 2 bug riêng (1.2:
shadow+filter, có diagnostic; 1.2b: shadow+backdrop-filter, im lặng không
diagnostic) và 3 tổ hợp an toàn (blend-mode, transform 3D, text-shadow).

**1.3 (khoá lại hiệu ứng an toàn bằng test) xong** — cả 6 mục đều có test
draw-call thật, commit `f1680805`/`522b29e7`. Trong lúc làm phát hiện 2
dòng "đã có, đủ" ghi trước đó (saturate(), opacity animation) thực ra SAI —
đã sửa lại trong doc lẫn viết test bù, xem chi tiết ở mục 1.3 phía trên.

**Thứ tự tiếp theo** (đúng nguyên tắc "case cơ bản đủ điều kiện trước case
mix" — 1.2/1.2b tạm giữ nguyên, chưa động vào):
1. ~~`flex-direction` reverse + `grid-auto-flow` (layout, còn lại của
   1.0)~~ — XONG.
2. ~~1.3 (khoá test cho hiệu ứng an toàn)~~ — XONG.
3. ~~`-webkit-line-clamp`, `text-indent`, `font-variant: small-caps`,
   `overflow-wrap`/`word-break`, `vertical-align`~~ — XONG. Còn
   `text-decoration-style` (mục cuối cùng, lớn nhất, đụng 2 renderer).
4. Quay lại 1.2 + 1.2b (case mix box-shadow) sau khi 1.0 xong hoàn toàn.

Không mở nhiều mục cùng lúc trong danh sách trên.
