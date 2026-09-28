# Nợ kỹ thuật (Technical Debt)

Ghi lại các điểm đã biết là chưa hoàn thiện, chưa tối ưu, hoặc là giải pháp
tạm thời — không phải bug đang khai thác được, nhưng nên quay lại khi có
thời gian. Cập nhật file này khi phát sinh nợ mới hoặc khi trả xong một mục
(xóa mục đó, không giữ lịch sử ở đây — lịch sử đã có trong git log).

## Bảo mật / an toàn dữ liệu

### SVG upload chỉ chặn bằng regex-blocklist, chưa phải sanitizer thật
- Vị trí: `apps/web/app/api/v1/assets/upload/complete/route.ts`,
  `apps/web/lib/mcp/assets.ts` (`svgContainsExecutableContent`).
- Hiện tại: chặn `<script>`, thuộc tính `on*=`, `javascript:`, `<foreignObject>`
  bằng regex. Chặn được các payload phổ biến nhưng không phải giải pháp
  triệt để — kẻ tấn công kiên trì có thể tìm cách lách qua (`<use href>` trỏ
  ra ngoài, encoding lạ, v.v.).
- Giải pháp đúng: sanitizer thật (DOMPurify SVG profile) hoặc rasterize SVG
  thành PNG ngay khi upload để loại bỏ hoàn toàn khả năng chạy script.

### Chưa có Content-Security-Policy toàn app
- Không có CSP header nào trong toàn bộ app (đã grep xác nhận). Đây là lớp
  defense-in-depth bổ sung cho vấn đề SVG ở trên và các vector XSS khác nói
  chung.
- Chưa làm vì rủi ro phá vỡ chức năng hiện có nếu thêm vội — cần khảo sát kỹ
  mọi nguồn script/style/font đang dùng trước khi viết policy.

### Không kiểm tra magic-byte cho image/video/audio
- Chỉ có font (`parseUserFont`) và giờ SVG là có kiểm tra nội dung thật;
  các loại còn lại tin hoàn toàn vào `Content-Type` client khai báo.
- Rủi ro thấp hơn SVG nhiều vì `X-Content-Type-Options: nosniff` đã chặn lớp
  browser-sniffing, nhưng vẫn chưa phải kiểm tra tuyệt đối.

### `create_team_workspace` chỉ chặn seat bằng ngưỡng cứng, chưa có billing thật
- Vị trí: migration `20260922082515_cap_team_workspace_seats_pending_billing.sql`.
- Hiện tại: chặn `p_seats > 50` để giới hạn thiệt hại tối đa, nhưng
  `seats_purchased` vẫn là số client tự khai, không xác minh qua thanh toán.
- Cần làm khi có Stripe (hoặc cổng thanh toán khác): chuyển `seats_purchased`
  thành field chỉ set được qua webhook thanh toán đã xác nhận, không cho
  client tự set trực tiếp qua RPC.

### Grant hygiene: `anon` có UPDATE trên mọi cột của `workspaces`
- RLS hiện chặn hết vì mọi policy chỉ áp cho `authenticated`, nên không khai
  thác được ở trạng thái hiện tại — nhưng nếu sau này có ai vô tình thêm
  policy cho `anon`/`public`, gap này sẽ lộ ra ngay.
- Nên revoke UPDATE trên `created_by`, `kind` khỏi `anon` cho gọn, dù không
  khẩn cấp.

### Leaked-password-protection đang tắt trong Supabase Auth
- Đây là setting trong Supabase Dashboard (Auth), không phải code/migration.
- Bật lên để chặn user đặt mật khẩu đã từng bị lộ (kiểm tra qua
  HaveIBeenPwned).

## Render pipeline

### Chunk rendering đang tắt hoàn toàn, thiết kế có thể đổi
- Toàn bộ cơ chế chunk (`render_job_chunks`, `buildRenderChunkManifest`,
  Cloud Run Chunk Job/Finalizer Job) vẫn còn trong code nhưng bị gate sau
  `RENDER_CHUNK_EXECUTION_ENABLED=false` — MVP chỉ chạy 1 Cloud Run job/lần
  render, cố định 4 vCPU / 16 GiB.
- Trước khi bật lại cần: (1) benchmark thật 4 vs 8 vCPU trên cùng 1 chunk để
  biết renderer có tận dụng đa nhân không, (2) quyết định ngưỡng thời lượng
  video nào thì chia chunk, (3) có thể redesign lại cách chia chunk (hiện
  đang cố định 300 frame/chunk, benchmark cũ cho thấy điều này gây lệch tải
  giữa các chunk khá nhiều).
- Dữ liệu benchmark hiện có (`docs/benchmark/render-benchmark-comprehensive-assessment.md`)
  đã cũ (chạy trên bản native Skia CPU chưa hoàn thiện feature parity), không
  nên dùng để quyết định số liệu cuối cùng — cần đo lại trên bản renderer
  hiện tại.

### Lệch lớn giữa browser và native khi hình học vượt qua near clip plane (perspective)
- Phát hiện khi verify pixel-diff cụm fixture `perspective` (native-stage
  playground), không phải lỗi mới phát sinh — các fixture này chỉ bị di
  chuyển tọa độ khi gộp file, không đổi bất kỳ giá trị CSS nào, nên hành vi
  lệch này đã tồn tại từ trước.
- Case ID bị ảnh hưởng nặng nhất (pixel-diff 46%-63%, tính bằng ngưỡng
  |ΔR|+|ΔG|+|ΔB| > 60 trên tổng 2,073,600 pixel):
  `html-compiler.perspective.mask-filter-near-plane` (60.8%),
  `html-compiler.perspective.mask-add-intersect-near-plane` (55.8%),
  `html-compiler.perspective.mask-different-perspective-boundary` (46.1%),
  `html-compiler.perspective.filter-drop-shadow-after-blur-near-plane` (63.0%);
  nhẹ hơn nhưng vẫn đáng chú ý: `mask-one-corner-near-plane` (6.0%),
  `nested-clip-path` (4.65%, nghi là do anti-alias viền clip-path, không
  chắc cùng nguyên nhân).
- Hiện tượng: cả 4-5 case đầu đều dùng `perspective` rất ngắn (190-260px,
  hoặc perspective lồng nhau outer/inner) kết hợp góc xoay đủ lớn khiến một
  phần bề mặt thẻ vượt qua near clip plane (w=0 trong không gian đồng nhất).
  Browser (Chrome) vẽ ra một khối hình lớn, cạnh sắc nét, gần như lấp kín
  canvas; native (compiler → Runtime/Skia) vẽ ra một khối rất nhỏ/mỏng ở
  đúng vị trí lẽ ra phải hiện.
- Đã thử tính tay ma trận perspective cho case `filter-blur-near-plane`
  (nay gộp trong `mask-filter-near-plane.html`): `perspective:190px`,
  card 420×280 `translateZ(160px) rotateY(28deg)` → phần bên trái thẻ
  (khoảng 35% chiều rộng) có z vượt quá 190 (w<0, sau lưng camera), điểm
  giao cắt w=0 nằm ở x≈-63.9 (tính từ tâm thẻ). Nếu chia phối cảnh
  (perspective divide) trực tiếp không cắt (clip) trong không gian đồng
  nhất trước, phần thẻ gần điểm giao cắt sẽ bị phóng to tới vô cực về mặt
  toán học — khớp với hình lớn mà browser đang vẽ. Renderer 3D chuẩn (và
  theo mô tả trong `packages/canvaskit-preview/src/command/geometry.ts` —
  `projectiveMeshSvg`/`projectiveTextureMesh` clip ở `w - ε ≥ 0` trước khi
  chia, có adaptive subdivision) phải cắt hình học trước để tránh hiện
  tượng phóng-to-vô-hạn đó — khớp với hình nhỏ, có giới hạn mà native đang
  vẽ.
- **Chưa xác định được bên nào đúng theo chuẩn CSS Transforms**: có thể
  Chrome đúng chuẩn còn native cắt quá tay (bug thật, cần sửa
  `projectiveMeshSvg`/`projectiveTextureMesh` hoặc logic near-plane), hoặc
  ngược lại Chrome tự nó có giới hạn xử lý near-plane cho perspective cực
  ngắn (rất hay gặp ở nhiều engine CSS 3D, không phải lúc nào cũng đúng
  chuẩn) còn native mới là chuẩn.
- Cần làm để kết luận dứt điểm: (1) lấy transform/frame thực tế mà compiler
  xuất ra cho case này (qua `compileHtmlCss`/`compileDocument` trực tiếp,
  không qua trình duyệt), đối chiếu tay với công thức CSS Transforms spec
  cho perspective matrix; (2) kiểm tra hành vi near-plane clipping của
  chính Chrome qua tài liệu/spec chính thức (không suy đoán từ ảnh chụp);
  (3) nếu xác định native sai, sửa trong
  `packages/canvaskit-preview/src/command/geometry.ts` (đường
  `projectiveMeshSvg`/`projectiveTextureMesh`) hoặc
  `packages/motion-compiler/src/compiler/index.ts` (cờ `depthClip`, dòng
  ~234-242 — hiện tại bất kỳ layer nào có CSS perspective sẽ khiến toàn bộ
  project chuyển `depthClip: "w-only"`, tắt hẳn 2 mặt phẳng z≥0/w-z≥0, có
  thể liên quan).

### Route download token fallback là dead code
- Vị trí: `apps/web/app/api/v1/renders/[id]/download/route.ts` — nhánh
  không phải R2 (`artifactPath` không bắt đầu `r2://`) tự tạo một token
  base64url nhưng không có endpoint nào validate token này; access control
  thật vẫn nằm ở `assertJobAccess` trong chính handler khi được gọi lại.
  Không phải lỗ hổng (vẫn an toàn) nhưng là code gây hiểu nhầm, nên dọn hoặc
  xóa khi có dịp.

## Vận hành / triển khai

### Cron `storage-maintenance` cần xác nhận `CRON_SECRET` đã đồng bộ lên Vercel
- Route: `apps/web/app/api/internal/cron/storage-maintenance/route.ts`,
  lịch chạy trong `apps/web/vercel.json` (mỗi giờ).
- `CRON_SECRET` đã có trong `.env.deploy` nhưng cần xác nhận giá trị đã được
  set đúng trong Vercel project settings (biến môi trường không tự động
  đồng bộ từ file `.env.deploy` lên Vercel).

## Text layout (line-break / bidi)

### Line-break UAX #14 chưa hỗ trợ Thái/Lào/Khmer/Miến Điện
- Vị trí: `packages/motion-runtime/src/visual/line-break.ts` (`lineBreakTokens`),
  dùng package `linebreak` (pure JS, ~228KB, không wasm).
- Hiện tại: đã thay được regex `\S+(?:\s+|$)` bằng bảng UAX #14 thật, sửa đúng
  case CJK (Trung/Nhật/Hàn ngắt được từng ký tự dù không có dấu cách) — đã
  verify bằng test hồi quy thật (`line-break.test.ts`,
  `text-layout.test.ts` case "wraps a CJK string"). Nhưng Thái/Lào/Khmer/Miến
  Điện cũng không dùng dấu cách để tách từ, mà package này chỉ có bảng
  rule-based, không có dữ liệu dictionary/LSTM các script đó cần — nên vẫn bị
  coi là một "từ" không ngắt được duy nhất, y hệt lỗi cũ.
- Giải pháp đúng: đổi sang `icu4x`/ICU4X WASM binding (`icu` trên npm,
  `LineSegmenter.createAuto()` có kèm dữ liệu LSTM cho 4 script này) — đánh
  đổi ~20MB wasm monolithic (đã đo thật, xem lịch sử trò chuyện) so với 228KB
  hiện tại. Cần đo lại xem cắt được data xuống bao nhiêu nếu build riêng
  component, trước khi quyết định đổi.
- Tokenizer `pre-wrap`/`break-spaces` (`text-layout.ts:334`,
  `matchAll(/\S+|\s+/g)`) **chưa** đổi sang `lineBreakTokens` — cố tình bỏ
  qua vì CSS pre-wrap cần mỗi khoảng trắng là một điểm ngắt độc lập (giữ
  nguyên số khoảng trắng khi wrap), khác với ngữ nghĩa "attach trailing
  whitespace vào từ trước" mà `lineBreakTokens` cung cấp cho `wrap: word`.

### Bidi (UAX #9) mới sửa phần layout thật, đo độ rộng để wrap vẫn theo hướng cũ
- Vị trí: `packages/motion-runtime/src/visual/text-layout.ts` — `layoutText()`
  (sinh glyph thật) đã tách theo bidi-run và sắp lại thứ tự hiển thị đúng
  (`bidi-resolve.ts`); `measureSourceLine()` (đo bề rộng để quyết định ngắt
  dòng, dùng trong `sourceLinesForText`'s greedy-fit) thì **chưa** — vẫn shape
  cả đoạn text đưa vào làm một buffer HarfBuzz theo một direction duy nhất.
- Hiện tại: với dòng có trộn hướng (Ả Rập/Hebrew chen trong câu Latin), số đo
  bề rộng dùng để quyết định điểm ngắt dòng có thể lệch vài pixel so với độ
  rộng glyph thật sẽ render ra (vì shape theo 1 buổi/1 direction cho ra
  kerning/mark-positioning hơi khác so với shape tách run rồi cộng lại) — chỉ
  ảnh hưởng tới việc CHỌN điểm ngắt dòng, không phải vị trí glyph cuối cùng
  (đã verify layoutText đúng qua ảnh chụp Chrome thật).
- UAX #9 rule L1 (reset level của whitespace cuối dòng về base direction khi
  bị ngắt dòng) chưa cài — ảnh hưởng vị trí khoảng trắng cuối dòng RTL khi
  đoạn RTL bị wrap thành nhiều dòng.
- Bidi bị bỏ qua hoàn toàn cho `writing-mode: vertical-rl/vertical-lr`
  (`layoutText`, biến `vertical`) — fallback về hành vi cũ (1 direction cho cả
  dòng), chưa có test/fixture nào cho tổ hợp RTL + vertical.

## Render pipeline

### [ĐÃ SỬA] CanvasKit-preview lag hàng giây/frame: nguyên nhân là box-shadow blur trên CPU raster, không phải thiếu cache filter
- Triệu chứng: fixture `debug/neonix-motion-test-10s` có `gpuFrameTimeMs`
  khoảng **3900-4100ms/frame** (budget 30fps = 33.3ms). Phần lớn chi phí nằm
  trong `endLayerTimeMs`.
- Giả thuyết cũ bị bác bỏ: trước đây cho rằng nguyên nhân là "Chrome cache kết
  quả filter trên compositor layer, còn chúng ta tính lại `canvas.restore()`
  mỗi frame". Benchmark CanvasKit thật trên GPU (GTX 1650, ANGLE/D3D11) cho
  thấy `filter: blur(70px)` saveLayer của orb chỉ tốn khoảng 2.8ms, và
  backdrop-filter blur card 300×300 chỉ khoảng 2.4ms. Vì vậy không cần cơ chế
  cache raster/tách transform phức tạp mà mục cũ từng đề xuất.
- Nguyên nhân thật: `drawBoxEffect`
  (`packages/canvaskit-preview/src/command/box-effect.ts`) dựng halo
  box-shadow như sau:
  - mỗi branch, mỗi frame tạo 3-4 surface bằng `kit.MakeSurface()`. Trong
    CanvasKit hàm này tạo **surface raster CPU**, kể cả khi canvas chính là
    WebGL;
  - blur trên CPU (orb 520px + spread 80 + blur 200 → ảnh 1282² px);
  - `makeImageSnapshot`, rồi upload texture lại lên GPU.
  Hàm này được gọi trong `endLayer`, nên chi phí bị tính vào
  `endLayerTimeMs`. Riêng 1 orb đo được **~597ms/frame**.
- Fix: port đúng cách Blink vẽ box-shadow. Theo
  `BoxPainterBase::PaintNormalBoxShadow`/`PaintInsetBoxShadow` trong
  `core/paint/box_painter_base.cc`, `cc::DrawLooper` chỉ gắn
  `SkMaskFilter::MakeBlur(kNormal, sigma, respectCTM)` cùng màu `SrcIn` rồi
  vẽ thẳng lên canvas đích. Cụ thể:
  - Outer: clip-out owner rrect, fill rrect đã outset theo spread
    (`outsetSilhouette`, công thức Blink) và dịch theo offset.
  - Inset: clip-to owner, `drawDRRect(outer, owner)`, với outer theo
    `AreaCastingShadowInHole`.
  - Sigma lấy từ `ShadowData::BlurRadiusToStdDev` = `radius * 0.5` (đúng
    spec).
  Skia GPU vẽ blurred rrect giải tích nên không cần surface nào. Code nằm ở
  `drawBoxShadowBranchesDirect()` trong `box-effect.ts`. Đường offscreen cũ
  chỉ còn là fallback khi CanvasKit thiếu `MaskFilter`/`clipRRect`/
  `drawDRRect` (test double) hoặc effect box có perspective.
- Đo lại bằng Playwright cùng một harness, Chrome thật so với CanvasKit:
  - Frame time của `neonix-motion-test-10s` quanh t=2s: **3927ms → 16.6ms**
    (median 12 frame).
  - Fidelity, meanΔ trước → sau: spread-shapes 1.77→1.60, spread-sweeps
    1.23→0.97, spread-routing 1.51→1.30, inner-glow 0.53→0.38,
    combined-glow 0.54→0.36, outer-glow 0.30→0.24, paint/box-shadow
    0.32→0.30. Các fixture ring/backdrop bằng hoặc tốt hơn một chút; không
    fixture nào kém đi.
  - Test: `packages/canvaskit-preview/test/box-shadow-direct.test.ts`.
- Còn lại:
  - Các offscreen khác vẫn dùng `kit.MakeSurface` (CPU raster): CSS mask
    trong `endLayer` (full-frame!), các nhánh projective ở `draw-ops.ts`, và
    fallback box-effect. Nếu scene có mask hoặc perspective bị lag, hướng fix
    là tạo offscreen từ surface chính bằng `surface.makeSurface(imageInfo)`
    (GPU khi preview, CPU khi readback). Benchmark cho thấy cùng pipeline
    nhanh hơn khoảng 100 lần.
  - `effectBox` của box-shadow là **padding box**
    (`motion-runtime` `effectBoxFor`, `box: "padding"`) cho cả outer lẫn
    inset. Blink dùng border box cho outer shadow, nên phần tử có border bị
    lệch đúng bằng độ dày border. Lỗi này có từ trước, chưa sửa.
  - `render-native` (native) chưa port cách vẽ này (xem mục sigma ngay
    dưới).

### [ĐÃ SỬA] Khung chữ nhật quanh text-shadow khi phần tử cha đang animate opacity
- Triệu chứng: ở `debug/neonix-motion-test-10s`, khoảng t=0.8-1.1s, chữ
  "NEONIX" hiện một khung chữ nhật có mép cứng, bên trong sáng hơn bên ngoài.
  Khung biến mất khi `titleIn` fade xong.
- Nguyên nhân: khi opacity < 1, `.title` được replay thành `beginLayer` có
  `compositeAlpha`, nên phải `saveLayer` với bounds = `layerContentBounds()`.
  Hàm này bỏ qua hoàn toàn nội dung của layer lồng nhau (`if (depth > 0)
  continue`). Vì vậy bounds chỉ bằng hộp `title::paint`
  (`[-34,56,1954,193]`), trong khi layer con `title::text` có text-shadow blur
  109px cần `[-363,-273,2283,522]`. Halo của con bị cắt theo bounds của cha.
  Khi opacity = 1, cha thành `beginGroup`, không có saveLayer, nên hết lỗi.
- Fix (`packages/canvaskit-preview/src/command/layers.ts`,
  `scopeContentBounds`): bounds của một scope giờ là union đệ quy của mọi
  scope con. Mỗi layer con được nới thêm `effectFilterExpansionPadding` của
  chính nó, giống cách Blink tính bounds của effect node từ visual rect của
  descendant sau khi map qua filter.
- Đo bằng Playwright, Chrome so với CanvasKit: vùng title ở t=1.033s có
  changed% 5.6 → 1.6 và meanΔ 3.17 → 2.41. Các fixture backdrop/box-shadow/
  text-shadow không đổi pixel nào. Median frame time không đổi (fade
  11.4 → 11.6ms, settled 15.7 → 15.6ms). Regression test nằm trong
  `test/save-layer-bounds.test.ts`.

### Công thức sigma của text-shadow/box-shadow chưa port sang render-native
- Vị trí: `packages/canvaskit-preview/src/command/effects.ts`
  (`cssShadowBlurRadiusToSkiaSigma`, dùng chung cho text-shadow và box-shadow
  không inset từ bản sửa gần đây) — mới sửa ở `canvaskit-preview` (browser
  preview), theo đúng quy ước "sửa canvaskit-preview trước, port native sau".
  `render-native` (Skia native dùng khi export MP4 thật) vẫn ở trạng thái
  cũ (nếu có logic sigma riêng, cần đối chiếu).
- Đã đo pixel thật (ground-truth Chrome vs canvaskit-preview) trên hình chữ
  nhật sạch: lệch <3% ở blur 24px/40px, lệch nhiều hơn (~16%) ở 4px nhưng nghi
  là nhiễu đo lường ở quy mô quá nhỏ (đã tự validate method qua synthetic
  test), không phải bug công thức.
- Cần làm: kiểm tra `render-native` có đang dùng đúng
  `cssShadowBlurRadiusToSkiaSigma` tương đương không, port nếu chưa, để export
  MP4 khớp với preview.

### [ĐÃ SỬA] box-shadow spread từng dùng dilate hình chữ nhật cho case đơn/list — giờ mọi branch có spread đều route qua drawBoxEffect (geometry expansion)
- Vị trí: `packages/canvaskit-preview/src/command/effects.ts`
  (`effectFilterFor`'s nhánh đơn-shadow-có-spread, và `boxShadowBranches()`),
  `packages/canvaskit-preview/src/command/replay.ts` (`drawBoxEffect`, đã
  sửa trước đó dùng geometry expansion).
- Root cause (đã sửa): `effectFilterFor` trước đây chỉ set `sourceOnly: true`
  (route qua `drawBoxEffect` đã sửa đúng) khi có ≥2 box-shadow trong list,
  hoặc kèm CSS `filter`. Box-shadow ĐƠN + spread — kiểu "glow orb" phổ biến
  nhất — vẫn dùng nhánh "ordinary" (dilate/erode hình chữ nhật cài thẳng vào
  paint). Đồng thời `boxShadowBranches()` (gate cho multi-shadow-list) thiếu
  logic bỏ qua op `morphology` mà `boxShadowOverlayBranches()` (replay.ts)
  đã có, nên list ≥2 shadow có spread bị rơi hẳn ra
  `renderer_effect_unsupported` (không render gì).
- Fix: (1) nhánh đơn-shadow-có-spread trong `effectFilterFor` giờ gọi
  `makeMixedBoxShadowFilter` với 1 branch và trả `sourceOnly: true`, tái
  dùng đúng route `drawBoxEffect` đã sửa thay vì tự dựng filter dilate; (2)
  thêm logic bỏ qua `morphology` per-branch vào `boxShadowBranches()`, y hệt
  bản đã có ở `boxShadowOverlayBranches()`/`splitLeadingBoxShadowThenFilter`.
- Đo pixel-diff thật trước/sau fix (`apps/web/e2e/box-shadow-spread-comparison.spec.ts`,
  12 fixture ở `apps/web/public/docs/html-compiler/fixtures/debug/box-shadow-spread-*.html`):
  circle 5.40%→0.42%, magnitude-sweep 12.52%→0.83%, circle-offset
  5.22%→0.45%, corner-radius-sweep 11.30%→2.64%, pill-shape 2.86%→0.79%.
  2shadow-list: từ unsupported hoàn toàn → render đúng, khớp gần với
  baseline single-shadow (0.64%).
- [ĐÃ SỬA TIẾP] Phát hiện phụ khi đo lại: `spread-radius-sweep` (rect
  thường, cornerRadius:0) tăng từ 0.85%→2.85% ở tile spread lớn (+90px).
  Giả thuyết ban đầu ("browser cũng bo tròn góc nhọn ở spread lớn, hành vi
  mới đúng hơn") SAI — kiểm tra lại bằng 3 fixture đào sâu
  (`box-shadow-spread-sharp-rect-isolated.html`,
  `-radius-vs-spread-relationship.html` [spread=90 cố định, quét radius
  0/20/40/60], `-extreme-large-spread.html` [radius:0, quét spread
  100/150/200]) cho thấy **browser thật giữ góc SẮC NÉT ở mọi mức spread
  khi cornerRadius:0**, kể cả spread=200px — công thức `radius + spread`
  của tôi sai hoàn toàn cho radius nhỏ, không chỉ riêng biên radius:0.
- Root cause thật (đã lấy từ source Chromium
  `third_party/blink/renderer/platform/geometry/float_rounded_rect.cc` qua
  chromium.googlesource.com, vì bản checkout local không có file này):
  `ComputeOutsetAdjustedBorderRadius` — nếu radius gốc = 0 thì **giữ
  nguyên 0** bất kể spread (early return, không cộng gì cả); nếu radius >
  0 thì dùng công thức phi tuyến bậc 3 (KHÔNG phải cộng thẳng):
  `coverage = 2*min(radius/boxWidth, radius/boxHeight)`; nếu
  `radius > spread` hoặc `coverage > 1` thì mới là `radius + spread`
  (đúng bằng công thức cũ của tôi — giải thích vì sao case hình tròn,
  radius=100 > spread=70, luôn đúng ngay từ đầu); còn lại thì
  `ratio = radius/spread`, kết quả =
  `radius + spread * (1 - (1-ratio)³ * (1-coverage³))`.
- Fix: `outsetSilhouette()` (`packages/canvaskit-preview/src/command/replay.ts`)
  port lại chính xác công thức trên (branch `cornerRadius===0 || spread===0`
  giữ nguyên radius; còn lại tính `coverage`/`ratio`/cubic đúng thứ tự
  Chromium) thay vì `cornerRadius + spread` đơn giản.
- Đo lại pixel-diff sau fix công thức: `extreme-large-spread` 11.78%→0.99%,
  `radius-vs-spread-relationship` 6.43%→0.99%, `sharp-rect-isolated`
  2.65%→0.67%, `corner-radius-sweep` 2.64%→1.03%. Toàn bộ 14 fixture giờ
  nằm trong khoảng 0.3%-1.0%, đồng đều với baseline offset-only (~0.7%) —
  không còn case nào lệch bất thường.
- Việc còn lại: port fix này (cả routing lẫn công thức corner-radius) sang
  `render-native` (native backend) — xem mục sigma text-shadow/box-shadow
  phía trên, cùng một nợ "chưa port sang render-native".
- [DỌN DẸP] 15 fixture debug kể trên (`box-shadow-spread-*`,
  `box-shadow-offset-*-sweep`) đã được gộp thành 3 fixture cố định trong
  catalog `effect`: `box-shadow-spread-shapes.html` (5 case hình dạng),
  `box-shadow-spread-sweeps.html` (7 sweep tham số, gộp trong 1 file),
  `box-shadow-spread-routing.html` (routing single/2-shadow-list/offset).
  `e2e/box-shadow-spread-comparison.spec.ts` đã trỏ sang 3 id mới này.

## Layout (html-compiler)

Cả 4 bug dưới đây đều được phát hiện qua so sánh trực tiếp native compile vs
`layoutSnapshot` (CDP đo bằng Chrome thật qua `infra/cloud-run/layout-probe`
— xem `apps/web/scripts/html-compiler-layout-snapshot-diff.mts` và
`.html-compiler-layout-snapshots/report.md`), không phải suy đoán. `layoutSnapshot`
đã che (mask) toàn bộ 4 bug này cho bất kỳ caller nào bật flag
`LAYOUT_SNAPSHOT_ENABLED`, nên KHÔNG chặn việc dồn ưu tiên sang hoàn thiện
paint — nhưng native tự thân (đường mặc định, không CDP) vẫn sai, cần quay
lại patch khi có thời gian.

### Anonymous flex text alignment — [ĐÃ SỬA]
- Đã fix trong `packages/html-compiler/src/compiler/pipeline/compile.ts`
  (hàm `flexAnonymousTextAlignment`) — giữ dòng này lại làm mốc tham chiếu,
  xóa khi rà soát lần sau (theo quy ước đầu file, lịch sử đã có trong git log).

### Implicit grid track auto-sizing tính gần như 0 thay vì auto-size theo content
- Vị trí: `packages/html-compiler/src/compiler/layout/grid.ts` (thuật toán
  auto-placement/sizing cho track ngầm định — chưa trace ra đúng dòng).
- Hiện tại: khi item tràn ra ngoài `grid-template-columns`/`grid-template-rows`
  tường minh và tự đặt vào track ngầm định (implicit row/column thứ 3 trở đi),
  native tính kích thước track đó gần như 0 (không phải auto-size theo
  content). Đo cụ thể trên fixture `grid-auto-flow`
  (`apps/web/public/docs/html-compiler/fixtures/layout/grid-auto-flow.html`,
  cũng đăng ký trong `html-playground-cases.ts`): item thứ 5 (`row-e`/`col-e`)
  — CDP đo đúng height≈328px / width≈288px, native tính ra 1px.
- Cần làm: sửa auto-placement trong `grid.ts` để track ngầm định tự tính kích
  thước theo intrinsic size của item rơi vào nó, đúng CSS Grid's implicit
  track sizing algorithm.

### Margin-collapse sai trên diện rộng
- Vị trí: chưa trace ra dòng cụ thể — nghi trong phần xử lý margin-collapse
  của `compile.ts`/`geometry.ts` (`topMarginOverride`, block formatting
  context).
- Hiện tại: fixture `html-compiler.layout.block-flow-margin-collapsing`
  (`apps/web/public/docs/html-compiler/fixtures/layout/block-flow-margin-collapsing.html`)
  — MỌI case (a→f) đều lệch height 24-99px so với CDP. Đây là bug diện rộng
  trong logic margin-collapse, không phải 1 case lẻ.
- Cần làm: trace từng case a-f để xác định rule margin-collapse nào (sibling
  margin, parent-child margin qua border/padding=0, margin âm...) đang bị
  tính sai so với CSS spec.

### `containing-block-edge-cases`: 1 layer sai width +300px
- Vị trí: fixture
  `apps/web/public/docs/html-compiler/fixtures/layout/containing-block-edge-cases.html`,
  layer `edge-clip-wide` (mô tả trong fixture: "display: contents promotes
  the wrapped child straight into the grid, wrapper itself generates no
  box").
- Hiện tại: CDP đo đúng, native lệch +300px width. Chưa trace root cause cụ
  thể — nghi liên quan cách resolve containing block khi có `display:
  contents` kết hợp grid.
- Cần làm: trace containing-block resolution cho case cụ thể này trong
  `compile.ts`'s xử lý `display: contents` (dòng ~244) kết hợp grid
  placement.

### Nested auto-size flex container bị tính thành full-parent-size thay vì shrink-to-fit (ưu tiên cao nhất)
- Vị trí: `packages/html-compiler/src/compiler/layout/geometry.ts`,
  `resolveGeometry()` (khoảng dòng 136-145 — nhánh `widthAuto`/`heightAuto`
  hiện fallback thẳng về `availableContentWidth`/`availableContentHeight`,
  tức "lấp đầy khoảng trống của parent", thay vì tự tính intrinsic
  shrink-to-fit size khi bản thân node là `display:flex`/`display:grid` và
  không có width/height khai báo).
- Hiện tại: đo trực tiếp qua fixture debug `neonix-motion-test-10s`
  (`apps/web/public/docs/html-compiler/fixtures/debug/neonix-motion-test-10s.html`,
  group "debug", đã được thêm vào bake CDP one-off qua
  `EXTRA_CURATED_IDS` trong `html-compiler-layout-snapshot-bake.mts`/`-diff.mts`):
  `.stage` (`display:flex; flex-direction:column`, không khai width/height,
  là con duy nhất của `<body>` cũng `display:flex`) — CDP đo đúng
  ~1060×615px (khớp công thức center-trong-1920×1080), native tính ra
  **1920×1080 (full canvas)**. `.cards` (`display:flex; flex-direction:row`,
  không khai width, con của `.stage`) — CDP đo đúng ~760px
  (=230px×3 card + 32px×2 gap), native tính ra **1920px**.
- Đây là bug dễ tái hiện nhất trong nhóm layout: bất kỳ flex/grid container
  nào không khai width/height VÀ tự nó cũng `display:flex`/`display:grid`,
  lồng trong 1 flex/grid container khác, đều có nguy cơ dính bug này — mức
  độ nghiêm trọng cao hơn 3 bug còn lại vì phạm vi tái hiện rộng hơn nhiều
  (không giới hạn ở grid implicit-track hay margin-collapse, mà ở bất kỳ
  flex-trong-flex/grid-trong-grid nào).
- Cần làm: thêm bước tính intrinsic (shrink-to-fit) width/height cho
  trường hợp node tự nó là flex/grid container và có `width:auto`/`height:auto`
  — hiện `resolveGeometry()` không có khái niệm "intrinsic size của 1 flex/grid
  container dựa trên children", chỉ có `intrinsicContentHeight` cho text
  (truyền từ caller). Cần 1 pass đo trước (tương tự cách `intrinsicContentHeight`
  đã làm cho text) chạy `resolveFlexLayout`/`resolveGridLayout` ở chế độ
  "đo kích thước" trước khi biết `containingWidth/Height` thật của chính
  node đó.

## Playground tooling

### `ComparePreviewLab.tsx` hard-code composition 1920×1080 cho panel "Browser CSS reference"
- Vị trí: `apps/web/components/playground/ComparePreviewLab.tsx` (hằng số
  `WIDTH = 1920, HEIGHT = 1080` dùng cho kích thước iframe, class
  `w-[1920px] h-[1080px]`, badge "1920×1080" cố định).
- Hiện tại: panel "Native renderer output" đọc đúng composition thật từ
  protocol đã compile (`logicalWidth`/`logicalHeight` trong canvas dataset),
  nhưng panel browser-reference luôn cố định khung 1920×1080 bất kể fixture
  đang chọn khai báo composition gì trong `<meta name="neonix-document">`.
  Với fixture composition khác 1920×1080 (vd 3 fixture debug text-shadow-halo,
  2 fixture debug bidi), nội dung 2 panel bị lệch tỉ lệ hiển thị dù layout
  logic cả hai đều đúng — đã workaround bằng cách đổi các fixture debug đó
  sang composition 1920×1080 cho khớp quy ước số đông, chưa sửa tận gốc tool.
- Cần làm: đọc composition thật từ fixture (giống cách panel native đang làm)
  thay vì hard-code, để hỗ trợ đúng mọi kích thước composition trong tương
  lai.

## Animation pipeline (found while compiling debug/neonix_ui_transform_showcase.html + neonix_physics_path_showcase.html + neonix_particle_showcase.html)

Ba fixture debug này là bộ "showcase" cố tình phủ nhiều idiom animation khác
nhau (16+13+18 act). Biên dịch qua `compileDocument()` (html-compiler một
mình) đã pass 167/167 từ trước, nhưng chạy tiếp qua toàn bộ pipeline runtime
thật (`compileProtocol`/`compileAndPrepareRuntimeProjectV3`, thứ mà preview
trực tiếp trong trình duyệt và `debug-act-timing-probe.mts` đều cần) phát
hiện thêm 3 bug thật, đều cùng một dạng: một giá trị hình học hợp lệ trong
CSS thật (0, hoặc suy biến từ phép chiếu 3D) va vào một giả định "phải > 0 /
phải có ≥3 điểm không thẳng hàng" ở đâu đó sâu trong pipeline, làm crash toàn
bộ compile thay vì render ra "không có gì" như Chrome thật.

### [ĐÃ SỬA] `frame.width`/`frame.height` sample về đúng 0 khi animation-fill-mode: both backward-fill trước delay
- Vị trí: `packages/motion-compiler/src/animation/sampler.ts`, `applyTrackValue`.
- Ca thật: `.act12-fill`/`.act13-text` có `width: 0` ở keyframe 0% cộng
  `animation-delay` lớn + `fill-mode: both` (progress bar, hiệu ứng
  typewriter). Trước delay, `sampleTrack` backward-fill đúng giá trị keyframe
  đầu = 0 y hệt Chrome thật sẽ làm - nhưng Protocol V2 schema đòi
  `frame.width/height` phải > 0 nghiêm ngặt, nên `sampleProtocolFullyAtTime`
  re-parse ra ZodError, crash toàn bộ compile.
- Fix: floor về `Math.max(1, value)` ngay trong `applyTrackValue`, ngay cạnh
  chỗ đã clamp opacity overshoot 0..1 - cùng quy ước `Math.max(1, ...)`
  html-compiler đã dùng cho geometry tĩnh (`layout/geometry.ts` và tương tự).
- Test: `sampler.test.ts` — "floors a sampled width/height of exactly 0 to 1".

### [ĐÃ SỬA] `clip-path: circle(0%)`/`ellipse(0 0)` sinh contour suy biến (mọi điểm trùng nhau)
- Vị trí: `packages/html-compiler/src/compiler/paint/clip.ts`, `parseRadial`.
- Ca thật: `.act10-fill { clip-path: circle(0% at 50% 50%); }` (điểm bắt đầu
  của hiệu ứng "wipe / iris reveal") — radius=0 khiến cả 4 điểm cuối của 4
  cung tròn trùng làm một điểm, `flattenPathContourAny` ném lỗi "không đủ
  điểm không thẳng hàng".
- Fix: floor radius về `Math.max(1, radius)` (thử 0.01 trước, không đủ - xem
  bên dưới, phải dùng đúng 1 mới ổn định qua hết pipeline).
- Test: `clip-path.test.ts` (3 case: circle 0%, ellipse 0 0, circle thường
  không đổi).

### [ĐÃ SỬA] Rectangle chiếu 3D edge-on (giữa flip 90°/270°) suy biến thành 1 đường thẳng, crash thay vì render trống
- Vị trí: `packages/motion-compiler/src/compiler/index.ts`, `flattenPathNodeAtBoundary`.
- Ca thật: ACT 5 "3D flip card" (`rotateY` qua đúng 90°/270°) — một hình chữ
  nhật nhìn nghiêng đúng 90° chiếu xuống 2D thành các điểm THẲNG HÀNG THẬT
  (không phải lỗi làm tròn) - Chrome thật chỉ hiện một lát mỏng/không có gì
  tại đúng khoảnh khắc đó, không crash.
- Fix: lọc bỏ (không throw) đúng những contour suy biến TRƯỚC khi gọi
  `tessellateClosedPath`, dùng lại đúng khái niệm `fullyClipped` đã có sẵn
  ngay phía trên (near/far clip loại bỏ hết contour cũng xử lý y hệt cách
  này) thay vì để cả node/frame crash.
- Chưa làm: `flattenPathContourAny` vẫn throw cứng ở MỌI call site khác (glyph
  outline, replay-2d, non-scaling-stroke, path fill thường) - chỉ riêng chỗ
  này được bọc tolerant vì "suy biến do góc chiếu" là trường hợp BÌNH THƯỜNG
  ở đây, không phải lỗi tác giả. Nếu găp crash tương tự ở call site khác,
  cân nhắc named riêng chứ đừng nới lỏng `flattenPathContourAny` chung chung.

### [CHƯA SỬA] `clip-path` animate qua `@keyframes` hoàn toàn không được lower thành track
- Vị trí: `packages/html-compiler/src/compiler/css/animation.ts` —
  `lowerAnimationTracks`'s `supported` list không có `clip-path`.
- Phát hiện khi tìm nguyên nhân crash ở trên: ACT 10 "wipe / iris reveal"
  của `neonix_ui_transform_showcase.html` animate `clip-path: circle(...)`
  qua `@keyframes act10Wipe`, nhưng vì `clip-path` không nằm trong danh sách
  property được animate, giá trị `clip-path` DUY NHẤT được dùng là giá trị
  TĨNH khai báo trực tiếp trên `.act10-fill` (`circle(0% ...)`) - nghĩa là
  compile ra đúng, không crash (sau fix ở trên), nhưng **hiệu ứng reveal
  không hề chạy**: element luôn bị clip về gần-như-không-có-gì suốt.
- Cần làm: thêm `clip-path` vào danh sách property animate được trong
  `animation.ts`, tương tự cách `filter`/`text-shadow` đã có track riêng
  (`lowerFilterAnimations`/`lowerTextShadowAnimations`) - clip-path cần
  nội suy GIỮA 2 SHAPE (circle/inset/polygon), không phải giữa 2 số đơn,
  nên nhiều khả năng cần cùng kiểu "padded list + geometry-aware
  interpolation" như filter list đã làm, không đơn giản như opacity/width.

### [KHÔNG PHẢI BUG] Nghi ngờ ban đầu "easing ease-in-out sai giá trị giữa segment" hóa ra là do so 2 thời điểm khác nhau
- Nghi vấn ban đầu (bằng `apps/web/scripts/debug-act-timing-probe.mts`): tại
  t=250ms giữa segment `act0Fade`'s [0%,10%]=[0,500ms] (progress cục bộ 50%),
  Chrome thật cho opacity=0.500 (đúng lý thuyết, `ease-in-out` đối xứng qua
  tâm) nhưng runtime cho ra 0.443 - tưởng là bug ở
  `sampleKeyframes`/`applyEasing`.
- Thực ra: `evaluateRuntimeProjectV3`'s `options.time` được
  `frameIndexAtTime`/`roundTimeToFrame` (`motion-runtime/src/foundation/
  clock.ts`) SNAP về đúng frame nguyên gần nhất của fps composition (đúng
  chủ ý - khớp với việc video xuất ra thật chỉ có frame rời rạc, không phải
  bug). Ở fps=30, t=250ms = frame 7.5 → làm tròn về frame 7 = 233.33ms.
  0.443 chính là giá trị ĐÚNG tại 233.33ms (verify trực tiếp bằng
  `sampleMotionLayerAtTime` độc lập, không qua đường nào khác: cho ra
  0.4999971 tại t=250ms thật, và 0.4426886 tại t=233.33ms - khớp in hệt
  0.443 quan sát được). Công cụ probe đang so opacity Chrome thật tại
  250ms (liên tục) với opacity runtime tại 233ms (bị snap) - lệch thời điểm,
  không lệch công thức. Y hệt bài học "1px offset" đã ghi trong CLAUDE.md
  (`pitfall_native_stage_pixel_crop_rounding` memory) - một pitfall khác,
  cùng một bài học: luôn verify một nghi ngờ mismatch còn sống sót qua so
  sánh đúng-cùng-một-thời-điểm trước khi tin nó là bug thật.
- Đã sửa `debug-act-timing-probe.mts`: tự động snap mọi thời điểm được yêu
  cầu về đúng lưới frame của composition's fps trước khi so (in ra dòng
  "note: ... snapped to ..." khi có snap) - để công cụ không tái phạm lỗi
  này ở lần dùng sau.

## Playground fixtures

### 15 file debug orphan trong `fixtures/paint/` chưa được đưa vào registry
- Vị trí: `apps/web/public/docs/html-compiler/fixtures/paint/` — các file:
  `border-corner-dashed-zoom.html`, `border-corner-dotted-zoom.html`,
  `border-corner-miter-baseline.html`, `border-dashed-rounded-corner-symmetry.html`,
  `border-dashed-rounded-radius-sweep.html`, `border-dashed-rounded-size-sweep.html`,
  `border-dashed-rounded-width-sweep.html`, `border-dashed-rounding-boundary.html`,
  `border-dashed-width-formula-check.html`, `border-dotted-rounded-radius-sweep.html`,
  `border-style-edge-length-sweep.html`, `border-style-radius-sweep.html`,
  `border-style-width-sweep.html`, `svg-dasharray-sweep.html`,
  `svg-rounded-rect-dash-isolation.html`.
- Hiện tại: fixture debug tự phát tạo ra khi soi một bug về góc bo của dashed
  border, mỗi file có comment giải thích mục đích. Không được đăng ký trong
  `html-compiler-preview.ts` hay `html-playground-cases.ts` nên không hiện
  trong dropdown native-stage nào — nằm im trong thư mục `paint/` từ đó.
- Cần làm: quyết định file nào còn giá trị làm regression case chính thức
  (đưa vào `fixtures/debug/` + đăng ký case), file nào chỉ là scratch có thể
  xóa hẳn.
