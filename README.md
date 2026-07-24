# MotionVideo

MotionVideo là editor và render pipeline cho TVC motion graphic 2D tiếng Việt. AI tạo hoặc điền một project có cấu trúc; người dùng vẫn sửa được nội dung, brand, scene, node và timing trước khi xuất MP4.

## Phạm vi sản phẩm

- TVC 15–30 giây cho F&B, spa, bán lẻ và SME.
- Kinetic text, logo, shape, image, camera 2D, component tái sử dụng và audio timeline.
- Template/grammar quảng cáo Việt Nam và font có kiểm tra dấu tiếng Việt.
- Không phải trình sinh pixel cinematic và không nhằm thay thế toàn bộ After Effects.

## Một kiến trúc canonical

```text
Prompt / Template / Import v1
              │
              ▼
       Authoring IR v2 (.mt/.mvc)
       Node graph + Clips + Variables
       Components + Bindings + Timeline
              │
              ▼ compile
       Normalized Runtime IR
       literal Nodes + literal Tracks
              │
              ▼
       Reference renderer → Frames → FFmpeg → MP4
```

Nguyên tắc bắt buộc:

1. `MotionProject` trong application code luôn là v2.
2. V1 chỉ là định dạng import legacy: parse v1 → migrate → v2 ngay tại biên hệ thống.
3. Component Instance là Node trong `scene.nodes[]`; không có graph `instances[]` thứ hai.
4. Preset, variable reference, binding và repeater chỉ tồn tại trong Authoring IR; renderer không diễn giải chúng.
5. Web/AI User chỉ sửa Project Variable và Component public props; internal node/bone/track của `.mvc` được đóng gói.
6. Preview và export dùng chung property vocabulary và transform convention.

Contract: [Motion Format v2](docs/motion-format-v2.md). Quyết định kiến trúc: [refactor.md](docs/refactor.md).

## Motion Format v2

Project dùng identity rõ ràng:

```json
{
  "format": "motion-project",
  "formatVersion": 2,
  "metadata": {
    "id": "project.demo",
    "name": "Demo",
    "aspectRatio": "9:16",
    "fps": 30,
    "locale": "vi-VN",
    "brand": { "name": "Brand", "primaryColor": "#D9381E" }
  },
  "dependencies": { "components": [] },
  "assets": [],
  "variables": [],
  "timeline": { "sceneOrder": ["scene.hook"], "audioTracks": [] },
  "scenes": [],
  "bindings": [],
  "extensions": { "constraints": [], "events": [] }
}
```

`.mvc` tách `formatVersion` khỏi `componentVersion`. Component package đã publish phải bất biến và project pin exact version + integrity.

## Monorepo

| Package | Trách nhiệm |
|---|---|
| `apps/web` | Next.js workspace/editor, import/export và local project storage |
| `apps/render-worker` | Authoring compiler, literal-track renderer, FFmpeg và upload adapter |
| `packages/motion-schema` | Zod v2, reference validator, Runtime IR và v1 migration boundary |
| `packages/template-library` | Seed project v2, block/preset registry và retrieval |
| `packages/ai-planner` | Chọn template và sinh project v2 đã validate |
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
- Worker: `pnpm dev:worker`

## Kiểm tra

```bash
pnpm typecheck
pnpm validate:v2-fixtures
pnpm e2e:render
```

`validate:v2-fixtures` parse 5 Component, 2 Project và 1 AI Patch; đồng thời kiểm tra reference hỏng bị từ chối. `e2e:render` compile template v2 thành Runtime IR, raster frame và encode MP4 thật.

## Trạng thái

Đã có:

- Canonical v2 xuyên schema, template, planner, editor, storage, export và worker.
- Import/localStorage v1 được migrate sang v2 khi đọc.
- Node/Clip editor cơ bản, template retrieval và preset registry.
- Authoring compiler loại preset/reference/binding trước runtime.
- Reference renderer đa worker và FFmpeg export.
- Golden fixtures cho Component API, dependency, list/repeater, camera và audio.

Đang hoàn thiện:

- Component package resolver/cache cho production và portable bundle.
- Repeater/component compiler đầy đủ cho mọi nested case.
- Preview browser dùng cùng evaluator track với worker.
- Transition, audio mix production, cloud queue/upload, auth/billing và LLM planner thật.

## Quy tắc đóng góp

- Không thêm feature mới vào `legacy-v1.ts`.
- Không import type v1 ngoài migration/test.
- Không cho renderer đọc preset, variable, binding, repeater hoặc Component package.
- Mọi thay đổi contract phải cập nhật schema, docs và fixtures cùng lúc.
- Chạy typecheck và fixture validation trước khi commit.

Private project; chưa công bố license.
