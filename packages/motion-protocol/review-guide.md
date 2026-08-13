# Review Guide — V3 Component Protocol

> **Mục đích:** Hướng dẫn review codebase V3 protocol một cách có hệ thống — tập trung vào **component contract** và **component-as-scene-layer** (component node + scene-local motion).
>
> **Nguyên tắc cốt lõi:** Bắt đầu từ **schema entrypoint**, sau đó đi xuống theo **luồng dữ liệu thật** (input JSON → schema parse → reference validation → compiler). Không review rải rác theo chữ cái.

---

## 1. Thứ tự review (nên đi theo đúng trình tự này)

Review theo thứ tự từ **rộng → hẹp**, từ **cấu trúc → ngữ nghĩa → kiểm chứng**:

| #   | File                              | Tại sao đọc file này                                                                                                            |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/v3/project.ts`               | **Root schema** của V3. Hiểu `MotionProjectV3Schema` gom những phần nào, giới hạn tổng thể (`MOTION_PROTOCOL_LIMITS`) ra sao.   |
| 2   | `src/v3/timeline.ts`              | **Scene-only timeline**. Xem `visualTracks`, `VisualClipV3` — clip source chỉ cho phép `{ kind: "scene", sceneId }`.            |
| 2b  | `src/v3/layers/component.ts`       | **Component node** (`type: "component"`) — `payload.componentId`, `variantId?`, `props?`, transform đóng vai trò wrapper. |
| 3   | `src/v3/components.ts`            | **Sealed component contract** — `props`, `variants`, `propBindings`, internals.                                |
| 4   | `src/v3/variables.ts`             | **Binding model** — phân biệt scene binding vs component binding; consumer có được chạm internal không.                         |
| 5   | `src/v3/references/project.ts`    | **Semantic validation** — id có tồn tại, public target có hợp lệ, binding có đi qua public API không.                           |
| 6   | `src/v3/parse.ts`                 | **Actual parse path** — schema parse xong có thật sự chạy reference validation không.                                           |
| 7   | `src/v3/__tests__/schema.test.ts` | **Kiểm chứng bằng test** — cái gì được accept, cái gì bị reject.                                                                |

> **Bắt đầu tốt nhất:** đọc `project.ts` trước, rồi nhảy sang `timeline.ts` (scene-only) và `layers/component.ts` vì phần component motion nằm ở đó.

---

## 2. Nhiệm vụ cụ thể của từng file

### 1) `src/v3/project.ts` — Root schema

- Xem `MotionProjectV3Schema` gom những phần con nào: `metadata`, `composition`, `dependencies`, `tokens`, `variables`, `assets`, `components`, `scenes`, `timeline`, `bindings`, `provenance`, `extensions`.
- Kiểm tra giới hạn tổng thể (`MOTION_PROTOCOL_LIMITS`): số scene / node / clip / track / key tối đa.
- Kiểm tra `.strict()` và `.superRefine()` — duplicate id có bị chặn ngay ở parse không.

### 2) `src/v3/timeline.ts` — Scene-only timeline

- `visualTracks` thay thế `sceneOrder` như thế nào.
- `VisualClipV3` chỉ chấp nhận `source.kind === "scene"` — không có component source.
- Clip không sở hữu `instanceTransform`/`instanceTransformTracks` nữa; định vị/keyframe component nằm ở component node.

### 2b) `src/v3/layers/component.ts` — Component node (instance)

- `ComponentLayerV3Schema` với `type: "component"` và `payload.componentId`.
- `transform` của node đóng vai trò wrapper transform khi compiler expand.
- Scene-local motion clip nhắm vào component node → compiler remap sang wrapper group.
- **Wrapper-safe contract:** các property transform chuẩn của node được phép animate; không expose internal node của component.

### 3) `src/v3/components.ts` — Sealed component

- Owner sở hữu toàn bộ internals (layers, internalBindings, actions).
- Consumer chỉ được dùng public API: `props`, `variants`. Wiring owner = `propBindings` (`layerProperty.layerId` / `childProp`).
- Prop values: static | variable | keyframes (chỉ khi `animatable`). Unknown variable / choice ngoài options / assetKind lệch → reject.
- Asset props bắt buộc `assetKind`. Conflict: payload keyframes + scene `payload.props.*` cùng prop → reject.
- Project-level binding không được target arbitrary component internals. Global `kind: "component"` chỉ scene-level instances.

### 4) `src/v3/variables.ts` — Binding model

- Phân biệt **scene binding** (bind tới node trong scene) vs **componentLayer binding** (bind tới instance scene-level) vs **component binding** (mọi **scene-level** instance của `componentId`; nested nhận value qua `childProp`).
- Consumer có bị bắt buộc dùng `propId` thay vì `nodeId` trực tiếp không.

### 5) `src/v3/references/project.ts` — Semantic validation

- Sau khi Zod parse xong, reference validation chạy gì: id tồn tại, asset type đúng, property path đúng node type.
- `propBindings` có trỏ tới layer thật (`layerProperty.layerId`) / child component trực tiếp (`childProp`) không.
- Binding có đi qua public API không, hay lách vào internal.

### 6) `src/v3/parse.ts` — Parse path thực tế

- `parseMotionProjectV3` có gọi đủ: text-payload normalize → schema parse → reference validation.
- Lỗi semantic có bị ném sớm (`MotionV3ReferenceError`) hay để trôi tới compiler.
- Không có legacy project normalizer trên parse path.

### 7) `src/v3/__tests__/schema.test.ts` — Kiểm chứng bằng test

- Đọc các test để biết **hợp đồng thật sự** là gì: cái gì được accept, cái gì bị reject.
- Kiểm tra xem mọi ràng buộc (wrapper-safe, ownership, binding) đều có test fail rõ ràng.

---

## 3. Tiêu chí đánh giá

| Tiêu chí             | Câu hỏi kiểm tra                                                                      |
| -------------------- | ------------------------------------------------------------------------------------- |
| **Shape**            | Dữ liệu có đúng object/field/type/range không?                                        |
| **Semantic**         | id, reference, property path có thật và đúng node type không?                         |
| **Ownership**        | Consumer có bị chặn khỏi internal component không?                                    |
| **Public API**       | Component owner chỉ expose đúng `props`, `variants`? |
| **Instance Motion**  | Component có move/scale/keyframe như group layer mà không chạm internals không?       |
| **Determinism**      | Cùng input có cho output/serialization ổn định không?                                 |
| **Artifact Sync**    | `pnpm test` có fail khi `schema/v3.json` lệch Zod không? (required gate)              |
| **Negative Tests**   | Mọi thứ không được phép đều có test fail rõ ràng?                                     |
| **Production Fit**   | Lỗi có bị bắt sớm ở parse/validation, không để tới compiler/render MP4 mới nổ?        |

---

## 4. Câu hỏi tự review quan trọng

### 4.1 Ownership

> Nếu tôi là user/consumer, tôi có cách nào sửa node bên trong component mà owner không expose không?

- **Mong đợi:** Không. Mọi binding phải đi qua `propId`. Không có lối lách qua `nodeId` + `property` trực tiếp vào component internals.

### 4.2 Shape / Type safety

> Nếu tôi nhập sai kiểu value, schema có reject ngay không?

- **Mong đợi:** Có. Zod `.strict()` + discriminated union + `.superRefine()` reject ngay ở parse, không cần tới reference validation.

### 4.3 Binding model

> Nếu tôi bind tới component, tôi có bắt buộc dùng `propId` không?

- **Mong đợi:** Có. Bind tới component bắt buộc dùng `propId`, không dùng internal `layerId`. Dạng `componentLayer` trỏ instance scene-level cụ thể; dạng `component` bind mọi instance **scene-level**. Nested instance chỉ nhận value nếu parent `childProp`.

### 4.4 Public target type-check

> Nếu `propBinding` target property sai node type, validation có bắt không?

- **Mong đợi:** Có. Reference validation kiểm tra property path có khớp với node type của target không.

### 4.5 Artifact sync

> Nếu JSON Schema được dùng ngoài app (tooling bên thứ ba), nó có đủ gần với Zod source of truth không?

> **Mong đợi:** `schema/v3.json` phải được regenerate từ Zod (`pnpm generate:schema`). Test suite **bắt buộc** so khớp byte-for-byte với output mới; lệch = fail. Không còn legacy project normalizer trên authoring path. Đổi protocol shape (kể cả khi vẫn `formatVersion: 3`) → regenerate + pass gate trước freeze.

## 5. Tóm tắt luồng review

```text
project.ts (root schema + limits)
        │
        ▼
timeline.ts (scene-only visual clips)   ← trọng tâm
        │
        ▼
layers/component.ts (component node) ──► components.ts (sealed contract)
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
