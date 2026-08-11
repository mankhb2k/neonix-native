# MotionVideo

MotionVideo là editor và render pipeline cho TVC motion graphic 2D tiếng Việt.
Hệ thống tạo project có cấu trúc từ brief/template, cho phép chỉnh nội dung,
brand, scene, node và timing trước khi xuất MP4.

Phạm vi đích gồm limited/cut-out character animation từ SVG rig được chuẩn bị
trong Figma và map lại trong app; không nhằm trở thành công cụ vẽ frame-by-frame.

## Canonical Format: Motion Project V3

**MotionProjectV3 is the ONLY authoring contract.** Tất cả product paths
(editor, compiler, runtime, preview, export, AI planner, MCP tools, Skill
templates) đều dùng chung format này.

```text
format: "motion-project"
formatVersion: 3
```

Parser chính thức (`parseMotionProject`) chỉ chấp nhận V3. Dữ liệu
`formatVersion: 2` bị từ chối với lỗi rõ ràng.

Tài liệu đầy đủ: [Motion Format V3](docs/motion-format-v3.md).
JSON Schema (Draft-07): `packages/motion-protocol/schema/v3.json`.

### Editor UI State

Editor UI state **không phải là một phần của V3 project JSON.**
Scroll position, selected node, undo stack, panel layout, zoom level,
playhead position — đây là local UI state, không được lưu vào project.
Project chỉ chứa dữ liệu authoring thuần túy.

### Kiến trúc

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

Contract: **[Motion Format V3](docs/motion-format-v3.md)** (canonical). V2 format: [đã loại bỏ](docs/motion-format-v2.md) (archive). Catalog: [Primitive objects](docs/primitives-object.md). Tiến độ: [roadmap-status](docs/roadmap-status.md). Kiến trúc: [refactor](docs/refactor.md). Freeze policy: [P0 schema freeze](docs/p0-schema-freeze-checklist.md). Browser preview: [roadmap](docs/browser-preview-atomic-roadmap.md). AI-first architecture: **[ai-first-editor-architecture](docs/ai-first-editor-architecture.md)**.

## Monorepo

| Package                     | Trách nhiệm                                                      |
| --------------------------- | ---------------------------------------------------------------- |
| `apps/web`                  | Next.js workspace/editor, import/export và local project storage |
| `apps/render-worker`        | Compiler, literal-track renderer, FFmpeg và upload adapter       |
| `packages/motion-protocol`  | Zod contract, reference validator và Runtime IR                  |
| `packages/template-library` | Seed project, block/preset registry và retrieval                 |
| `packages/ai-planner`       | Chọn template và tạo project đã validate                         |
| `packages/motion-grammar`   | Grammar Hook → Offer → CTA                                       |
| `packages/asset-registry`   | Asset/font policy                                                |
| `packages/shared`           | Kiểu dùng chung ngoài motion domain                              |

## Chạy local

Yêu cầu Node ≥ 20 và pnpm ≥ 9.

```bash
pnpm install
pnpm dev
```

AI User workspace mới dùng chung server Next.js nhưng tách route khỏi editor hiện tại.

- Landing: `http://localhost:3000`
- App: `http://localhost:3000/app`
- AI User: `http://localhost:3000/appai`
- Block Lab: `http://localhost:3000/app/lab/blocks`
- Render worker: `pnpm dev:worker`

Block Lab là cách xem nhanh preview của motion blocks. Các JSON trong `assets/` là regression data để khóa contract/compiler và không phải dữ liệu người dùng. Riêng fixture hierarchy SVG có thể render thành PNG cục bộ bằng `pnpm validate:primitives`.

## Kiểm tra

```bash
pnpm typecheck
pnpm validate:motion-fixtures
pnpm validate:primitives
pnpm e2e:render
pnpm e2e:web
```

- `validate:motion-fixtures` parse Component, Project và AI Patch, kiểm tra reference lỗi và compiler expansion.
- `validate:primitives` kiểm tra world transform/Bone/SVG/effects và tạo PNG goldens tại `tmp/primitive-previews`.
- `e2e:render` compile project, raster frame và encode một MP4 thật.
- `e2e:web` chạy Playwright trên `http://127.0.0.1:3000` (AI User: `/appai`). Trên Windows nên mở sẵn `pnpm dev` rồi chạy `pnpm e2e:web` để reuse server; Playwright cũng tự start Next nếu cổng trống.
- `test:preview-parity` chạy E2E Runtime IR harness (`/appai/runtime-harness`) so transform tại t=0/1/1.5 với worker.

Trạng thái từng phase, commit tương ứng và các gap còn lại: [`docs/roadmap-status.md`](docs/roadmap-status.md).

## Trạng thái render

Giữ pipeline hiện tại: Authoring compiler → Runtime IR → raster workers → FFmpeg. Đây là ranh giới đúng để preview/export cùng dựa trên dữ liệu literal và để renderer không phụ thuộc template hay schema authoring.

World transform/parenting, shared evaluator và SVG/image asset resolver đã có trong worker. Phần cần mở rộng tiếp theo là đưa cùng Runtime IR/evaluator vào browser preview, rồi triển khai shape/mask và audio mix.

## Quy tắc đóng góp

- Không thêm parser tương thích cho format đã bỏ; dữ liệu sai version phải báo lỗi rõ ràng.
- Không cho renderer đọc preset, variable, binding, repeater hoặc Component package.
- Mọi thay đổi contract phải cập nhật schema, docs và fixtures cùng lúc.
- Chạy typecheck, fixture validation và render smoke test trước khi commit.

Private project; chưa công bố license.
