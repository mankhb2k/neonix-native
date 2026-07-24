# MotionVideo primitive object catalog

> Tài liệu sống — catalog duy nhất cho các thành phần nguyên tử, trạng thái triển khai và fixture coverage. Schema normative hiện tại vẫn là [`motion-format-v2.md`](motion-format-v2.md). Proposal chi tiết nằm tại [`atomic-primitives-plan.md`](atomic-primitives-plan.md), [`svg-cutout-plan.md`](svg-cutout-plan.md) và [`fixtures/v2/test-plan.md`](fixtures/v2/test-plan.md).

## Định vị

MotionVideo là 2D motion composition engine cho template-driven video, TVC, infographic và SVG cut-out/semi-organic animation. Không phải frame-by-frame drawing tool hoặc full organic character suite.

Engine không tạo Node riêng cho mọi use case. Bar chart, process, timeline, product promo và character được compose từ một vocabulary nhỏ:

```text
Value + Property + Keyframe + Track + Binding
      + Node + Hierarchy + Path + Mask
      + Expansion + Modifier + Effect + Component
```

## Ký hiệu trạng thái

| Trạng thái | Nghĩa |
|---|---|
| Implemented | Có implementation và assertion tự động tương ứng |
| Partial | Có schema/compiler hoặc smoke test nhưng chưa chứng minh end-to-end |
| Planned P0 | Bắt buộc cho vertical slice motion/cut-out |
| Planned P1 | Thêm sau khi P0 acceptance pass |
| Out of scope | Không thêm placeholder vào schema hiện tại |

## 1. Artifact và identity primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Artifact identity | `format`, `formatVersion` | Partial | đúng/sai format, version rejection, strict unknown fields |
| Stable ID | Address trong scope | Partial | empty, duplicate, namespace sau expansion |
| Semantic | `role`, `key`, `tags` | Partial | public/internal address, duplicate role được phép, key stability |
| Integrity | SHA-256 pin cho asset/component | Partial | đúng hash, mismatch, missing file, immutable package |
| Component semver | Public contract version | Partial | exact pin, missing dependency, incompatible action/public prop |
| Source mapping | Figma/Illustrator element → canonical Node/asset | Planned P0 | flat paths, group, rename, re-import, conflict |

## 2. Value/property primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| JSON literal value | Runtime scalar/object/list | Partial | string/number/bool/null/list/object round-trip |
| Resolvable value | Literal hoặc variable reference | Partial | type, numeric scale/offset, missing variable |
| Property path | Stable animatable address | Partial | valid target, invalid path, ID-based effect/modifier path |
| Variable | string/color/number/bool/image/enum/list | Partial | defaults, min/max/options, list item schema |
| Binding | Variable/context → Node property | Partial | precedence, one-to-many, context item, missing target |
| Public parameter | Component safe surface | Partial | type match, default/override, internal isolation |
| Capability metadata | Primitive support/limits for UI và AI | Partial registry | current property/resource limits chạy; primitive registry đầy đủ còn thiếu |

## 3. Time/animation primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Keyframe | `{t, v, easing}` | Partial | ordering, duplicate time policy, before/after range |
| Property Track | Keys trên target/property | Partial | numeric/non-numeric interpolation, target validation |
| Easing | linear/ease/spring/step | Partial | exact values tại fixed timestamps, clamp policy |
| Clip | Duration, target, source | Partial | target, duration, keys không vượt clip |
| Schedule | absolute/after/with | Partial | chain, offset, missing ref, cycle |
| Playback | iterations/direction/rate | Partial schema | finite/infinite hard limit chạy; reverse/alternate evaluator còn thiếu |
| Preset source | Authoring shortcut → tracks | Implemented | known preset, literal expansion, no preset in Runtime IR |
| Named Action | Reusable component animation | Planned P0 | idle/blink/talk/wave/walk, namespace, loop/rate |
| Deterministic clock | Random-access frame evaluation | Planned P0 | frame order independence, repeated render equality |

## 4. Spatial/layout primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Transform | x/y/size/rotation/scale/anchor/opacity/visibility/flip | Partial | local matrix và tracked values |
| Hierarchy | `parentId` Node graph | Partial | missing parent, cycle, deep hierarchy |
| World matrix | Parent × local | Partial — worker tested | anchor, inherit flags, flip, nested scale/rotation; Web parity còn thiếu |
| Draw order | z-index + stable tree order | Partial | equal z-index, nested groups, mask/effect layers |
| Bounds | Geometry/layout bounds | Planned P0 | transformed AABB, zero-size Bone, effect inflation |
| Hit test | Canvas selection | Planned P0 | transform inverse, transparent/masked content |
| Layout | linear/grid/radial placement | Planned P0 | deterministic positions and item limits |

## 5. Core Node objects

Node chỉ tồn tại khi có spatial identity, bounds, draw order, hit-test hoặc parenting.

| Node | Atomic responsibility | Trạng thái | Fixture logic |
|---|---|---|---|
| Group | Hierarchy/container | Partial | parent transform, subtree opacity/effects/mask |
| Text | Text content/layout | Partial | Vietnamese, wrap, alignment, font fallback |
| Shape | Rectangle/ellipse primitives | Partial typed schema | fill/stroke/radius typed; polygon/renderer còn thiếu |
| Path | Typed contours + line/cubic segments | Planned P0 | open/closed, holes, fill rule, bounds |
| Image | Raster asset | Partial typed plumbing | contain/cover/crop/alpha/color space |
| SVG | Normalized vector asset/part | Partial typed + worker smoke | sanitize, raster, nested transform; mask/Web parity còn thiếu |
| Video | Time-based media asset | Partial typed plumbing | trim, frame selection, loop, mute/audio policy |
| Bone | Zero-size transform joint | Partial — worker smoke | chain/pivot/hierarchy chạy; limits/Web parity còn thiếu |
| Camera | Scene view transform | Partial schema | active camera, pan/zoom/rotate, shot changes |
| Component Instance | Reusable package Node | Implemented compiler | dependency pin, props, expansion, namespace |

`logo`, `icon` và `character` đã bị xóa khỏi Node union. Logo/icon là semantic composition bằng Text/Image/SVG/Path/Component; Character là Component được compose từ Bone/Group/SVG/variants/actions.

## 6. Geometry/paint primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Point/Contour/Segment | Canonical Path geometry | Planned P0 | finite coordinates, cubic normalization, limits |
| Fill | Solid paint | Partial | color/opacity/fill rule |
| Stroke | Width/cap/join | Planned P0 | open path, scale behavior, bounds |
| Gradient | Linear/radial typed paint | Planned P1 | stable stop IDs, interpolation, transforms |
| Dash | Stroke dash array/offset | Planned P1 | odd arrays, offset animation |
| Trim Path | Arc-length range | Planned P1 | start/end/offset, open/closed contours |
| Path Morph | Compatible topology interpolation | Planned P0 late | mismatch rejection, 0/0.5/1 silhouettes |
| Path Bend | Lightweight curve deformation | Planned P1 | bounded control points, deterministic geometry |

SVG arc/quadratic commands được importer normalize thành cubic. P0 Morph không tự thêm points hoặc đoán correspondence.

## 7. Composition primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Mask/Clip | Node/subtree visibility từ source Node | Planned P0 | clip/alpha/inverse, nested, cycle |
| Effects stack | Ordered pixel effects | Planned P0 late | order, property animation, resource limits |
| Blur | Effect | Planned P0 late | radius 0/max, offscreen bounds |
| Shadow | Effect | Planned P0 late | offset/blur/color/alpha |
| Glow | Effect | Planned P0 late | radius/intensity/order |
| Color adjust | Effect | Planned P0 late | brightness/contrast/saturation |
| Blend mode | Layer compositing | Planned P1 | normal/multiply/screen/overlay/add |
| Scene transition | Cross-scene compositing | Planned P0 | duration, overlap, crossfade/wipe |

Canonical order: raster subtree → mask → ordered effects → blend/z-order.

## 8. Compile-time expansion primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Component expansion | Package → namespaced Nodes/Tracks | Implemented | nested policy, props/bindings, no Component runtime leak |
| Repeater list | List variable → cloned subtree | Implemented MVP | stable key, context binding, 0/1/n |
| Repeater count | Numeric clone source | Planned P0 | count limits, IDs, transform step |
| Repeater layout | Linear/grid/radial | Planned P0 | positions, gaps, radial angle |
| Time stagger | Offset cloned clips/tracks | Planned P0 | positive/negative bounds, deterministic schedule |
| Text Animator | Text → grapheme/word/line runs | Planned P0 | Vietnamese combining marks, emoji, stagger |
| Emitter | Seeded repeated sprites | Planned P1 | count/lifetime/seed/resource limits |

Compiler phải loại các expansion primitives khỏi Runtime IR.

## 9. Modifier primitives

| Modifier | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Motion Path | Node position/orientation theo Path | Planned P0 | arc length, tangent, progress, offset |
| Path Morph | Geometry interpolation | Planned P0 late | topology + numeric interpolation |
| Secondary Motion | Follow-through trên chain | Planned P0 cut-out | fixed time, random access, damping/stiffness |
| Simple constraint | Copy/look-at/pin | Planned P1 | dependency order/cycle |
| 2-bone IK | Analytic arm/leg solver | Planned P1 | reachable/unreachable target, bend direction |
| Path Bend | Simple warp | Planned P1 | hair/ribbon curvature |

Modifier có stable ID và animatable paths như `modifiers.hairFollow.stiffness`.

## 10. Cut-out character primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| SVG Source Import | Raw Figma/Illustrator source | Planned P0 | sanitize, parse, source fingerprint |
| Part | Một hoặc nhiều source paths thành SVG asset | Planned P0 | multi-select, create, rename, extract |
| Rig Mapper | Part → parent/pivot/order/semantic | Planned P0 | save/reload, reparent, conflict |
| Bone Chain | Joint hierarchy | Partial — worker smoke | arm chain chạy; mở rộng torso/head/leg/hair và Web parity |
| Rest Pose | Canonical local transforms | Planned P0 | reset, re-import preservation |
| Variant Slot | Mouth/eyes/hand/expression assets | Planned P0 | default, switch, invalid asset |
| Named Action | Reusable animation clips | Planned P0 | compose idle/blink/talk/gesture |
| Lip-sync cues | Step keys cho mouth variants | Planned P0 | cue boundaries, voiceover alignment |
| Prop Attachment | Prop parented vào hand/slot | Partial — worker smoke | pivot/draw order chạy; detach/action/Web parity còn thiếu |
| Secondary Chain | Hair/tail/ribbon overlap | Planned P0 late | deterministic movement |

Raw source/import/rig/action metadata không được đi vào Runtime IR.

## 11. Scene/media primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Scene | Spatial/time scope | Partial | unique ID, duration, order |
| Project Timeline | Scene order + audio tracks | Partial | missing/duplicate scene, total duration |
| Audio Track | BGM/voiceover/SFX | Partial plumbing | start/trim/loop/gain/fade/mix |
| Audio cue/marker | Beat/phoneme/semantic time | Planned P1 tooling | import/generate/edit, no raster dependency |
| Asset declaration | Typed image/SVG/video/audio/font metadata | Implemented schema + fixtures | required fields, alpha/audio consistency, manifest/probe parity |
| Asset resolver | ID → verified local/cache resource | Partial fixtures | URI safety, hash, manifest coverage; cache/offline còn thiếu |
| Font resolver | Family/weight → bundled font | Partial fixture | Vietnamese glyphs, fallback, missing weight |
| Media probe | Codec/duration/dimensions policy | Implemented fixtures | invalid/corrupt/unsupported media |

## 12. Authoring/application primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Patch | Revision-guarded public edit | Partial parse | apply, conflict, public-surface enforcement |
| Inspector control | Edit supported property | Partial | schema-driven controls, undo/redo |
| Timeline/dope sheet | Key/action editing | Planned P0 | drag, snap, multi-select, serialization |
| Canvas selection | Select/move/rotate/pivot | Planned P0 | zoom, hit test, hierarchy |
| Import/re-import | External asset reconciliation | Planned P0 | stable Node IDs, conflict UI |
| Preview | Browser evaluation | Partial CSS | same Runtime IR/frame as export |
| AI capability registry | Safe generation vocabulary | Planned P0 | only supported primitives/properties |

## 13. Runtime-only primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Literal Runtime Node | Draw-ready Node | Implemented schema | no variable/component/repeat/action metadata |
| Literal Runtime Track | Resolved keys | Implemented schema | literal-only enforcement |
| Frame Plan | Scene-local frame jobs | Implemented | FPS, boundaries, frame count |
| Evaluated Node State | Property values tại time t | Partial | all property families, deterministic result |
| Offscreen Surface | Mask/effect subtree buffer | Planned P0 | bounds/memory/reuse |
| Raster Output | PNG frame | Implemented text/logo | exact dimensions, visual golden |
| Encoder Output | H.264/AAC MP4 | Partial video smoke | streams, duration, FPS, colorspace, audio |

## 14. P1 và P2 boundary

P1 chỉ triển khai sau khi composition/cut-out vertical slices pass:

- Emitter, Trim Path, animated Dash/Gradient.
- Blend modes nhỏ.
- Audio waveform/beat markers.
- Simple constraints, 2-bone IK và Path Bend.

Out of scope hiện tại:

- Mesh deformation, skinning, weight paint.
- Organic IK và puppet pins nâng cao.
- Expression language/arbitrary scripts.
- Full physics.
- Frame-by-frame drawing/onion skin.
- Advanced compositing/custom shaders.

## Asset audit — 2026-07-24

`docs/fixtures/v2/assets/manifest.json` hiện khóa 19 assets. Validator kiểm tra hash/probe/reference và đối chiếu typed declaration của năm asset family với manifest.

| Nhóm | Coverage |
|---|---|
| Opaque/alpha image | Có |
| Font Việt Regular/Medium/Bold | Có |
| BGM/voiceover/SFX | Có |
| Video có/không audio stream | Có |
| Flat SVG character | Có |
| Figma exports | Có 2 file, path phẳng + mask wrappers |
| Illustrator export | Có 1 file, group tổng quát |
| Script/external URL | Không có trong positive assets |
| Semantic body-part groups | Không có; đúng để test group trong app |
| Gradient/clipPath/text SVG | Chưa có; sẽ sinh synthetic fixtures |
| Mouth/eye/hand variants | Chưa có; sẽ sinh normalized SVG part fixtures |

Không cần thêm asset bên ngoài cho Path/Mask/Gradient/Morph/variants: test geometry nên được sinh nhỏ, deterministic và review được. Một Figma SVG có semantic groups chỉ cần sau này để test happy-path import; không chặn Phase 0.

## Fixture architecture

```text
docs/fixtures/v2/
  assets/                 # binary/source fixtures + manifest
  imports/                # raw import expectations/re-import scenarios
  components/             # reusable .mvc and rig/actions
  projects/               # end-to-end .mt compositions
  primitives/             # one positive fixture per primitive
  invalid/                # one failure reason per fixture
  expected-runtime/       # canonical compiler goldens
  expected-frames/        # PNG visual goldens
  expected-media/         # probe/audio assertions
  expected-web/           # preview screenshots/state expectations
```

## Test layers áp dụng cho mọi primitive

1. Schema positive: minimal và full object parse.
2. Schema negative: wrong type, unknown field, limit violation.
3. Reference: missing ID, duplicate ID, cycle và cross-scope target.
4. Round-trip: parse → serialize → parse không đổi nghĩa.
5. Compiler: expected Runtime IR và authoring-only fields biến mất.
6. Evaluator: values tại before/start/middle/end/after.
7. Visual/audio: fixed frame hoặc media probe/mix assertion.
8. Interaction: kết hợp với hierarchy, mask, effects, camera và component.
9. Determinism: khác worker order vẫn cùng output.
10. Limits/performance: reject hoặc degrade rõ ràng, không memory explosion.
11. Web parity: preview timestamp khớp exported frame.
12. AI safety: planner chỉ sinh capability đang active.

Không phải primitive nào cũng cần mọi layer; nhưng một layer chỉ được đánh dấu N/A khi tài liệu ghi lý do.

## Fixture matrix theo logic

### Foundation

- `identity-and-strictness`: format/version/IDs/unknown fields.
- `variables-and-bindings`: mọi variable type, precedence và one-to-many.
- `schedule-playback`: absolute/after/with, cycles, rate/direction/iterations.
- `hierarchy-transform`: anchors, inherit flags, flips và world matrices.
- `component-public-api`: props/defaults/bindings/internal isolation.
- `patch-apply-conflict`: revision và public-surface restrictions.

### Drawable/geometry

- `text-vietnamese`: grapheme, wrap, font weight/fallback.
- `shape-basic`: rectangle/ellipse/polygon fill/stroke.
- `path-basic`: open/closed/multi-contour/evenodd.
- `path-invalid`: non-finite, empty, resource limits.
- `image-fit-alpha`: contain/cover/crop/transparency.
- `svg-normalized`: masks/transforms and sanitized input.
- `video-frame`: trim/loop/mute and deterministic frame sampling.

### Composition/modifier

- `mask-modes`: clip/alpha/inverse/nested/cycle.
- `motion-path`: progress 0/0.5/1, tangent orientation.
- `effects-stack`: blur/shadow/glow/order/limits.
- `path-morph`: topology match/mismatch and silhouettes.
- `bone-secondary`: 3-bone chain at fixed timestamps.
- `camera-transition`: pan/zoom/rotate and scene overlap.

### Expansions

- `repeater-list`: 0/1/n, stable keys/context.
- `repeater-count-layout`: count/linear/grid/radial/stagger.
- `text-animator-vi`: grapheme/word/line with Vietnamese and emoji.
- `emitter-seeded`: P1 deterministic count/lifetime.

### Character/import

- `svg-flat-import`: multi-select paths → Create Part.
- `svg-grouped-import`: group suggestions and rename.
- `svg-reimport`: unchanged/renamed/removed element reconciliation.
- `cutout-character`: rest pose, pivots, hierarchy, slots và actions.
- `cutout-dialogue`: idle + blink + lip sync + gesture + prop.
- `cutout-semi-organic`: segmented hair + Secondary Motion + mask.

### Media

- `audio-three-roles`: BGM/voiceover/SFX trim/loop/fade/gain.
- `video-audio-policy`: no stream/has stream/muted/kept.
- `font-vietnamese`: glyph coverage and deterministic fallback.
- `media-corrupt`: clear decoder/probe errors.

## Cross-primitive acceptance compositions

1. `infographic-composition`: Path + Repeater + Text Animator + Effects.
2. `product-tvc-composition`: Image/SVG + Mask + Motion Path + Camera + audio.
3. `cutout-dialogue-composition`: SVG Parts + Bone/Hierarchy + variants/actions + lip sync.
4. `cutout-semi-organic-composition`: Bone Chain + Secondary Motion + mask + prop attachment.

Các composition fixtures bắt buộc vì thứ tự interaction/compositing không thể chứng minh bằng isolated fixture.

## Implementation order

### Phase 0 — test/runtime foundation

- Stable property-path/capability registry.
- Shared evaluator, deterministic clock/seed.
- World matrix, bounds, hit-test và offscreen abstraction.
- Expected Runtime/PNG/media/Web harness.

### Phase 1 — geometry/compositing

- Typed Shape/Path/Paint.
- SVG/Image renderer.
- Mask dependency graph và draw order.
- Geometry, hierarchy và mask fixtures.

### Phase 2 — compiler expansions

- Repeater vNext.
- Text Animator.
- Compiler goldens và AI capability limits.

### Phase 3 — movement/cut-out

- Motion Path.
- Figma/Illustrator import + Rig Mapper.
- Bone Chain, variants, Named Actions và lip-sync.
- Secondary Motion deterministic.

### Phase 4 — visual/media finish

- Effects stack và normalized Path Morph.
- Camera/transition.
- Video frame + audio mixer.
- Preview/export parity.

### Phase 5 — selected P1

- Trim/Dash/Gradient/Blend/Emitter/Constraints/2-bone IK/Path Bend chỉ khi có template và fixture thật yêu cầu.

## Completion rule

Một primitive chỉ chuyển sang Implemented khi có:

- typed authoring schema;
- reference/limit validation;
- runtime representation rõ ràng;
- stable animatable property paths;
- compiler/evaluator implementation;
- positive + negative + Runtime golden;
- visual/audio assertion nếu có observable output;
- Web preview/export parity;
- capability metadata cho Inspector/AI;
- documentation normative cập nhật sau cùng.
