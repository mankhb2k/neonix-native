# Motion Format v2 — regression fixtures

Các fixture này là dữ liệu chuẩn cho contract v2 tại [`../../motion-format-v2.md`](../../motion-format-v2.md). Chúng được parse bằng Zod và kiểm tra reference qua:

```bash
pnpm validate:v2-fixtures
```

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
| `patches/ai-fill-big-number.json` | Planner patch chỉ sửa public surface |

## Quy ước đã khóa

- Mọi artifact có `format` và `formatVersion`; Component dùng thêm `componentVersion`.
- Component Instance là Node `type: "component"` trong `scene.nodes[]`.
- Hierarchy chỉ dùng `parentId`; Node ID có scope theo Scene.
- Project binding target luôn có `sceneId` và `nodeId`.
- Public API ánh xạ `variableId`; consumer không thấy internal binding target.
- Authoring IR cho phép variable reference; Runtime IR chỉ chứa literal.
- Repeater là authoring directive và được compiler expand trước renderer.
- Asset ID khác URI; project pin Component bằng version + integrity.
- Audio và thứ tự Scene thuộc `timeline`, không thuộc `extensions`.
- Camera pan/rotation dùng transform; zoom dùng `payload.zoom`.
