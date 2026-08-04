# Motion Format v2 — regression fixtures

Các fixture này là dữ liệu chuẩn cho contract v2 tại [`../../motion-format-v2.md`](../../motion-format-v2.md). Chúng được parse bằng Zod và kiểm tra reference qua:

Vì sản phẩm còn ở giai đoạn pre-public và chưa có project v2 thật đang chạy, các fixture này là development baseline, không phải compatibility contract. Chúng được phép rebaseline trực tiếp theo [`../../v2-upgrade.md`](../../v2-upgrade.md); không cần giữ parser hoặc migrator cho fixture cũ.

```bash
pnpm validate:v2-fixtures
```

Machine-readable coverage ledger: [`primitives-coverage.json`](primitives-coverage.json) (asserted by `pnpm validate:v2-fixtures`).

Compiler goldens được lưu tại `expected-runtime/`. Chỉ chạy `pnpm update:v2-goldens` khi thay đổi compiler là có chủ ý và đã review JSON diff; validation thông thường không tự ghi lại golden.

Visual goldens được lưu tại `expected-frames/`. Chỉ chạy `pnpm update:v2-frame-goldens` khi pixel output thay đổi có chủ ý. `pnpm validate:primitives` so ảnh với tolerance theo channel và ghi `.diff.png` vào `tmp/primitive-previews/` khi sai; validation không tự nhận output mới.

## Acceptance = workflow

Một fixture đạt khi đi hết chuỗi sau mà không truy cập internal Component từ Web/AI User:

1. Designer tạo/mở Component (Component Factory tại `/factory`).
2. Publish `.mvc` bất biến theo `componentId@componentVersion` — ledger máy đọc được: [`registry/scene-components.json`](registry/scene-components.json).
3. AI tạo `.mt`, thêm Component Node vào Scene.
4. AI điền text/màu/số qua project variables hoặc `payload.props`.
5. User Web sửa màu và tốc độ animation.
6. Compiler resolve dependency, bindings, repeat và value reference thành Runtime IR literal.
7. Renderer xuất MP4 với scene order và audio timeline.
8. Project cũ mở được từ package cache/bundle theo dependency đã pin.

Fail nếu AI User phải sửa component `nodes[]`, bone, clip hoặc track nội bộ.

Product composition pack (12 `accept-*` projects + scorecard) phải đáp ứng acceptance catalog trong [`../../primitives-object.md`](../../primitives-object.md), kế hoạch kiểm thử trong [`../../v2-upgrade.md`](../../v2-upgrade.md) và ledger máy đọc được tại [`acceptance/scorecard.json`](acceptance/scorecard.json).

## Bản đồ fixture

| File | Mục đích kiểm thử |
|---|---|
| `components/big-number.mvc.json` | Variables, Public API, bindings, animation rate reference |
| `components/compare.mvc.json` | Hai nhánh đối xứng và semantic public/internal |
| `components/timeline-steps.mvc.json` | List, item context và compile-time repeater |
| `components/repeater-layouts.mvc.json` | Repeater list/count, none/linear/grid/radial, context binding và time stagger |
| `components/mascot-wave.mvc.json` | Bone, SVG và variable reference trong keyframe |
| `components/product-showcase.mvc.json` | Component asset, image prop, CTA và binding 1→n |
| `projects/big-number-demo.mt.json` | Component Node và project binding |
| `projects/golden-product-promo.mt.json` | Dependency pinning, scene order và audio timeline |
| `projects/media-assets.mt.json` | Image opaque/alpha, SVG, font Việt, video silent/audio và ba audio roles |
| `projects/hierarchy-transform.mt.json` | Group/Bone/SVG hierarchy, pivot chain, inherited opacity, flip và prop attachment |
| `projects/property-capabilities.mt.json` | Runtime Text tracks cho string, numeric interpolation và discrete color |
| `projects/geometry-paths.mt.json` | Rectangle/ellipse/polygon, open cubic Path, multi-contour evenodd hole và animated Paint |
| `projects/mask-compositing.mt.json` | Clip/alpha/inverse-alpha, mask-only/content-and-mask và nested mask graph |
| `projects/repeater-layouts.mt.json` | Stable Runtime IDs, exact layouts/tracks và không còn `repeat` |
| `projects/text-animator-unicode.mt.json` | Grapheme/word/line tiếng Việt, combining mark, emoji ZWJ, selector và stagger |
| `projects/motion-path.mt.json` | Arc-length progress, offsets, tangent orientation và source/target ở hierarchy khác nhau |
| `imports/svg-import-sources.json` | SVG phẳng từ Figma/Illustrator cho sanitize, group trong app và re-import |
| `patches/ai-fill-big-number.json` | Planner patch chỉ sửa public surface |
| `negative/components/*.json` | Missing parent, unsupported path/value/asset/node, mismatch, duplicate/cycle, non-finite number và schema limits |
| `negative/projects/*.json` | Project reference/dependency không hợp lệ |
| `negative/limits/cases.json` | Stress descriptors cho mọi public array hiện có và hierarchy depth mà không commit JSON khổng lồ |
| `expected-runtime/*.runtime.json` | Runtime IR deterministic của từng positive Project fixture |
| `expected-frames/*.png` | Stored pixel goldens tại timestamp cố định dùng cùng Runtime IR/evaluator với export |

## Asset kit

`assets/manifest.json` là nguồn sự thật cho binary fixtures. Validator kiểm tra đồng thời:

- mọi file có đúng byte size và SHA-256;
- image/video/audio có đúng codec, dimensions, duration, FPS, sample rate, channel và audio-stream policy;
- font đăng ký được với raster engine;
- mọi URI/thumbnail trong Project và Component trỏ tới asset có manifest;
- integrity pin trong artifact khớp SHA-256;
- declaration của năm asset family khớp manifest/probe về MIME, kích thước, codec, duration, FPS, alpha/audio policy, font và SVG viewBox;
- không có asset trong manifest mà chưa được ít nhất một fixture sử dụng.

Các asset đã được project owner xác nhận cho phép sử dụng trong automated fixtures và local preview. `video-silent.mp4` không có audio stream; `video-with-audio.mp4` có AAC để khóa hai trường hợp riêng biệt.

## Xem primitive preview

Chạy:

```bash
pnpm validate:primitives
```

Lệnh này compile fixtures hierarchy, geometry, mask, Repeater, Text Animator và Motion Path; kiểm tra clock/seed/world-space/bounds/hit-test/cubic extrema/mask graph/compile-time expansion/arc-length orientation, render mười stored PNG goldens rồi ghi preview vào `tmp/primitive-previews/`. Thư mục `tmp` là artifact cục bộ, không commit; mở trực tiếp PNG hoặc `.diff.png` để kiểm tra.

## Quy ước baseline hiện tại

- Mọi artifact có `format` và `formatVersion`; Component dùng thêm `componentVersion`.
- Component Instance là Node `type: "component"` trong `scene.nodes[]`.
- Node dùng discriminated payload/style schemas; Group không nhận field tùy ý và Runtime IR không nhận Component/repeat.
- `logo`, `icon`, `character` không phải Node type; chúng là semantic composition/Component.
- Hierarchy chỉ dùng `parentId`; Node ID có scope theo Scene.
- Project binding target luôn có `sceneId` và `nodeId`.
- Public API ánh xạ `variableId`; consumer không thấy internal binding target.
- Authoring IR cho phép variable reference; Runtime IR chỉ chứa literal.
- Repeater là authoring directive và được compiler expand trước renderer.
- Asset ID khác URI; project pin Component bằng version + integrity.
- Asset declaration dùng discriminated union `image | svg | video | audio | font`; metadata kỹ thuật bắt buộc và được giữ nguyên vào Runtime IR.
- Audio và thứ tự Scene thuộc `timeline`, không thuộc `extensions`.
- Camera pan/rotation dùng transform; zoom dùng `payload.zoom`.
