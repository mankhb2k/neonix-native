# Chương trình v2-upgrade — hệ authoring motion graphics 2.5D chuyên nghiệp

> **Trạng thái:** Kiến trúc đích và kế hoạch thực thi
> **Phạm vi:** Công cụ animation/effect chuyên nghiệp cho Designer, tùy biến template an toàn cho người dùng phổ thông
> **Tên chương trình:** `v2-upgrade`
> **Chính sách format:** Chuẩn hóa trực tiếp Motion Format v2. App chưa public và chưa có project v2 thực tế, vì vậy không duy trì legacy parser, compatibility alias hoặc migrator cho schema hiện tại.

## 1. Kết quả sản phẩm cần đạt

MotiClip là hệ motion graphics 2.5D phân lớp, không phải phần mềm 3D tổng quát và không cần sao chép toàn bộ After Effects.

Sản phẩm có hai bề mặt trên cùng một document model:

1. **Designer Authoring:** cho phép truy cập đầy đủ node graph, typed track, dữ liệu Graph Editor, effect, matte, adjustment, constraint, procedural driver, depth/parallax, action và nội bộ Component.
2. **Template User:** chỉ sửa public contract do Designer công bố như text, asset, brand style, variant, danh sách nội dung và các control motion/effect/duration đã giới hạn an toàn.

Nâng cấp thành công khi Designer có thể tạo kinetic typography, product promo, layered parallax, logo reveal, masked transition, infographic, UI motion và SVG cut-out chất lượng cao; đồng thời Template User tùy biến được kết quả mà không sửa node, keyframe hoặc driver graph nội bộ.

## 2. Ngoài phạm vi

Chương trình không bổ sung:

- mesh, material, light hoặc depth buffer;
- perspective mesh, camera orbit tự do hoặc `rotateX/rotateY` tùy ý;
- skinning/weight paint và organic puppet deformation;
- runtime JavaScript/After Effects expression không giới hạn;
- frame-by-frame drawing/onion skin;
- custom shader tùy ý trong core portable format;
- một Node type mới cho mỗi use case hình ảnh.

`depth` trong MotiClip điều khiển layered projection/parallax. Thứ tự vẽ vẫn tường minh và deterministic.

## 3. Quyết định rebaseline trực tiếp Motion Format v2

App chưa public, chưa có project hoặc Component v2 của người dùng cần bảo toàn. Freeze P0 cũ được gỡ bỏ có chủ ý để thiết kế lại v2 thành contract hoàn chỉnh trước release đầu tiên.

Các thay đổi breaking sau được thực hiện trực tiếp dưới `formatVersion: 2`:

- typed Runtime Track và typed keyframe interpolation;
- canonical position/transform model và spatial tangent;
- depth/camera semantics cho 2.5D;
- Adjustment Node và isolated compositing group;
- typed procedural driver cùng evaluation order;
- Runtime easing dạng closed union;
- effect/matte mới và motion-blur render settings.

Quy ước thực thi:

- chỉ tồn tại một parser và một canonical schema v2;
- không viết `migrateV2ToCurrent()`, legacy parser hoặc compatibility alias;
- fixture `.mt`/`.mvc` hiện tại là dữ liệu phát triển và được rewrite theo schema mới;
- Runtime JSON/PNG golden được rebaseline theo từng vertical slice sau khi review diff;
- artifact cũ không còn hợp schema mới phải bị reject, không được fallback;
- `formatVersion: 2` chỉ được freeze lại khi toàn bộ Core gate trong catalog đích đã đạt;
- sau lần public đầu tiên, mọi breaking change tiếp theo mới bắt buộc bump format hoặc có migration boundary.

Git history/tag giữ lại baseline cũ để đối chiếu kỹ thuật, nhưng baseline đó không phải compatibility contract.

## 4. Kiến trúc đích

```text
Designer Authoring IR
  nodes + typed tracks + drivers + effects + components + public API
                              │
                              │ validate + compile
                              ▼
Canonical Runtime IR
  literal typed values + dependency DAG + resolved local time
                              │
                              │ evaluate frame
                              ▼
Evaluated Scene State
  transforms + depth projection + geometry + effect parameters
                              │
                              │ build render plan
                              ▼
RenderPlan / compositing DAG
  isolated groups + mattes + adjustment passes + blur samples
                 ┌────────────┴────────────┐
                 ▼                         ▼
       Browser preview adapter       Export worker adapter
```

React, CSS animation và editor widget không được trở thành animation evaluator thứ hai. Preview và export phải dùng chung compiler, clock, evaluator và RenderPlan contract.

## 5. Các invariant bắt buộc

1. Frame time là `frameIndex / fps`; evaluation random-access và không phụ thuộc lịch sử playback.
2. Primitive ngẫu nhiên là hàm thuần của stable seed, channel và sample index/time bucket.
3. `zIndex` điều khiển compositing order; `depth` điều khiển parallax response. Không suy diễn trường này từ trường kia.
4. Component Instance là reusable authoring package, không mặc định là rasterized precomposition.
5. Mỗi field được parser chấp nhận phải được compile, evaluate, compile-away theo rule đã ghi hoặc bị reject. Cấm silent field loss.
6. Mỗi property chỉ có một value kind, interpolation policy, combine operator, domain và runtime support state trong capability registry.
7. Runtime schema và evaluator dùng cùng closed vocabulary. Unknown easing/effect/driver không được âm thầm fallback.
8. Modifier family phải là ordered stack hoặc bị giới hạn cardinality bằng validation. Runtime `.find()` không được bỏ qua instance hợp lệ phía sau.
9. Template User không được địa chỉ hóa property nội bộ nếu Component chưa công bố.
10. Browser/export parity là release gate.

## 6. Evaluation order chuẩn

```text
Node literal/default
→ Component prop và variable binding
→ Clip local-time mapping và keyframe track
→ Procedural driver stack (replace/add/multiply)
→ Constraint và secondary motion
→ Layered 2.5D camera/parallax projection
→ Geometry modifier
→ Local/subtree rasterization
→ Clip/alpha/luma matte
→ Ordered node effects
→ Adjustment trong isolated group hiện tại
→ Layer blend và parent compositing
→ Scene transition và project compositing
```

Ngoại lệ phải có ADR và typed stage riêng. Plugin không được tự thay đổi thứ tự trên.

## 7. Thay đổi data model đích

### 7.1 Typed property và track

Mở rộng property capability registry với:

- `valueKind`: `number | angle | vec2 | color | boolean | string | asset | path | gradient`;
- danh sách interpolation được phép;
- combine operator cho driver;
- unit, min/max và resource limit;
- `animatable`, `bindable`, `public`, `runtimeSupport`;
- color space hoặc angle policy khi phù hợp;
- quyền Designer/Template User.

Track vẫn dùng property path, nhưng value kind phải tường minh:

```json
{
  "targetId": "hero",
  "property": "transform.position",
  "valueKind": "vec2",
  "preBehavior": { "type": "clamp" },
  "postBehavior": { "type": "cycle", "mode": "pingpong" },
  "keys": []
}
```

Không có lý do compatibility để giữ đồng thời hai representation. WS1 phải khóa một canonical Transform ADR; khuyến nghị dùng `transform.position` dạng `vec2` làm địa chỉ animation chính thức. Nếu giữ storage x/y phẳng vì hiệu năng/ergonomics thì `transform.position` phải là capability ảo duy nhất cho compound spatial track, và validation phải cấm representation xung đột. Không ship alias mơ hồ.

### 7.2 Keyframe và segment interpolation

Thay easing enum cố định bằng closed typed union:

- `hold`;
- `linear`;
- `cubic-bezier` với temporal handles được validate;
- `spring` với mass, stiffness, damping, initial velocity;
- discrete interpolation theo property.

Quyền sở hữu segment phải rõ: key bên trái sở hữu `outInterpolation`; key bên phải có thể khai báo spatial incoming handle. Evaluator không được tùy ý đọc easing từ một phía không được contract quy định.

`vec2` key có thể khai báo `spatialOut`/`spatialIn`. Reject spatial handle trên scalar, color, boolean, string và asset.

Angle track khai báo `shortest | clockwise | counterclockwise | continuous`. Color track dùng `oklab` làm canonical mặc định và cho phép `srgb` để tương thích.

### 7.3 Track extrapolation

Hỗ trợ:

- `clamp`;
- `cycle`;
- `pingpong`;
- `offset-cycle` cho number/angle/vec2;
- `continue` cho number/angle/vec2 dựa trên terminal velocity.

Clip playback điều khiển toàn clip/action. Track extrapolation chỉ điều khiển một property.

### 7.4 Typed procedural driver graph

Vocab đầu tiên:

- `noise`/`wiggle`;
- `oscillator`;
- `link-property`;
- `remap-range`;
- `delay-follow`;
- `spring-follow`;
- `time-remap`;
- `clamp`, `wrap`, `quantize`.

Mỗi driver có stable ID, typed input/output, destination property, combine operator và deterministic parameters. Driver tạo dependency DAG; missing source, type mismatch và cycle là reference error.

Không driver nào thực thi code tùy ý. Plugin muốn portable phải compile về closed Runtime driver vocabulary.

### 7.5 Layered 2.5D

Thêm `transform.depth` độc lập với draw order. Scene khai báo không gian:

```json
{
  "space": {
    "mode": "layered-2.5d",
    "depthRange": [-1, 1],
    "projection": "parallax"
  }
}
```

Camera vẫn là 2D view controller gồm x/y, rotation, zoom và parallax strength/camera depth nếu cần; không có free 3D orientation.

Parallax modifier cho phép override từng layer:

- position response x/y;
- zoom response;
- rotation response;
- depth-driven blur tùy chọn;
- clamp policy để giữ bounds an toàn.

Trước khi duyệt fixture phải có ADR khóa công thức projection, coordinate convention, inverse mapping và neutral-depth behavior.

### 7.6 Compositing boundary và Adjustment

Group có semantics rõ:

- `isolation: pass-through | isolate`;
- optional `clipToBounds`;
- subtree bounds chuẩn;
- mask/effect trên isolated Group tác động vào rasterized subtree;
- pass-through Group không giả lập pixel surface riêng.

Thêm `type: "adjustment"` là Node không tự vẽ. Nó áp dụng effect stack lên các sibling đã composite phía dưới trong isolated group hiện tại; tôn trọng visibility, opacity, matte, local time và z-order; không xuyên isolation boundary.

Matte mode đích:

- `clip`;
- `alpha`;
- `inverse-alpha`;
- `luma`;
- `inverse-luma`.

Component package tiếp tục tách khỏi compositing isolation. Nếu cần local-timeline precomp, thiết kế `precomp` contract riêng thay vì overload Component.

### 7.7 Effect framework chuyên nghiệp

Mọi effect có stable ID, enabled state, typed animatable parameters và bounds-inflation rule. Khi phù hợp, effect có opacity và blend mode riêng.

Giữ và harden:

- blur;
- shadow;
- glow;
- color adjust.

Bổ sung theo thứ tự:

1. levels/curves dạng portable có giới hạn;
2. tint/gradient-map;
3. directional blur;
4. radial blur;
5. displacement map/turbulent displacement;
6. noise/grain;
7. echo/trail;
8. transform/repeated-transform effect;
9. chromatic aberration;
10. posterize time.

Mỗi effect chỉ được thêm khi có schema, evaluator/renderer, resource budget, visual golden và preview/export parity. Không thêm placeholder vào union.

### 7.8 Motion blur

Thêm Project/Scene render settings:

- enabled;
- shutter angle;
- sample count;
- shutter phase hoặc centered default đã ghi rõ;
- per-node `inherit | on | off`.

Implementation đầu dùng deterministic temporal supersampling. Sample lấy từ output-frame timestamp, không lấy từ wall clock. Enforce offscreen/sample budget trước render.

### 7.9 Public contract của template

Giữ Component variables, bindings, public params, variants và named actions. Mở rộng Public Param metadata:

- `step`, min/max và safe range;
- `affectsDuration`;
- `requiresRecompile`;
- conditional visibility;
- preview hint;
- `basic | advanced | designer-only`;
- mapping từ macro control sang driver/effect intensity đã giới hạn thay vì expose internals.

Consumer patch tiếp tục allowlist. Internal node ID, track, driver graph và effect topology không được truy cập nếu chưa publish.

### 7.10 Marker và audio automation

Thêm marker typed, stable ID cho Scene, Action và Audio. Marker có local time, optional duration, semantic role và closed payload. Marker không tự thay đổi render; clip, driver hoặc snapping phải tham chiếu tường minh.

Audio tiếp tục thuộc project timeline, không nằm trong spatial Node graph. Nâng cấp theo vertical slice:

- source in/out và project duration rõ ràng;
- gain dB cho professional authoring;
- gain/pan automation track;
- beat/phoneme/semantic marker kèm optional analysis provenance;
- audio-reactive driver chỉ dùng precomputed deterministic envelope/band.

## 8. Workstream thực thi

### WS0 — Audit tính trung thực của contract

**Mục tiêu:** loại accepted-but-ignored data trước khi mở rộng format.

Việc cần làm:

- tạo machine-readable matrix cho Schema, Reference Validation, Compiler, Evaluator, RenderPlan, Browser, Worker và Editor;
- audit Component Instance transform/effect/mask/blend propagation;
- audit Group subtree effect/mask và pass-through semantics;
- audit modifier cardinality so với runtime `.find()`;
- thay Runtime `easing: string` bằng closed canonical v2 vocabulary;
- compile hoặc reject scene-level repeat;
- thêm negative fixture cho mọi combination chưa hỗ trợ;
- CI fail nếu primitive được ghi Implemented nhưng thiếu gate.

**Exit:** không còn public field được chấp nhận rồi âm thầm bỏ qua/fallback.

### WS1 — Rebaseline schema v2

**Mục tiêu:** thay contract thử nghiệm hiện tại bằng một canonical v2 duy nhất, không mang nợ compatibility trước release.

Việc cần làm:

- ghi ADR cho canonical Transform, Track/Key, evaluation order và compositing boundary;
- sửa trực tiếp `packages/motion-schema/src/v2.ts` và public exports;
- xóa field/alias/enum cũ không còn thuộc thiết kế đích;
- không thêm parser/migrator cho contract thử nghiệm cũ;
- rewrite positive/negative/limit fixtures theo v2 mới;
- cập nhật compiler Runtime goldens theo từng vertical slice;
- cập nhật visual goldens chỉ sau khi review expected/actual/diff;
- sửa docs, capability ledger và editor fixture builders cùng PR với primitive liên quan;
- giữ `formatVersion: 2` trong Project/Component và giữ Patch version độc lập;
- thêm freeze checklist mới chỉ được ký sau M8.

**Exit:** mọi artifact trong fixture suite parse/compile trực tiếp bằng canonical v2 mới; construct cũ không còn hợp lệ bị reject; repository không chứa legacy branch trong runtime code.

### WS2 — Typed animation evaluator

**Mục tiêu:** temporal/spatial animation đủ chiều sâu chuyên nghiệp.

Việc cần làm:

- mở rộng capability value kind/interpolation policy;
- thêm typed Track/Key schema và validation;
- implement hold, linear, cubic Bézier, parameterized spring;
- implement angle policy, Oklab/sRGB color interpolation;
- implement vec2/spatial Bézier;
- implement pre/post extrapolation;
- thêm Scene/Action marker và marker-relative scheduling;
- tạo indexed track lookup thay vì tìm tuyến tính mỗi property/frame;
- chốt duplicate/overlap rule giữa clip/track;
- giữ interpolation handles qua playback expansion;
- expose pure curve sampler cho Graph Editor.

**Exit:** test đủ before/start/middle/end/after, handle, overshoot, extrapolation, color, angle, spatial path và parity.

### WS3 — Graph Editor và dope sheet

**Mục tiêu:** Designer author được capability mới mà không sửa JSON.

Việc cần làm:

- command chọn/move/copy key và snapping trong `editor-core`;
- command sửa handle với continuous/broken/auto modes;
- Value Graph cho scalar/angle và Spatial Path Editor cho vec2;
- editor selection/viewport nằm ngoài portable format;
- chỉ serialize authored key/handle data;
- undo/redo coalescing cho handle drag;
- shortcut cho hold/linear/ease và align time;
- virtualization cho timeline/key set lớn.

**Exit:** Designer dựng được mọi typed-track fixture bằng UI; save/reload không đổi sampled output.

### WS4 — Procedural driver runtime

**Mục tiêu:** complex reusable motion không cần arbitrary expression/keyframe duplication.

Việc cần làm:

- driver union và capability registry;
- dependency DAG/cycle diagnostics;
- deterministic noise, oscillator, link, remap và utility drivers;
- delay/spring follow qua random-access sampling;
- combine semantics theo value kind;
- chỉ animate driver parameters sau khi static-driver parity đạt;
- Designer UI và safe Public Param mapping;
- benchmark graph lớn và scrub ngẫu nhiên.

**Exit:** cùng fixture cho kết quả giống nhau khi evaluate xuôi, ngược và chia parallel worker chunks.

### WS5 — Shared RenderPlan và isolated compositing

**Mục tiêu:** một subtree-aware compositing DAG dùng chung preview/export.

Việc cần làm:

- đưa z-order, isolation, matte, effects và offscreen decision vào shared RenderPlan;
- biểu diễn pass-through/isolate Group tường minh;
- tính subtree bounds gồm animated stroke/effect inflation;
- pool/reuse offscreen surfaces theo budget;
- khóa order raster subtree → matte → effect → adjustment → blend;
- cập nhật hit-test/editor overlay cho isolated group;
- loại renderer-specific interpretation của authoring Node;
- trả structured diagnostic khi vượt budget.

**Exit:** Browser/Worker thực thi cùng plan cho nested group/matte/effect trong tolerance.

### WS6 — Adjustment và matte

**Mục tiêu:** grading/reveal cấp layer chuyên nghiệp.

Việc cần làm:

- Adjustment Node schema và capability rules;
- same-isolation-group scope;
- luma/inverse-luma trong color space đã khóa;
- mask/matte trên Adjustment;
- validation order và empty-scope;
- fixture nested isolation, adjustment stack, luma transition;
- mặc định chỉ Designer sửa adjustment/effect topology.

**Exit:** Adjustment không tác động layer phía trên hoặc ngoài group; nested parity đạt.

### WS7 — Effect depth và motion blur

**Mục tiêu:** tăng visual quality mà không mở arbitrary shader.

Việc cần làm:

- chuẩn hóa effect metadata, param animation, bounds inflation;
- triển khai từng effect theo vertical slice;
- temporal motion blur và per-node override;
- color-management policy cho interpolation/luma/compositing;
- quality preset chỉ đổi sample count, không đổi timing semantics;
- editor command reorder/enable/duplicate effect;
- GPU acceleration chỉ đứng sau cùng RenderPlan semantics;
- limit radius, displacement, echo history và sample count.

**Exit:** mỗi effect có limits, midpoint test, worker golden, browser parity và effect-order fixture.

### WS8 — Layered 2.5D và parallax

**Mục tiêu:** parallax trở thành spatial system chính thức và deterministic.

Việc cần làm:

- duyệt projection ADR/coordinate convention;
- thêm depth vào Transform, 2.5D settings vào Scene/Camera;
- projection chạy sau constraint và trước rasterization;
- per-node Parallax modifier;
- cập nhật world matrix/bounds/hit-test/inverse mapping;
- giữ draw order bằng zIndex;
- Designer depth controls/camera preview;
- safe depth/parallax range cho Template User;
- acceptance: multiplane, dolly, card tunnel, camera shake.

**Exit:** static camera giữ output 2D ở neutral depth; camera motion tạo đúng multiplane response; hit-test/export parity đạt.

### WS9 — Template publication hardening

**Mục tiêu:** publish professional internals thành consumer contract an toàn.

Việc cần làm:

- Public Param safe range, step, condition và preview hint;
- Component lint cho asset, duration và offscreen budget;
- public control không tạo invalid internal state;
- macro control cho bounded effect/driver;
- giữ action/variant compatibility theo Component semver;
- template performance/aspect-ratio packs;
- human Designer sign-off ngoài machine/agent scoring;
- immutable publication và package/version contract tests.

**Exit:** Template User hoàn thành workflow không truy cập internal graph; min/default/max của public controls đều hợp lệ và trong budget.

### WS10 — Parity, performance và release hardening

**Mục tiêu:** đưa capability chuyên nghiệp vào production an toàn.

Việc cần làm:

- Browser/Worker parity ở representative frames/motion-blur samples;
- benchmark compile, evaluate, RenderPlan, raster;
- interactive budget theo node/track/driver/effect;
- malformed/oversized/hostile artifact tests;
- lưu Runtime JSON, expected/actual PNG và diff khi CI fail;
- save/reload/export round trip;
- diagnostic thay cho silent visual degradation;
- AI chỉ enumerate primitive đã qua gate.

**Exit:** acceptance pack qua release gates và editor đạt responsiveness budget.

## 9. Thứ tự bàn giao

Đây là dependency order, không phải cam kết lịch.

| Milestone | Bao gồm | Phụ thuộc | Kết quả |
|---|---|---|---|
| M0 Contract truth | WS0 | — | Hiểu/fix baseline semantics, loại silent gap |
| M1 V2 rebaseline | WS1 | M0 | Một canonical schema v2, fixtures/goldens được rewrite có kiểm soát |
| M2 Professional tracks | WS2 + core WS3 | M1 | Custom curve, typed interpolation, spatial path, extrapolation |
| M3 Shared compositing | WS5 | M1 | Subtree RenderPlan và Browser/Worker parity |
| M4 Matte/Adjustment | WS6 | M3 | Adjustment và luma matte |
| M5 Layered 2.5D | WS8 | M2 + M3 | Depth/parallax/camera authoring |
| M6 Procedural motion | WS4 | M2 | Deterministic drivers và macro controls |
| M7 Visual quality | WS7 | M2 + M3 | Motion blur và professional effects |
| M8 Template release | WS9 + WS10 | M4–M7 | Template do Designer tạo, consumer-safe |

Chỉ làm song song sau khi contract chung đã freeze. Graph Editor có thể đi cùng evaluator khi Track/Key command và sampling API đã duyệt; Browser/Worker adapter có thể song song sau khi RenderPlan duyệt.

## 10. Fixture và acceptance bắt buộc

### Animation

- `typed-track-interpolation.mt.json`;
- `temporal-bezier-handles.mt.json`;
- `parameterized-spring.mt.json`;
- `spatial-bezier-position.mt.json`;
- `track-extrapolation.mt.json`;
- `angle-color-interpolation.mt.json`;
- negative: wrong handle kind, unknown easing, mixed position/x-y, type mismatch.

### Compositing/effect

- `group-isolation.mt.json`;
- `adjustment-stack.mt.json`;
- `adjustment-nested-scope.mt.json`;
- `luma-matte-transition.mt.json`;
- `motion-blur-shutter.mt.json`;
- một fixture cho mỗi effect và cross-effect ordering;
- negative: cross-isolation matte, invalid params, offscreen/sample budget.

### 2.5D

- `layered-parallax.mt.json`;
- `parallax-camera-pan.mt.json`;
- `parallax-dolly-zoom.mt.json`;
- `parallax-hit-test.mt.json`;
- negative: invalid depth/projection/camera.

### Procedural

- `driver-wiggle-seeded.mt.json`;
- `driver-link-remap.mt.json`;
- `driver-delay-follow.mt.json`;
- `driver-random-access.mt.json`;
- negative: cycle, unsupported combine, non-deterministic config.

### Audio/marker

- `timeline-markers.mt.json`;
- `audio-automation.mt.json`;
- `audio-reactive-envelope.mt.json` khi Advanced driver triển khai;
- negative: duplicate marker, out-of-scope time, gain/pan domain, missing analysis.

### Template workflow

- kinetic typography;
- layered product promo có camera parallax;
- logo reveal dùng trim, luma matte và adjustment grade;
- infographic list dùng repeater/stagger;
- UI/product showcase dùng bounded driver intensity;
- cut-out character có action, secondary motion và public variants.

Mỗi composition phải test public controls tại min/default/max.

## 11. Definition of Done cho một primitive

Primitive chỉ là **Implemented** khi qua mọi gate áp dụng được:

1. **Contract:** typed schema, default, unit, limit, round-trip.
2. **Reference:** ID, type, cycle, cardinality, topology validation.
3. **Rebaseline:** positive/negative/limit fixture và golden v2 đã cập nhật có review.
4. **Compiler:** deterministic literal Runtime golden.
5. **Evaluator:** boundary/midpoint/random-access assertions.
6. **RenderPlan:** stage, order, bounds, resource request.
7. **Worker visual:** stored golden và diff artifact.
8. **Browser parity:** cùng fixture/frame trong tolerance.
9. **Editor authoring:** tạo/sửa/undo/save không cần JSON.
10. **Template safety:** public controls không phá domain/budget.
11. **Performance:** benchmark representative/limit cases.
12. **Documentation:** capability registry và [`primitives-object.md`](primitives-object.md) cập nhật.

`N/A` phải có lý do. Có field Zod, parse-positive fixture hoặc một screenshot không đủ.

## 12. CI gates

Giữ các gate hiện tại:

```bash
pnpm typecheck
pnpm validate:v2-fixtures
pnpm validate:primitives
pnpm validate:acceptance-export
pnpm validate:acceptance-web-parity
```

Thêm gate cho canonical v2 đã chuẩn hóa:

```bash
pnpm validate:v2-schema
pnpm validate:v2-animation
pnpm validate:render-plan
pnpm validate:preview-export-parity
pnpm bench:motion-runtime
```

Validation không tự update golden. Runtime JSON/PNG thay đổi phải dùng lệnh update tường minh và review diff.

## 13. Performance budget phải khóa trước release

Phải publish số đo/limit cho:

- track/key evaluate mỗi frame;
- driver graph node và dependency depth;
- spatial Bézier segment;
- isolated/adjustment surface;
- effect-expanded offscreen pixels;
- motion-blur samples mỗi output frame;
- displacement/echo history;
- layer count trong 2.5D Scene;
- compile latency sau một public-param edit;
- scrub latency và preview frame budget.

Limit nằm trong schema/capability registry và có negative fixture. UI warning không thay runtime enforcement.

## 14. Rủi ro và biện pháp

| Rủi ro | Hậu quả | Biện pháp |
|---|---|---|
| Schema mở nhanh hơn runtime | JSON hợp lệ nhưng render sai | WS0 matrix và primitive DoD |
| Graph Editor model thay đổi nhiều | Schema/UI rework | Freeze Track/Key ADR trước UI |
| Lẫn depth với draw order | Visual/selection không ổn định | Tách `depth`/`zIndex`, khóa formula |
| Effect lệch giữa adapters | Preview/export sai khác | Shared RenderPlan và parity goldens |
| Driver biến thành expression runtime | Mất security/determinism | Closed typed vocabulary và DAG validation |
| Motion blur quá tốn | Preview/export chậm | Quality tier, strict budgets, node override |
| Public controls expose internals | Template dễ hỏng | Allowlist, safe ranges, min/default/max acceptance |
| Rebaseline quá lớn trong một diff | Khó review và khó tìm regression | Chia vertical slice, review Runtime/PNG diff từng primitive |

## 15. Điều kiện hoàn thành chương trình

Chương trình hoàn tất khi:

- M0–M8 đạt exit criteria;
- catalog đích [`primitives-object.md`](primitives-object.md) không còn Core primitive thiếu gate;
- Browser/export dùng cùng evaluation và RenderPlan semantics;
- Project/Component parse trực tiếp bằng canonical v2, không cần migration layer;
- Designer dựng acceptance templates hoàn toàn bằng UI;
- Template User chỉ dùng published controls;
- public-control min/default/max nằm trong validity/performance budgets;
- acceptance pack có human Designer sign-off;
- tài liệu không còn định vị MotiClip là pure 2D hoặc đồng nhất professional animation với full 3D suite.
