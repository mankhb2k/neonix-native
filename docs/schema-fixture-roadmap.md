# Schema-first fixture roadmap

> Mục tiêu hiện tại: khóa ngôn ngữ JSON cho AI authoring và khả năng mở rộng lâu dài. Browser preview không phải dependency của giai đoạn này. Motion Format v2 chưa có dữ liệu production nên các contract generic hiện tại được phép siết chặt trong v2, với điều kiện migrate schema, compiler, docs và toàn bộ fixtures trong cùng thay đổi.

## Nguyên tắc fixture trước schema

Không thêm primitive chỉ từ một TypeScript interface. Thứ tự bắt buộc:

```text
use case + composition
→ authoring fixture dương
→ fixture âm + resource limits
→ expected Runtime IR
→ reference/property rules
→ typed Zod schema
→ compiler assertion
→ cập nhật capability catalog
```

Renderer/preview golden có thể bổ sung sau, nhưng contract và compiler golden không được bỏ qua. Một primitive mới phải chứng minh nó compose được với ít nhất hai primitive đã có; nếu chỉ phục vụ một template cụ thể, ưu tiên Component thay vì engine primitive.

## Audit baseline 24/07/2026

Baseline sau milestone finite/resource policy có 10 positive fixtures, 22 negative artifacts, 21 deterministic limit cases, 4 Runtime IR goldens và 19 asset đã pin hash/probe.

### Phase 0 implementation progress

- [x] Property capability registry nền cho transform và property đang dùng.
- [x] Finite-number policy cho toàn bộ numeric/JSON surface; limits cho dimensions, scale, duration, FPS, playback và public arrays hiện có.
- [x] Strictly increasing key-time validation.
- [x] Reference validation cho track target/property và schedule graph.
- [x] 22 negative artifacts và 21 limit/depth descriptors với structured error assertions.
- [x] 4 stored Runtime IR goldens, exact-set check và double-compile determinism assertion.
- [x] Property value/variable-type validation cho registry baseline.
- [x] Negative matrix cho duplicate Node ID, hierarchy depth và từng array limit.
- [x] JSON `1e400` bị reject ở typed transform lẫn generic JSON metadata; schema không nhận NaN/Infinity sau parse.
- [x] Runtime world bounds, inverse-matrix hit-test, drawable subtree bounds và offscreen dimension/pixel budgets.

### Phase 1 progress

- [x] `assetType` đổi từ string tự do thành discriminated union: image/svg/video/audio/font.
- [x] Node `assetId`, text `fontAssetId`, brand logo và audio timeline được kiểm tra asset compatibility.
- [x] Negative fixtures cho unsupported asset type và Node–Asset mismatch.
- [x] Typed metadata riêng cho image, SVG, video, audio và font; validator đối chiếu declaration với manifest/probe.
- [x] Negative contracts cho thiếu metadata, alpha mismatch và video audio-policy mismatch.
- [x] Thay `RegularNode` generic bằng discriminated union cho Group/Bone/Text/Shape/Image/SVG/Video/Camera/Component.
- [x] Xóa `logo`, `icon`, `character` và Path placeholder khỏi normative Node union; Path chỉ quay lại cùng typed geometry fixture.
- [x] Active camera bắt buộc trỏ tới Camera Node; Group reject generic payload/style.

### Đã có contract và hành vi có thể dựa vào

| Nhóm | Primitive/object | Mức hiện tại |
|---|---|---|
| Artifact | Project, Component, Patch, Runtime IR | Parse/serialize; Component compile thành Runtime IR |
| Identity | ID, semantic role/key/tags, dependency pin | Có reference validation cơ bản |
| Value | string/color/number/boolean/image/enum/list variables | Có variable resolve, public API và binding |
| Time | Scene, Clip, Track, Keyframe, schedule absolute/after/with | Compiler/evaluator cơ bản |
| Playback | iterations/direction/rate, preset source | Preset được expand; playback chưa test đủ evaluator |
| Spatial | Transform, parent hierarchy, zIndex, inherit flags | Worker có world matrix và hierarchy assertions |
| Compile-time | Component expansion, list Repeater MVP | Có compiler assertions |
| Drawable | Text; typed Shape/Image/SVG/Video | Text và SVG/Image fixture hierarchy đã render; Shape/Video renderer còn thiếu |
| Joint | Bone như zero-size transform Node | Arm hierarchy fixture đã test pivot/prop attachment |
| Timeline | scene order; BGM/voiceover/SFX metadata | Contract/compiler plumbing, chưa mix audio |

### Có tên/field nhưng chưa phải typed primitive hoàn chỉnh

| Tên hiện có | Vấn đề |
|---|---|
| `shape` | Rectangle/ellipse và paint đã typed; polygon, geometry limits và renderer chưa có |
| `path` | Đã bị reject khỏi Node union cho tới khi có typed contours/segments và fixtures S1 |
| `maskId` | Chỉ là ID reference; chưa có mode clip/alpha/inverse, cycle graph và fixture dương |
| `camera` | Zoom/projection và active-camera reference đã typed; shot/transition runtime chưa có |
| `video` | fit/crop/trim/loop/mute/frame policy đã typed; frame renderer và audio mix chưa có |
| property path | Registry đã khóa baseline hiện dùng; chưa phủ Path/Mask/effect/modifier tương lai |
| `extensions.constraints/events` | Array JSON tự do, chưa có consumer hoặc reference validation |

Node types thực sự xuất hiện trong positive fixtures hiện tại: `bone`, `camera`, `component`, `group`, `image`, `shape`, `svg`, `text`, `video`. Track properties hiện chỉ bao phủ `transform.rotation`, `transform.opacity`, `transform.flipX`.

## Schema foundation phải làm trước primitive mới

### F0.1 — Typed asset union

Tách asset theo `assetType`: image, svg, video, audio, font. Chốt metadata tối thiểu, integrity, media policy và asset reference compatibility theo Node.

Fixtures: mỗi asset type một positive; sai type, missing asset, bad integrity, unsafe URI và unsupported codec là negative.

### F0.2 — Discriminated Node schemas

Thay RegularNode dùng chung generic payload bằng union có payload/style riêng:

- Group/Bone: transform-only payload đã giới hạn;
- Text: text, font, alignment, wrap;
- Shape: geometry + typed paint;
- Path: contours + typed paint;
- Image/SVG: assetId + fit/crop;
- Video: assetId + trim/loop/mute/frame policy;
- Camera: zoom/projection/activation policy.

`logo/icon` chỉ là Component hoặc SVG/Path alias nếu không có hành vi runtime riêng. Xóa `character` generic trước schema freeze.

### F0.3 — Property capability registry

Schema giữ property path ổn định, validator tra registry theo target type. Registry mô tả value type, animatable/bindable/public, min/max và runtime support. Reject path không tồn tại hoặc value sai kiểu ngay khi parse references.

### F0.4 — Limits và deterministic policy

Chốt max scenes/nodes/keys/path points/repeater count/effects, finite number policy, key ordering/duplicate time, ID length và nesting depth. Negative fixtures phải khóa từng limit.

Trạng thái: finite policy và mọi limit thuộc normative surface hiện tại đã khóa bằng 21 stress cases. Path/effects chưa tồn tại trong schema nên giới hạn point/effect sẽ được thêm cùng positive/negative fixtures S1/S2; Repeater list hiện bị khóa bởi `listItems` và sẽ có count/grid/radial limits riêng khi mở rộng ở S3.

## Thứ tự primitive cần fixture để thêm/siết schema

### S1 — Core geometry

1. Shape: rectangle, ellipse, polygon; fill/stroke/radius.
2. Path: line/cubic contours, open/closed, holes, fillRule.
3. Image/SVG typed fit/crop/alpha và bounds.
4. Group/Bone typed payload, inherit flags và rest transform.

Exit: authoring fixtures + expected Runtime JSON + negative topology/reference/value fixtures. Sau S1 mới có vocabulary geometry đáng tin cho AI.

### S2 — Composition

5. Mask/Clip: sourceId, clip/alpha/inverse-alpha, dependency cycle guard.
6. Multiple effects: ordered `effects[]` với stable effect ID; bắt đầu blur/shadow/glow/color-adjust.
7. Draw order/compositing: blend mặc định, subtree isolation và bounds policy.
8. Camera/scene transition typed contract.

Exit: compiler giữ đúng thứ tự canonical `raster → mask → effects → composite`; chưa cần pixel renderer để khóa JSON order/reference.

### S3 — Motion/expansion

9. Motion Path: pathId/progress/orient/offset.
10. Repeater count/list + linear/grid/radial + stagger; compile-time expansion.
11. Text Animator: grapheme/word/line + selector/stagger; compile-time expansion.
12. Normalized Path Morph: chỉ topology tương thích.

Exit: expected Runtime IR chứng minh Repeater/Text Animator đã biến mất; Motion Path/Morph còn literal modifier đã typed.

### S4 — Cut-out authoring contract

13. Part metadata và stable source mapping cho SVG import.
14. Bone chain/rest pose/prop attachment.
15. Variant Slot cho mouth/eye/hand/expression.
16. Named Action cho idle/blink/talk/wave/walk.
17. Lip-sync cue/marker sinh step keys.
18. Secondary Motion deterministic contract cho segmented chain.

Character là Component compose các object trên, không thêm `CharacterNode` runtime.

### S5 — Media timeline

19. Video trim/loop/mute/fit và audio-stream policy.
20. Audio trim/end/gain/fade/loop, role và overlap policy.
21. Marker/cue cho beat/phoneme/semantic events.
22. Font family/weight/fallback và locale coverage.

## P1/P2 chưa thêm vào normative schema

Particle emitter, trim path, dashed stroke animation, gradient animation, blend modes nâng cao, constraints và 2-bone IK chỉ chuyển sang normative sau khi P0 compositions cần chúng. Mesh, skinning, puppet/warp, physics, expressions, frame-by-frame và shader không thêm placeholder field vào v2. Proposal có thể nằm trong docs hoặc fixture draft ngoài thư mục positive, nhưng parser production phải reject.

## Cấu trúc fixture đích

```text
docs/fixtures/v2/
  primitives/<primitive>/
    positive.mvc.json hoặc positive.mt.json
    expected.runtime.json
    negative/
      missing-reference.json
      invalid-value.json
      over-limit.json
  compositions/
    geometry-mask-effects.mt.json
    repeater-text-motion-path.mt.json
    cutout-dialogue.mt.json
    media-timeline.mt.json
  assets/
  patches/
```

Mỗi expected Runtime file phải deterministic và review được bằng JSON diff. Negative fixtures là file thật, không chỉ mutate object trong test code.

## Kế hoạch thực thi đề xuất

### Sprint A — Schema hardening, 5–7 ngày

- Tạo fixture harness theo cấu trúc mới.
- Chuyển hai negative case hiện tại thành file.
- Thêm compiler goldens cho 5 Component/4 Project hiện tại.
- Chốt limits, key ordering, finite values và property registry interface.
- Quyết định/xóa `character`, chuẩn hóa vai trò `logo/icon`.

### Sprint B — Typed Node/Asset, 7–10 ngày

- F0.1–F0.4 và S1.
- Migrate toàn bộ fixture hiện tại khỏi generic payload/style.
- Không thêm compatibility parser vì chưa có dữ liệu production.

### Sprint C — P0 composition, 7–10 ngày

- S2 Mask/effects/camera-transition contract.
- Reference graph và order assertions.

### Sprint D — P0 motion expansion, 10–14 ngày

- S3 Motion Path/Repeater/Text Animator/Morph.
- Compiler expansion/modifier goldens và limit tests.

### Sprint E — Cut-out/media schema, 10–14 ngày

- S4 và S5.
- Khóa `cutout-dialogue` và `media-timeline` acceptance JSON.

Sau khoảng 6–8 tuần, ta có thể freeze Motion Format v2 cho AI authoring P0 dù browser preview chưa hoàn thiện. Khi đó renderer/preview được xây theo contract đã khóa thay vì vừa làm UI vừa đoán schema.

## Freeze gate

Chỉ freeze v2 khi:

- mọi Node/asset/effect/modifier là discriminated typed union;
- không còn generic `character` hay property path không validate;
- mỗi P0 primitive có positive, negative và expected Runtime fixture;
- mọi compile-time construct biến mất khỏi Runtime IR;
- reference graph và resource limits có test;
- bốn composition fixtures compile deterministic;
- AI capability registry chỉ expose surface đã qua các gate trên.
