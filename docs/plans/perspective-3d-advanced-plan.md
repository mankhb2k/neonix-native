# Perspective 3D nâng cao — Nested, Animation, Texture, Clipping và WebGPU

## Mục tiêu

Hoàn thiện các khả năng perspective 3D còn lại sau vertical slice hiện tại:

1. Nested perspective nhiều tầng.
2. Animation/interpolation riêng cho `perspective` và `perspective-origin`.
3. Textured image/video trên projective plane.
4. Near-plane clipping phức tạp cho mask/filter.
5. Parity đầy đủ giữa Skia và WebGPU.

Tất cả backend phải nhận cùng một `RuntimeFrame`. CSS compiler chỉ chịu trách
nhiệm parse và hạ semantic; Runtime chịu trách nhiệm sampling, Matrix4 và
clipping; backend chịu trách nhiệm rasterization theo capability.

```text
CSS / JSON V2
      ↓
RuntimeFrame + Matrix4 + tracks
      ↓
Skia / WebGPU backend
      ↓
Golden screenshot và pixel comparison
```

## Nguyên tắc contract

- Không gộp perspective của các group lồng nhau thành một distance duy nhất.
- `perspective` của group và `transform: perspective()` của layer vẫn là hai
  semantic khác nhau.
- `perspective-origin` được resolve trong local border-box của context sở hữu
  nó.
- Layout frame 2D không thay đổi do `z`, perspective hoặc animation perspective.
- Matrix4 column-major là representation canonical trong Runtime.
- Near-plane clipping phải xảy ra trong homogeneous space trước perspective
  divide.
- Mask, filter, opacity và blend phải giữ đúng thứ tự layer/effect.
- Skia và WebGPU không được tự tính lại CSS semantic khác nhau.
- Backend thiếu capability phải trả diagnostic, không silently flatten hoặc bỏ
  qua effect.

## Phase 6 — Nested perspective nhiều tầng

### Mục tiêu

Bảo đảm mỗi CSS perspective được áp dụng tại đúng group boundary và descendant
nhận đúng chuỗi Matrix4.

### Implementation

- Giữ perspective riêng trong từng `layer.render3d.perspective`.
- Nhân matrix theo thứ tự:

```text
parent world
→ parent perspective
→ child world
→ child perspective
→ descendant transform
→ composition camera projection
```

- Không flatten các perspective lồng nhau thành một perspective duy nhất.
- Giữ `perspective-origin` local của từng group.
- `transform-style: flat` phải flatten tại boundary tương ứng.
- `transform-style: preserve-3d` tiếp tục truyền world Matrix4 xuống children.
- Near-plane clipping thực hiện sau khi hoàn tất transform chain của surface.
- Diagnostic phải chỉ ra layer/group gây lỗi khi matrix hoặc perspective không
  hợp lệ.

### Cases

1. Hai group lồng nhau cùng `perspective-origin`.
2. Hai group có perspective distance khác nhau.
3. Hai group có origin lệch nhau.
4. Parent `preserve-3d`, child `flat`.
5. Child `preserve-3d` tiếp tục truyền perspective.
6. Layer nằm giữa hai perspective boundary.
7. Một mặt phẳng cắt near-plane ở perspective trong.
8. Nested perspective kết hợp `backface-visibility`.
9. Nested perspective kết hợp `overflow: hidden`.
10. Nested perspective với clip-path và composition clipping.

### Acceptance

- Descendant giữ đủ projective terms trong Matrix4.
- Perspective ngoài không bị flatten hoặc áp dụng lặp.
- `flat` dừng truyền chiều sâu đúng boundary.
- Bốn góc của surface khớp Browser CSS reference.
- Runtime diagnostic không báo `layer_fully_clipped` sai.
- Có unit test cho matrix order và Playwright screenshot cho từng boundary.

## Phase 7 — Animation/interpolation perspective

### Mục tiêu

Compile animation của `perspective` và `perspective-origin` thành V2 tracks,
Runtime sampling mỗi frame, không tạo CSS animation engine riêng.

### JSON contract

Distance dùng numeric track:

```json
{
  "path": "render3d.perspective.distance",
  "keyframes": [
    { "time": 0, "value": { "type": "number", "value": 400 } },
    { "time": 1000, "value": { "type": "number", "value": 900 } }
  ],
  "easing": {
    "type": "cubicBezier",
    "x1": 0.25,
    "y1": 0.1,
    "x2": 0.25,
    "y2": 1
  }
}
```

Origin dùng typed `vec2` track:

```json
{
  "path": "render3d.perspective.origin",
  "keyframes": [
    { "time": 0, "value": { "type": "vec2", "value": [300, 200] } },
    { "time": 1000, "value": { "type": "vec2", "value": [0, 0] } }
  ]
}
```

### Implementation

- Interpolate `distance` theo số thực.
- Interpolate X/Y của `perspective-origin` độc lập.
- Clamp distance không nhỏ hơn epsilon.
- Hỗ trợ delay, iteration, alternate, fill-mode và play-state hiện có.
- Rebuild local perspective Matrix4 sau mỗi lần sample.
- Không thay đổi layout frame trong animation.
- Giữ transform order giữa perspective, rotate, translateZ và scaleZ.
- Frame đầu/cuối phải deterministic khi animation bị pause hoặc fill.

### Cases

1. Distance tăng tuyến tính.
2. Distance dùng cubic-bezier.
3. Distance dùng `steps()`.
4. Origin chạy từ center sang góc trái.
5. Origin chạy đồng thời X/Y.
6. Animation có delay và `fill-mode: backwards`.
7. `alternate` đổi hướng perspective.
8. Paused/resume bằng `animation-play-state`.
9. Perspective animation kết hợp `rotateY`.
10. Perspective-origin animation kết hợp nested perspective.
11. Animation chạy qua giá trị origin ngoài border-box.
12. Hai track perspective độc lập trên hai group sibling.

### Acceptance

- Cùng timestamp tạo cùng Matrix4 ở mọi backend.
- Frame 0, frame giữa và frame cuối có golden screenshot.
- Không có jump vị trí hoặc thay đổi layout ngoài ý muốn.
- Easing `linear`, `steps()` và cubic-bezier cho cùng kết quả compiler/runtime
  đã định nghĩa.
- Pause/resume không làm thay đổi thời gian hoặc transform ngoài contract.

## Phase 8 — Textured image/video trên projective plane

### Mục tiêu

Image và video giữ đúng texture khi bốn góc bị projective distortion, không bị
render như affine bounding box.

### Implementation Skia

- Tạo projective quad mesh.
- Chia quad thành subdivision khi projective distortion lớn.
- Mỗi vertex giữ:

```text
position.xy
homogeneous.w
uv
```

- Sample image/video bằng UV.
- Resolve `object-fit`, `object-position` và crop trước khi project.
- Image và video dùng chung textured-surface pipeline.
- Compiler nhận metadata media từ catalog (`uri`, intrinsic size, duration, fps)
  để video source-range được validate deterministic thay vì đoán từ CSS.
- Skia dùng `drawVertices` + image shader khi CanvasKit có capability; fallback
  `drawImageRect` chỉ dùng cho surface không projective hoặc backend thiếu mesh.
- Video chỉ cập nhật texture frame nếu geometry không đổi.
- Giữ `image-rendering` theo capability renderer.

### Implementation WebGPU

- Vertex shader nhận Matrix4.
- Fragment shader sample image/video texture.
- Dùng perspective-correct UV interpolation.
- Upload video frame theo Runtime timestamp.
- Dùng cùng subdivision và clipping contract với Skia.

### Cases

1. Image `contain` trên `rotateY`.
2. Image `cover` với `perspective-origin` lệch.
3. Image alpha trên mặt phẳng nghiêng.
4. Video frame trên projective quad.
5. Image/video kết hợp `object-position`.
6. Image/video vượt composition edge.
7. Image kết hợp clip-path.
8. Video kết hợp opacity và blend mode.
9. Subdivision thấp/cao để kiểm tra sai số.
10. Image/video chạy animation `translateZ`.
11. Texture bị cắt một phần ở near-plane.
12. Projective texture trong nested perspective.

### Acceptance

- Texture không bị kéo theo affine bounding box.
- Không có seam giữa các subdivision.
- UV, crop và fit giống nhau giữa Skia và WebGPU.
- Video cùng timestamp tạo cùng frame source.
- Sai số golden pixel nằm trong ngưỡng đã chốt.

## Phase 9 — Near-plane clipping cho mask/filter

### Mục tiêu

Mask và filter vẫn đúng khi visible surface hoặc offscreen effect cắt qua
near-plane, far-plane hoặc composition edge.

### Pipeline bắt buộc

```text
local surface
→ projective transform
→ homogeneous near/far clipping
→ mask source
→ mask composite
→ filter/offscreen effect
→ opacity
→ blend/isolation
→ composition clip
```

### Implementation

- Clip geometry bằng `w` trước perspective divide.
- Mask source được clip cùng transform với visible surface.
- Không chuyển geometric clip thành alpha mask khi geometric clip đủ dùng.
- Filter offscreen surface lấy bounds sau projective projection.
- Blur/drop-shadow mở rộng bounds trước composition clipping.
- `mask-composite` giữ thứ tự sau clipping.
- Alpha mode lấy alpha; luminance mode dùng color-to-coverage deterministic.
- Capability thiếu phải trả diagnostic theo effect/layer.

### Cases

1. Alpha mask bị cắt một phần bởi near-plane.
2. Luminance mask cắt qua near-plane.
3. Hai mask layer `add` và `intersect`.
4. `subtract` tại composition edge.
5. `exclude` với surface nghiêng.
6. Blur source crossing near-plane.
7. Drop-shadow sau blur.
8. Filter kết hợp mask và clip-path.
9. Isolated group có mask/filter projective.
10. Mask source ở perspective boundary khác visible layer.
11. Filter bounds vượt far-plane.
12. Near-plane clipping chỉ xảy ra ở một góc của mask source.

### Acceptance

- Không mất toàn bộ mask khi chỉ một phần surface bị cắt.
- Không xuất hiện alpha đảo hoặc vùng mask leak.
- Filter không leak ra ngoài composition.
- Skia và WebGPU dùng cùng intermediate surface bounds.
- `subtract` và `exclude` được kiểm tra bằng nền màu tương phản.
- Diagnostic xuất hiện khi backend không thể tạo offscreen projective surface.

## Phase 10 (superseded) — Full WebGPU parity

> This original Phase 10 scope is deferred to Phase 11. The active Phase 10
> scope is the Skia hardening section in the roadmap amendment below.

### Mục tiêu

Skia và WebGPU nhận cùng RuntimeFrame, cùng Matrix4, cùng clipping và cùng
effect order. Khác biệt còn lại chỉ thuộc rasterization/anti-aliasing của
backend.

### Backend interface

```text
RuntimeFrame
→ BackendCapabilities
→ RenderSurface
→ ProjectiveGeometry
→ Paint/effect passes
→ Composite output
```

### Implementation

- WebGPU hỗ trợ Matrix4 transform.
- WebGPU hỗ trợ perspective divide và near/far clipping.
- WebGPU hỗ trợ backface culling.
- WebGPU hỗ trợ image/video projective texture.
- WebGPU hỗ trợ mask và mask composite cơ bản.
- WebGPU hỗ trợ filter offscreen.
- WebGPU hỗ trợ blend/isolation.
- Diagnostic capability dùng cùng mã với Skia.
- Không backend nào âm thầm flatten Matrix4 thành Matrix3.
- Golden test sử dụng cùng JSON, RuntimeFrame và timestamp.

### Test groups

1. Matrix4 affine regression.
2. Single perspective.
3. Nested perspective.
4. Animated perspective.
5. Animated perspective-origin.
6. Image projective texture.
7. Video projective texture.
8. Near-plane geometric clipping.
9. Mask/filter near-plane.
10. Blend/isolation.
11. Backface culling.
12. Composition edge clipping.

### Acceptance

- Cùng RuntimeFrame tạo kết quả hình học tương đương.
- Chênh lệch pixel chỉ do rasterization/anti-aliasing trong ngưỡng cho phép.
- Không backend nào bỏ qua projective term.
- Capability thiếu trả diagnostic giống nhau.
- Golden screenshots pass cho Skia và WebGPU.
- E2E test có thể đổi backend mà không đổi fixture JSON.

## Thứ tự triển khai và kiểm thử

```text
Phase 6: Nested perspective
        ↓
Phase 7: Perspective animation
        ↓
Phase 8: Image/video texture
        ↓
Phase 9: Mask/filter near-plane
        ↓
Phase 10: Skia hardening & optimization
        ↓
Phase 11: WebGPU parity (deferred)
```

Mỗi phase cần hoàn thành theo chuỗi:

```text
unit contract test
→ compiler lowering test
→ RuntimeFrame test
→ Skia replay test
→ WebGPU backend test
→ Playwright E2E
→ golden screenshot / pixel diff
```

Không bắt đầu Phase 10 trước khi semantic và offscreen contract của Phase 6–9
ổn định. Nếu không, cùng một lỗi sẽ phải sửa đồng thời ở CSS compiler, Skia
và WebGPU.

## Deliverables tổng thể

- JSON V2 track contract cho perspective distance và origin.
- Runtime Matrix4 nested context resolver.
- Runtime homogeneous clipping contract cho surface và offscreen effect.
- Skia projective textured surface renderer.
- WebGPU Matrix4/projective renderer.
- Bộ fixture trong `apps/web/lib/docs`.
- Unit tests cho compiler, Runtime và backend.
- Playwright E2E với Browser CSS reference.
- Golden screenshot set cho từng phase.
- Capability diagnostics và báo cáo pixel parity.

## Roadmap amendment — Phase 10 is Skia hardening first

The previous Phase 10 WebGPU parity section is deferred. The active Phase 10
scope is now Skia hardening and production optimization; it must not change the
backend-neutral JSON V2 or RuntimeFrame contract.

### Phase 10 deliverables

- Reuse decoded image/video resources by asset revision and invalidate them on
  `resourceGeneration`, `contentRevision`, or decoded frame revision changes.
- Reuse compatible offscreen surfaces through a bounded pool and release every
  temporary surface deterministically.
- Cache ordered Skia filter programs, projective texture meshes, and composed
  mask snapshots with bounded eviction and explicit disposal.
- Keep projective texture/video sampling perspective-correct, including
  near-plane clipping and frame-version invalidation.
- Expose render-cache hits, texture uploads, offscreen creation/reuse and
  frame time through `SkiaRenderStats` and preview data attributes.
- Emit specific diagnostics for unsupported assets, masks, filters, snapshots,
  composites and command replay; never silently drop an effect.
- Add golden screenshot repeatability and production E2E coverage for image,
  video, projective texture, mask/filter and repeated offscreen rendering.

### Phase 10 acceptance

- Repainting the same static frame produces byte-stable canvas pixels.
- Repeated video instances share a decoded texture when their frame revision is
  unchanged, and upload again only when the revision changes.
- Changing a filter, mask source, projective matrix or asset revision cannot
  reuse stale pixels.
- All pooled surfaces, cached images, filters and masks are released by
  `dispose()`; cache sizes remain bounded.
- Skia golden fixtures continue to pass for Phases 8–9.

## Phase 11 — Full WebGPU parity (deferred)

After Phase 10 is stable, implement the former WebGPU parity scope using the
same RuntimeFrame, Matrix4, clipping, mask/filter ordering and diagnostics.
WebGPU remains an adapter, not a reason to add Skia-specific fields to JSON V2.
