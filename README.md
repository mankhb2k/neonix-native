# MotionVideo

MotionVideo là editor và render pipeline cho TVC motion graphic 2D tiếng Việt. Hệ thống tạo project có cấu trúc từ brief/template, cho phép chỉnh nội dung, brand, scene, node và timing trước khi xuất MP4.

Phạm vi đích gồm limited/cut-out character animation từ SVG rig được chuẩn bị trong Figma và map lại trong app; không nhằm trở thành công cụ vẽ frame-by-frame.

## Kiến trúc

```text
Brief / Template
       ↓
Authoring IR (.mt/.mvc)
Node graph + Clips + Variables + Components + Bindings
       ↓ compile
Normalized Runtime IR
literal Nodes + literal Tracks
       ↓
Raster frames → FFmpeg → MP4
```

Chỉ có một model project trong application code: `MotionProject`. Parser chỉ nhận canonical format hiện tại; dữ liệu không đúng contract bị từ chối, không có migrator hay compatibility alias.

Các nguyên tắc chính:

- Component Instance là một Node trong `scene.nodes[]`; không tồn tại spatial graph thứ hai.
- Preset, variable reference, binding và repeater được compiler giải quyết trước runtime.
- Renderer chỉ đọc Node và Track literal trong Normalized Runtime IR.
- AI User và Web chỉ sửa Project Variable, text Node và public props của Component.
- Preview và export phải tiến tới dùng chung property vocabulary, transform convention và track evaluator.

Contract đầy đủ: [Motion Format](docs/motion-format-v2.md). Catalog nguyên tử: [Primitive objects](docs/primitives-object.md). Tiến độ: [Kiến trúc và lộ trình refactor](docs/refactor.md). Hướng nhân vật SVG: [SVG cut-out plan](docs/svg-cutout-plan.md). Thiết kế primitive: [Atomic primitives plan](docs/atomic-primitives-plan.md).

## Monorepo

| Package | Trách nhiệm |
|---|---|
| `apps/web` | Next.js workspace/editor, import/export và local project storage |
| `apps/render-worker` | Compiler, literal-track renderer, FFmpeg và upload adapter |
| `packages/motion-schema` | Zod contract, reference validator và Runtime IR |
| `packages/template-library` | Seed project, block/preset registry và retrieval |
| `packages/ai-planner` | Chọn template và tạo project đã validate |
| `packages/motion-grammar` | Grammar Hook → Offer → CTA |
| `packages/asset-registry` | Asset/font policy |
| `packages/shared` | Kiểu dùng chung ngoài motion domain |

## Chạy local

Yêu cầu Node ≥ 20 và pnpm ≥ 9.

```bash
pnpm install
pnpm dev
```

- Landing: `http://localhost:3000`
- App: `http://localhost:3000/app`
- Block Lab: `http://localhost:3000/app/lab/blocks`
- Render worker: `pnpm dev:worker`

Block Lab là cách xem nhanh preview của motion blocks. Các JSON trong `docs/fixtures/v2` là regression data để khóa contract/compiler; chúng không tự tạo preview và không phải dữ liệu người dùng.

## Kiểm tra

```bash
pnpm typecheck
pnpm validate:v2-fixtures
pnpm e2e:render
```

- `validate:v2-fixtures` parse Component, Project và AI Patch, kiểm tra reference lỗi và compiler expansion.
- `e2e:render` compile project, raster frame và encode một MP4 thật.

## Trạng thái render

Giữ pipeline hiện tại: Authoring compiler → Runtime IR → raster workers → FFmpeg. Đây là ranh giới đúng để preview/export cùng dựa trên dữ liệu literal và để renderer không phụ thuộc template hay schema authoring.

Phần cần mở rộng tiếp theo nằm trong implementation, không phải thay kiến trúc: world transform/parenting, image/shape/mask, asset resolver, audio mix và dùng chung track evaluator với browser preview.

## Quy tắc đóng góp

- Không thêm parser tương thích cho format đã bỏ; dữ liệu sai version phải báo lỗi rõ ràng.
- Không cho renderer đọc preset, variable, binding, repeater hoặc Component package.
- Mọi thay đổi contract phải cập nhật schema, docs và fixtures cùng lúc.
- Chạy typecheck, fixture validation và render smoke test trước khi commit.

Private project; chưa công bố license.
