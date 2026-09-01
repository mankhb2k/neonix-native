# Kế hoạch HTML/CSS Atomic Compiler → Protocol V2 → Runtime Parity

## 1. Mục tiêu

Giai đoạn này không nhằm hỗ trợ toàn bộ HTML/CSS. Mục tiêu là triển khai đúng
các atomic đã được chốt trong `ATOMIC_CSS_PROTOCOL_V2_MAP.md` theo một luồng duy nhất:

~~~text
HTML/CSS fixture
    ↓
@motionvideo/html-compiler
    ↓
Atomic Protocol V2 JSON
    ↓
@motionvideo/motion-compiler
    ↓
RuntimeProjectV3
    ↓
@motionvideo/motion-runtime
    ↓
PaintCommandBuffer / runtime frame
    ↓
Preview Renderer
~~~

Kết quả runtime của từng fixture phải tương đồng với kết quả HTML/CSS do
Chromium render tại cùng viewport, thời điểm, font và asset.

### Definition of Done cho một atomic

Một atomic chỉ được ghi là **supported** khi đồng thời đạt đủ:

1. HTML compiler nhận đúng subset HTML/CSS đã công bố.
2. Compiler sinh JSON hợp lệ với `MotionProtocolV2Schema`.
3. JSON không chứa CSS syntax hoặc runtime-only data.
4. Motion compiler hạ được JSON sang RuntimeProjectV3 mà không fallback im lặng.
5. Runtime và renderer thực thi đúng semantic.
6. Có fixture source → expected JSON.
7. Có unit test compiler và runtime.
8. Có visual parity test giữa Chromium reference và Preview Renderer.
9. WebGL2 và WebGPU không khác semantic.
10. Capability chỉ được publish sau khi tất cả gate trên pass.

## 2. Phạm vi và nguyên tắc

### Trong phạm vi

- Các hàng trong `ATOMIC_CSS_PROTOCOL_V2_MAP.md`.
- Một document HTML có CSS đặt trong `<style>`.
- Viewport composition cố định, ban đầu là 1920 × 1080 hoặc bản preview
  đồng tỷ lệ 16:9.
- Source fixture read-only trong Preview.
- Compiler sinh Protocol V2 JSON read-only để đối chiếu.
- Browser reference và Runtime Preview render cùng một fixture.
- Asset và font phải được khai báo rõ, có kích thước/metadata ổn định.
- Timing trong toàn pipeline dùng milliseconds.

### Chưa làm trong giai đoạn đầu

- Toàn bộ HTML/CSS platform.
- JavaScript DOM mutation, event, form và web component.
- Network-dependent CSS, font hệ thống không cố định hoặc asset không probe.
- Media query ngoài viewport composition đã chọn.
- CSS Houdini, canvas, iframe lồng, plugin browser và native control.
- Accessibility tree hoặc browser interaction semantics.
- Rasterize cả subtree HTML thành ảnh để che lấp atomic chưa hỗ trợ.
- Tự động chấp nhận CSS không hỗ trợ bằng cách bỏ qua declaration.

Unsupported syntax phải tạo diagnostic có code, selector/node và property rõ
ràng. Không được render gần đúng rồi vẫn báo supported.

## 3. Ranh giới trách nhiệm

| Thành phần | Trách nhiệm |
| --- | --- |
| `motion-protocol` | Schema JSON Atomic V2 và validation quan hệ; không biết HTML/CSS, Runtime IR hoặc GPU. |
| `html-compiler` | Parse source, resolve CSS, layout/text/paint và hạ kết quả sang Protocol V2. |
| `motion-compiler` | Protocol V2 → RuntimeProjectV3; resolve semantic effect, matrix, mask/blend program và capability. |
| `motion-runtime` | Sample time, world transform, hierarchy, effects, masks, blend, text glyphs và phát PaintCommandBuffer. |
| `preview-renderer` | Thực thi paint/resource commands trên WebGL2/WebGPU; không hiểu CSS. |
| Web Preview | Chọn fixture, chạy pipeline, hiển thị source/JSON, browser reference/runtime result và parity status. |

Quy tắc kiến trúc:

- HTML compiler chỉ import Protocol types/schema, không import Runtime.
- Motion compiler và Runtime không nhận HTML/CSS.
- Renderer không tự sửa hoặc diễn giải lại Protocol.
- Protocol không thêm field chỉ để giữ nguyên CSS syntax.
- Matrix GPU, color matrix đã fuse, texture và render target không đi ngược
  trở lại Protocol JSON.

## 4. Thiết kế Preview chuẩn

Mỗi case trong Preview phải sở hữu một fixture HTML/CSS riêng. Không dùng một
boilerplate chung không liên quan tới JSON đang hiển thị.

### Giao diện

~~~text
┌──────────────────────────────┬──────────────────────────────┐
│ Runtime Preview 16:9         │ Atomic Protocol V2 JSON      │
│ (Protocol → Runtime)         │ hoặc HTML / CSS              │
├──────────────────────────────┤                              │
│ Browser Reference 16:9       │ Hai tab cùng một CodePanel   │
│ (Chromium HTML/CSS)          │ và chỉ khác nội dung         │
└──────────────────────────────┴──────────────────────────────┘
~~~

- Tab `HTML / CSS`: source document read-only.
- Tab `Atomic Protocol V2 JSON`: output thực tế của
  `compileHtmlCss()`, không phải JSON fixture viết tay.
- Hai tab dùng đúng một component/code style.
- Browser Reference chạy trong iframe sandbox với viewport và DPR cố định.
- Runtime Preview nhận duy nhất JSON vừa compiler.
- Khi compile lỗi, giữ source và hiển thị diagnostic; không gọi runtime.
- Có trạng thái `compile pass`, `schema pass`,
  `runtime pass`, `parity pass/fail`.
- Có chế độ overlay hoặc difference để tìm sai lệch pixel, nhưng không thêm
  một authoring format mới.

### Fixture contract đề xuất

~~~ts
type AtomicHtmlFixture = {
  id: string;
  domain: string;
  document: string;
  composition: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
    background: string;
  };
  sampleTimesMs: number[];
  requiredCapabilities: string[];
  assets: FixtureAsset[];
  parity: {
    mode: "exact" | "perceptual";
    maxPixelError: number;
    maxMismatchRatio: number;
  };
};
~~~

Mỗi fixture chỉ chứng minh một atomic chính. Fixture kết hợp được thêm sau khi
các atomic thành phần đã pass độc lập.

## 5. Kiến trúc HTML compiler

### Public API mục tiêu

~~~ts
type HtmlCompileRequest = {
  document: string;
  composition: {
    width: number;
    height: number;
    fps: number;
    durationMs: number;
    background: string;
  };
  assets?: HtmlCompilerAsset[];
};

type HtmlCompileResult =
  | {
      status: "success";
      protocol: MotionProtocolV2;
      diagnostics: HtmlCompilerDiagnostic[];
      capabilitiesUsed: string[];
    }
  | {
      status: "error";
      protocol: null;
      diagnostics: HtmlCompilerDiagnostic[];
      capabilitiesUsed: string[];
    };
~~~

Compiler phải pure đối với một resolved snapshot. Phần phụ thuộc browser được
tách thành adapter:

~~~text
HTML document
    ↓
Browser resolver adapter
    ├── DOM tree
    ├── computed styles
    ├── resolved rectangles
    ├── stacking contexts
    └── text/font inputs
    ↓
ResolvedHtmlScene (internal, không serialize thành authoring format)
    ↓
Atomic lowerers
    ↓
MotionProtocolV2
~~~

Chromium được dùng làm resolver đầu tiên để tận dụng cascade, inheritance,
units, flex và grid mà không phải xây lại toàn bộ browser engine. Đây chỉ là
authoring-time resolver:

- Runtime và renderer không phụ thuộc DOM/Chromium.
- Protocol output vẫn portable và deterministic sau khi compile.
- CI pin Chromium version, DPR, viewport, locale, timezone và font assets.
- Adapter không được chụp subtree thành bitmap.
- Sau này có thể thay browser adapter bằng resolver độc lập mà không đổi
  Protocol hoặc Runtime.

### Các module dự kiến trong html-compiler

~~~text
packages/html-compiler/src/
├── source/          document parsing và source locations
├── resolver/        browser snapshot contract + adapter
├── cascade/         supported-property normalization
├── geometry/        px, %, calc, boxes, anchors và transforms
├── paint/           color, gradients, borders và backgrounds
├── assets/          image/font/SVG resolution
├── text/            shaping, bidi, wrapping và glyph runs
├── temporal/        animation/transition → tracks
├── lower/           resolved scene → Protocol V2 layers
├── diagnostics/     fail-closed errors/warnings
└── _test_/          compiler fixtures và golden JSON
~~~

### ID và output ổn định

- Ưu tiên `data-atomic-id`, sau đó `id`.
- Nếu không có ID, sinh ID từ structural DOM path ổn định.
- Pseudo/paint layers sinh suffix ổn định như
  `card::background:0`, `card::border`.
- Sibling `order` phản ánh resolved stacking/paint order.
- Cùng source và environment phải sinh byte-stable JSON sau canonical
  serialization.

## 6. Thứ tự triển khai

### Phase 0 — Hard cut đồng bộ schema hiện tại

Mục tiêu: trước khi thêm compiler HTML, toàn repo phải dùng đúng một Protocol V2.

Việc cần làm:

- Thay toàn bộ consumer `composite.mask` cũ bằng canonical
  layer-level `clipPath` and `mask` references.
- Xóa blend `add` khỏi compiler/runtime/editor capability; dùng enum CSS
  canonical.
- Đồng bộ effect cũ `drop-shadow` sang `shadow`.
- Đồng bộ text consumer sang `payload.layout.lines/runs/glyphs`.
- Đồng bộ `enabled`, render3d, transform operations, conic gradient và
  semantic filters.
- Không thêm migration hoặc compatibility cho shape cũ.
- Làm sạch typecheck của Protocol → Compiler → Runtime → Preview.

Exit gate:

- Không còn fixture/schema consumer dùng field V2 cũ.
- Protocol tests, compiler tests, runtime tests và Preview fixture tests pass.
- Lỗi `unrecognized key composite.mask` không còn.

Trạng thái triển khai (Phase 0):

- Đã hard-cut các consumer chính sang layer-level `clipPath`/`mask`, CSS blend
  enum và effect `shadow`; không còn đường đọc mask composite legacy trong
  compiler/editor.
- Text fixture/editor đã dùng `payload.source` + `payload.layout`; Runtime IR
  giữ layout authority riêng để hoàn thiện ở phase text compiler.
- `enabled`, `render3d` và `backfaceVisibility` được compiler bảo toàn sang
  Runtime IR; conic gradient đã có nhánh Canvas2D; multi-mask và semantic
  color filters vẫn phát diagnostic rõ ràng cho tới phase triển khai tương ứng.
- Đã xác nhận typecheck/lint/test cho Protocol, Compiler, Runtime,
  Preview Renderer, Export Renderer và Web preview.

### Phase 1 — Vertical slice và parity harness

Atomic đầu tiên: một `div` kích thước cố định, background solid, opacity 1.

Việc cần làm:

- Hoàn thiện `compileHtmlCss()` với success/error result.
- Tạo browser resolver iframe sandbox.
- Sinh composition + một rectangle shape layer.
- Parse lại output bằng `MotionProtocolV2Schema`.
- Nối Preview: source → HTML compiler → Protocol JSON → motion compiler →
  runtime → renderer.
- Thêm browser screenshot reference và runtime screenshot.
- Thêm pixel diff artifact khi test fail.

Exit gate:

- Không còn JSON viết tay cho fixture vertical slice.
- Browser reference và runtime rectangle pass parity trên WebGL2 và WebGPU.

Trạng thái hiện tại: compiler, fixture, schema assertion và Preview pipeline đã
được nối cho Gold Test 01. Browser screenshot/parity gate chưa được xác nhận
trong môi trường hiện tại vì browser runtime không có browser khả dụng; cần
chạy lại E2E khi môi trường browser được bật.

### Bộ Gold Test bắt buộc

Đây là bộ fixture chuẩn để xác nhận toàn bộ pipeline. Mỗi case phải có đủ
HTML/CSS source, Chromium reference screenshot, expected Protocol V2 JSON,
Runtime output và parity assertion cho WebGL2/WebGPU. Không được đánh dấu
`supported` chỉ vì JSON parse thành công.

| ID | Gold test | Atomic chính | Phase mở khóa |
| --- | --- | --- | --- |
| 01 | Rectangle solid | `shape.rectangle` + frame cố định | Phase 1 |
| 02 | Opacity | layer opacity | Phase 5 |
| 03 | Translate | `transform.translate` | Phase 5 |
| 04 | Scale + anchor | `transform.scale` + `anchor` | Phase 5 |
| 05 | Rotate + anchor | `transform.rotate` + `anchor` | Phase 5 |
| 06 | Ordered transform | `transform.operations[]` | Phase 5 |
| 07 | Nested transform | parent hierarchy + world transform | Phase 3 |
| 08 | Rounded rectangle | corner radius geometry | Phase 4 |
| 09 | Linear gradient | multi-stop linear paint | Phase 4 |
| 10 | Radial gradient | multi-stop radial paint | Phase 4 |
| 11 | Conic gradient | conic paint | Phase 4 |
| 12 | Image cover | image source + `fit: cover` | Phase 6 |
| 13 | Box shadow | ordered `shadow` effect | Phase 7 |
| 14 | Blur + color filter chain | ordered blur/color effects | Phase 7 |
| 15 | Multiply blend | CSS canonical blend mode | Phase 8 |
| 16 | Isolation | compositing isolation boundary | Phase 8 |
| 17 | Alpha mask | mask source + alpha coverage | Phase 8 |
| 18 | Basic text glyph run | `payload.layout.lines/runs/glyphs` | Phase 9 |
| 19 | Perspective + rotateY | local 3D context + projection | Phase 10 |
| 20 | Animated translate + opacity | tracks/keyframes in milliseconds | Phase 11 |

#### Gold test contract

Mỗi fixture được lưu với cấu trúc tương đương:

~~~text
fixtures/gold/<id>-<slug>/
├── input.html
├── input.css
├── expected.protocol.json
├── reference.chromium.png
└── manifest.json
~~~

`manifest.json` phải khai báo viewport/DPR, sample time tính bằng
milliseconds, backend cần kiểm tra, capability bắt buộc và ngưỡng sai số.
`expected.protocol.json` được tạo từ compiler rồi canonical-serialize; test
vẫn parse lại bằng `MotionProtocolV2Schema` để phát hiện output không hợp lệ.

Mỗi case chạy theo các assertion bắt buộc:

1. HTML/CSS compiler trả `success` hoặc diagnostic có selector/property.
2. Protocol output khớp expected semantic JSON, không chứa CSS syntax.
3. Motion compiler không fallback im lặng và tạo Runtime IR hợp lệ.
4. Runtime phát lệnh tương ứng ở mọi sample time đã khai báo.
5. WebGL2 và WebGPU cùng semantic; ảnh render nằm trong ngưỡng parity của
   manifest so với Chromium reference.
6. Khi case chưa được implement, test phải fail với mã capability rõ ràng,
   không được bỏ qua declaration hoặc biến thành ảnh raster để “pass”.

#### Thứ tự triển khai gold tests

Case 01 là gate bắt buộc của Phase 1. Sau đó mỗi phase chỉ mở khóa nhóm case
đã nêu trong bảng; case thuộc phase sau không được làm điều kiện chặn vertical
slice hiện tại. Khi toàn bộ 20 case pass, bộ này trở thành regression suite
chính thức cho mọi thay đổi compiler/runtime/renderer.

### Phase 2 — Cascade, units và geometry nền

CSS input:

- Phase 2 tag allowlist: `div`, `span`, `main`, `section`, `article`, `header`,
  `footer`, `nav`, `aside` và `body` wrapper; tag ngoài allowlist phải fail rõ
  ràng với `html-tag-unsupported`.
- type/class/id selector trong subset đã công bố;
- cascade, specificity, source order và inheritance;
- CSS variables;
- px, %, em/rem, viewport units trong fixed viewport;
- `calc()`;
- width/height/min/max/auto;
- margin và padding cho nested box geometry; `gap` chờ Phase 3 khi flex/grid
  được hạ xuống.

Atomic output:

- resolved `frame.width/height`;
- resolved local translate;
- hierarchy và stable order;
- không giữ selector, variable hoặc unit string trong JSON.

Tests:

- cascade conflict;
- inherited color/font input;
- nested variables và fallback;
- percentage theo containing block;
- calc trộn unit;
- min/max constraint.

### Phase 3 — Layout và stacking 2D

CSS input:

- block boxes cần cho fixture;
- flex;
- grid;
- relative/absolute positioning;
- z-index;
- display none;
- visibility;
- overflow hidden/clip.

Atomic output:

- resolved frames và local transforms;
- `parentLayerId` + `order`;
- không emit subtree cho `display:none`;
- resolved visibility;
- rectangular/path clip mask cho overflow.

Runtime:

- hierarchy/world transform;
- sibling paint order;
- enabled state;
- clip execution.

Exit gate: fixture nested flex, grid, absolute overlay và overflow clip đều
pass geometry + pixel parity.

Trạng thái triển khai: Phase 3A đã hoàn tất block flow cơ bản, `display`
(`block|contents|none`), relative/absolute primitive, visibility và numeric
`z-index`, kèm compiler tests và Preview Lab fixtures. Flex/grid, margin
collapsing và overflow clip vẫn là phần 3B/3C chưa mở khóa.

### Phase 4 — Paint cơ bản và border

CSS input:

- solid color;
- background layers;
- linear/radial/conic gradient;
- nhiều color stops;
- border;
- border-radius.

Atomic output:

- shape fill;
- normalized gradient stops;
- ordered group children cho nhiều background layers;
- path fallback cho border/radius không biểu diễn lossless bằng rectangle.

Runtime/renderer:

- gradient sampling thống nhất WebGL2/WebGPU;
- premultiplied alpha;
- path fill/stroke;
- corner/border geometry.

Không coi conic gradient supported trước khi runtime có pixel parity.

### Phase 5 — Opacity và transform 2D

CSS input:

- opacity;
- translate, scale, rotate, skew;
- transform-origin;
- ordered transform list;
- matrix/matrix3d khi xuất hiện trong subset.

Atomic output:

- semantic transform fields cho trường hợp 2D phổ biến;
- anchor đã resolve;
- `operations[]` khi thứ tự phải được giữ;
- matrix operation chỉ khi source thực sự là matrix.

Motion compiler/runtime:

- operations là authoritative;
- compose Matrix4 nội bộ;
- opacity được áp đúng tại compositing boundary;
- không serialize runtime matrix ngược vào Protocol.

Tests phải chứng minh `translate rotate` khác
`rotate translate`.

### Phase 6 — Image, SVG, path và clip-path

CSS/HTML input:

- `img`;
- object-fit contain/cover/fill/none;
- SVG path;
- clip-path trong subset;
- alpha/luma source đơn.

Atomic output:

- asset metadata + image layer;
- resolved image frame/crop/fit;
- path contours;
- layer-level `clipPath`/`mask` references.

Runtime:

- deterministic asset sampling;
- path tessellation;
- alpha/luma coverage;
- mask/clip source không paint ra scene.

### Phase 7 — Filters và shadows

CSS input:

- blur;
- brightness, contrast, saturate, hue-rotate;
- grayscale, sepia, invert, opacity filter;
- box-shadow: multiple, spread, inset;
- filter drop-shadow.

Atomic output:

- ordered `effects[]`;
- semantic effects dễ đọc;
- `shadow.source = box` cho box-shadow;
- `shadow.source = alpha` cho drop-shadow;
- mỗi shadow là một effect theo list order.

Motion compiler:

- semantic color effects → color matrix/component program;
- chỉ fuse các color operation liền nhau;
- không fuse xuyên qua blur/shadow.

Runtime:

- filter opacity khác layer opacity;
- shadow lấy silhouette từ source gốc;
- spread âm/dương;
- inset clipping;
- effect order được giữ.

### Phase 8 — Blend, isolation và multi-mask

CSS input:

- toàn bộ CSS blend mode canonical trong Protocol;
- isolation auto/isolate;
- ordered multi-mask;
- layer-level clipPath + alpha/luminance mask coverage.

Motion compiler/runtime:

- Runtime IR có blend program rõ ràng;
- tạo offscreen group khi isolation/mask/effect cần;
- mask stack được evaluate đúng thứ tự;
- premultiplied-alpha và color-space được chốt bằng test;
- không map operator thành metadata hoặc group approximation.

Exit gate:

- từng blend mode có fixture;
- từng mask operator có fixture hai mask;
- nested isolation không nhìn xuyên backdrop ngoài group.

### Phase 9 — Text atomic

CSS input:

- font fallback;
- font size/weight/style;
- variable-font coordinates;
- letter/word spacing và line height;
- wrapping;
- LTR/RTL/bidi;
- rich inline spans.

HTML compiler/text shaper:

- font assets phải cố định;
- HarfBuzz tạo glyph IDs, advances và clusters;
- bidi + line breaking tạo visual lines;
- rich spans tạo nhiều runs;
- decoration hạ thành shape/path layer;
- Protocol chỉ nhận positioned GlyphRun/TextLayout.

Runtime:

- không reshape source text;
- glyph lookup từ font asset + variations + glyphId;
- atlas/outline cache;
- paint theo `lines[].runIds`;
- cluster chỉ phục vụ editor mapping, không quyết định render.

Text parity dùng font fixture cố định và tolerance riêng cho rasterization;
geometry/run/glyph output vẫn phải exact.

### Phase 10 — CSS 3D

CSS input:

- rotateX/Y/Z;
- translateZ/scaleZ;
- perspective/perspective-origin;
- preserve-3d/flat;
- backface-visibility;
- matrix3d.

Atomic output:

- ordered operations;
- group render3d perspective + resolved origin;
- transformStyle;
- layer backfaceVisibility.

Runtime:

- local perspective subtree;
- flatten boundary;
- accumulated Matrix4;
- backface culling sau accumulated transform;
- deterministic depth/order rule.

### Phase 11 — Animation và transition

CSS input:

- keyframes;
- animation duration/delay/iteration/direction/fill/easing trong subset;
- transition với trạng thái đầu/cuối được fixture khai báo rõ.

Atomic output:

- layer-local `tracks[]`;
- keyframe time tính bằng ms;
- typed values;
- cubic bezier, step và spring khi có mapping xác định;
- stable effect/run paths.

Runtime:

- sample local layer time;
- interpolate number/vector/color;
- enum/string/boolean dùng discrete step;
- base value ngoài track range theo contract;
- cùng một timeMs cho browser reference và runtime.

Transition phụ thuộc event hoặc DOM mutation không có state đầu/cuối xác định
phải fail diagnostic trong MVP.

## 7. Bảng workstream theo atomic

| Workstream | HTML compiler | Motion compiler | Runtime/renderer | Milestone |
| --- | --- | --- | --- | --- |
| Cascade/variables/units | Resolve thành số/màu | Không biết CSS | Không biết CSS | 2 |
| Flex/grid/box model | Snapshot frame/hierarchy | Lower nodes | World geometry/order | 3 |
| Solid/gradients/border | Paint/path atoms | Paint resources | Sample/draw | 4 |
| 2D transform/opacity | Semantic fields/operations | Matrix IR | Compose/sample | 5 |
| Image/SVG/clip | Assets/path/clipPath/mask | Resource/coverage IR | Texture/path/mask | 6 |
| Filters/shadows | Ordered effects | Effect program | Execute chain | 7 |
| Blend/isolation/masks | Canonical composite | Offscreen/composite IR | Pixel coverage operators | 8 |
| Text | Glyph layout | Glyph resources | Glyph paint/cache | 9 |
| 3D | operations/render3d | Matrix/context IR | Projection/flatten/cull | 10 |
| Animation/transition | Tracks ms | Track bindings | Time sampling | 11 |

## 8. Test strategy

### A. HTML compiler unit tests

- parser/source-location tests;
- supported CSS property normalization;
- selector/cascade/inheritance tests;
- resolved snapshot → exact Protocol JSON golden;
- stable IDs/order;
- unsupported CSS diagnostics;
- schema parse cho mọi output.

### B. Motion compiler tests

- mỗi Protocol atom → exact RuntimeProjectV3 fragment;
- capability fail-closed;
- no silent fallback;
- canonical masks/effects/text/transform tests;
- same Protocol always yields same runtime hash.

### C. Runtime semantic tests

- keyframe sampling;
- matrix order;
- mask operators;
- blend equations;
- effect order/color matrices;
- text glyph placement;
- deterministic PaintCommandBuffer.

### D. Renderer conformance tests

- cùng PaintCommandBuffer trên WebGL2 và WebGPU;
- resource sampling và premultiplied alpha;
- offscreen group/isolation;
- gradient/path/text/effect fixtures.

### E. End-to-end visual parity

Cho mỗi fixture:

1. Render HTML/CSS trong Chromium reference.
2. Compile cùng source thành Protocol V2.
3. Render Protocol qua runtime tại cùng `timeMs`.
4. Capture hai ảnh với cùng viewport và DPR.
5. So sánh pixel/perceptual theo policy fixture.
6. Lưu reference, runtime và diff image khi fail.

Ngoài pixel diff, luôn kiểm tra geometry bounds và compiled JSON để tránh một
ảnh “trông đúng” nhưng protocol sai semantic.

## 9. Capability ledger

Tạo một ledger machine-readable, ví dụ:

~~~ts
type AtomicCapabilityStatus = {
  id: string;
  protocol: "ready";
  htmlLowering: "pending" | "ready";
  motionLowering: "pending" | "ready";
  runtime: "pending" | "ready";
  webgl2: "pending" | "ready";
  webgpu: "pending" | "ready";
  parity: "pending" | "ready";
};
~~~

`COMPILER_SUPPORTED_FEATURES` chỉ expose capability có toàn bộ downstream
stage ready. Protocol chấp nhận một field không đồng nghĩa runtime hỗ trợ field
đó.

Preview dùng ledger để:

- chỉ liệt kê case đã nối đủ pipeline;
- hiển thị stage nào đang pending;
- không chạy case unsupported rồi trả hình sai.

## 10. Quy tắc merge cho từng atomic

Một PR/slice hoàn chỉnh phải bao gồm trong cùng thay đổi:

1. HTML/CSS fixture.
2. HTML compiler lowering.
3. Expected Protocol JSON.
4. Motion compiler lowering/capability.
5. Runtime semantic.
6. Renderer implementation nếu cần.
7. Unit tests.
8. Browser/runtime visual parity.
9. README/capability ledger update.

Không merge trạng thái “schema đã có, consumer dùng field cũ” vào nhánh chính.
Nếu một slice quá lớn, capability giữ pending cho tới PR cuối.

## 11. Thứ tự backlog đầu tiên

1. Hoàn tất Phase 0, đặc biệt hard-cut layer-level `clipPath`/`mask`.
2. Tạo fixture contract và một solid rectangle.
3. Nối Preview dùng JSON từ `compileHtmlCss()`.
4. Tạo Chromium reference + runtime diff harness.
5. Width/height/background/opacity.
6. Nested boxes + parent/order.
7. Margin/padding/flex.
8. Transform 2D.
9. Linear/radial/conic gradient.
10. Image/object-fit.
11. Border/path/clip.
12. Filters/shadow.
13. Blend/isolation/masks.
14. Text.
15. 3D.
16. Animation/transition.

Đây là thứ tự giảm rủi ro: mỗi bước tạo được một kết quả nhìn thấy, có JSON
để kiểm tra và có runtime parity trước khi mở atomic tiếp theo.

### Trạng thái Phase 2

Phase 2 đã được triển khai trong `packages/html-compiler`: parser DOM subset,
selector/cascade/inheritance, custom properties + fallback, units/calc, box
geometry, nested group lowering và fail-closed diagnostics. Golden tests được
đặt trong `src/_test_/phase2.test.ts`; flex/grid, paint nâng cao, text,
transform, 3D và temporal atoms vẫn để cho các phase sau.

### Trạng thái Phase 4

Phase 4 compiler đã hạ solid paint, linear/radial/conic gradient đa stop,
background layers, solid border và uniform border-radius xuống Protocol V2.
Gradient stop thiếu offset được normalize; background layers nhận identity
`<id>::paint:<index>` theo paint order. Border style khác `solid` và radius
không đồng nhất fail-closed với diagnostic, không tạo fallback mơ hồ.

Golden compiler assertions nằm trong `packages/html-compiler/src/_test_/phase4.test.ts`.
Preview Lab có năm fixture tại **HTML compiler / Phase 4**. Runtime/renderer đã
nhận gradient linear/radial/conic với tối đa 8 stop, stroke và corner geometry
qua cùng một uniform contract; tests GPU kiểm tra packing và các backend dùng
cùng semantic. Visual parity trên thiết bị thật vẫn là gate E2E cần chạy tiếp.

### Trạng thái HTML transform preflight

HTML compiler đã có subset 2D cho `translate`, `scale`, `rotate`, `skew` và
`transform-origin`; mỗi fixture được đặt trong nhóm **Transforms & 3D** cùng
preview Protocol hiện có. Output giữ cả component fields và `operations[]` để
chuẩn bị cho Phase 5. Ordered transform composition và matrix/matrix3d chỉ
được đánh dấu hoàn tất sau khi Motion Runtime dùng `operations[]` làm nguồn
chính và có parity test hoán đổi thứ tự.

## 12. Tiêu chí hoàn thành giai đoạn

Giai đoạn compiler/runtime atomic đầu tiên hoàn thành khi:

- Mọi hàng được chọn từ `ATOMIC_CSS_PROTOCOL_V2_MAP.md` có capability ledger.
- Mọi capability marked ready có fixture độc lập và visual parity.
- Preview luôn hiển thị đúng source fixture và JSON compiler output tương ứng.
- Runtime không đọc HTML/CSS và không dựa vào browser để render.
- Không còn compatibility path cho Protocol shape cũ.
- Unsupported CSS luôn fail rõ ràng.
- WebGL2/WebGPU và Preview/Export dùng cùng RuntimeProjectV3 semantic.
- Có thể thêm CSS subset mới bằng một vertical slice mà không sửa lại Protocol
  hoặc tạo pipeline thứ hai.
