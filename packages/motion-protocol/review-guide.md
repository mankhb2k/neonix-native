# Review Guide — V1 Component Protocol

> **Mục đích:** Hướng dẫn review codebase V1 protocol một cách có hệ thống — tập trung vào **component contract** và **component-as-layer** (component layer trên `project.layers`).
>
> **Nguyên tắc cốt lõi:** Bắt đầu từ **schema entrypoint**, sau đó đi xuống theo **luồng dữ liệu thật** (input JSON → schema parse → reference validation → compiler). Không review rải rác theo chữ cái.

---

## 1. Thứ tự review (nên đi theo đúng trình tự này)

Review theo thứ tự từ **rộng → hẹp**, từ **cấu trúc → ngữ nghĩa → kiểm chứng**:

| #   | File                              | Tại sao đọc file này                                                                                                            |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/v1/project.ts`               | **Root schema** của V1. Hiểu `MotionProjectV1Schema` gom những phần nào, giới hạn tổng thể (`MOTION_PROTOCOL_LIMITS`) ra sao.   |
| 2   | `src/v1/timeline/schema.ts`       | **Timeline metadata**. Chỉ `duration?` / `workArea?` / `markers?`. Không `visualTracks` / `audioTracks` / `captionTracks`. |
| 2b  | `src/v1/layers/component.ts`       | **Component layer** (`type: "component"`) — `payload.componentId`, `variantId?`, `props?`, transform đóng vai trò wrapper. |
| 3   | `src/v1/components/`              | **Sealed component contract** — `props`, `variants`, `propBindings`, internals.                                |
| 4   | `src/v1/variables.ts`             | **Binding model** — `target.type: "prop"` (`layerId` + `propId`); consumer không chạm internals. |
| 5   | `src/v1/references/project.ts`    | **Semantic validation** — id có tồn tại, public target có hợp lệ, binding có đi qua public API không.                           |
| 6   | `src/v1/parse.ts`                 | **Actual parse path** — schema parse xong có thật sự chạy reference validation không.                                           |
| 7   | `test/v1/schema.test.ts` | **Kiểm chứng bằng test** — cái gì được accept, cái gì bị reject.                                                                |

> **Bắt đầu tốt nhất:** đọc `project.ts` trước, rồi `timeline/schema.ts` và `layers/index.ts` (nested tree + audio).

---

## 2. Nhiệm vụ cụ thể của từng file

### 1) `src/v1/project.ts` — Root schema

- Xem `MotionProjectV1Schema` gom những phần con nào: `metadata`, `composition`, `dependencies`, `tokens`, `variables`, `assets`, `components`, `layers`, `timeline`, `bindings`, `provenance`, `extensions`.
- Kiểm tra giới hạn tổng thể (`MOTION_PROTOCOL_LIMITS`): số layer / track / key / component tối đa.
- Kiểm tra `.strict()` và `.superRefine()` — duplicate id có bị chặn ngay ở parse không.

### 2) `src/v1/timeline/schema.ts` — Timeline metadata

- `timeline` chỉ giữ clock: `duration?`, `workArea?`, `markers?`.
- Nội dung phát nằm trên `project.layers`. Root layer = lane. Mọi layer bắt buộc `zIndex` (unique trong siblings) và `timing`. Nested `zIndex >= 0`. Group phải có ≥1 child. Không field `locked`.
- Discriminator layer luôn là `type` (không `kind`). Binding target cũng `type`.

### 2b) `src/v1/layers/component.ts` — Component layer (instance)

- `ComponentLayerV1Schema` với `type: "component"` — leaf. Wrapper atoms trên LayerBase; `payload.componentId`, `variantId?`, `props`. Compiler expand thành wrapper + internals.
- Animation trên wrapper atoms của instance → compiler remap sang wrapper group. Prop keyframes fan-out internals.
- **Wrapper-safe:** frame, transform, timing, zIndex, appearance, compositing, effects, semantic. Không expose internal layers.

### 3) `src/v1/components/` — Sealed component

- Owner sở hữu toàn bộ internals (layers). Public props là luồng drive duy nhất từ ngoài vào trong.
- Consumer: wrapper atoms + public `props` / `variantId`. Wiring owner = `propBindings`. Variant chỉ override props.
- Prop values: static | variable | keyframes (chỉ khi `animatable`). Unknown variable / choice ngoài options / assetKind lệch → reject.
- `payload.props` trên project instance chỉ ref `project.variables`. `component.variables` chỉ cho default / variant / nested instance trong definition.
- Asset props bắt buộc `assetKind`. Animate `payload.props.*` qua animation track bên ngoài → reject; prop animation phải nằm trong prop value keyframes.
- Project binding chỉ `type: "prop"`; nested chỉ `childProp`.

### 4) `src/v1/variables.ts` — Binding model

- Chỉ `target.type: "prop"` (`layerId` + `propId`). Không bind layer field.
- Consumer bắt buộc dùng `propId` — không lách internals.
- Canonical: `ProjectBindingV1Schema`. Prop kinds: string, number, boolean, color, asset, choice. Owner sinks ở `prop-sinks.ts`.

### 5) `src/v1/references/project.ts` — Semantic validation

- Sau khi Zod parse xong, reference validation chạy gì: id tồn tại, asset type đúng, property path đúng layer type.
- `propBindings` có trỏ tới layer thật (`layerProperty.layerId`) / child component trực tiếp (`childProp`) không.
- Binding có đi qua public API không, hay lách vào internal.
- `component.variables` không được merge vào lookup global (`variableById`).
- Project binding `target.type: "prop"` phải khớp prop public + type variable.

### 6) `src/v1/parse.ts` — Parse path thực tế

- `parseMotionProjectV1` có gọi đủ: text-payload normalize → schema parse → reference validation.
- Lỗi semantic có bị ném sớm (`MotionV1ReferenceError`) hay để trôi tới compiler.
- Không có legacy project normalizer trên parse path.

### 7) `test/v1/schema.test.ts` — Kiểm chứng bằng test

- Đọc các test để biết **hợp đồng thật sự** là gì: cái gì được accept, cái gì bị reject.
- Kiểm tra xem mọi ràng buộc (wrapper-safe, ownership, binding) đều có test fail rõ ràng.

---

## 3. Tiêu chí đánh giá

| Tiêu chí             | Câu hỏi kiểm tra                                                                      |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Shape**            | Dữ liệu có đúng object/field/type/range không?                                        |
| **Semantic**         | id, reference, property path có thật và đúng layer type không?                         |
| **Ownership**        | Consumer có bị chặn khỏi internal component không?                                    |
| **Public API**       | Component owner chỉ expose đúng `props`, `variants`? |
| **Instance Motion**  | Component có move/scale/keyframe như group layer mà không chạm internals không?       |
| **Determinism**      | Cùng input có cho output/serialization ổn định không?                                 |
| **Artifact Sync**    | `pnpm test` có fail khi `schema/v1.json` lệch Zod không? (required gate)              |
| **Negative Tests**   | Mọi thứ không được phép đều có test fail rõ ràng?                                     |
| **Production Fit**   | Lỗi có bị bắt sớm ở parse/validation, không để tới compiler/render MP4 mới nổ?        |

---

## 4. Câu hỏi tự review quan trọng

### 4.1 Ownership

> Nếu tôi là user/consumer, tôi có cách nào sửa layer bên trong component mà owner không expose không?

- **Mong đợi:** Không. Mọi binding phải đi qua `propId`. Không có lối lách qua `nodeId` + `property` trực tiếp vào component internals.

### 4.2 Shape / Type safety

> Nếu tôi nhập sai kiểu value, schema có reject ngay không?

- **Mong đợi:** Có. Zod `.strict()` + discriminated union + `.superRefine()` reject ngay ở parse, không cần tới reference validation.

### 4.3 Binding model

> Nếu tôi bind tới component, tôi có bắt buộc dùng `propId` không?

- **Mong đợi:** Có. Bind bắt buộc `target.type: "prop"` với `layerId` + `propId`. Nested instance chỉ nhận value qua parent `childProp`. Không bind layer field.

### 4.4 Public target type-check

> Nếu `propBinding` target property sai layer type, validation có bắt không?

- **Mong đợi:** Có. Reference validation kiểm tra property path có khớp với layer type của target không.

### 4.5 Artifact sync

> Nếu JSON Schema được dùng ngoài app (tooling bên thứ ba), nó có đủ gần với Zod source of truth không?

> **Mong đợi:** `schema/v1.json` phải được regenerate từ Zod (`pnpm generate:schema`). Test suite **bắt buộc** so khớp byte-for-byte với output mới; lệch = fail. Không còn legacy project normalizer trên authoring path. Đổi protocol shape (kể cả khi vẫn `formatVersion: 1`) → regenerate + pass gate trước freeze.

## 5. Tóm tắt luồng review

```text
project.ts (root schema + limits)
        │
        ▼
timeline/schema.ts (duration / workArea / markers)   ← trọng tâm
        │
        ▼
layers/component.ts (component layer) ──► components/ (sealed contract)
        │
        ▼
variables.ts (binding model)
        │
        ▼
references/project.ts (semantic validation)
        │
        ▼
parse.ts (parse path thực tế)
        │
        ▼
schema.test.ts (kiểm chứng bằng test)
```
