# Kế hoạch test Motion Format

Playback acceptance is covered by `projects/schedule-playback.mt.json` and its Runtime golden, including iterations, reverse/alternate direction, infinite scene clipping, schedule offsets, and evaluator timestamp assertions.

Effects acceptance is covered by `projects/effects-stack.mt.json`, `expected-runtime/effects-stack.runtime.json`, and `expected-frames/effects-stack-t0_5.png`; it verifies ordered blur/shadow/glow/color-adjust, animated effect properties, mask-before-effects, negative references, and the per-node effect limit.

Path Morph acceptance is covered by `projects/path-morph.mt.json`, `expected-runtime/path-morph.runtime.json`, and `expected-frames/path-morph-t{0,1,2}.png`; it verifies topology-compatible targets, progress tracks, mismatch/limit negatives, and silhouette interpolation at progress 0/0.5/1.

Secondary Motion acceptance is covered by `projects/bone-secondary-motion.mt.json`, its Runtime golden, and `expected-frames/bone-secondary-motion-t{0_5,1_5}.png`; the modifier lives on its driver bone, supports rotation only, validates chain ownership/references/limits, and verifies random-access follow-through.

Camera projection and scene transition acceptance is covered by `projects/camera-transition.mt.json`, its Runtime golden, and `expected-frames/camera-transition-t{0,1_5}.png`; it evaluates active camera pan/zoom/rotation, proves changed framing by PNG hash, validates strict orthographic projection and transition duration negatives, and asserts a crossfade midpoint has two 50% scene layers in the global frame plan.

Component Action outer playback is covered by `components/action-playback.mvc.json` and `projects/action-playback.mt.json`; it verifies iterations/rate, reverse, alternate, `action.loop` fill, and the over-duration guard.

Tài liệu này là coverage map cho fixtures. Ký hiệu:

Catalog đầy đủ của mọi primitive/object: [`../../primitives-object.md`](../../primitives-object.md).

- ✅ có assertion tự động cho capability đã triển khai;
- 🟡 có contract/compiler fixture nhưng chưa chứng minh pixel/audio cuối;
- ⬜ chưa có implementation hoặc acceptance test.

## Coverage hiện tại

| Capability | Contract | Compiler | Runtime/media | Web parity |
|---|---:|---:|---:|---:|
| Project/Component/Patch parse | ✅ | — | — | — |
| Parent/dependency reference | ✅ | — | — | — |
| Stored negative/error contract | ✅ 78 artifacts + 40 limit cases | — | — | — |
| Typed asset metadata | ✅ 5 families + manifest cross-check | ✅ preserved in Runtime IR | ✅ ffprobe/font/SVG probe | — |
| Discriminated Node payload/style | ✅ 9 authoring families | ✅ Component removed, literal union preserved | 🟡 Text/SVG smoke | 🟡 legacy editor type-safe |
| Stored Runtime IR goldens | ✅ | ✅ 17 projects | — | — |
| Stored PNG goldens | — | — | ✅ 18 fixed-time frames + pixel diff | ⬜ |
| Property capability registry | ✅ kind/domain/public/runtime state | ✅ reject unsupported/compile-only | ✅ Text string/number/color | — |
| Resource limits | ✅ finite numbers + all current public arrays | — | — | — |
| Public props và Project binding | ✅ | 🟡 | ⬜ | ⬜ |
| Component expansion | ✅ | ✅ | 🟡 | ⬜ |
| Repeater/list | ✅ stable key/context | ✅ removed from Runtime | ✅ layout PNG | ⬜ |
| Schedule/playback/preset | ✅ | 🟡 | 🟡 | ⬜ |
| Text/brand semantic | ✅ | ✅ | ✅ smoke | 🟡 |
| Image opaque/alpha | ✅ | ✅ plumbing | ⬜ | ⬜ |
| SVG/Bone | ✅ | ✅ plumbing | ✅ SVG/Bone smoke | ⬜ |
| Typed Path | ✅ line/cubic + limits | ✅ preserved | ✅ fill/stroke/hole/bounds | ⬜ |
| Shape/group/mask | ✅ | ✅ literal relations | ✅ mask modes/nesting PNG | ⬜ |
| Parent/world transform | ✅ | ✅ preserved | ✅ matrix assertions | ⬜ |
| Bounds/hit-test/offscreen plan | — | — | ✅ AABB/inverse/draw order/budgets | ⬜ |
| Camera/transition | ✅ strict orthographic + transition duration | ✅ active camera/transition preserved | ✅ camera PNG + crossfade composition | ⬜ |
| Video silent/audio | ✅ trim bounds | ✅ plumbing | ✅ cached decoded-frame timestamp hashes | ⬜ |
| BGM/voiceover/SFX timeline | ✅ | ✅ plumbing | ⬜ mix | ⬜ |
| Font và tiếng Việt | ✅ asset/text | ✅ preserved | 🟡 one bundled font | ⬜ |
| Preview/export equivalence | — | — | 🟡 export renderer goldenized | ⬜ browser |
| Figma SVG import/re-import | ⬜ | — | — | ⬜ |
| Cut-out rig/pivot hierarchy | ✅ fixture | ✅ preserved | ✅ visual smoke | ⬜ |
| Named character actions | ✅ | ✅ outer playback | ✅ evaluator | ⬜ |
| Mouth/eye/hand variants | ✅ | ✅ assetId step keys | 🟡 | ⬜ |
| Dialogue lip-sync cues | ✅ slot/variant/time/limit negatives | ✅ `payload.assetId` step keys | 🟡 Runtime IR golden | ⬜ |
| Typed Path geometry | ✅ | ✅ | ✅ worker PNG golden | ⬜ |
| Mask clip/alpha/inverse | ✅ | ✅ | ✅ worker PNG golden | ⬜ |
| Motion Path | ✅ refs/cycles/limits | ✅ literal modifier + progress track | ✅ arc length/offset/orientation PNG | ⬜ |
| Text Animator grapheme/word/line | ✅ Unicode + limits | ✅ literal runs/tracks | ✅ worker PNG golden | ⬜ |
| Repeater count/grid/radial | ✅ + limits | ✅ IDs/layout/stagger | ✅ worker PNG golden | ⬜ |
| Ordered effects stack | ✅ | ✅ | ✅ worker PNG golden | ⬜ |
| Normalized Path Morph | ✅ topology/limits | ✅ progress track | ✅ worker PNG goldens | ⬜ |
| Bone Secondary Motion | ✅ refs/ownership/limit | ✅ literal modifier | ✅ random-access solver + PNG | ⬜ |

`media-assets.mt.json` và `assets/manifest.json` khóa asset plumbing. Video frame sampling now proves decoded pixels at fixed timestamps; audio remains unproven until MP4 stream probing is enabled.

Schema, fixtures và acceptance gate cho nhân vật SVG: [`../../svg-cutout-plan.md`](../../svg-cutout-plan.md).

Schema, composition order và fixture matrix cho atomic primitives: [`../../atomic-primitives-plan.md`](../../atomic-primitives-plan.md).

## Test layers phải có

### 1. Contract/reference

- Positive fixture tối thiểu cho mỗi artifact và node family.
- Negative fixture cho duplicate ID, missing reference, cycle, invalid dependency, schedule, mask, camera, audio asset và binding.
- Assert cả error path/message, không chỉ assert có exception.

### 2. Compiler golden

- Lưu expected Runtime IR cho binding, public props, component namespace, repeater, schedule, variable reference và preset expansion.
- Assert không còn Component, preset, binding, repeater hoặc resolvable reference trong output.
- Snapshot phải deterministic và review được như JSON thường.

### 3. Evaluator

- Assert property value tại `before/start/middle/end/after` track.
- Bao phủ numeric/non-numeric keys, easing, playback rate/direction/iteration.
- Bao phủ local/world transform, anchor, flip, visibility, opacity và camera.

### 4. Visual golden

- Render PNG ở timestamp cố định cho text Việt, shape, image fit/crop/alpha, SVG, hierarchy, mask, z-index, camera và video frame.
- Dùng pixel diff có tolerance; lưu diff artifact khi CI fail.
- Chạy cùng Runtime IR/evaluator với browser preview.

### 5. Media E2E

- Probe output bằng metadata tool thay vì chỉ kiểm tra file size.
- Assert H.264/yuv420p, resolution, FPS, duration và AAC stream.
- Assert trim/start/loop/fade/volume cho BGM, voiceover và SFX.
- Phân biệt video không audio stream, video có audio, muted và audio được giữ.

### 6. Web E2E

- Import fixture, chỉnh variable/public prop, save/reload và export.
- Chụp preview tại timestamp cố định và so với frame export.
- Assert lỗi import hiển thị đúng cho invalid fixtures.

## Thứ tự triển khai

1. Hoàn thiện negative reference suite và compiler JSON goldens.
2. ✅ Tách evaluator/transform math dùng chung và thêm timestamp assertions cho hierarchy fixture.
3. ✅ Thêm visual smoke cố định cho SVG rig; tiếp tục nâng thành pixel-diff golden cho text/logo.
4. ✅ Triển khai world transform và SVG renderer; tiếp tục mở shape/image/mask tests.
5. ✅ Triển khai video frame deterministic; tiếp tục audio mix và media E2E probe.
6. Chuyển Web preview sang Runtime IR và bật parity suite.
7. Khóa vertical slice `cutout-dialogue`: import → rig → actions → lip sync → camera/audio → MP4.
8. Chỉ bật Effects/Morph sau khi Path/Mask/world transform visual goldens ổn định.

Mỗi capability chỉ chuyển sang ✅ khi tầng tương ứng có assertion đầu ra. Việc Zod parse một field không chứng minh compiler hoặc renderer đã thực thi field đó.
