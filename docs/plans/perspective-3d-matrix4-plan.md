# Perspective 3D và Matrix4 Runtime/Skia

## Implementation status

- Phase 1 — Contract and capability: complete.
- Phase 2 — Matrix4 canonical runtime baseline: complete for protocol/compiler
  propagation, perspective context composition, validation, and explicit
  projective capability diagnostics.
- Phase 3 — Skia projective geometry: complete for the current planar-surface
  contract, including general triangle-surface tessellation, homogeneous
  near/far clipping, camera-to-canvas mapping, and shared clip/mask transforms.
- Phase 4 — Image, text and effect surfaces: complete for the current preview
  contract's projective transform propagation through image/video/text glyphs,
  masks, isolation, and existing offscreen effect programs. Textured image
  mesh refinement remains a separate capability milestone.

## Mục tiêu

Đưa perspective 3D từ CSS/Protocol V2 xuống Runtime V3 và Skia một cách
deterministic, không làm mất chiều `z` khi đi qua backend.

Mục tiêu kiến trúc:

```text
CSS / JSON V2
      |
      v
Runtime V3: Matrix4 canonical
      |
      +--> WebGPU: Matrix4 vertex projection
      +--> Skia affine: Matrix3 fast path khi an toàn
      +--> Skia perspective: projective geometry từ Matrix4
```

Runtime và Protocol không được phụ thuộc vào Matrix3. Matrix3 chỉ là chi tiết
nội bộ của Skia cho các transform affine 2D đã được kiểm tra.

## Quyết định semantic

Protocol V2 giữ ba loại perspective riêng biệt:

```text
composition.view.projection
    Camera toàn composition, phục vụ render target/export.

layer.render3d.perspective
    CSS perspective context của group, áp dụng cho descendants.

layer.transform.operations[].motion.perspective
    CSS transform: perspective(...) của chính layer.
```

Các transform 3D khác vẫn nằm trong `layer.transform`:

- `translate.z`;
- `scale.z`;
- `rotate.x`, `rotate.y`, `rotate.z`;
- ordered operations `translate`, `scale`, `rotate`, `motion.*`.

Quy ước runtime:

- Matrix lưu dạng column-major 4×4.
- Tọa độ XY dùng origin góc trên trái, Y tăng xuống.
- `+Z` hướng về camera theo convention hiện tại.
- `near`/`far` dùng để clipping, không tự động thay đổi `order`.
- `order` vẫn là paint order deterministic trong phase đầu.
- `z = 0`, rotate Z và không có projective term phải giữ output 2D hiện tại.

## Phase 1 — Contract và capability

### Phạm vi

- Audit `V2ProjectionSchema`, `V2Render3DSchema`, `V2TransformSchema`.
- Chốt default cho orthographic, perspective, `flat`, `preserve-3d`.
- Chốt thứ tự nhân matrix giữa camera, group perspective và layer transform.
- Định nghĩa clipping khi điểm nằm sau camera, gần `near` hoặc vượt `far`.
- Định nghĩa capability:
  - `matrix4.transform`;
  - `matrix4.projective`;
  - `group.render3d.perspective`;
  - `layer.backfaceVisibility`;
  - `skia.projective.geometry`.

### Diagnostic

Backend không hỗ trợ projective rendering phải trả diagnostic rõ ràng. Không
được âm thầm rút Matrix4 thành Matrix3 nếu matrix có chiều sâu hoặc perspective.

### Acceptance

- Schema chấp nhận composition perspective và group perspective.
- Schema từ chối FOV, near/far, distance không hợp lệ.
- JSON cũ với `z = 0` vẫn parse và render như cũ.
- Có test xác nhận ba cấp perspective không bị gộp semantic.

## Phase 2 — Matrix4 canonical trong Runtime

### Phạm vi

- Giữ `localMatrix`, `worldMatrix`, `worldToClipMatrix` là Matrix4.
- Loại bỏ các API runtime coi Matrix3 là transform chính.
- Hoàn thiện `transformPoint4`, perspective divide và projective clipping.
- Áp dụng đúng `z`, rotateX/Y, translateZ và scaleZ trong world transform.
- Xử lý `flat` bằng flatten tại group boundary.
- Xử lý `preserve-3d` bằng cách giữ world transform 3D của descendants.
- Giữ `backface-visibility` sau accumulated transform.

### Affine compatibility

Runtime phải phân loại matrix:

```text
Affine 2D
  z = 0, không rotateX/Y, w không thay đổi
  → cho phép Skia Matrix3 fast path

3D/projective
  có chiều sâu, rotateX/Y hoặc perspective term
  → bắt buộc giữ Matrix4 tới backend projective
```

### Acceptance

- `z` được bảo toàn qua Protocol → RuntimeFrame → PaintCommand.
- Orthographic với `z` khác 0 không làm thay đổi XY ngoài contract đã chốt.
- Perspective làm vật thể gần camera lớn hơn một cách deterministic.
- Near/far và behind-camera clipping không tạo draw command sai.
- Toàn bộ regression 2D hiện tại vẫn pass.

## Phase 3 — Skia projective geometry

### Phạm vi

- Giữ Matrix4 trong `PaintCommand.setTransform`.
- Chỉ gọi `canvas.concat(Matrix3)` khi matrix được xác nhận affine 2D.
- Shape/rectangle/circle/path:
  - flatten hoặc tessellate geometry;
  - project vertex bằng Matrix4;
  - perspective divide;
  - clip triangle/polygon theo camera plane;
  - render bằng Skia path hoặc vertices.
- Không dùng `matrix4ToSkia3x3()` cho projective matrix.

### Paint và clipping

- Composition clip áp dụng sau projection.
- Clip-path phải được project cùng coordinate space với drawable.
- Stroke cần được tessellate trước hoặc sau projection theo contract đã chốt.
- `non-scaling-stroke` chỉ được giữ khi backend chứng minh được geometry hợp lệ;
  nếu không phải trả diagnostic.

### Acceptance

- Rectangle rotateX/Y không bị biến thành affine bounding box.
- Hai cạnh của một mặt phẳng có độ hội tụ đúng khi có perspective.
- Path cong được project liên tục, không có khoảng hở giữa các triangle.
- Clip composition và clip-path đúng ở near/far edge.
- Matrix affine cũ cho output pixel tương đương trước khi bật projective path.

### Completed follow-up acceptance

- General Runtime meshes are clipped in homogeneous space before division by
  `w`; the fixtures cover rotate-X, rotate-Y, and curved ellipse cuts.
- Golden SVG/Skia pixel diff is checked by
  `apps/web/e2e/skia-projective.spec.ts` for every near-plane fixture.

## Phase 4 — Image, text và effect surfaces

### Phạm vi

- Image: render textured quad/projective mesh.
- Video: dùng cùng image projective path sau khi frame source đã được resolve.
- Text: shape glyph hoặc rasterize vào offscreen surface rồi project surface.
- Mask: project source surface trước khi composite coverage.
- Filter/blur/shadow: chạy trên offscreen surface trong đúng coordinate space.
- Blend/isolation: giữ group boundary trước khi project/composite.
- Outline, border-radius, gradient và background image phải dùng cùng transform.

### Thứ tự bắt buộc

```text
local transform
  → group preserve-3d / perspective
  → world Matrix4
  → camera projection
  → geometric clip
  → offscreen paint/effects
  → opacity / blend / isolation
  → Skia output
```

Thứ tự thực tế phải được kiểm chứng bằng golden capture, đặc biệt với mask,
filter và blend trong isolated group.

### Acceptance

- Image/video không bị kéo sai khi bốn góc có projective distortion.
- Text giữ đúng glyph order và không bị đổi baseline ngoài projection.
- Mask/filter không bị áp dụng trước hoặc sau perspective sai scope.
- Blend và isolation không leak ra sibling bên ngoài group.

## Phase 5 — CSS compiler, preview và rollout

### CSS lowering

### Implementation status

The first Phase 5 vertical slice is implemented and covered by the HTML
compiler preview. CSS parent perspective now lowers to `group.render3d`,
`perspective-origin` is resolved in the group's local border-box units,
`transform-style` and `backface-visibility` are preserved, and 3D transform
functions lower to ordered Matrix4 operations or typed transform tracks.

Runtime now carries an explicit projective clipping policy. CSS parent
perspective and `transform: perspective()` use `depthClip: "w-only"`: the
homogeneous camera plane is enforced, while the global orthographic near/far
planes are not reapplied to descendants whose `w` varies across the surface.
Ordinary view projection keeps `depthClip: "global"`. Runtime V3 still culls
reversed surfaces when `backface-visibility: hidden` is active.

E2E coverage currently includes eight independent fixtures in
`apps/web/e2e/html-compiler-perspective.spec.ts`: group translateZ, rotateX,
off-center perspective origin, flat/preserve-3d markers, transform
`perspective()`, hidden backface, near/far clipping, and animated 3D tracks.

- `perspective` → `group.render3d.perspective`.
- `perspective-origin` → `render3d.perspective.origin`.
- `transform-style` → `render3d.transformStyle`.
- `backface-visibility` → layer `backfaceVisibility`.
- `translateZ`, `scaleZ`, `rotateX`, `rotateY` → ordered transform/Matrix4.
- `transform: perspective(...)` → ordered `motion.perspective` operation.
- Không đưa `z` vào layout 2D hoặc làm thay đổi frame size.

### E2E cases

Mỗi case là một fixture riêng và kiểm tra CSS → Protocol V2 → RuntimeFrame →
Skia output:

1. Composition perspective với một rectangle có `translateZ`.
2. `rotateX` trên rectangle phẳng.
3. `rotateY` với `perspective-origin` lệch tâm.
4. Group `flat` và group `preserve-3d` khác nhau.
5. Nested group perspective.
6. `transform: perspective(...)` khác với group `perspective`.
7. `backface-visibility: hidden`.
8. Near-plane và far-plane clipping.
9. Animated `translateZ` và `rotateY`.
10. Perspective kết hợp image, clip-path, mask và isolation.
11. So sánh Skia với WebGPU trên cùng RuntimeFrame.
12. Regression toàn bộ case 2D, paint và motion path hiện tại.

### Rollout

- Bật Matrix4 canonical trước, nhưng giữ affine fast path.
- Bật projective shape/path sau khi golden tests pass.
- Bật image/text/effects theo capability từng backend.
- Chỉ bật CSS perspective mặc định khi Skia và WebGPU cùng pass các case bắt
  buộc; nếu backend thiếu capability, hiển thị diagnostic thay vì flatten im lặng.

## Không thuộc đợt đầu

- Tự động depth-sort theo `z` hoặc z-buffer thay cho `order`.
- Full CSS 3D scene graph với preserve-3d không giới hạn.
- Perspective filter shader tối ưu GPU.
- Subpixel parity tuyệt đối giữa browser, Skia và WebGPU.

## Tiêu chí hoàn thành

- Protocol V2 phân biệt rõ composition camera, group perspective và transform
  perspective.
- Runtime không mất `z` và không dùng Matrix3 làm canonical representation.
- Skia không silently flatten projective Matrix4.
- Affine 2D không bị regression.
- Có diagnostic capability cho mọi trường hợp backend chưa hỗ trợ.
- Có E2E capture và test JSON/runtime/Skia cho từng nhóm semantic.
