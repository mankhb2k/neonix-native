# Component Instance Transform Plan

## Mục tiêu

Xây dựng component theo mô hình:

- `kind: "component"` vẫn giữ nguyên
- component là một sealed owner-owned graph
- consumer chỉ được sửa phần public được owner cho phép
- component instance có thể được keyframe như một layer/group
- dữ liệu phải strict, normalized, deterministic để xuất MP4

Plan này chỉ tập trung vào **logic, schema, validation, compiler, runtime contract**.
Phần UI chỉ là gợi ý triển khai, chưa phải phạm vi chính.

## Ý Định Kiến Trúc

Component nên được xem như:

- một **sealed internal graph** do owner sở hữu hoàn toàn
- một **instance layer** ở timeline có transform riêng
- một **public surface** để consumer chỉnh các thuộc tính được phép

Tức là:

- bên trong: private
- bên ngoài: public
- whole component: có transform riêng giống group layer

## Nguyên Tắc

1. Owner quyết định internals.
2. Consumer chỉ đi qua public contract.
3. Component instance có transform riêng ở timeline.
4. Binding vào component phải đi qua public target.
5. Validation phải fail sớm nếu access sai.
6. Compiler phải deterministic và không bỏ qua lỗi contract.

## Hiện Trạng

Hệ hiện tại đã có:

- `EmbeddedComponentV3` với `publicParams`, `slots`, `variants`, `publicTargets`, `variables`, `nodes`, `bindings`, `actions`
- `VisualClipV3` cho `component` source
- compiler synthesize component thành runtime scene
- binding component đi qua `targetId`

Nhưng còn thiếu:

- component instance transform cấp whole-layer
- validation đầy đủ cho `publicTargets`
- validation đầy đủ cho type compatibility khi bind vào component
- contract rõ ràng giữa instance transform và internal public edits

## Target Model

### 1. Component Definition

Owner-authored component definition tiếp tục là embedded artifact:

- `id`
- `version`
- `integrity`
- `publicParams`
- `slots`
- `variants`
- `publicTargets`
- `variables`
- `nodes`
- `bindings`
- `actions`
- `assetDependencies`

### 2. Component Instance

Visual clip source `kind: "component"` cần có thêm một lớp transform instance.

Instance transform nên có các thuộc tính tương tự group:

- `x`
- `y`
- `rotation`
- `scaleX`
- `scaleY`
- `anchorX`
- `anchorY`
- `opacity`
- `visible`
- `flipX`
- `flipY`

Lớp này là transform của cả component như một layer.

### 3. Public Surface

Consumer chỉ được chỉnh:

- `publicParams`
- `slots`
- `variants`
- `actions`
- `publicTargets`

Không được bind trực tiếp vào private node/property.

### 4. Private Surface

Owner giữ toàn quyền đối với:

- internal node graph
- internal layout
- internal bindings
- internal motion details
- internal assets

## Đề Xuất Schema

### Component instance transform

Nên thêm vào `VisualClipV3` một field riêng cho component instance transform.

Có thể theo hướng:

- `transform` hoặc
- `instanceTransform` hoặc
- `motion`

Quan trọng nhất là:

- field này áp dụng cho `source.kind === "component"`
- field này không thay thế public surface
- field này chỉ điều khiển whole-component motion

### Public target contract

`publicTargets` nên là contract chuẩn để consumer binding.

Mỗi target cần:

- `id`
- `nodeId`
- `property`
- `name`
- `description`

Có thể mở rộng thêm:

- `valueKind`
- `control`
- `capability`

## Compiler Contract

Compiler cần resolve theo thứ tự:

1. Validate project structure.
2. Validate component references.
3. Resolve component instance.
4. Resolve component public targets.
5. Validate variable type compatibility.
6. Apply instance transform cho whole component.
7. Apply public bindings vào runtime node được expose.
8. Flatten component thành runtime IR.

## Validation Rules

### Must reject

- duplicate component IDs
- duplicate public target IDs
- public target trỏ vào node không tồn tại
- component binding trỏ vào target không public
- variable type mismatch với target property
- invalid instance transform values
- invalid V3 fields hoặc V2 leftovers
- unknown component references trong visual clips

### Must keep

- strict object shapes
- finite numeric bounds
- normalized timeline fields
- deterministic compile output
- integrity checks cho component dependency

## Runtime Contract

Runtime chỉ nên thấy:

- component instance transform đã resolve
- public edits đã map vào internal nodes
- deterministic scene graph đã flatten

Runtime không cần biết:

- authoring tool nào tạo component
- HTML/CSS hay primitives nào được dùng ở source layer
- internals component được owner tổ chức ra sao

## Implementation Phases

### Phase 1: Schema extension

- Thêm component instance transform vào `VisualClipV3`.
- Giữ `kind: "component"` không đổi.
- Không phá semantics của scene clips.

### Phase 2: Validation hardening

- Validate `publicTargets` chặt hơn.
- Validate type compatibility cho component bindings.
- Validate instance transform bounds.

### Phase 3: Compiler update

- Apply instance transform khi synthesize runtime scene.
- Keep public target resolution deterministic.
- Fail compile on invalid target/type mismatch.

### Phase 4: Reference validation

- Ensure public target node exists inside component graph.
- Ensure target IDs are unique.
- Ensure binding target exists and is public.

### Phase 5: Regression and fixtures

- Update fixtures for component instance transform.
- Update compiler goldens.
- Update schema tests and reference tests.

## Task List

- [ ] Define `VisualClipV3` instance transform field for component sources.
- [ ] Update `MotionProjectV3` validation path to accept component instance transform.
- [ ] Validate `publicTargets` uniqueness and node existence.
- [ ] Restore type validation for component bindings.
- [ ] Ensure component binding resolution fails on missing public target.
- [ ] Extend compiler to apply instance transform during component synthesize.
- [ ] Add reference validation for component graph and public targets.
- [ ] Add migration for any old binding form if persisted data exists.
- [ ] Update fixtures for `component.project.json` and `comprehensive.project.json`.
- [ ] Update runtime goldens for component instance transforms.

## Test Plan

### Protocol tests

File:

- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`

Add tests for:

- valid component with public targets
- duplicate public target IDs
- public target node missing
- component binding to missing target
- component instance transform accepted for component clips
- invalid instance transform rejected

### Reference tests

File:

- `packages/motion-protocol/src/v3/references/project.ts`
- related test coverage in schema/reference tests

Add tests for:

- component public target node existence
- component public target uniqueness
- binding target must exist and be public

### Compiler tests

File:

- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`

Add tests for:

- component clip compiles with instance transform
- component binding resolves through public target
- binding type mismatch rejects compile
- missing public target rejects compile
- deterministic output with same input

### Runtime goldens

Update:

- `packages/motion-compiler/src/__fixtures__/runtime-compile-goldens/*`

Verify:

- component instance transform is preserved in runtime output
- public bindings are resolved into runtime node values
- private internals remain flattened only

## UI Notes

UI chưa phải phạm vi chính của plan này, nhưng sau này nên hiển thị theo 2 vùng:

- public edits: những gì consumer được sửa
- motion controls: transform/keyframe của whole component

Chỉ là gợi ý để editor UX map đúng với contract logic.

## Acceptance Criteria

Plan được xem là xong khi:

- component vẫn sealed ở internals
- consumer chỉ sửa public surface
- component instance có thể keyframe như group layer
- validation chặt và fail sớm
- compiler output deterministic cho MP4 export
- fixtures/tests phản ánh đúng contract mới

## Recommended Next Step

Implement theo thứ tự:

1. schema extension
2. validation hardening
3. compiler update
4. fixtures and tests
5. UI later, chỉ khi cần
