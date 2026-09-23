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
