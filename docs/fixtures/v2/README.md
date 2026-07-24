# Motion Format v2 — regression fixtures

Các fixture này là dữ liệu chuẩn cho contract v2 tại [`../../motion-format-v2.md`](../../motion-format-v2.md). Chúng được parse bằng Zod và kiểm tra reference qua:

```bash
pnpm validate:v2-fixtures
```

Coverage và thứ tự bổ sung acceptance tests: [`test-plan.md`](test-plan.md).

Compiler goldens được lưu tại `expected-runtime/`. Chỉ chạy `pnpm update:v2-goldens` khi thay đổi compiler là có chủ ý và đã review JSON diff; validation thông thường không tự ghi lại golden.

## Acceptance = workflow

Một fixture đạt khi đi hết chuỗi sau mà không truy cập internal Component từ Web/AI User:

1. Designer tạo/mở Component.
2. Publish `.mvc` bất biến theo `componentId@componentVersion`.
3. AI tạo `.mt`, thêm Component Node vào Scene.
4. AI điền text/màu/số qua project variables hoặc `payload.props`.
5. User Web sửa màu và tốc độ animation.
6. Compiler resolve dependency, bindings, repeat và value reference thành Runtime IR literal.
7. Renderer xuất MP4 với scene order và audio timeline.
8. Project cũ mở được từ package cache/bundle theo dependency đã pin.

Fail nếu AI User phải sửa component `nodes[]`, bone, clip hoặc track nội bộ.

## Bản đồ fixture

| File | Mục đích kiểm thử |
|---|---|
| `components/big-number.mvc.json` | Variables, Public API, bindings, animation rate reference |
| `components/compare.mvc.json` | Hai nhánh đối xứng và semantic public/internal |
| `components/timeline-steps.mvc.json` | List, item context và compile-time repeater |
| `components/mascot-wave.mvc.json` | Bone, SVG và variable reference trong keyframe |
| `components/product-showcase.mvc.json` | Component asset, image prop, CTA và binding 1→n |
| `projects/big-number-demo.mt.json` | Component Node và project binding |
| `projects/golden-product-promo.mt.json` | Dependency pinning, scene order và audio timeline |
| `projects/media-assets.mt.json` | Image opaque/alpha, SVG, font Việt, video silent/audio và ba audio roles |
| `projects/hierarchy-transform.mt.json` | Group/Bone/SVG hierarchy, pivot chain, inherited opacity, flip và prop attachment |
| `imports/svg-import-sources.json` | SVG phẳng từ Figma/Illustrator cho sanitize, group trong app và re-import |
| `patches/ai-fill-big-number.json` | Planner patch chỉ sửa public surface |
| `negative/components/*.json` | Missing parent, unsupported path/value/asset, asset mismatch, duplicate key time/ID, schedule cycle và schema limits |
| `negative/projects/*.json` | Project reference/dependency không hợp lệ |
| `negative/limits/cases.json` | Stress descriptors cho scene/node/clip/track/key/list/depth limits mà không commit JSON khổng lồ |
| `expected-runtime/*.runtime.json` | Runtime IR deterministic của từng positive Project fixture |

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

Lệnh này compile `hierarchy-transform.mt.json`, kiểm tra world-space tại shoulder/elbow/wrist, render SVG parts ở ba timestamp và ghi PNG vào `tmp/primitive-previews/`. Thư mục `tmp` là artifact cục bộ, không commit; mở trực tiếp các file PNG bằng Explorer hoặc editor để xem pose trước, pose gập tay và pose đã flip.

## Quy ước đã khóa

- Mọi artifact có `format` và `formatVersion`; Component dùng thêm `componentVersion`.
- Component Instance là Node `type: "component"` trong `scene.nodes[]`.
- Hierarchy chỉ dùng `parentId`; Node ID có scope theo Scene.
- Project binding target luôn có `sceneId` và `nodeId`.
- Public API ánh xạ `variableId`; consumer không thấy internal binding target.
- Authoring IR cho phép variable reference; Runtime IR chỉ chứa literal.
- Repeater là authoring directive và được compiler expand trước renderer.
- Asset ID khác URI; project pin Component bằng version + integrity.
- Asset declaration dùng discriminated union `image | svg | video | audio | font`; metadata kỹ thuật bắt buộc và được giữ nguyên vào Runtime IR.
- Audio và thứ tự Scene thuộc `timeline`, không thuộc `extensions`.
- Camera pan/rotation dùng transform; zoom dùng `payload.zoom`.
