# Kế hoạch test Motion Format

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
| Stored negative/error contract | ✅ 18 artifacts + 9 limit cases | — | — | — |
| Typed asset metadata | ✅ 5 families + manifest cross-check | ✅ preserved in Runtime IR | ✅ ffprobe/font/SVG probe | — |
| Discriminated Node payload/style | ✅ 9 authoring families | ✅ Component removed, literal union preserved | 🟡 Text/SVG smoke | 🟡 legacy editor type-safe |
| Stored Runtime IR goldens | ✅ | ✅ 4 projects | — | — |
| Property capability registry | ✅ baseline | ✅ reject unsupported | — | — |
| Resource limits | ✅ ID/array limits | — | — | — |
| Public props và Project binding | ✅ | 🟡 | ⬜ | ⬜ |
| Component expansion | ✅ | ✅ | 🟡 | ⬜ |
| Repeater/list | ✅ | ✅ | 🟡 | ⬜ |
| Schedule/playback/preset | ✅ | 🟡 | 🟡 | ⬜ |
| Text/brand semantic | ✅ | ✅ | ✅ smoke | 🟡 |
| Image opaque/alpha | ✅ | ✅ plumbing | ⬜ | ⬜ |
| SVG/Bone | ✅ | ✅ plumbing | ✅ SVG/Bone smoke | ⬜ |
| Typed Path | ⬜ | ⬜ | ⬜ | ⬜ |
| Shape/group/mask | ✅ | 🟡 | ⬜ | ⬜ |
| Parent/world transform | ✅ | ✅ preserved | ✅ matrix assertions | ⬜ |
| Camera/transition | ✅ | 🟡 | ⬜ | ⬜ |
| Video silent/audio | ✅ | ✅ plumbing | ⬜ | ⬜ |
| BGM/voiceover/SFX timeline | ✅ | ✅ plumbing | ⬜ mix | ⬜ |
| Font và tiếng Việt | ✅ asset/text | ✅ preserved | 🟡 one bundled font | ⬜ |
| Preview/export equivalence | — | — | ⬜ | ⬜ |
| Figma SVG import/re-import | ⬜ | — | — | ⬜ |
| Cut-out rig/pivot hierarchy | ✅ fixture | ✅ preserved | ✅ visual smoke | ⬜ |
| Named character actions | ⬜ | ⬜ | ⬜ | ⬜ |
| Mouth/eye/hand variants | ⬜ | ⬜ | ⬜ | ⬜ |
| Dialogue lip-sync cues | ⬜ | ⬜ | ⬜ | ⬜ |
| Typed Path geometry | ⬜ | ⬜ | ⬜ | ⬜ |
| Mask clip/alpha/inverse | ⬜ | ⬜ | ⬜ | ⬜ |
| Motion Path | ⬜ | ⬜ | ⬜ | ⬜ |
| Text Animator grapheme/word/line | ⬜ | ⬜ | ⬜ | ⬜ |
| Repeater count/grid/radial | ⬜ | ⬜ | ⬜ | ⬜ |
| Ordered effects stack | ⬜ | ⬜ | ⬜ | ⬜ |
| Normalized Path Morph | ⬜ | ⬜ | ⬜ | ⬜ |
| Bone Secondary Motion | ⬜ | ⬜ | ⬜ | ⬜ |

`media-assets.mt.json` và `assets/manifest.json` khóa asset plumbing. Trạng thái “plumbing” không được hiểu là renderer đã vẽ hoặc mix media.

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
5. Triển khai video frame và audio mix, bật media E2E.
6. Chuyển Web preview sang Runtime IR và bật parity suite.
7. Khóa vertical slice `cutout-dialogue`: import → rig → actions → lip sync → camera/audio → MP4.
8. Chỉ bật Effects/Morph sau khi Path/Mask/world transform visual goldens ổn định.

Mỗi capability chỉ chuyển sang ✅ khi tầng tương ứng có assertion đầu ra. Việc Zod parse một field không chứng minh compiler hoặc renderer đã thực thi field đó.
