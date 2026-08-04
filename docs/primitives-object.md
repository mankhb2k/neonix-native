# Catalog primitive chuyên nghiệp cho MotiClip 2.5D

> **Vai trò tài liệu:** Catalog trạng thái đích sau khi hoàn thành chương trình [`v2-upgrade`](v2-upgrade.md).
> **Sản phẩm:** Hệ authoring motion graphics 2.5D phân lớp cho Designer, xuất bản thành template tùy biến an toàn cho người dùng phổ thông.
> **Quy tắc trung thực:** Tài liệu mô tả hệ thống cuối cùng bắt buộc phải đạt. Trước khi các gate nâng cấp hoàn tất, bằng chứng implementation hiện tại vẫn nằm tại [`fixtures/v2/`](fixtures/v2/README.md) và [`motion-format-v2.md`](motion-format-v2.md). Không dùng catalog đích này để tuyên bố code chưa làm là đã hoàn thành.

## 1. Định nghĩa sản phẩm

MotiClip là motion composition engine 2.5D phân lớp, tập trung vào animation, effect và reusable template.

Một document model phục vụ hai bề mặt:

| Bề mặt | Người dùng | Quyền hạn |
|---|---|---|
| Designer Authoring | Motion designer/template creator | Toàn bộ node, track, Graph Editor handle, effect, matte, adjustment, driver, constraint, depth/parallax, action và internal component graph |
| Template Customization | Người dùng phổ thông/AI planner | Chỉ public text, asset, brand, list, variant và bounded motion/effect controls |

Template User không phải sửa internal node, keyframe, driver graph hoặc effect topology. Designer không bị giới hạn bởi giao diện đơn giản mà họ publish cho Template User.

## 2. Phạm vi sản phẩm

### Trong phạm vi

- Kinetic typography và text sequencing.
- Infographic/data-driven animation.
- Product promo, UI/product showcase và logo reveal.
- Layered camera motion và multiplane parallax.
- Mask, alpha/luma matte, adjustment và ordered effect compositing.
- SVG path animation, morph, trim và cut-out/semi-organic character motion.
- Deterministic procedural motion không thực thi code tùy ý.
- Component có version, public controls, variants và actions.
- Browser preview/export parity từ cùng Runtime IR và RenderPlan.

### Ngoài phạm vi

- Full 3D mesh, material, light, depth buffer và camera orbit tự do.
- Perspective mesh deformation và arbitrary 3D rotation.
- Mesh skinning, weight paint, organic puppet.
- JavaScript/After Effects expression không giới hạn.
- Frame-by-frame drawing/onion skin.
- Custom shader tùy ý trong portable core format.
- Node type riêng cho mọi semantic use case.

## 3. Vocabulary hệ thống

```text
Value + Property + Typed Keyframe + Track + Clip
      + Binding + Driver + Constraint
      + Node + Hierarchy + Depth + Camera
      + Geometry Modifier + Matte + Effect + Adjustment
      + Component + Public API + Variant + Action
```

`logo`, `icon`, `card`, `chart`, `character`, `product`, `CTA` là semantic composition hoặc Component, không phải core Node type.

## 4. Kiến trúc cuối cùng

```text
Authoring IR
  ├─ Designer internals
  └─ published Template contract
          │
          ▼
Canonical Motion Format v2 validation
          │
          ▼
Compiler → literal typed Runtime IR
          │
          ▼
Frame evaluator → evaluated scene state
          │
          ▼
Shared RenderPlan / compositing DAG
      ┌───┴───────────┐
      ▼               ▼
Browser preview   Export worker
```

Editor, Browser và Worker có thể dùng API UI/raster khác nhau nhưng không được có animation hoặc compositing semantics khác nhau.

## 5. Evaluation order chuẩn

```text
Literal/default
→ Component prop và binding
→ Clip timing và typed keyframe track
→ Procedural driver stack
→ Constraint/secondary motion
→ Layered 2.5D projection
→ Geometry modifier
→ Subtree rasterization
→ Clip/alpha/luma matte
→ Node effect
→ Adjustment effect
→ Blend/composite
→ Scene transition
```

Mỗi primitive phải khai báo stage mà nó chạy. Không được thay stage giữa preview và export.

## 6. Phân loại trạng thái đích

| Trạng thái | Ý nghĩa sau khi chương trình hoàn tất |
|---|---|
| Core | Bắt buộc cho professional 2.5D template product release |
| Advanced | Professional capability hỗ trợ sau Core, chỉ được ship khi đủ gate |
| Deferred | Chủ ý nằm ngoài lần nâng cấp; parser reject hoặc chỉ là editor metadata không portable |
| Out of scope | Không thuộc định hướng sản phẩm |

Không primitive nào được coi là Implemented chỉ vì parse được. Bắt buộc qua §20.

## 7. Identity, value và property

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Artifact identity | Phân biệt format/version | Core | Một strict canonical v2 parser trong giai đoạn pre-public; `formatVersion` dành cho evolution sau lần public đầu tiên; strict unknown-field policy |
| Stable ID | Địa chỉ entity portable | Core | Unique theo scope, giới hạn độ dài, namespace deterministic khi expand |
| Semantic | Thể hiện ý nghĩa không thêm Node type | Core | Role/key/tags được giữ qua compile khi public |
| Integrity pin | Identity bất biến của asset/component | Core | Verify hash, portable cache/bundle policy |
| Typed value | Dữ liệu property an toàn | Core | `number`, `angle`, `vec2`, `color`, `boolean`, `string`, `asset`, `path`, `gradient` |
| Property path | Địa chỉ capability ổn định | Core | Bắt buộc lookup registry, reject unknown path |
| Property capability | Source of truth cho animation/binding/UI/AI | Core | Value kind, unit, interpolation, combine, limits, public/runtime state |
| Variable | Input scalar/list/asset tái sử dụng | Core | Typed default/domain/options, reject non-finite |
| Binding | Variable/context → property | Core | Type-check, duplicate-target policy, deterministic priority |
| Public parameter | Control an toàn cho Template User | Core | Safe range, step, control type, capability level, optional condition |
| Patch | Consumer edit có revision guard | Core | Chỉ allowlisted public surface, không truy cập internal graph mặc định |

## 8. Time và animation chuyên nghiệp

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Frame clock | Canonical time | Core | `frameIndex / fps`, random-access, không dùng wall clock |
| Typed keyframe | Giá trị tại local time | Core | Value kind khớp property, stable time, bounded keys |
| Hold segment | Chuyển giá trị discrete | Core | Giữ left value đến boundary |
| Linear segment | Nội suy đều | Core | Hỗ trợ kind tương thích |
| Temporal Bézier | Custom speed/value curve | Core | Handle được validate, segment ownership rõ |
| Parameterized spring | Physics-style interpolation | Core | Mass/stiffness/damping/velocity, deterministic settle/overshoot |
| Spatial Bézier | Editable 2D motion path | Core | Chỉ vec2 track, in/out tangent, canvas path editor |
| Angle policy | Nội suy rotation | Core | Shortest/clockwise/counterclockwise/continuous |
| Color interpolation | Motion màu mượt | Core | Oklab canonical, sRGB compatibility, discrete khi khai báo |
| Track | Animation của typed property | Core | Value kind, keys, pre/post behavior, capability validation |
| Track extrapolation | Loop/continue riêng property | Core | Clamp, cycle, ping-pong, offset-cycle, continue theo kind |
| Clip | Nhóm track theo local timing | Core | Duration, target, schedule, playback, preset/action source |
| Schedule | Xếp clip tương đối/tuyệt đối | Core | Absolute/after/with, reject missing ref/cycle |
| Playback | Lặp toàn clip | Core | Iterations, rate, normal/reverse/alternate, tách track extrapolation |
| Marker | Mốc thời gian named/semantic | Core | Scene/action/audio marker, stable ID, chỉ tác động khi được tham chiếu |
| Time remap | Điều khiển local time | Advanced | Monotonic/non-monotonic tường minh, bounded sampling |

Scalar `transform.x/y` tiếp tục tương thích. `transform.position` dùng cho spatial animation. Reject scalar và compound position track xung đột nếu chưa có animation-layer contract.

## 9. Procedural animation và quan hệ

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Driver graph | Typed procedural dependency DAG | Core | Stable ID, typed ports, cycle rejection, deterministic order |
| Noise/Wiggle | Biến thiên organic | Core | Seeded, frequency/amplitude, random-access sampling |
| Oscillator | Motion tuần hoàn | Core | Sine/triangle/saw/pulse closed vocabulary, phase/frequency |
| Property link | Tái dùng evaluated value | Core | Type-check, explicit space/stage |
| Range remap | Ánh xạ interval | Core | Clamp/extrapolate policy, optional easing |
| Delay/follow | Theo source có độ trễ | Core | Random-access history sampling với bounded window |
| Spring follow | Secondary response | Core | Deterministic params và sample budget |
| Utility driver | Clamp/wrap/quantize | Core | Pure typed operation |
| Driver combination | Gộp output vào destination | Core | `replace`, `add`, `multiply` theo value kind |
| Constraint | Quan hệ spatial giữa Nodes | Core | Look-at, copy-position, copy-rotation, weight, cycle validation |
| Pin constraint | Gắn point vào target | Advanced | Explicit local/world point space |
| Secondary motion | Follow-through trên chain | Core | Rotation/position mode, animate params sau static parity |
| 2-bone IK | Định vị limb giải tích | Advanced | Typed chain/pole/limits, deterministic solve, không skinning |

Portable driver không chạy arbitrary code. Plugin authoring syntax phải compile về closed Runtime vocabulary.

## 10. Spatial model và layered 2.5D

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Transform 2D | Local plane transform | Core | Position/size/rotation/scale/anchor/opacity/visibility/flip |
| Depth | Parallax coordinate | Core | Finite, độc lập `zIndex`, neutral depth giữ output 2D |
| Hierarchy | Parent-child transform/opacity | Core | Cycle/depth limits, inherit flags, deterministic world matrix |
| Draw order | Painter/compositing order | Core | `zIndex` + stable tie-break, không suy từ depth |
| Layered Scene space | 2.5D coordinate policy | Core | `flat-2d`/`layered-2.5d`, bounded range, projection formula đã freeze |
| Camera | 2D view/parallax driver | Core | Pan, zoom, rotation, parallax strength, không 3D orbit |
| Parallax modifier | Override camera response theo layer | Core | Position/zoom/rotation response và safe clamp |
| Depth blur | Focus cue tùy chọn | Advanced | Bounded blur theo depth/camera distance, explicit focus plane |
| Bounds | Footprint geometry/subtree/effect | Core | Animated, depth-projected, stroke/effect inflation |
| Hit-test | Canvas selection | Core | Inverse world/projection, isolation/visibility aware |
| Layout | Placement cho list/repeater | Core | None, linear, grid, radial deterministic |

Layered 2.5D không kéo theo light, material, mesh perspective, occlusion buffer hoặc 3D collision.

## 11. Core Nodes

Node chỉ tồn tại khi có spatial identity, draw/compositing behavior, media time, hierarchy control hoặc reusable package boundary.

| Node | Trách nhiệm nguyên tử | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Group | Hierarchy và optional compositing boundary | Core | Pass-through/isolate, subtree bounds, thay Null/control use case |
| Bone | Zero-draw transform joint | Core | Rest rotation, limits, hierarchy, cut-out semantics |
| Text | Nội dung/layout text | Core | Unicode/grapheme-safe, font asset, typed paint/text animation |
| Shape | Rectangle/ellipse/polygon | Core | Fast-path primitives, typed paint/geometry |
| Path | Multi-contour vector geometry | Core | Line/cubic, open/closed, fill rule, morph targets |
| Image | Raster media plane | Core | Asset ID, fit/crop/alpha, depth/parallax |
| SVG | Sanitized vector asset plane | Core | Asset ID, fit/crop, recolor policy, depth/parallax |
| Video | Time-based media plane | Core | Trim, loop/frame/muted policy, deterministic sampling |
| Camera | Non-drawing scene view | Core | Flat 2D và layered 2.5D |
| Component | Reusable authoring package instance | Core | Version/integrity/public props/actions, complete compile propagation |
| Adjustment | Non-drawing compositing pass | Core | Áp effect lên sibling đã composite phía dưới trong isolated group |

Không cần Solid Node: Shape rectangle có renderer fast path. Không cần Null Node: Group là zero-draw transform/container và có thể mang editor semantic. Light nằm ngoài phạm vi.

Component không phải precomposition. Nếu sau này cần local-timeline/rasterized Precomp, phải có contract riêng.

## 12. Geometry, paint và geometry modifier

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Point/Contour/Segment | Canonical vector geometry | Core | Finite coordinates, stable IDs, resource limits |
| Solid fill/stroke | Base paint | Core | Color/opacity, cap/join/miter, fill rule |
| Gradient | Linear/radial paint | Core | Stable stops, order validation, animatable stops |
| Dash | Stroke pattern | Core | Bounded segments, animated offset |
| Trim Path | Arc-length reveal | Core | Animated start/end/offset, open/closed policy |
| Path Morph | Topology-compatible interpolation | Core | Strict compatibility hoặc normalized correspondence rõ |
| Path Bend | Controlled deformation | Core | Bounded deterministic warp |
| Motion Path | Drive transform theo Path | Core | Arc-length progress, tangent orientation, cross-hierarchy space |
| Repeated transform | Copies có transform falloff | Advanced | Deterministic count/delta/opacity falloff |
| Emitter | Seeded sprite/shape generation | Advanced | Fixed budget, deterministic birth/state, random-access frame |

Geometry modifier chạy trước rasterization. Pixel displacement thuộc Effect stage.

## 13. Matte, compositing và effect

```text
raster subtree → matte → node effects → adjustment → blend/composite
```

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Group isolation | Offscreen composition boundary | Core | `pass-through`/`isolate`, pass-through không có implicit surface |
| Clip matte | Geometry clipping | Core | Cùng Scene/isolation scope, cycle validation |
| Alpha matte | Source alpha điều khiển target | Core | Normal/inverse, source visibility policy |
| Luma matte | Source luminance điều khiển target | Core | Normal/inverse, frozen color-space conversion |
| Adjustment | Grade/effect layers phía dưới | Core | Cùng isolated group, tôn trọng matte/opacity/time/z-order |
| Blend mode | Layer compositing | Core | Normal/multiply/screen/add và closed modes được review |
| Effect stack | Ordered pixel operations | Core | Stable ID, enabled, typed params, bounds/resource metadata |
| Blur | Làm mềm | Core | Radius animation, bounds inflation đúng |
| Shadow | Offset shadow | Core | Color/opacity/blur/offset animation |
| Glow | Additive halo | Core | Radius/intensity/color/opacity/order |
| Color adjust | Basic grade | Core | Brightness/contrast/saturation |
| Levels/curves | Professional tone control | Core | Bounded portable representation |
| Tint/gradient map | Color remap | Core | Typed colors/stops/interpolation |
| Directional blur | Blur theo trục | Core | Angle/distance, bounded surface plan |
| Radial blur | Zoom/spin blur | Advanced | Center/mode/amount/quality budget |
| Displacement | Pixel-space distortion | Core | Typed source/map/noise, amount, expanded bounds |
| Noise/grain | Texture/finishing | Core | Seeded deterministic noise, color/mono policy |
| Echo/trail | Temporal image repetition | Advanced | Bounded frame/history window, blend policy |
| Transform effect | Post-raster transform/repeat | Advanced | Explicit coordinate space và sampling quality |
| Chromatic aberration | RGB channel offset | Advanced | Bounded amount/direction |
| Posterize time | Temporal stepping | Advanced | Local sampling FPS, deterministic mapping |

Effect là closed discriminated type. Unknown effect bị reject thay vì bỏ qua.

## 14. Motion blur và render quality

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Motion blur | Temporal integration | Core | Deterministic supersampling, shutter angle/samples/phase |
| Per-node override | Quality/control exception | Core | `inherit`, `on`, `off`, safe template exposure |
| Quality tier | Preview/export sampling budget | Core | Chỉ đổi quality, không đổi authored timing/semantics |
| Color policy | Đồng nhất interpolation/luma/compositing | Core | Working spaces và conversion boundaries rõ |
| Offscreen planner | Cấp surface an toàn | Core | Integer bounds, pooling, dimension/pixel/sample limits |

Motion-blur sample lấy từ canonical output-frame timestamp. Sequential playback và random scrub phải cho cùng output.

## 15. Compile-time expansion và reusable Component

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Component expansion | Package → namespaced runtime graph | Core | Complete refs/transforms/actions, không rò Component |
| Public API | Publish customization surface | Core | Content/style/motion/layout/audio groups, safe ranges/controls |
| Variant | Chuyển coherent visual state | Core | Stable IDs, defaults, asset/type validation |
| Named Action | Reusable internal animation | Core | Local duration, clips, playback, compatible public params |
| Repeater list/count | Expand data-driven subtree | Core | Stable keys, limits, deterministic IDs |
| Repeater layout | Placement expanded instances | Core | None/linear/grid/radial exact placement |
| Time stagger | Offset expanded animation | Core | Deterministic local-time offsets và limits |
| Text Animator | Expand grapheme/word/line | Core | Unicode segmentation, selector, stagger, typed properties |
| Consumer macro | Một public control → internals | Core | Bounded driver/effect/track mapping, không expose topology |

Published Component immutable theo `componentId@componentVersion`. Major version khi public observable behavior không tương thích.

## 16. Cut-out và semi-organic character

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| SVG source import | Sanitize/giữ source identity | Core | Structural fingerprint, stable re-import, reject external content |
| Part mapping | Source elements → asset/node | Core | Stable mapping, deterministic asset generation |
| Bone chain | Joint hierarchy | Core | Rest pose, limits, transform inheritance |
| Rig mapping | Part/pivot/parent/order/slots | Core | Typed metadata, không phải drawing Node giả |
| Variant slot | Mouth/eye/hand/expression state | Core | Default/switch/asset validation |
| Lip-sync cue | Timed mouth variant | Core | Marker/cue → discrete asset keys |
| Prop attachment | Gắn visual vào joint/slot | Core | Pivot, depth, draw order đúng |
| Secondary chain | Hair/tail/ribbon overlap | Core | Deterministic rotation/position response |
| Simple IK | Designer pose/runtime solve | Advanced | 2-bone, strict limits, không mesh skinning |

Character là Component từ Group, Bone, SVG/Image/Path, variant, action, constraint và secondary motion.

## 17. Scene, media và audio

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Scene | Spatial/time/compositing scope | Core | Duration, nodes, clips, camera, 2.5D settings, transition |
| Project timeline | Global scene/audio order | Core | Stable sequence và overlap rules |
| Scene transition | Cross-scene composition | Core | Cut/fade/crossfade và matte transition được review |
| Asset manifest | Typed media metadata | Core | Image/SVG/video/audio/font, integrity/probe parity |
| Video sampling | Frame tại local media time | Core | Trim, loop/hold/transparent, exact FPS mapping |
| Audio clip/track | BGM/voice/SFX playback | Core | Start, source trim, duration, loop, gain, fade |
| Audio automation | Professional mix motion | Advanced | Gain dB, pan, typed keyframes |
| Audio/beat marker | Sync reference | Core | Stable IDs, optional analysis provenance |
| Audio-reactive driver | Giá trị từ approved analysis | Advanced | Precomputed deterministic envelope/bands |
| Font resolution | Portable text rendering | Core | Pinned asset, family/weight/style, glyph fallback policy |

Audio thuộc timeline/media, không phải spatial Node nếu chưa có spatial-audio product riêng.

## 18. Designer editor primitives

Selection, viewport và panel state không thuộc portable format, nhưng authoring UI là completion gate.

| Công cụ | Phân loại | Hành vi bắt buộc |
|---|---|---|
| Inspector | Core | Capability-driven controls, mixed values, undo/redo |
| Dope sheet | Core | Select/move/copy/paste/snap key và clip-local time |
| Value Graph Editor | Core | Scalar/angle curve, temporal handle, presets |
| Spatial Path Editor | Core | Vec2 path/tangent, canvas handles, orient preview |
| Effect stack editor | Core | Add/remove/reorder/enable, animate params, enforce limits |
| Driver editor | Core | Typed source/destination, cycle errors, macro publication |
| Depth/parallax controls | Core | Layer depth, camera preview, response, neutral reset |
| Matte/adjustment controls | Core | Scope visualization, isolation diagnostics |
| Component publisher | Core | Public controls, variants/actions, semver, validation |
| Template User panel | Core | Chỉ public contract, không internal ID/topology |

Command đi qua `editor-core` hoặc deterministic domain boundary tương đương. React không mutate portable document trực tiếp.

## 19. Runtime và RenderPlan primitives

| Primitive | Trách nhiệm | Phân loại | Hành vi bắt buộc |
|---|---|---|---|
| Literal Runtime Node | Entity sẵn evaluate/draw | Core | Không unresolved variable/Component/repeater/editor metadata |
| Typed Runtime Track | Closed evaluator input | Core | Cùng interpolation vocabulary với schema, reject unknown |
| Dependency DAG | Driver/constraint order | Core | Stable topological order, cycle diagnostics |
| Evaluated state | Giá trị tại canonical sample | Core | Typed, bounded, random-access |
| RenderPlan | Shared compositing DAG | Core | Isolation, matte, effect, adjustment, blend, resource plan |
| Browser adapter | Interactive raster | Core | Thực thi plan, không alternate semantics |
| Worker adapter | Export raster | Core | Cùng plan/sampled values |
| Frame planner | Scene/transition/blur sample jobs | Core | Deterministic, chunk-safe |
| Asset resolver | Runtime media access | Core | Browser cache/blob và export verified file/cache |
| Diagnostic | Giải thích invalid/over-budget | Core | Structured error, không silent degradation |

## 20. Gate hoàn thành primitive

Primitive chỉ đạt phân loại cuối khi có mọi bằng chứng áp dụng được:

1. Typed schema, default, unit, limits, serialization round-trip.
2. Reference validation cho ID, type, cycle, topology, cardinality.
3. Positive/negative/limit fixtures và Runtime/PNG goldens của v2 đã được rebaseline, có review.
4. Deterministic compiler golden với literal Runtime output.
5. Evaluator assertion tại boundary/midpoint/random-access.
6. RenderPlan assertion về stage/order/bounds/resources.
7. Worker visual golden và diff artifact khi fail.
8. Browser/export sampled-frame parity.
9. Designer UI authoring, undo/redo, save/reload.
10. Template User safety tại public-control min/default/max.
11. Representative/limit performance benchmark.
12. Catalog và capability registry được cập nhật.

`N/A` phải có lý do. “Có schema”, “fixture parse được” hoặc “một screenshot đúng” không đủ.

## 21. Product acceptance compositions

| Composition | Capability bắt buộc |
|---|---|
| Kinetic typography | Temporal Bézier, spatial path, Text Animator, motion blur, public copy/style |
| Layered product promo | 2.5D depth, camera parallax, adjustment grade, shadow/glow, replace product asset |
| Logo reveal | Trim/morph, luma matte, displacement, blur/glow, timing macro |
| Data infographic | List binding, repeater, stagger, number/text animation, safe item limits |
| UI/product showcase | Camera, depth, oscillator/follow driver, bounded effect intensity |
| Cut-out dialogue | Bone, action, lip-sync marker, secondary motion, prop, audio |
| Matte transition pack | Alpha/luma/inverse matte, isolated group, adjustment, cross-scene timing |
| Procedural loop pack | Wiggle/noise/oscillator, extrapolation, deterministic random-access |

Mỗi composition phải:

- được dựng bằng Designer UI, không hand-edit JSON;
- publish bộ consumer controls nhỏ và an toàn;
- render đúng tại public-control min/default/max;
- qua save/reload, package publication và versioned dependency resolution;
- qua Browser/export parity và performance budget;
- có human Designer visual sign-off.

## 22. Chính sách phát triển sau nâng cấp

Chỉ thêm primitive mới khi nó mở khóa composition đã được chứng minh mà vocabulary hiện tại không diễn đạt sạch được.

Thứ tự ưu tiên:

1. animation quality/control;
2. compositing/effect depth;
3. layered 2.5D camera motion;
4. deterministic procedural reuse;
5. safe template publication.

Độ trưởng thành không đo bằng số Node type. Nó được đo bằng phạm vi/chất lượng composition Designer tạo được, độ an toàn của Template User contract và deterministic preview/export parity.
