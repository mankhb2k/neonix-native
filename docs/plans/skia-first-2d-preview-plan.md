# Skia-first 2D Preview and Export Plan

> Migration checkpoint (2026-09-02): the browser Skia renderer now lives in
> `packages/skia-renderer/` as `@motionvideo/skia-renderer`. The older
> `packages/preview-renderer/` package is kept for WebGPU/WebGL2 only and no
> longer owns the Skia implementation. `PreviewStage` selects the independent
> package when `backend="skia"`; CanvasKit WASM remains app-owned at
> `/vendor/canvaskit/`.

> Phase 3 checkpoint (2026-09-02): Skia paint replay now has a dedicated
> `paint.ts` implementation for solid opacity, linear/radial/sweep gradients,
> focal radial gradients, stop opacity, `gradientUnits`, `gradientTransform`,
> spread modes and CanvasKit sRGB/unpremultiplied readback. The Skia docs lab
> now includes eight Protocol V2 gradient fixtures and the Playwright Phase 3
> contract test. Radial gradients use a CanvasKit local matrix so object
> bounding-box gradients preserve elliptical geometry; conic reference output
> uses a browser-safe SVG wedge serializer because SVG has no native conic
> paint server.

> Phase 4 checkpoint (2026-09-02): Runtime text preparation is now the source
> of truth for the Skia lab. `PreviewStage` rejects unprepared text overrides,
> prevents stale frames during fixture changes, and exposes the exact prepared
> `RuntimeFrameV3` to the browser SVG reference. Skia replays glyph outlines,
> color layers/encoded color glyphs, text stroke, opacity and decorations. The
> lab contains 16 Protocol V2 text fixtures, including three Arabic fixtures
> (`language=ar`, `direction=rtl`) plus fallback emoji, emoji-only, ZWJ and
> variation-selector cases; Runtime shaping and Skia pixel-diff are validated
> by Playwright. Mixed-script UAX#9 bidi remains outside this MVP gate.

## Mục tiêu

Đưa toàn bộ visual preview 2D của Neonix sang Skia/CanvasKit, giữ nguyên
Motion Protocol V2 và Runtime V3. Protocol V2 vẫn giữ các trường 3D hiện có,
nhưng 3D được cô lập và chưa được render trong MVP.

Skia chịu trách nhiệm rasterize 2D thành pixels. FFmpeg chỉ nhận RGBA frames,
audio và thực hiện encode/mux thành video.

```text
MotionProtocolV2
        ↓
compileProtocol()
        ↓
RuntimeProjectV3
        ↓
evaluateRuntimeProjectV3()
        ↓
RuntimeFrameV3 / PaintCommandBuffer
        ↓
SkiaRenderer / CanvasKit
        ↓
RGBA frame
        ↓
FFmpeg
        ↓
MP4 / WebM / MOV
```

## Nguyên tắc kiến trúc

- `MotionProtocolV2` là authoring contract và không bị thay đổi để phục vụ
  Skia.
- `RuntimeProjectV3` và `RuntimeFrameV3` là nguồn semantics duy nhất cho
  preview và export.
- Skia adapter không compile Protocol, không evaluate timeline và không tự
  tính lại geometry.
- Mọi geometry, transform, text layout, glyph outline, timing và opacity phải
  đến từ `PaintCommandBuffer`.
- Browser SVG chỉ là reference renderer cho visual comparison, không phải
  nguồn dữ liệu hình học.
- Unsupported capability phải báo diagnostic hoặc fail closed; không âm thầm
  bỏ qua command.
- WebGPU/WebGL2 không được dùng làm renderer 2D mặc định trong MVP.

## Cô lập 3D

Protocol V2 tiếp tục giữ các trường 3D để bảo toàn khả năng mở rộng. Compiler
hoặc Runtime cần phân loại domain render:

```text
2D layer/subtree → SkiaRenderer
3D layer/subtree → skia_3d_unsupported diagnostic
```

Các dấu hiệu 3D có thể gồm camera/perspective thật, depth, mesh, material,
lighting, `rotate.x/y` hoặc capability 3D rõ ràng. Không được tự động flatten
3D thành 2D nếu điều đó làm thay đổi semantics.

Trong tương lai:

```text
2D subtree → Skia
3D subtree → WebGPU3DRenderer
                  ↓
              compositor
```

## Tình trạng hiện tại

### Đã có

- Protocol V2, Compiler và Runtime V3 đã có boundary phù hợp.
- `PaintCommandBuffer` đã chứa các command cần cho 2D:
  `setTransform`, `drawSolid`, `drawShape`, `drawPath`, `drawText`,
  `drawImage` và `drawVideo`.
- `packages/skia-renderer/` đã được tạo và cô lập khỏi `preview-renderer`.
- CanvasKit WASM đã được vendored trong app và có loader.
- Skia surface có thể tạo và readback RGBA với `readPixels`.
- Có `SkiaBackend` và `SkiaCommandReplay` ban đầu.
- Replay đã bao phủ transform tuyệt đối theo từng drawable, solid, shape,
  rounded corner, path, fill/stroke opacity, stroke cap/join và gradient.
- Text Runtime V3 đã được prepare bằng HarfBuzz trước khi vào Skia; Skia replay
  glyph outline, color layers/encoded color glyph resources, text stroke và decoration.
- Trang `/docs/preview/skia` đã có dropdown fixture.
- Có bộ fixture riêng tại `apps/web/lib/docs/skia-preview-fixtures.ts`, nhưng
  project payload vẫn tham chiếu các Protocol V2 fixtures có sẵn trong
  `docs/preview`.
- Có 8 SVG reference path trong `apps/web/public/preview/skia/`; lab SVG hiện
  serialize động từ cùng `RuntimeFrameV3` với Skia.

### Chưa hoàn thành

- Skia replay chưa đạt parity đầy đủ với Runtime/WebGL/WebGPU.
- Image/video resource upload vào Skia chưa hoàn thiện.
- Mask, clip, blur, shadow, blend, isolation và compositing chưa đầy đủ.
- Preview hiện chưa hoàn toàn Skia-only trong mọi entry path.
- SVG reference chưa phải serializer đầy đủ cho toàn bộ `PaintCommandBuffer`.
- Pixel-diff hiện mới có threshold contract cho path, gradient và 13 text/font
  cases; golden image storage chưa được thêm.
- Export hiện vẫn dùng SVG + sharp/libvips để rasterize frame trước FFmpeg;
  chưa chuyển sang Skia export renderer.
- Capability gate cô lập 3D chưa được formalize trong compiler/runtime.

## Lộ trình triển khai

### Phase 0 — Contract và 3D gate

Mục tiêu: khóa boundary trước khi mở rộng renderer.

- Thêm capability/domain classification cho Runtime frame hoặc render plan.
- Giữ nguyên các trường 3D trong Protocol V2.
- Chặn 3D bằng diagnostic `skia_3d_unsupported` trong Skia MVP.
- Xác nhận Skia chỉ nhận `RuntimeFrameV3`/`PaintCommandBuffer`.
- Không cho docs page chứa geometry hard-code.

Gate:

- Một frame 2D đi vào Skia được.
- Một frame có capability 3D bị chặn rõ ràng.
- Không có 3D flatten âm thầm.

### Phase 1 — Skia command replay core

Tách phần renderer core khỏi browser lifecycle:

```text
packages/skia-renderer/
├── command-replay.ts
├── path.ts
├── paint.ts
├── text.ts
├── resources.ts
└── diagnostics.ts
```

`@motionvideo/preview-renderer` chỉ quản lý CanvasKit surface, resize, DPR,
lifecycle và chuyển frame vào core replay.

Hoàn thiện command replay:

- `beginFrame` / `endFrame`;
- `setTransform` với chuyển đổi Matrix4 → CanvasKit 2D matrix;
- `drawSolid`;
- `drawShape`: rectangle, rounded rectangle, ellipse, polygon;
- `drawPath`: line, quadratic, cubic, arc, closed/open contour;
- fill/stroke và paint order;
- alpha ở layer, fill và stroke;
- stroke width, miter limit, cap, join, dash;
- diagnostics có `key` và `layerId`.

Gate:

- `path.geometry.cubic` render đúng từ Protocol V2 qua Runtime.
- Không có geometry hard-code trong Skia lab.

### Phase 2 — Path E2E baseline

Dùng 8 fixture hiện có trong docs/preview:

```text
path.geometry.cubic
path.geometry.line
path.geometry.open-contour
shape.stroke-cap
path.geometry.arc-closed
path.geometry.multiple-contours
path.gradient
path.geometry.arc
```

Mỗi case phải chạy:

```text
Protocol V2
  → compileProtocol()
  → evaluateRuntimeProjectV3()
  → RuntimeFrameV3
  → SkiaCommandReplay
```

SVG reference chỉ dùng để đối chiếu visual với cùng project/frame. Không được
tạo lại JSON geometry trong lab.

### Phase 3 — Paint và gradient

Hoàn thiện `PaintFill` mapping:

- solid color;
- linear gradient;
- radial gradient;
- conic/sweep gradient;
- stop opacity;
- `gradientUnits`;
- `gradientTransform`;
- spread method;
- color space và premultiplied alpha.

Gate:

- gradient output của Skia không bị tô phẳng;
- màu, alpha và vị trí stop khớp reference trong threshold đã định;
- gradient path và gradient shape dùng cùng paint implementation.

### Phase 4 — Text và font

Runtime tiếp tục chịu trách nhiệm shaping/layout. Skia chỉ rasterize glyph đã
resolve:

```text
Runtime text layout + glyph outlines
        ↓
Skia Path / glyph draw
```

Đã triển khai:

- Runtime load font bytes có kiểm tra SHA-256 và shaping bằng HarfBuzz;
- glyph path thông thường với mapping `outline/pathScale/x/y`;
- font fallback và mixed runs;
- text fill, opacity, stroke, paint order và decoration;
- color emoji qua COLR/layer hoặc encoded bitmap khi CanvasKit hỗ trợ decode;
- frame callback dùng chung cho SVG reference và Skia để tránh so sánh khác
  RuntimeFrame;
- 16 fixture text/font thực tế, gồm 3 fixture Arabic RTL và 4 fixture emoji:
  fallback, only, ZWJ và
  variation selectors.

Gate đã đạt:

- glyph count phát ra từ Runtime được kiểm tra trên canvas và Skia có draw call;
- browser SVG và Skia dùng cùng glyph frame, không browser shaping lại text;
- font thiếu tiếp tục đi qua diagnostic Runtime rõ ràng;
- Arabic RTL thuần được shaping bằng HarfBuzz và replay bằng Skia `drawGlyphs`;
- emoji color vẫn được nhận diện là color-glyph resource, không bị nhầm với text
  monochrome;
- `skia-phase4.spec.ts` pass pixel-diff cho toàn bộ 16 text/font cases.

Phase 4 được khóa ở phạm vi text semantic, font selection/fallback, shaping,
glyph placement và monochrome/color glyph replay. Bidi trộn Arabic/Latin, line
breaking phức tạp và paragraph layout global sẽ mở ở phase text riêng khi có
UAX#9/paragraph contract rõ ràng.

### Phase 5 — Image và video (đã hoàn tất gate MVP)

Resource adapter nhận asset từ `apps/web/public/preview` qua URI trong Protocol
V2, host decode và chuyển resource đã chuẩn bị vào Skia:

```text
Protocol asset URI (`/preview/image/*`, `/preview/svg/*`, `/preview/video/*`)
        ↓
PreviewAsset / decoded video frame
        ↓
Skia image
        ↓
drawImageRect
```

Triển khai:

- PNG/JPEG/WebP/SVG asset theo capability;
- image scaling và filtering;
- preserve aspect ratio: contain/cover/fill/none;
- image rendering mode;
- video frame theo `mediaTime` runtime;
- resource cache và disposal;
- không phát audio trong visual Skia renderer.

Phase 5 gate: static image cases phải dùng các asset `/preview` hiện có và pass
SVG reference pixel-diff; video cases phải seek cùng `mediaTime` từ Runtime,
upload decoded frame vào Skia, expose resource/video counters và giữ ổn định
khi đổi fixture. Asset thiếu phải fail closed với diagnostic.

Gate đã đạt:

- `SkiaRuntimeLab` có dropdown 7 image cases và 4 video cases lấy từ cùng
  `PREVIEW_LAB_CASES`, không tạo một protocol/geometry fixture riêng cho Skia;
- image đi qua URI `/preview/image/*` hoặc `/preview/svg/*`, loader decode thành
  `PreviewAsset`, Runtime phát `drawImage`, Skia replay `drawImageRect` với
  contain/cover/none/alignment/filter;
- video đi qua URI `/preview/video/demo-video.mp4`, loader seek theo `mediaTime`,
  Skia snapshot frame hiện tại vào DOM canvas trước khi upload để tương thích
  CanvasKit 0.42, không dùng audio;
- clip cover dùng đúng LTRB viewport và `ClipOp.Intersect`; missing asset không
  bị vẽ và phát `preview_asset_missing`;
- `skia-phase5.spec.ts` pass image pixel-diff, missing-resource gate và 4 video
  resource/media-time/upload gates;
- toàn bộ gate `skia-phase2.spec.ts` đến `skia-phase5.spec.ts` pass: 6 tests.

### Phase 6 — Compositing và effects

Mở rộng theo pass:

- clip path;
- alpha/luma mask;
- offscreen layer;
- blend mode;
- isolation;
- blur;
- drop/inner shadow;
- color filter;
- effect graph.

Mỗi capability phải được ghi nhận trong matrix:

```text
supported | partial | unsupported
```

### Phase 7 — Skia-only preview MVP

Khi các gate 2D đạt yêu cầu:

- `PreviewStage` dùng Skia làm backend mặc định;
- `auto` của 2D không chọn WebGPU trước nữa;
- WebGL2/WebGPU giữ lại cho legacy/reference hoặc future 3D;
- mọi docs preview visual test dùng Skia;
- diagnostics phân biệt backend unavailable và command unsupported.

Target:

```text
2D preview → Skia/CanvasKit
3D preview → disabled diagnostic trong MVP
```

### Phase 8 — SVG reference và pixel-diff

Tạo browser-safe SVG serializer nhận `PaintCommandBuffer`, không import
`@motionvideo/export-renderer` vào Client Component vì package đó kéo theo
`sharp` và Node built-ins.

Mỗi E2E case cần kiểm tra:

- composition width/height;
- frame index/time;
- SVG reference được load;
- Skia canvas được load;
- canvas không có diagnostic error;
- pixel diff trong threshold;
- bounds, alpha fringe và color samples.

Không so sánh screenshot của hai layout khác nhau; cả hai panel phải dùng cùng
logical width/height và cùng fit policy.

### Phase 9 — Skia export

Sau khi preview 2D ổn định, chuyển export visual renderer:

```text
RuntimeProjectV3
  → evaluateRuntimeProjectV3(frame)
  → Skia export surface
  → raw RGBA
  → FFmpeg
```

Audio tiếp tục đi theo `AudioMixPlanV3` và được FFmpeg mux cùng video.

Giai đoạn đầu có thể dùng Skia-WASM để đồng nhất semantics với browser. Native
Skia chỉ được thêm sau khi benchmark chứng minh cần thiết.

## Definition of Done cho MVP

- Preview 2D mặc định chạy bằng Skia/CanvasKit.
- Không còn geometry hard-code trong Skia docs lab.
- 8 path fixtures đi qua đầy đủ Protocol V2 → Compiler → Runtime → Skia.
- SVG reference và Skia dùng cùng fixture, frame, viewport và color space.
- Pixel-diff có threshold rõ ràng và chạy tự động bằng Playwright.
- Text/path/shape/gradient cơ bản đạt parity chấp nhận được; text/font đã có
  emoji fallback, color glyph và pixel-diff E2E.
- Image/video cơ bản render được hoặc fail closed có diagnostic.
- Protocol V2 giữ nguyên các trường 3D.
- Project 3D bị cô lập và không làm Skia render sai.
- Export có thể lấy frame từ Skia và pipe sang FFmpeg.
- Không có import server-only như `sharp` trong client bundle.

## Các lỗi cần tránh

- Dùng SVG fixture độc lập rồi kết luận Skia parity.
- Vẽ hard-code trong `SkiaPreviewLab`.
- Đưa CanvasKit object, GPU handle hoặc decoder handle vào Runtime IR.
- Để Skia tự shape/layout text lần thứ hai.
- Gọi `sharp`, `child_process` hoặc export renderer server-side từ Client
  Component.
- Flatten perspective/3D âm thầm.
- Bỏ qua command unsupported nhưng vẫn báo render thành công.
- Dùng màu/alpha khác nhau giữa SVG reference và Skia fixture.
