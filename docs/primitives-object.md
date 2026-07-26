# MotionVideo primitive object catalog

Current status ledger: [`roadmap-status.md`](roadmap-status.md). Machine-readable schema-first coverage: [`fixtures/v2/primitives-coverage.json`](fixtures/v2/primitives-coverage.json) (asserted by `pnpm validate:v2-fixtures`). **P0 schema freeze:** [`p0-schema-freeze-checklist.md`](p0-schema-freeze-checklist.md) (2026-07-25). Worker PNG/Web parity remain separate gates; this catalog’s “Implemented schema” means contract/reference/limits (+ compiler when Runtime surface) are covered.

> Tài liệu sống — catalog duy nhất cho các thành phần nguyên tử, trạng thái triển khai và fixture coverage. Schema normative: [`motion-format-v2.md`](motion-format-v2.md). Fixture suite: [`fixtures/v2/README.md`](fixtures/v2/README.md). Product acceptance: [`product-primitive-acceptance.md`](product-primitive-acceptance.md).

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
| Partial | Schema/compiler hoặc smoke có, nhưng Web/PNG/parity còn thiếu |
| Planned P1 | Chưa normative — schema reject (`negative/p1-not-normative/`) |
| Deferred UI | Không thuộc Motion Format; editor/canvas/timeline |
| Out of scope | Không thêm placeholder vào schema hiện tại |

## Tổng hợp — đã làm / chưa làm

Cập nhật: 2026-07-25. Chi tiết từng dòng ở các mục §1–13 bên dưới. Machine ledger: [`fixtures/v2/primitives-coverage.json`](fixtures/v2/primitives-coverage.json).

### Đã làm (P0 — schema + runtime/compiler fixture)

| Nhóm | Nguyên tử |
|---|---|
| Identity | Artifact identity, Stable ID, Semantic (`key` qua compile), Integrity, Component semver, Source mapping (SVG import) |
| Value | JSON literal, Resolvable value (typed surfaces), Property path registry, Variable, Binding (1 target / many sources), Public param, Capability registry |
| Time | Keyframe, Track, Easing, Clip, Schedule, Playback, Preset, Named Action outer playback, Deterministic clock/seed |
| Spatial | Transform, Hierarchy, World matrix (worker), Draw order, Bounds, Hit-test (worker), Layout via Repeater |
| Nodes | Group, Text, Shape, Path, Image, SVG, Video, Bone, Camera, Component Instance |
| Paint/geometry | Point/Contour/Segment, Solid fill/stroke, **Gradient** (literal stops), **Dash** + animatable `dashOffset`, **Trim Path**, Path Morph, **Path Bend** |
| Composition | Mask/Clip, Effects stack (blur/shadow/glow/color-adjust), **Blend mode** (`normal\|multiply\|screen\|add`), Scene transition (`cut\|fade\|crossfade`) |
| Expansion | Component expansion, Repeater (list/count/layouts/stagger), Text Animator — compile away khỏi Runtime IR |
| Modifiers | Motion Path, Path Morph, Secondary Motion (rotation), Trim Path, Path Bend, Constraint (`look-at\|copy-position\|copy-rotation`) |
| Cut-out | `sourceImports` / Part / `cutoutRigs`, Bone chain, `restRotation`, Variant slot, Named Action, Lip-sync cues, Prop attachment, Secondary chain |
| Scene/media | Scene, Timeline `sceneOrder`, Audio track mix, Asset declaration/resolver (schema), Font `fontAssetId` mismatch reject, Media probe |
| Authoring format | Patch public-surface, AI capability freeze surface, Import fixtures |
| Runtime IR | Literal node/track, Frame plan, Offscreen plan, PNG worker goldens, Encoder MP4 smoke |

### Làm được nhưng còn gap (Partial / deferred)

| Gap | Ghi chú |
|---|---|
| Browser Web / Canvas PNG parity | Runtime IR harness có; media/screenshot parity vs worker còn thiếu |
| Parallax Modifier | Manual keyframe parallax được; auto parallax modifier **chưa** (plan riêng) |
| Gradient stops animate | Fill gradient literal OK; animate stops theo track **chưa** |
| Secondary Motion `axis: position` | Schema/runtime P0 chỉ **rotation** |
| Secondary Motion animate stiffness/damping | Params **static** ở P0 |
| Constraint `pin` | Chưa; chỉ look-at / copy-position / copy-rotation |
| Effect bounds inflation | Bounds baseline có; inflation đầy đủ còn thiếu |
| Font glyph Web fallback | Schema mismatch reject có; glyph coverage Web deferred |
| Asset cache/offline | Hash/manifest có; cache/offline deferred |
| Editor UI | Inspector, timeline/dope sheet, canvas selection — Deferred UI |
| Encoder/product infra | MP4 smoke; queue/storage/auth chưa |

### Chưa làm — Planned P1 (schema reject)

| Primitive | Reject fixture |
|---|---|
| Emitter | `negative/p1-not-normative/emitter-node.json` |
| 2-bone IK | `negative/p1-not-normative/two-bone-ik.json` |
| Audio cue/marker | `negative/p1-not-normative/audio-marker-track.json` |

### Out of scope (không thêm placeholder)

Mesh/skinning/weight paint · Organic IK/puppet · Expression language · Full physics · Frame-by-frame/onion skin · Custom shaders · `CharacterNode` / `RestPose` / `RigMapper` types · Wipe transition · Parallax-as-depth-from-`zIndex`

### Quy tắc đọc trạng thái trong bảng §1–13

- **Implemented schema** = contract ± fixtures xanh; Web PNG có thể vẫn deferred.
- **Implemented worker** = schema + worker/evaluator (+ thường có Runtime/PNG golden).
- **Planned P1 — rejected** = parser từ chối; chưa mở normative.

## 1. Artifact và identity primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Artifact identity | `format`, `formatVersion` | Implemented schema | đúng/sai format, version rejection, strict unknown fields |
| Stable ID | Address trong scope | Implemented schema | empty, duplicate, namespace sau expansion |
| Semantic | `role`, `key`, `tags` | Implemented schema | public/internal address; `key` preserved through compile |
| Integrity | SHA-256 pin cho asset/component | Implemented schema | đúng hash, mismatch, missing file, immutable package |
| Component semver | Public contract version | Implemented schema | exact pin, missing dependency, incompatible action/public prop |
| Source mapping | Figma/Illustrator SVG export → canonical Node/asset | Implemented schema + import fixtures | flat paths, fingerprint, re-import identity, script/URL reject |

## 2. Value/property primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| JSON literal value | Runtime scalar/object/list | Implemented schema | string/number/bool/null/list/object round-trip |
| Resolvable value | Literal hoặc variable reference | Implemented schema | typed clip/track/playback/params only; missing variable + finite map |
| Property path | Stable animatable address | Implemented current surface | enumerable kind/domain/public/runtime state; effect/modifier paths đến cùng primitive |
| Variable | string/color/number/bool/image/enum/list | Implemented schema | defaults, min/max/options, list item schema |
| Binding | Variable/context → Node property | Implemented schema | one target property per binding; one variable → many targets |
| Public parameter | Component safe surface | Implemented schema | type match, default/override, internal isolation |
| Capability metadata | Primitive support/limits for UI và AI | Implemented property registry | public P0 enumeration; P1 node types rejected |

## 3. Time/animation primitives

Playback is implemented for finite and infinite iterations, normal/reverse/alternate direction, rate scaling, scene-duration clipping, and schedule offsets. The acceptance fixture is `docs/fixtures/v2/projects/schedule-playback.mt.json`; compiler and evaluator assertions cover before/start/middle/end/after timestamps.

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Keyframe | `{t, v, easing}` | Implemented schema | ordering, duplicate time reject, before/after range |
| Property Track | Keys trên target/property | Implemented schema | numeric/non-numeric interpolation, target validation |
| Easing | linear/ease/spring/step | Implemented schema | exact values tại fixed timestamps, clamp policy |
| Clip | Duration, target, source | Implemented schema | target, duration, keys không vượt clip |
| Schedule | absolute/after/with | Implemented schema | chain, offset, missing ref, cycle |
| Playback | iterations/direction/rate | Implemented | finite/infinite, reverse/alternate evaluator, rate>0 reject |
| Preset source | Authoring shortcut → tracks | Implemented | known preset, literal expansion, no preset in Runtime IR |
| Named Action | Reusable component animation | Implemented outer playback | idle/blink/talk/wave compose, loop/rate, over-duration guard |
| Deterministic clock/seed | Random-access frame evaluation và pseudo-random sample | Implemented runtime foundation | frame index/time, channel/sample independence, stored frame equality |

## 4. Spatial/layout primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Transform | x/y/size/rotation/scale/anchor/opacity/visibility/flip | Implemented schema (Web deferred) | local matrix và tracked values |
| Hierarchy | `parentId` Node graph | Implemented schema | missing parent, cycle, deep hierarchy |
| World matrix | Parent × local | Implemented schema — worker tested; Web deferred | anchor, inherit flags, flip, nested scale/rotation |
| Draw order | z-index + stable tree order | Implemented schema | equal z-index, nested groups, mask/effect layers |
| Bounds | Geometry/layout bounds | Implemented runtime baseline | transformed AABB + drawable subtree chạy; effect inflation còn thiếu |
| Hit test | Canvas selection | Implemented schema; Web selection deferred | inverse transform, visibility, opacity và draw order |
| Layout | linear/grid/radial placement | Implemented via Repeater | deterministic positions and item limits |

## 5. Core Node objects

Node chỉ tồn tại khi có spatial identity, bounds, draw order, hit-test hoặc parenting.

| Node | Atomic responsibility | Trạng thái | Fixture logic |
|---|---|---|---|
| Group | Hierarchy/container | Implemented schema | parent transform, subtree opacity/effects/mask |
| Text | Text content/layout | Implemented schema; font/Web deferred | Vietnamese, wrap, alignment, fontAssetId mismatch reject |
| Shape | Rectangle/ellipse/polygon primitives | Implemented worker | typed paint, animated radius/paint, geometry limits và PNG golden |
| Path | Typed contours + line/cubic segments | Implemented worker | open/closed, evenodd holes, true cubic bounds và PNG golden |
| Image | Raster asset | Implemented schema + media fixture | contain/cover/fill/none fit, crop rect, alpha metadata |
| SVG | Normalized vector asset/part | Implemented schema + worker smoke; Web deferred | sanitize, raster, nested transform |
| Video | Time-based media asset | Implemented worker frame sampling | trim, frame policy, loop, mute/audio policy |
| Bone | Zero-size transform joint | Implemented schema + worker smoke; Web deferred | chain/pivot/hierarchy; restRotation |
| Camera | Scene view transform | Implemented worker | active camera, pan/zoom/rotate, crossfade |
| Component Instance | Reusable package Node | Implemented compiler | dependency pin, props, expansion, namespace |

`logo`, `icon` và `character` đã bị xóa khỏi Node union. Logo/icon là semantic composition bằng Text/Image/SVG/Path/Component; Character là Component được compose từ Bone/Group/SVG/variants/actions.

## 6. Geometry/paint primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Point/Contour/Segment | Canonical Path geometry | Implemented | finite coordinates, line/cubic, contour/segment limits |
| Fill | Solid paint | Implemented worker | color/opacity/nonzero/evenodd |
| Stroke | Width/cap/join | Implemented worker | open path, animated width, stroke-inflated bounds |
| Gradient | Linear/radial typed paint | Implemented worker | `gradient-dash` + stop-order negatives; stops literal (not animated) |
| Dash | Stroke dash array/offset | Implemented worker | `style.dash` + animatable `dashOffset` on path/shape |
| Trim Path | Arc-length range | Implemented worker | `trim-path-reveal`; animate start/end/offset |
| Path Morph | Compatible topology interpolation | Implemented worker | mismatch rejection, 0/0.5/1 silhouettes |
| Path Bend | Arc-chord warp | Implemented worker | `path-bend-ribbon`; amount ∈ [-1,1]; sin(πt) perpendicular offset |

SVG arc/quadratic commands được importer normalize thành cubic. P0 Morph không tự thêm points hoặc đoán correspondence.

## 7. Composition primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Mask/Clip | Node visibility từ source Node | Implemented worker | clip/alpha/inverse, nested, cycle và source visibility |
| Effects stack | Ordered pixel effects | Implemented worker | order, property animation, resource limits |
| Blur | Effect | Implemented worker | radius 0/max, offscreen budgets via effects fixture |
| Shadow | Effect | Implemented worker | offset/blur/color/alpha |
| Glow | Effect | Implemented worker | radius/intensity/order |
| Color adjust | Effect | Implemented worker | brightness/contrast/saturation |
| Blend mode | Layer compositing | Implemented worker | `normal\|multiply\|screen\|add`; `blend-mode-glow` |
| Scene transition | Cross-scene compositing | Implemented cut/fade/crossfade | wipe rejected; duration/overlap goldens |

Canonical order: raster subtree → mask → ordered effects → blend/z-order.

## 8. Compile-time expansion primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Component expansion | Package → namespaced Nodes/Tracks | Implemented | nested policy, props/bindings, no Component runtime leak |
| Repeater list | List variable → cloned subtree | Implemented | stable key, duplicate/missing rejection, context binding |
| Repeater count | Numeric clone source | Implemented | count limits, stable generated IDs |
| Repeater layout | None/linear/grid/radial | Implemented | exact positions, columns, radius và orientation |
| Time stagger | Offset cloned clips/tracks | Implemented | bounded value, canonical deterministic schedule |
| Text Animator | Text → grapheme/word/line runs | Implemented compiler | Vietnamese combining marks, emoji ZWJ, selector, stagger và unit limit |
| Emitter | Seeded repeated sprites | Planned P1 — rejected in schema | negative/p1-not-normative/emitter-node.json |

Compiler phải loại các expansion primitives khỏi Runtime IR.

## 9. Modifier primitives

| Modifier | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Motion Path | Node position/orientation theo Path | Implemented runtime | typed refs, arc length, tangent, progress, offsets, cycles, cross-hierarchy |
| Path Morph | Geometry interpolation | Implemented runtime | topology + numeric interpolation |
| Secondary Motion | Follow-through trên chain | Implemented runtime | fixed time, random access; params static at P0 |
| Trim Path | Arc-length reveal | Implemented worker | `trim-path-reveal`; animate start/end/offset |
| Simple constraint | look-at / copy-position / copy-rotation | Implemented worker | `constraint-look-at`; cycle reject; topo evaluation |
| 2-bone IK | Analytic arm/leg solver | Planned P1 — rejected in schema | negative/p1-not-normative/two-bone-ik.json |
| Path Bend | Arc-chord warp | Implemented worker | `path-bend-ribbon`; amount ∈ [-1,1] |

Modifier có stable ID. Animatable paths P0: `modifiers.<id>.progress` (Motion Path/Path Morph), `modifiers.<id>.start|end|offset` (Trim Path), `modifiers.<id>.amount` (Path Bend), `modifiers.<id>.weight` (Constraint). Secondary Motion stiffness/damping/amplitude là static configuration.

## 10. Cut-out character primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| SVG Source Import | SVG export (Figma/Illustrator) | Implemented sanitizer + fixtures | sanitize, fingerprint, re-import |
| Part | Một hoặc nhiều source paths thành SVG asset | Implemented import mapping | multi-select mapping via sourceImports.parts |
| Rig Mapper | Part → parent/pivot/order/semantic | Implemented as mapped fields (not a type) | `cutoutRigs` + `sourceImports`; no RigMapper schema type |
| Bone Chain | Joint hierarchy | Implemented worker smoke | arm chain + hierarchy-transform |
| Rest Pose | Canonical local transforms | Implemented as `bone.payload.restRotation` | no RestPose object; reset/re-import via import fixtures |
| Variant Slot | Mouth/eyes/hand/expression assets | Implemented | default, switch, invalid asset negatives |
| Named Action | Reusable animation clips | Implemented | compose idle/blink/talk/gesture + outer playback |
| Lip-sync cues | Step keys cho mouth variants | Implemented compiler | cue boundaries → assetId step keys |
| Prop Attachment | Prop parented vào hand/slot | Implemented worker smoke | pivot/draw order; Web parity còn thiếu |
| Secondary Chain | Hair/tail/ribbon overlap | Implemented Secondary Motion | deterministic chain follow-through |

Raw source/import/rig/action metadata không được đi vào Runtime IR.

## 11. Scene/media primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Scene | Spatial/time scope | Implemented schema | unique ID, duration, order |
| Project Timeline | Scene order + audio tracks | Implemented schema | missing/duplicate/unscheduled scene reject |
| Audio Track | BGM/voiceover/SFX | Implemented mix + probe | start/trim/loop/gain/fade/mix |
| Audio cue/marker | Beat/phoneme/semantic time | Planned P1 — rejected in schema | negative/p1-not-normative/audio-marker-track.json |
| Asset declaration | Typed image/SVG/video/audio/font metadata | Implemented schema + fixtures | required fields, alpha/audio consistency, manifest/probe parity |
| Asset resolver | ID → verified local/cache resource | Implemented schema; cache/offline deferred | URI safety, hash, manifest coverage |
| Font resolver | Family/weight → bundled font | Implemented schema | fontAssetId unknown/wrong-type reject; glyph Web deferred |
| Media probe | Codec/duration/dimensions policy | Implemented fixtures | invalid/corrupt/unsupported media |

## 12. Authoring/application primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Patch | Revision-guarded public edit | Implemented schema | `applyMotionPatch` public-surface only; private property reject |
| Inspector control | Edit supported property | Deferred UI (not format) | schema-driven controls, undo/redo |
| Timeline/dope sheet | Key/action editing | Deferred UI (not format) | drag, snap, multi-select, serialization |
| Canvas selection | Select/move/rotate/pivot | Deferred UI (not format) | zoom, hit test, hierarchy |
| Import/re-import | External asset reconciliation | Implemented import fixtures; UI deferred | stable Node IDs via import contract |
| Preview | Browser evaluation | Deferred Web parity (Runtime IR harness exists) | hierarchy harness; full PNG/Web still deferred |
| AI capability registry | Safe generation vocabulary | Implemented freeze gate | public P0 properties only; P1 node types absent |

## 13. Runtime-only primitives

| Primitive | Vai trò | Trạng thái | Logic phải test |
|---|---|---|---|
| Literal Runtime Node | Draw-ready Node | Implemented schema | no variable/component/repeat/action metadata |
| Literal Runtime Track | Resolved keys | Implemented schema | literal-only enforcement |
| Frame Plan | Scene-local frame jobs | Implemented | FPS, boundaries, frame count |
| Evaluated Node State | Property values tại time t | Partial | all property families, deterministic result |
| Offscreen Surface | Mask/effect subtree buffer | Implemented planning abstraction | integer origin/size + dimension/pixel budget; allocation/reuse đến cùng Mask/Effects |
| Raster Output | PNG frame | Implemented text/SVG smoke | exact dimensions, visual golden |
| Encoder Output | H.264/AAC MP4 | Partial video smoke | streams, duration, FPS, colorspace, audio |


## 14. P1 / P2 và việc tiếp theo

Xem bảng **Tổng hợp — đã làm / chưa làm** ở đầu tài liệu.

**P1 còn lại** (chỉ mở khi có composition fixture thật): Emitter · animated gradient stops · constraint `pin` · 2-bone IK · audio markers.

**Initiative riêng (không P1 reject wall):** Parallax Modifier (fixtures-first, plan riêng).

**Out of scope:** mesh/skinning · organic IK · expressions · physics · frame-by-frame · custom shaders.

## Asset / fixture notes

- Assets pinned: `docs/fixtures/v2/assets/manifest.json` (+ import suite Figma/Illustrator).
- Layout fixture dirs: `projects/`, `components/`, `negative/`, `expected-runtime/`, `expected-frames/`, `patches/`, `primitives-coverage.json`.
- Cross-primitive maps: infographic · product TVC · cut-out dialogue · semi-organic mascot.

## Completion rule

Primitive → **Implemented** khi có typed schema · reference/limits · Runtime representation · property paths · compiler/evaluator · ± fixtures (+ Runtime golden khi có surface) · visual khi observable · docs normative. Web PNG parity có thể `na` nếu đã ghi lý do.
