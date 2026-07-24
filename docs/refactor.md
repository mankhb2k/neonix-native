# Kiến trúc và lộ trình refactor MotionVideo

> Tài liệu sống — cập nhật lần cuối: 2026-07-24.

Tài liệu này trả lời ba câu hỏi: kiến trúc nào đã được khóa, hệ thống đã triển khai đến đâu, và việc tiếp theo phải làm theo thứ tự nào. Khi implementation thay đổi, checklist và dẫn chứng trong tài liệu này phải được cập nhật cùng pull request.

## Thứ tự nguồn sự thật

1. [`motion-format-v2.md`](motion-format-v2.md) là contract normative cho `.mt`, `.mvc`, patch và Runtime IR.
2. `packages/motion-schema/src/v2.ts` là schema thực thi contract.
3. Tài liệu này là decision log, trạng thái triển khai và roadmap.
4. [`primitives-object.md`](primitives-object.md) là catalog capability và fixture coverage.
5. [`browser-preview-atomic-roadmap.md`](browser-preview-atomic-roadmap.md) là lịch triển khai preview parity và test gates theo milestone.
5. [`../workflow.md`](../workflow.md) mô tả luồng sản phẩm và definition of done.
6. `docs/fixtures/v2` khóa các use case và regression compiler.

Nếu tài liệu và schema mâu thuẫn, chưa được tự chọn một bên: sửa contract, schema, fixtures và consumer trong cùng thay đổi.

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

Các quyết định không mở lại nếu chưa có use case và fixture chứng minh cần đổi:

- Application chỉ có một `MotionProject` canonical.
- Scene Node graph là spatial graph duy nhất; Component Instance cũng là Node.
- Project Variable và Component public props là bề mặt chỉnh sửa an toàn cho Web/AI User.
- Preset, binding, variable reference, repeater và Component package phải biến mất sau compile.
- Renderer chỉ nhận Normalized Runtime IR literal.
- Preview và export phải dùng chung property vocabulary, timing và evaluator.
- Component đã publish là immutable; project pin exact version và integrity.

Mục tiêu animation nhân vật là limited/cut-out 2D từ SVG đã thiết kế sẵn, không phải frame-by-frame hay organic character suite. Proposal character vertical slice: [`svg-cutout-plan.md`](svg-cutout-plan.md). Thiết kế Path, Mask, Motion Path, Text Animator, Repeater, Effects, Morph và Secondary Motion: [`atomic-primitives-plan.md`](atomic-primitives-plan.md).

## Đã triển khai

### Contract và validation

- [x] Zod schema cho Project, Component, Node, Clip, Variable, Binding, Timeline và Runtime IR.
- [x] Reference validation cho parent, target, cycle và Component dependency.
- [x] API canonical `parseMotionProject`/`serializeMotionProject`.
- [x] Parser tương thích, migrator và alias định dạng cũ đã được loại bỏ.
- [x] AI Patch có schema riêng qua `MotionPatchSchema`.

Dẫn chứng: `packages/motion-schema/src/index.ts`, `packages/motion-schema/src/v2.ts`.

### Template, planner và Web

- [x] Template seed sinh canonical Project.
- [x] Registry block/preset dùng ID canonical, không resolve alias ngầm.
- [x] AI planner trả project đã qua validation.
- [x] Next.js editor, local storage, import và export dùng `MotionProject` canonical.
- [x] Block Lab cho phép xem nhanh block animation tại `/app/lab/blocks`.

Dẫn chứng: `packages/template-library`, `packages/ai-planner`, `apps/web`.

### Compiler

- [x] Resolve schedule tuyệt đối/tương đối và playback rate.
- [x] Apply Project binding và Component public props.
- [x] Expand Component namespace và repeater.
- [x] Resolve variable reference.
- [x] Expand preset thành literal tracks.
- [x] Runtime output được parse lại bằng `NormalizedMotionProjectV2Schema`.

Dẫn chứng: `apps/render-worker/src/compiler/index.ts`.

### Render

- [x] Frame plan và raster đa worker.
- [x] Literal track evaluator cơ bản.
- [x] Text/logo reference drawing.
- [x] FFmpeg encode MP4 H.264 thật.
- [x] E2E hiện render được project 20 giây, 240 frame ở 540×960.

Dẫn chứng: `apps/render-worker/src/runtime`, `apps/render-worker/src/e2e.ts`.

### Regression và tài liệu

- [x] Fixtures cho Component API, dependency, repeater/list, camera và audio contract.
- [x] Negative tests cho reference hỏng và dependency không pin.
- [x] Golden compiler test đảm bảo Component không lọt vào Runtime IR.
- [x] Asset fixture kit có manifest/hash/probe cho image, SVG, font, audio và video.
- [x] Media compiler fixture giữ đủ asset, node type, audio role và text tiếng Việt.
- [x] README và workflow đã đồng bộ với canonical architecture.

Lệnh kiểm tra hiện tại:

```bash
pnpm typecheck
pnpm validate:v2-fixtures
pnpm validate:primitives
pnpm e2e:render
```

## Khoảng trống còn lại

### P0 — Runtime foundation cho preview và SVG cut-out

- [x] Tách track evaluator và transform math thành package `@motionvideo/motion-runtime` dùng chung được.
- [ ] Browser preview compile Project sang Runtime IR thay vì mô phỏng preset bằng CSS.
- [x] Thêm fixed-time assertions và visual smoke PNG cho hierarchy SVG tại `pnpm validate:primitives`.
- [ ] World matrix, pivot, inherit flags và z-order chạy giống nhau trên preview/export.
- [x] Thêm safe local asset resolver và renderer cho SVG parts/image trong export worker.
- [x] Renderer worker cho Shape rectangle/ellipse/polygon và solid Paint.
- [x] Typed Path geometry + renderer + cubic bounds + evenodd hole golden.
- [x] Mask dependency graph với clip/alpha/inverse-alpha, nested layer compositing và source visibility.
- [x] Golden Runtime/PNG harness, deterministic clock/seed và capability limits.

Đây là ưu tiên cao nhất vì hiện preview Web chỉ là preview gần đúng, chưa phải kết quả export.

### P1 — SVG rig schema, compiler và Designer workflow

- [ ] Figma SVG importer + sanitizer + stable source mapping.
- [ ] Rig Mapper: rename, reparent, draw order và pivot editor.
- [ ] Typed SVG/Bone payload, cut-out rig slots và named Component Actions.
- [ ] Mouth/eye/hand replacement variants compile thành literal tracks.
- [ ] Action/pose timeline cho idle, blink, talk, wave và walk cycle.
- [ ] Camera transform, scene transition và prop attachment.
- [ ] Motion Path, Bone chain và Secondary Motion deterministic cho segmented hair/tail.
- [x] Harden Repeater thành list/count + none/linear/grid/radial + time stagger.
- [ ] Thêm Text Animator Unicode-aware.

### P2 — Component và asset production

- [ ] Component package resolver/cache theo exact version + integrity.
- [ ] Portable project bundle chứa dependency cần thiết.
- [ ] Nested Component/repeater edge cases và cycle guard đầy đủ.
- [ ] Asset registry, download/cache và checksum policy.
- [ ] Re-import reconciliation cho SVG source đã thay đổi.
- [ ] Portable character package chứa raw source, normalized parts, rig và actions.
- [ ] Ordered effects stack và normalized Path Morph sau khi geometry pipeline ổn định.

### P3 — Audio và hạ tầng render

- [ ] Audio decode, trim, gain, fade và mix theo timeline.
- [ ] Voiceover waveform/cues và mouth-key generation.
- [ ] Queue, retry, progress, cancellation và idempotency.
- [ ] Object storage upload, signed URL và cleanup policy.
- [ ] Observability, quota, auth và billing boundary.

### P4 — AI authoring

- [ ] Retrieval dựa trên capability/intent thay vì chỉ template ID.
- [ ] Planner tạo patch có constraint và revision guard.
- [ ] Designer/AI Author workflow cho `.mvc` với semantic hooks.
- [ ] Evaluation set cho brief tiếng Việt → project → preview/export.

## Việc tiếp theo được đề xuất

Không viết lại render pipeline. Theo quyết định schema-first, sprint tiếp theo khóa JSON contract trước preview:

1. ✅ Tách evaluator/transform math thành `packages/motion-runtime`.
2. ✅ Thêm fixture SVG gồm torso/arm/hand/prop với pivot và visual smoke.
3. ✅ Triển khai world matrix và SVG/image renderer trong export worker.
4. Thực hiện Sprint A/B tại [`schema-fixture-roadmap.md`](schema-fixture-roadmap.md): negative files, compiler goldens, typed Asset/Node và property registry.
5. Khóa P0 geometry/composition/motion/cut-out/media fixtures và expected Runtime IR.
6. Sau freeze gate mới cho Web preview compile cùng Runtime IR và dùng `motion-runtime`.

## Quy tắc cập nhật tiến độ

- Chỉ đánh dấu `[x]` khi có implementation và test/fixture tương ứng.
- Mỗi mục hoàn tất phải ghi được file hoặc lệnh kiểm chứng.
- Không ghi phần thử nghiệm như capability production.
- Quyết định mới ảnh hưởng contract phải cập nhật `motion-format-v2.md` trước hoặc cùng lúc.
- Nếu bỏ một hướng, ghi lý do vào tài liệu này rồi xóa code/tài liệu chết; không xóa luôn roadmap.
