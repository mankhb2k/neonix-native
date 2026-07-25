# Browser preview và atomic primitive test roadmap

> Baseline kỹ thuật: 24/07/2026. Từ quyết định schema-first, lịch calendar M1–M5 bên dưới được xem là forecast cũ và chỉ bắt đầu lại sau freeze gate trong [`schema-fixture-roadmap.md`](schema-fixture-roadmap.md). Thiết kế pipeline/gates vẫn giữ nguyên; browser preview không còn là sprint kế tiếp.

## Đích sản phẩm

Có ba mốc khác nhau, không được gọi chung là “hoàn thiện”:

1. **P0 production**: đủ cho phần lớn motion graphics 2D, infographic, template video và cut-out animation từ SVG có sẵn.
2. **P1 broad motion**: thêm particle, trim/dash/gradient animation, blend mode, constraint và 2-bone IK.
3. **P2 advanced animation suite**: mesh, skinning, organic IK, puppet/warp, physics, expressions, frame-by-frame và shader. Đây là một dòng sản phẩm lớn hơn, không phải điều kiện để phát hành app theo định vị hiện tại.

Mục tiêu phát hành đầu tiên là P0 production, không phải mô phỏng toàn bộ After Effects/Toon Boom/Rive.

## Browser preview sẽ chạy như thế nào

```text
Project/Component authoring data
        ↓
Browser-safe compiler (Web Worker)
        ↓
Literal Runtime IR
        ↓
Deterministic clock: frame ↔ time
        ↓
Shared property evaluator + world matrices
        ↓
Shared RenderPlan/display list
        ├── Browser Canvas2D adapter
        └── Node Canvas raster workers → FFmpeg
```

### Luồng editor

1. Khi Project, variable hoặc public prop thay đổi, Web Worker compile lại phần bị ảnh hưởng thành Runtime IR. React không tự diễn giải preset/keyframe.
2. Player giữ `currentFrame`, không giữ thời gian trôi nổi. `time = currentFrame / fps`; pause/scrub/jump đều evaluate ngẫu nhiên được.
3. `@motionvideo/motion-runtime` evaluate track, transform, hierarchy, visibility, mask/effect parameters tại đúng timestamp.
4. Render core tạo RenderPlan đã sắp z-order và resolve geometry/compositing. Browser Canvas2D chỉ thực thi plan; overlay chọn node, bounding box và pivot nằm ở lớp editor riêng.
5. Browser asset resolver dùng `Blob/ObjectURL`, cache ảnh/font/SVG đã sanitize và báo trạng thái loading/error rõ ràng. Export resolver dùng file/cache đã verify integrity.
6. Export dùng cùng compiler, Runtime IR, clock, evaluator và RenderPlan. Hai raster adapter có thể khác API, nhưng phải qua parity screenshot với tolerance đã chốt.

Không encode MP4 để preview từng lần sửa và không tiếp tục dùng CSS animation làm nguồn sự thật. CSS chỉ dùng cho UI chrome, loading hoặc catalog demo không thuộc editor.

## Definition of done cho mỗi primitive

Một primitive chỉ được đánh dấu **Implemented** khi qua đủ gate áp dụng được:

1. **Contract**: typed schema, default, limit và serialization round-trip.
2. **Reference/negative**: missing ID, cycle, invalid topology/value và resource limit bị reject đúng error path.
3. **Compiler golden**: authoring construct compile thành Runtime IR literal, deterministic, không rò preset/component/repeater directive.
4. **Evaluator**: assertion tại before/start/middle/end/after, easing, hierarchy và random-access frame.
5. **Renderer visual**: golden PNG ở timestamp cố định, pixel tolerance và diff artifact khi fail.
6. **Web/export parity**: cùng fixture/frame cho kết quả nằm trong tolerance; save/reload không đổi output.
7. **Interaction/performance**: phối hợp hierarchy/mask/effect/camera; giới hạn node/path/effect; benchmark và không crash khi asset lỗi.

Gate không liên quan chỉ được ghi `N/A` khi có lý do trong catalog. “Có field trong Zod” hoặc “fixture parse được” không đồng nghĩa primitive đã hoàn thiện.

## Lộ trình P0 production — 12 đến 14 tuần

### M1 — Preview parity foundation · 27/07–07/08/2026

- Tách compiler thành package browser-safe, không import Node API.
- Tạo RenderPlan/display-list contract và Canvas2D browser adapter.
- Chuyển `PreviewStage` từ CSS preset sang Runtime IR + deterministic clock.
- Asset resolver interface cho browser/worker.
- Parity harness: fixture + frame → browser PNG và export PNG → diff.

**Exit:** fixture hierarchy SVG hiện tại play/scrub được trong editor; ba frame `t=0/1/1.5` khớp worker trong tolerance.

### M2 — Geometry và compositing core · 10/08–28/08/2026

- Shape rectangle/ellipse/polygon.
- Typed Path: line/cubic, open/closed, holes và fill rule.
- Image/SVG fit/crop/alpha, stable bounds và hit-test.
- Mask/Clip: clip, alpha, inverse-alpha; cycle guard.
- Z-order, transformed bounds và editor selection overlay.

**Exit:** geometry/mask fixture suite qua đủ contract, negative, visual và parity gates.

### M3 — P0 motion primitives · 31/08–25/09/2026

- Motion Path theo arc length + orient-to-path.
- Repeater count/list + linear/grid/radial + stagger.
- Text Animator theo grapheme/word/line, bao gồm tiếng Việt và emoji.
- Ordered effects MVP: blur, shadow, glow, color adjust.
- Normalized Path Morph; reject topology không tương thích.
- Deterministic limits cho node/path/effect/repeater.

**Exit:** mỗi primitive có positive/negative fixture, compiler/evaluator assertions, ít nhất ba golden frames và Web/export parity.

### M4 — Cut-out vertical slice · 28/09–16/10/2026

- Typed Bone/SVG part, rest pose, prop attachment.
- Named actions: idle, blink, talk, wave; variant slot cho mouth/eye/hand.
- Voiceover cue → mouth step keys; camera shot và scene transition.
- Project acceptance 20–30 giây có hai nhân vật, hội thoại, gesture, prop, camera, BGM/voiceover/SFX.

**Exit:** import/rig data đã chuẩn bị → edit/scrub → save/reload → export MP4; preview và sampled export frames qua parity.

### M5 — P0 hardening/release gate · 19/10–30/10/2026

- Cross-primitive compositions và regression suite.
- Performance budget, malformed/oversized project, missing/corrupt asset.
- CI artifacts cho Runtime JSON, PNG diff, MP4 probe và benchmark.
- Cập nhật capability registry để AI chỉ sinh primitive đã qua gate.

**Kết quả dự kiến:** P0 production hoàn thiện cuối tháng 10/2026, nếu scope và nhân lực giữ nguyên.

## Sau P0

### P1 broad motion · khoảng 3–4 tháng tiếp theo

Particle emitter, trim path, dashed stroke, gradient animation, blend modes, waveform/beat marker, simple constraints, 2-bone IK. Dự kiến hoàn thành khoảng **02/2027** với một developer.

### P2 advanced suite · thêm khoảng 6–9 tháng

Mesh deformation, skinning/weight paint, organic IK, puppet/warp, expressions, physics, frame-by-frame, advanced compositing và custom shaders. Nếu thật sự giữ toàn bộ scope này, forecast hợp lý cho một developer là **08–11/2027**; cần prototype và benchmark trước khi cam kết từng capability.

Với hai developer làm song song renderer/runtime và Web/editor, P0 có thể giảm còn khoảng 8–10 tuần; P2 vẫn không nên hứa trước khi có người dùng P0/P1 xác nhận nhu cầu.

## Thứ tự fixture và CI

Mỗi sprint đi theo cùng một vòng:

```text
schema + limits
→ positive/negative fixtures
→ compiler golden
→ evaluator timestamps
→ worker visual golden
→ browser/export parity
→ cross-primitive + performance
```

CI tối thiểu khi kết thúc M1:

```bash
pnpm typecheck
pnpm validate:v2-fixtures
pnpm validate:primitives
pnpm test:compiler-golden
pnpm test:visual-worker
pnpm test:preview-parity
pnpm e2e:render
```

Ba lệnh `test:*` cuối là acceptance target cần được tạo trong M1–M2; không ghi là đã có ở baseline hiện tại.

## Báo cáo tiến độ

Cuối mỗi sprint cập nhật [`primitives-object.md`](primitives-object.md) theo từng cột Contract/Compiler/Evaluator/Worker/Web/Parity. Phần trăm hoàn thành tính theo gate đã qua, không tính theo số type hoặc số dòng code. Mọi failure phải giữ lại Runtime JSON, expected/actual PNG và diff image để có thể review bằng mắt.
