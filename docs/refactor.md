# Kiến trúc MotionVideo

> Cập nhật: 2026-07-25. Tiến độ milestone: [`roadmap-status.md`](roadmap-status.md).

## Thứ tự nguồn sự thật

1. [`motion-format-v2.md`](motion-format-v2.md) — contract normative cho `.mt`, `.mvc`, patch và Runtime IR.
2. `packages/motion-schema/src/v2.ts` — schema thực thi contract.
3. [`primitives-object.md`](primitives-object.md) — catalog capability và fixture coverage.
4. [`p0-schema-freeze-checklist.md`](p0-schema-freeze-checklist.md) — policy sau P0 freeze.
5. [`roadmap-status.md`](roadmap-status.md) — ledger done / remaining.
6. [`browser-preview-atomic-roadmap.md`](browser-preview-atomic-roadmap.md) — Web preview parity còn lại.
7. `docs/fixtures/v2` — regression fixtures.
8. [`../workflow.md`](../workflow.md) — luồng sản phẩm và definition of done (nếu có).

Nếu tài liệu và schema mâu thuẫn: sửa contract, schema, fixtures và consumer trong cùng thay đổi.

## Kiến trúc đã khóa

```text
Brief / Template
       ↓
Authoring Project + Component packages
       ↓ validate + compile
Normalized Runtime IR
literal nodes + literal tracks
       ↓
Frame evaluator → Raster workers → FFmpeg → MP4
```

Quyết định không mở lại nếu chưa có use case + fixture chứng minh cần đổi:

- Một `MotionProject` canonical trong application.
- Scene Node graph là spatial graph duy nhất; Component Instance cũng là Node.
- Project Variable và Component public props là bề mặt Web/AI User.
- Preset, binding, variable reference, repeater và Component package biến mất sau compile.
- Renderer chỉ nhận Normalized Runtime IR literal.
- Preview và export dùng chung property vocabulary, timing và evaluator.
- Component đã publish là immutable; project pin exact version và integrity.
- Cut-out: `sourceImports` + `cutoutRigs` + `bone.payload.restRotation` — không có Node `RestPose` / `RigMapper`.
- Character là Component compose từ Bone/Group/SVG/variants/actions, không có `CharacterNode`.

## Stack đã có

| Lớp | Dẫn chứng |
|---|---|
| Contract / validation | `packages/motion-schema` |
| Shared evaluator | `packages/motion-runtime` |
| Compiler + worker render | `apps/render-worker` |
| Template / AI planner | `packages/template-library`, `packages/ai-planner` |
| Web editor / preview | `apps/web` |
| Fixtures | `docs/fixtures/v2`, `pnpm validate:v2-fixtures`, `pnpm validate:primitives` |

## Việc còn lại (tóm tắt)

Chi tiết và evidence: [`roadmap-status.md`](roadmap-status.md).

- Browser preview / Canvas media / PNG Web parity (xem browser roadmap).
- P1 primitives chỉ khi có composition fixture thật (emitter, trim, dash, gradient, blend, IK…).
- Product infra: queue, storage, auth/billing, AI retrieval nâng cao.

## Quy tắc

- Capability **done** chỉ khi có schema ± fixture (và compiler/runtime khi có surface Runtime).
- Sau P0 freeze: PR schema kèm fixture ± và note breaking/non-breaking.
- Breaking format → bump `formatVersion` hoặc `extensions` namespace.
}