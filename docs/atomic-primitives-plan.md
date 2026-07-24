# Atomic primitives — schema, runtime và fixture plan

> Trạng thái: proposal, chưa phải Motion Format normative. Mọi primitive chỉ được thêm vào Zod contract sau khi input fixture, expected Runtime IR và acceptance assertion đã được chốt.

Danh sách đầy đủ và trạng thái cross-layer của mọi object: [`primitives-object.md`](primitives-object.md).

## Định vị kỹ thuật

MotionVideo là 2D motion composition engine cho template-driven video, TVC, infographic và SVG cut-out/semi-organic animation. Đây không phải frame-by-frame drawing tool hoặc full organic character animation suite.

Engine giữ số lượng Node type nhỏ. Sức mạnh đến từ:

```text
Property + Keyframe + Binding + Hierarchy
         + Path + Mask + Repeater + Modifier
```

Bar chart, timeline hoặc character rig phải được compose từ primitive thay vì thêm `BarChartNode`, `TimelineNode` hoặc hàng trăm domain Node.

## Phân loại primitive

Chỉ tạo Node type khi đối tượng có spatial identity, bounds, draw order, hit-test hoặc parenting riêng.

| Loại | Vai trò | Ví dụ |
|---|---|---|
| Drawable Node | Có geometry/bounds và được raster | Text, Shape, Path, SVG, Image, Video |
| Modifier | Biến đổi geometry/property của Node khác | Motion Path, Secondary Motion, Bend, Constraint |
| Compile-time Expansion | Sinh Node/Track literal trước runtime | Repeater, Text Animator, small Emitter |
| Effect/Composite | Xử lý pixels sau khi vẽ Node/subtree | Blur, Shadow, Glow, Mask, Blend |

Mọi item trong array cần `id` ổn định để property track target `effects.glow.radius` hoặc `modifiers.follow.progress`, không dùng array index trong public property path.

## Trạng thái hiện tại

| Capability | Schema | Compiler | Renderer |
|---|---|---|---|
| Property/Track/Keyframe | Có | Có một phần | Numeric evaluator cơ bản |
| Hierarchy/Bone chain | Biểu diễn được bằng `parentId` | Giữ hierarchy | World matrix + SVG worker smoke đã có; Web parity còn thiếu |
| Bounds/Hit-test | Không cần authoring field | Không cần compile | AABB/inverse/draw-order assertions đã có; alpha/mask parity còn thiếu |
| Offscreen plan | Resource limits | Không cần compile | Integer surface plan + dimension/pixel rejection đã có; allocation chờ Mask/Effects |
| Clock/seed + PNG golden | Không cần authoring field | Frame time canonical | Random-access seed và 7 stored pixel goldens đã có |
| Property capabilities | Enumerable schema metadata | Domain/support enforced khi compile | Text và Shape/Path paint evaluator đã có; primitive registry mở rộng dần |
| Path | Typed multi-contour line/cubic + limits | Literal geometry được giữ | Fill/stroke/open/closed/evenodd + true cubic bounds đã có |
| Mask | Typed relation + cycle guard | Literal relation được giữ/namespace | clip/alpha/inverse-alpha, nested và source visibility đã render |
| Motion Path | Chưa có | Chưa có | Chưa có |
| Text Animator | Typed grapheme/word/line authoring directive | Unicode runs + literal tracks | Renderer chỉ nhận Text runs; PNG golden đã có |
| Repeater | list/count + four layouts + limits | Stable IDs/context/stagger expansion | Không lọt vào Runtime; PNG layout golden đã có |
| Effects stack | Chưa có typed schema | Chưa có | Chưa có |
| Path Morph | Chưa có | Chưa có | Chưa có |
| Secondary Motion | Chưa có | Chưa có | Chưa có |

Vì vậy kế hoạch không được mô tả Mask và các modifier tương lai như capability đã chạy chỉ vì tên field/type tồn tại.

## Thứ tự xử lý canonical

```text
1. Resolve variables, bindings và schedules
2. Expand Component / Repeater / Text runs / Emitter
3. Evaluate literal tracks tại time t
4. Build local geometry: Path → Morph → Trim/Bend
5. Apply motion modifiers: Motion Path → Constraint → Secondary Motion
6. Build world matrices theo hierarchy
7. Raster Node/subtree
8. Apply Mask/Clip
9. Apply ordered effects[]
10. Composite theo blend mode và z-order
```

Preview và export phải dùng đúng cùng pipeline/evaluator. Compiler có thể loại authoring expansions, nhưng Runtime IR vẫn được giữ những runtime primitive literal cần geometry/compositing.

## P0 — bảy primitive chính

### 1. Path Node hoàn chỉnh

Không lưu một SVG path string mơ hồ làm canonical geometry. Dùng contours và typed segments:

```ts
type Point = { x: number; y: number };

type PathSegment =
  | { kind: "line"; to: Point }
  | { kind: "cubic"; control1: Point; control2: Point; to: Point };

type PathContour = {
  start: Point;
  segments: PathSegment[];
  closed: boolean;
};

type PathPayload = {
  contours: PathContour[];
  fillRule: "nonzero" | "evenodd";
};
```

Quadratic/arc commands từ SVG được importer normalize thành cubic. Nhiều contour hỗ trợ hole. Style tiếp tục quản lý fill/stroke; geometry không chứa presentation.

Validation:

- finite coordinates;
- contour có ít nhất một segment;
- closed/open hợp lệ với fill/stroke policy;
- bounds tính deterministic;
- reject NaN, Infinity và geometry vượt resource limits.

### 2. Mask/Clip

Thay `maskId` mơ hồ bằng quan hệ typed:

```ts
type NodeMask = {
  sourceNodeId: string;
  mode: "clip" | "alpha" | "inverse-alpha";
  sourceVisibility: "mask-only" | "content-and-mask";
};
```

P0 chỉ một mask/Node, mask source cùng Scene và không được tạo reference cycle. Nested mask được cho phép khi dependency graph không cycle. Luma mask và nhiều mask/Node để sau.

### 3. Motion Path

Motion Path là Modifier trên Node, không phải Node type mới:

```ts
type MotionPathModifier = {
  id: string;
  type: "motion-path";
  pathNodeId: string;
  progress: ResolvableValue; // 0..1
  orientToPath: boolean;
  rotationOffset: number;
  startOffset?: number;
  endOffset?: number;
};
```

Track animate `modifiers.<id>.progress`. Evaluator dùng arc-length lookup table deterministic; tangent xác định orientation. Path Node có thể ẩn nhưng vẫn làm motion resource.

### 4. Text Animator

Text Animator là authoring expansion, không tạo hàng trăm glyph Nodes trong `.mt`:

```ts
type TextAnimator = {
  id: string;
  unit: "grapheme" | "word" | "line";
  selector: { start: number; end: number };
  stagger: number;
  properties: {
    offsetX?: number;
    offsetY?: number;
    rotation?: number;
    scale?: number;
    opacity?: number;
    fill?: string;
  };
};
```

Compiler dùng Unicode grapheme segmentation, không split theo UTF-16 character. Text tiếng Việt tổ hợp dấu và emoji phải giữ nguyên. Runtime nhận text runs + literal tracks.

### 5. Repeater vNext

Repeater hiện đã có list MVP. Không viết lại; mở rộng source và layout:

```ts
type RepeatSource =
  | { kind: "list"; variableId: string; keyPath: string }
  | { kind: "count"; count: ResolvableValue };

type RepeatLayout =
  | { kind: "none" }
  | { kind: "linear"; offsetX: number; offsetY: number }
  | { kind: "grid"; columns: number; gapX: number; gapY: number }
  | { kind: "radial"; radius: number; startAngle: number; endAngle: number };
```

Thêm `timeStagger`, transform step và hard limits. Compiler tiếp tục sinh deterministic namespace; renderer không biết Repeater.

### 6. Multiple effects

Effects là ordered stack trên Node/subtree:

```ts
type Effect =
  | { id: string; type: "blur"; radius: number }
  | { id: string; type: "shadow"; offsetX: number; offsetY: number; blur: number; color: string }
  | { id: string; type: "glow"; radius: number; intensity: number; color: string }
  | { id: string; type: "color-adjust"; brightness: number; contrast: number; saturation: number };
```

Effect order là observable behavior. Track target field qua effect ID. Resource policy giới hạn blur radius, offscreen size và số effects để tránh memory explosion.

### 7. Shape/Path Morph cơ bản

Chỉ morph geometry đã normalize và tương thích topology:

```ts
type PathMorphTarget = {
  id: string;
  contours: PathContour[];
};

type PathMorphModifier = {
  id: string;
  type: "path-morph";
  from: "base" | string;
  to: string;
  progress: ResolvableValue;
};
```

Hai geometry phải cùng số contour, segment count và segment kind. P0 không tự thêm điểm hoặc đoán correspondence. Interpolation chỉ chạy trên numeric point coordinates.

## P0 cut-out bổ sung

### Bone chain

Bone chain dùng Node `bone` + `parentId`; không cần primitive graph mới. Typed payload:

```ts
type BonePayload = {
  length: number;
  rotationLimits?: { min: number; max: number };
};
```

Điều kiện bắt buộc là world matrix/pivot đúng và fixture chứng minh chain 3 đoạn.

### Secondary Motion

Secondary Motion là Modifier deterministic, ưu tiên cho hair/tail/ribbon chain:

```ts
type SecondaryMotionModifier = {
  id: string;
  type: "secondary-motion";
  driverNodeId: string;
  chainNodeIds: string[];
  stiffness: number;
  damping: number;
  lag: number;
  amplitude: number;
  axis: "rotation" | "position";
};
```

MVP dùng fixed timestep và trạng thái có thể derive từ time 0 để random frame render vẫn deterministic. Không phụ thuộc kết quả frame trước trong worker khác. Nếu solver không hỗ trợ random access, compiler bake modifier thành tracks trước khi render.

Segmented SVG parts là lựa chọn P0; path bend/warp nhẹ để P1.

## P1 — sau vertical slice

| Capability | Kiểu primitive | Scope đầu tiên |
|---|---|---|
| Particle emitter | Compile-time Expansion | seeded sprite instances, count limit |
| Trim path | Path modifier | start/end/offset trên arc length |
| Dashed stroke animation | Path style + tracks | dash array/offset |
| Gradient animation | Typed paint | linear/radial stops, stable stop IDs |
| Blend modes | Composite | normal, multiply, screen, overlay, add |
| Audio waveform/beat marker | Authoring metadata/tooling | không đi vào raster IR |
| Simple constraints | Modifier | copy transform, look-at, pin |
| 2-bone IK | Rig modifier | deterministic analytic solver |
| Path bend/simple warp | Geometry modifier | 2–4 control points, bounded scope |

Emitter MVP compile thành Nodes/Tracks để giữ renderer đơn giản. Nếu performance chứng minh cần runtime emitter, phải có benchmark/fixture trước khi đổi representation.

## P2 — ngoài phạm vi hiện tại

- Mesh deformation, skinning và weight paint.
- Organic IK, puppet pins và advanced warp.
- Expression language và arbitrary scripting.
- Full physics simulation.
- Frame-by-frame drawing/onion skin.
- Advanced compositing/custom shaders.

Không thêm placeholder field cho P2 vào canonical schema.

## Cross-cutting schema work

`payload/style` generic đã được thay bằng discriminated schemas cho chín authoring Node family hiện có. Primitive mới phải mở rộng union bằng typed fixture; không thêm lại record tự do. Extension namespaced có kiểm soát chỉ được thêm khi có consumer và validation.

Các field dự kiến trên Node:

```ts
type PrimitiveNodeBase = {
  mask?: NodeMask;
  modifiers?: Modifier[];
  effects?: Effect[];
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "add";
};
```

Reference validator phải hiểu mọi Node/asset/path/effect/modifier ID. Compiler phải reject authoring reference chưa resolve. Runtime schema chỉ nhận literal values và primitive renderer thực sự hỗ trợ.

## Capability registry cho AI/Designer

Mỗi primitive đăng ký metadata dùng chung:

```ts
type PrimitiveCapability = {
  id: string;
  stage: "authoring" | "compiler" | "runtime";
  supportedNodeTypes: string[];
  animatableProperties: string[];
  limits: Record<string, number>;
};
```

Inspector, AI planner, validator và docs đọc cùng registry. AI không được sinh effect/modifier mà active renderer chưa hỗ trợ.

## Fixture structure

```text
docs/fixtures/v2/
  primitives/
    path-basic.mt.json
    mask-modes.mt.json
    motion-path.mt.json
    text-animator-vi.mt.json
    repeater-count-list.mt.json
    effects-stack.mt.json
    path-morph.mt.json
    bone-secondary-motion.mt.json
  invalid/
    path-non-finite.json
    mask-cycle.json
    motion-path-missing-path.json
    text-selector-invalid.json
    repeater-over-limit.json
    effect-duplicate-id.json
    morph-topology-mismatch.json
    secondary-chain-invalid.json
  expected-runtime/
  expected-frames/
```

## Assertions theo primitive

| Primitive | Schema/reference | Compiler/evaluator | Visual/performance |
|---|---|---|---|
| Path | geometry/bounds/limits | typed literal geometry | fill, stroke, holes, open path |
| Mask | source/cycle/mode | dependency order | clip/alpha/inverse/nested |
| Motion Path | path/progress refs | arc length/tangent | start/middle/end/orientation |
| Text Animator | selector/unit | grapheme runs/stagger | Việt/emoji/word/line |
| Repeater | source/key/limit | IDs/context/layout | list/count/grid/radial |
| Effects | unique IDs/limits | ordered stack properties | blur/shadow/glow/order |
| Morph | topology | numeric interpolation | 0/0.5/1 exact silhouettes |
| Bone Secondary | chain/driver/limits | random-access deterministic | hair chain at fixed times |

Mỗi visual golden có frame tại time cố định, pixel tolerance và diff artifact. Mỗi compile-time primitive có expected Runtime JSON chứng minh authoring construct đã biến mất.

## Composition fixtures

Ngoài fixture riêng lẻ cần ba fixture kết hợp:

1. `infographic-composition`: Path + Repeater + Text Animator + Effects.
2. `product-tvc-composition`: Mask + Motion Path + Image/SVG + Camera.
3. `cutout-semi-organic`: Bone chain + Secondary Motion + Mask + mouth variants + audio.

Những fixture này phát hiện lỗi interaction/order mà unit fixture không thấy.

## Development phases

### Phase 0 — foundation

**Status: complete (2026-07-24).** Shared evaluator/property registry, world matrix/bounds/hit-test, offscreen planning, deterministic clock/seed, JSON/PNG goldens, resource limits và unsupported-capability rejection đều có automated assertions.

1. Shared property evaluator và stable property-path registry.
2. World matrix, bounds, hit-test và offscreen surface abstraction.
3. Runtime capability registry và unsupported-capability rejection.
4. Golden JSON/PNG harness, deterministic clock/seed và resource limits.

### Phase 1 — geometry/compositing

1. [x] Typed Shape/Path/Paint schema, renderer, bounds, limits và JSON/PNG goldens.
2. Path import normalization từ SVG arc/quadratic sang canonical cubic.
3. [x] Mask dependency graph, clip/alpha/inverse-alpha, nested compositing và mask-aware hit-test.
4. [x] Node layer compositing dùng chung cho masked Shape/Path/Text/Image/SVG.
5. [x] Visual fixtures cho mask modes, nested composition và source visibility.

### Phase 2 — compile-time expressiveness

1. [x] Repeater list/count, none/linear/grid/radial, orient-to-angle và time stagger.
2. [x] Text Animator với Unicode grapheme/word/line segmentation, selector và stagger.
3. [x] Expected Runtime snapshots, unit limits và authoring-only leak rejection.

### Phase 3 — movement và cut-out

1. Motion Path arc-length evaluator.
2. Bone chain/world pivot fixtures.
3. Secondary Motion deterministic bake/evaluator.
4. Tích hợp named actions/variants từ `svg-cutout-plan.md`.

### Phase 4 — visual finish

1. Ordered effects stack.
2. Basic normalized Path Morph.
3. Blend modes tối thiểu và performance budgets.

### Phase 5 — P1 có chọn lọc

Chỉ triển khai primitive P1 khi có template/vertical slice thật cần nó và fixture acceptance được viết trước.

## Definition of done cho một primitive

- Typed authoring schema và reference validation.
- Runtime representation rõ ràng: expanded hoặc literal primitive.
- Stable animatable property paths.
- Compiler/evaluator implementation dùng chung preview/export.
- Positive, negative, expected Runtime và visual fixtures.
- Resource/performance limits và lỗi unsupported rõ ràng.
- Inspector/AI capability metadata.
- Docs normative chỉ cập nhật sau khi tất cả assertions pass.
