# Motion Format v2 — authoring contract

Đây là contract normative duy nhất cho `.mt` và `.mvc`. Schema thực thi nằm tại `packages/motion-schema/src/v2.ts`; API không có hậu tố version luôn trả canonical format hiện tại. Input không đúng contract bị từ chối và không có migration boundary.

> **Trạng thái pre-public:** quyết định freeze P0 ngày `2026-07-25` đã được chủ động gỡ bỏ. Vì chưa có project v2 thật đang chạy, schema được rebaseline trực tiếp theo [`v2-upgrade.md`](v2-upgrade.md), vẫn giữ `formatVersion: 2` và không duy trì compatibility layer hay migrator cho baseline thử nghiệm cũ. Chỉ freeze lại v2 sau khi hoàn tất các gate Core 2.5D.

## Surface baseline hiện tại (đang được rebaseline)

| Family | In P0 |
|---|---|
| Nodes | `group`, `bone`, `text`, `shape`, `path`, `image`, `svg`, `video`, `camera`, `component` (authoring only) |
| Assets | `image`, `svg`, `video`, `audio`, `font` discriminated metadata |
| Paint | Solid string fill/stroke **or** linear/radial gradient fill; dash[] + animatable dashOffset; cap/join |
| Transitions | `cut`, `fade`, `crossfade` only |
| Effects | `blur`, `shadow`, `glow`, `color-adjust` ordered stack |
| Blend | `normal`, `multiply`, `screen`, `add` on Node |
| Modifiers | Motion Path, Path Morph, Secondary Motion, Trim Path, Path Bend, Constraint (look-at/copy-position/copy-rotation) |
| Expansion | Repeater, Text Animator, Component, lip-sync cues (compile away) |
| Values | Variables + bindings + public params; resolvable refs on typed clip/track/playback/params only (`text.payload.text` stays `string`) |
| Patch | `set` on project variables or Component Instance `payload.props.*` |
| Cut-out | `sourceImports` + `cutoutRigs` + `bone.payload.restRotation` (no `RestPose` / `RigMapper` node types) |

### Explicitly not in P0

Emitter, 2-bone IK, mesh/skinning, audio markers, wipe transitions, constraint `pin`, animated gradient stops, and any generic `character` node. Reject fixtures live under `docs/fixtures/v2/negative/p1-not-normative/`. Inspector/timeline/canvas UI schemas are out of format scope.

## Artifact và version

```text
Project   { format: motion-project,   formatVersion: 2 }
Component { format: motion-component, formatVersion: 2, componentVersion: semver }
Patch     { format: motion-patch,     formatVersion: 1, baseRevision, operations }
```

Trong giai đoạn pre-public rebaseline, `formatVersion` giữ nguyên là `2`; fixtures và goldens cũ được viết lại trực tiếp thay vì migrate. Sau lần public đầu tiên, thay đổi breaking mới phải tăng format version và có migration contract rõ ràng. `componentVersion` điều khiển compatibility của public contract; package đã publish là bất biến.

## Authoring IR và Runtime IR

```text
.mt / .mvc Authoring IR
  nodes + component nodes + variables + bindings
  preset/tracks + variable references + repeat directives
                         │ compile
                         ▼
Normalized Runtime IR
  literal nodes + literal tracks + literal key values
  không preset, variable reference, binding, repeat hoặc component package
```

Renderer chỉ đọc Normalized Runtime IR.

## Numeric và resource policy

Mọi number trong typed fields lẫn generic JSON phải hữu hạn; parser reject NaN/Infinity, kể cả khi JSON hợp lệ như `1e400` được JavaScript đọc thành Infinity. Transform dimensions, scale, media duration/FPS, playback iterations và các numeric domain khác có hard limit trong `MOTION_V2_LIMITS`.

Mọi public array hiện có—asset, variable, public param, dependency, binding, scene, node, clip, track, key, audio track, extension entry, patch operation, enum option, locale, semantic tags, polygon points, Path contours và Path segments—đều có trần schema. Repeater có hard limit cho count và grid columns; effect stack chỉ nhận limit khi primitive tương ứng được thêm cùng fixture.

## Scene graph

Mọi spatial entity thuộc đúng một Scene. Component Instance là Node:

```json
{
  "id": "inst.hero",
  "type": "component",
  "parentId": null,
  "zIndex": 2,
  "transform": {},
  "payload": {
    "componentId": "comp.hero",
    "componentVersion": "1.0.0",
    "props": {}
  }
}
```

Không có top-level `instances[]`. Parenting, masking, draw order và clip targeting dùng cùng Node graph. Node ID chỉ unique trong Scene; mọi project-level target phải chứa `sceneId`.

`NodeV2` là discriminated union, không có `payload` hoặc `style` JSON tự do:

- Group không nhận payload/style; Bone chỉ nhận length/rest rotation.
- Text, Shape, Path, Image, SVG, Video và Camera có payload riêng, strict theo family.
- Component Instance tồn tại trong Authoring IR và phải được compiler expand; Runtime IR không chấp nhận Component hoặc `repeat`.
- `logo` và `icon` là semantic role được compose bằng Text/Image/SVG/Component, không phải Node type.
- Character là Component từ Group/Bone/SVG/variants/actions, không có `CharacterNode`.
- Shape hỗ trợ rectangle/ellipse/polygon. Path hỗ trợ nhiều contour, line/cubic, open/closed và `fillRule: nonzero|evenodd`; mọi tọa độ phải finite.

Paint hỗ trợ solid string **hoặc** gradient object (`linear-gradient` / `radial-gradient` với stops literal). Stroke vẫn solid string; `dash` / `dashOffset` cho nét đứt (offset animatable). Fill, opacity, stroke width, rectangle radius và trim-path start/end/offset animate qua capability registry. Path morph, path bend và secondary motion thuộc modifier stack. Runtime bounds dùng cực trị Bézier thật và nới nửa stroke width đã evaluate.

## Cut-out mapping model

Cut-out characters không thêm Node type `RestPose` hay `RigMapper`. Normative mapping:

- `sourceImports[]` — SVG export parts → output assets + node ids + structural fingerprints
- `cutoutRigs[]` — part → parent/pivot/z-order/semantic slots
- `bone.payload.restRotation` — rest pose on Bone nodes

Variant slots, named actions và lip-sync cues sống trên Component metadata và compile ra literal tracks/nodes.

Mỗi Node có tối đa một quan hệ `mask { sourceNodeId, mode, sourceVisibility }`. `mode` là `clip | alpha | inverse-alpha`; nguồn phải cùng Scene. `mask-only` ẩn nguồn khỏi compositing/hit-test bình thường, còn `content-and-mask` giữ nguồn như content. Mask lồng nhau được phép, nhưng graph thiếu nguồn hoặc có cycle bị reject trước compiler.

## Public API và binding

Public param có thể khai báo metadata UI (optional): `group` (`content|style|motion|layout|audio`), `control` (`text|textarea|color-picker|slider|toggle|asset-picker|enum`), `capability` (`basic|advanced|designer-only`, mặc định `basic`). Component Factory `/factory` dùng các field này để sinh Controls.

```text
Component default variable
        ↓ overridden by instance prop mapped through Public API
Resolved component variable
        ↓ internal bindings
Internal nodes / clips / tracks
```

Project binding có độ ưu tiên cao hơn literal instance prop:

```text
Component default < Instance payload.props < Project binding
```

Khi một prop đang bound, UI sửa source Project Variable. Muốn sửa local phải detach binding trước. Một variable điều khiển nhiều target bằng nhiều binding record. Mỗi target property chỉ được một binding (duplicate target bị reject).

Web/AI User chỉ được sửa Project Variable và Component Node `payload.props`. Internal semantic, node, bone, clip và track chỉ dành cho Designer/AI Author. Patch `set` tuân cùng public surface.

## Resolvable value

Authoring value là literal hoặc variable reference:

```json
{
  "ref": { "kind": "variable", "id": "var.speed" },
  "map": { "scale": 1, "offset": 0 }
}
```

MVP chỉ hỗ trợ reference, numeric scale và offset trên các field resolvable đã typed (clip/track/playback/params). `text.payload.text` và các payload string tương tự giữ `string` thuần — không nhúng ref vào mọi field. Compiler phải type-check rồi resolve trước Runtime IR; không có expression engine tổng quát.

## Property capability registry

Mỗi property normative đăng ký `valueKind`, `animatable`, `bindable`, `public`, numeric domain và `runtimeSupport`. Authoring validator dùng registry cho track/binding; Runtime schema kiểm tra lại target, property, support state và literal domain. `compile-time` nghĩa property có thể được binding/resolve trước compile nhưng không được phép xuất hiện như Runtime Track.

AI và schema-driven controls chỉ enumerate property có `public: true`; việc một field tồn tại trong Node schema không tự động cho phép AI animate field đó.

Capability public/AI được xuất từ ledger `docs/fixtures/v2/primitives-coverage.json` (gate thật) vào `ai-capability-manifest.json` khi chạy `pnpm validate:v2-fixtures`. `transform.depth`, parallax modifier và Adjustment node chưa ship — ledger `planned-p0` (R4/R5), không quảng cáo `runtimeSupport: "evaluated"`.

Unknown Clip `presetId` không còn silent fallback sang `fade-in`: compiler chỉ expand `COMPILED_PRESET_IDS` và throw `Unknown preset: …`. Cycle extrapolation hỗ trợ `mode: "repeat" | "pingpong"`.

## List và repeater

Variable list khai báo `itemSchema`. Node template có `repeat.source` dạng `list { variableId, keyPath }` hoặc `count { count, keyPrefix }`; layout là `none`, `linear`, `grid` hoặc `radial`. Binding con có source `context`, ví dụ `item.title`. Compiler clone subtree/binding/clip bằng ID deterministic, áp `timeStagger`, canonicalize timestamp và xóa directive khỏi Runtime IR. Count, list item và grid columns đều có hard limit; renderer không biết Repeater.

## Text Animator

Text Node authoring có thể khai báo một `textAnimator` gồm stable ID, unit `grapheme | word | line`, locale, selector chuẩn hóa 0..1, start/duration/stagger/easing và các from-properties offset/rotation/scale/opacity/fill. Compiler dùng `Intl.Segmenter`, vì vậy combining mark, emoji ZWJ và skin-tone modifier không bị split theo UTF-16. Nó sinh Text run + literal tracks, canonicalize timestamp và xóa Node nguồn/textAnimator khỏi Runtime IR. Unit count có hard limit; Text Animator Node không được làm parent, mask source hoặc target của authored clip/track—hãy animate parent nếu cần chuyển động toàn khối.

## Motion Path modifier

Mọi drawable/transform Node có thể có tối đa một modifier `motion-path` với stable `id`, `pathNodeId`, `contourId`, literal `progress` trong `[0,1]`, `orientToPath`, `rotationOffset` và normalized `startOffset/endOffset`. Track animate đúng path `modifiers.<id>.progress`; compiler giữ modifier và track literal trong Runtime IR, đồng thời namespace reference khi expand Component.

Path source phải cùng Scene, có type `path`, chứa contour được tham chiếu và contour phải có chiều dài khác zero. Authoring lẫn Runtime IR đều reject modifier ID trùng, nhiều Motion Path trên một Node, offset đảo, source là descendant của target và dependency cycle. Evaluator dùng bảng arc-length deterministic với 32 mẫu cho mỗi cubic segment; line và closing segment giữ nguyên. Point/tangent của source được chuyển sang world-space rồi về parent-space của target, nên source và target có thể thuộc các hierarchy transform khác nhau. `orientToPath` đặt rotation theo tangent cộng `rotationOffset`; hidden Path vẫn được dùng làm motion resource.

## Clip timing

- Scene duration, schedule, clip duration và key `t` đều tính bằng giây.
- Schedule là scene-relative; key `t` là clip-relative từ 0.
- `absolute.at`, `after.clipId` và `with.clipId` thay trigger/start/delay mơ hồ.
- Playback dùng `iterations`, `direction` và `rate`.
- Compiler reject dependency cycle và clip vượt policy Scene.
- Frame time canonical là `frameIndex / fps`; preview/export không dùng wall clock để evaluate composition.
- Mọi stochastic primitive tương lai phải lấy sample bằng `(seed, channel, sampleIndex)` thuần, không dùng `Math.random()` hoặc state phụ thuộc thứ tự render frame.

## Transform và camera

- `anchorX/Y` normalized trong `[0,1]`.
- `scaleX/Y >= 0`; phản chiếu chỉ dùng `flipX/Y`.
- rotation dùng degree, chiều Canvas; visible dùng step interpolation.
- Với column-vector convention, local matrix là `T(x,y) · R(rotation) · S(scale × flipSign) · T(-anchor × size)`; world matrix là `parentWorld · local` sau khi áp dụng inherit flags.
- Camera pan dùng `transform.x/y`, rotation dùng `transform.rotation`, zoom dùng duy nhất `payload.zoom`.
- Camera projection chỉ hỗ trợ `orthographic`. Renderer map camera center vào canvas center bằng `T(viewCenter) · R(-rotation) · S(zoom) · T(-cameraPosition)` sau source-size scaling; Camera Node không tự vẽ.
- World bounds là AABB của bốn góc local `[0,width] × [0,height]` sau world matrix; subtree bounds mặc định chỉ union drawable descendants.
- Hit-test đổi world point về local bằng inverse world matrix, loại node hidden/opacity 0 và trả kết quả theo draw order giảm dần.
- Mask/Effects phải xin offscreen plan từ bounds đã tính; plan làm tròn ra ngoài và reject dimension/pixel budget trước khi cấp phát surface.

## Asset, dependency và offline

Asset reference luôn là ID; URI chỉ nằm trong asset manifest. Project pin mỗi Component bằng `componentId`, exact version, source và integrity. Integrity không tự bảo đảm offline: loader phải lấy đúng package từ portable bundle hoặc content-addressed cache trước khi compile.

Asset declaration là discriminated union theo `assetType`; không dùng metadata record tự do:

| Family | Metadata bắt buộc |
|---|---|
| `image` | `mimeType`, `width`, `height`, `pixelFormat`, `hasAlpha` |
| `svg` | `mimeType: image/svg+xml`, `width`, `height`, `viewBox`, `sanitized: true` |
| `video` | `mimeType`, dimensions, `duration`, `fps`, `videoCodec`, `pixelFormat`, `hasAudio`; video có audio bắt buộc thêm codec/sample rate/channels |
| `audio` | `mimeType`, `duration`, `codec`, `sampleRate`, `channels` |
| `font` | `mimeType`, `family`, `weight`, `style`, `localeCoverage` |

Schema reject ảnh có `hasAlpha` mâu thuẫn với pixel format và reject video có audio metadata không khớp `hasAudio`. Fixture validator tiếp tục đối chiếu declaration với hash và media probe; compiler giữ nguyên metadata đã xác thực trong Runtime IR để renderer không phải đoán lại.

## Timeline và audio

Project `timeline.sceneOrder` là thứ tự phát canonical. Mỗi Scene có thể khai báo `transition` ra Scene kế tiếp: `cut` (duration 0/omitted), hoặc `fade`/`crossfade` với duration dương có giới hạn và không vượt hai Scene kề nhau. Với fade/crossfade, authored Scene duration được giữ nguyên nhưng global timeline overlap `duration` giây; Runtime frame plan blend hai Scene ở overlap (0→1 incoming, 1→0 outgoing). `timeline.audioTracks` chứa BGM, voiceover và SFX với start/trim/volume/loop/fade. `extensions` chỉ dành cho constraints và events chưa thuộc runtime lõi.

## Semver và semantic

Major chỉ khi public observable contract không tương thích: xóa/đổi type hoặc nghĩa prop, public semantic/control/event/slot, hoặc hành vi đã cam kết mà không migrate được. Internal ID/hierarchy không ảnh hưởng semver trừ khi đã được expose. Internal timing vẫn có thể breaking nếu làm sai bảo đảm sync công khai.

Semantic có `{ role, key?, tags[] }`. Role không unique; `key` chỉ là public address khi được expose trên Public API.
