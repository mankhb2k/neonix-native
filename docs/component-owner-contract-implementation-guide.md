# Component Owner Contract Implementation Guide

## Mục tiêu

Áp dụng mô hình component sealed, owner-owned:

- Owner sở hữu toàn bộ internals của component.
- Consumer chỉ được dùng public contract do owner expose.
- Dữ liệu phải strict, normalized, và deterministic để compiler xuất MP4 ổn định.
- Validation phải fail sớm nếu consumer cố chạm vào internals.

## Quyết định kiến trúc

Chọn hướng:

- Component vẫn được author bằng primitives trong app.
- Component được publish thành artifact V3 canonical.
- Consumer chỉ làm việc qua public surface.
- Không cho bind trực tiếp vào private `nodeId/property` của component nữa.

## Những gì đang có

Hệ hiện tại đã có nền tảng tốt:

- `EmbeddedComponentV3` là embedded definition.
- Compiler đã synthesize component clip thành runtime scene.
- Project-level bindings đã tách scene target và component target.

Nhưng contract mới vẫn thiếu 2 điểm quan trọng:

- `publicTargets` chưa được validate đủ chặt.
- Binding component đã mất type validation nếu chỉ dựa trên `targetId`.

## Cách làm đề xuất

### 1. Giữ `publicTargets` là public surface

Mỗi component owner chỉ expose những target hợp lệ qua:

- `id`
- `nodeId`
- `property`
- metadata mô tả target

Consumer chỉ được bind vào `targetId`.

### 2. Validate `publicTargets` chặt hơn

Bắt buộc kiểm tra:

- `publicTargets[].id` không trùng nhau trong cùng component
- `publicTargets[].nodeId` phải trỏ tới node tồn tại trong component
- `publicTargets[].property` phải hợp lệ với node/property capability
- `publicTargets` không được rỗng nếu component được phép consumer bind vào

### 3. Khôi phục type validation cho component bindings

Khi resolve `binding.target.targetId` sang `publicTarget`:

- lấy `publicTarget.property`
- suy ra kiểu dữ liệu mong đợi từ property capability
- so sánh với kiểu của `binding.source.variableId`
- nếu lệch type thì fail compile

### 4. Giữ compile deterministic

Compiler chỉ làm 3 việc:

- resolve public target
- verify type compatibility
- inject variable value vào runtime node đã được expose

Không cho compiler tự suy đoán hay bỏ qua binding lỗi.

### 5. Có migration cho dữ liệu cũ

Vì đây là breaking change trong V3, cần migration rõ ràng:

- `component.nodeId/property` cũ phải được chuyển sang `targetId`
- `variants` object cũ phải được migrate sang array typed variant
- dữ liệu persisted cũ phải được import hoặc normalize trước khi compile

## Đề xuất schema

### `EmbeddedComponentV3`

Nên giữ:

- `publicParams`
- `slots`
- `variants`
- `publicTargets`
- `variables`
- `nodes`
- `bindings`
- `actions`

### `ProjectBindingV3`

Component target nên là:

- `kind: "component"`
- `componentId`
- `targetId`

Không nên cho consumer ghi trực tiếp `nodeId/property`.

### `publicTargets`

Mỗi target nên có:

- `id`
- `nodeId`
- `property`
- `name`
- `description`

Nếu cần, sau này có thể thêm:

- `valueKind`
- `control`
- `capability`

để validation và UI render dễ hơn.

## Thứ tự triển khai

### Phase 1: Schema and reference validation

- Thêm validation `publicTargets`:
  - unique ID
  - node exists
  - property exists or is allowed
- Chặn target trỏ vào node không tồn tại.
- Chặn component binding không có public target tương ứng.

### Phase 2: Compiler validation

- Khôi phục type check cho component bindings.
- Resolve `targetId` ra `publicTarget`.
- Fail compile nếu variable type không khớp target property.

### Phase 3: Migration layer

- Hỗ trợ import dữ liệu component cũ.
- Normalize binding cũ `nodeId/property` sang `targetId`.
- Normalize `variants` object cũ sang array variant.

### Phase 4: Editor surface

- Consumer UI chỉ hiển thị public params, slots, variants, actions.
- Không cho sửa internal nodes của component.
- Owner mode mới được edit internals.

### Phase 5: Regression hardening

- Update fixtures.
- Update golden runtime snapshots.
- Lock behavior bằng tests trước khi mở thêm primitives mới.

## Task List

- [ ] Thêm validation cho `publicTargets` trong `packages/motion-protocol/src/v3/references/project.ts`.
- [ ] Chặn `publicTargets[].nodeId` không tồn tại trong component nodes.
- [ ] Chặn duplicate `publicTargets[].id`.
- [ ] Khôi phục type validation cho component bindings trong `packages/motion-compiler/src/compile-v3.ts`.
- [ ] Fail compile nếu `targetId` không map được sang `publicTarget`.
- [ ] Thêm migration/normalizer cho binding cũ `nodeId/property`.
- [ ] Thêm migration/normalizer cho `variants` object cũ.
- [ ] Cập nhật fixtures `component.project.json` và `comprehensive.project.json`.
- [ ] Cập nhật schema tests để cover public target validation.
- [ ] Cập nhật compiler tests để cover invalid target/type mismatch.

## Test Plan

### Protocol tests

File:

- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`

Nên thêm:

- parse component có `publicTargets` hợp lệ
- reject duplicate `publicTargets[].id`
- reject `publicTargets[].nodeId` không tồn tại
- reject component binding trỏ đến `targetId` không public

### Compiler tests

File:

- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`

Nên thêm:

- compile project có component clip và public target hợp lệ
- reject variable type mismatch với public target
- reject binding component thiếu public target
- reject component integrity mismatch

### Regression tests

Giữ và chạy lại:

- V3 strict parse
- V2 rejection
- timeline `visualTracks` only
- clip-level transition
- runtime goldens cho component instance

## Acceptance Criteria

Khi xong, hệ thống phải đạt:

- consumer không chỉnh được internals component
- owner chỉ expose public contract
- mọi binding component đều đi qua `targetId`
- mọi target đều được validate đầy đủ
- type mismatch bị fail sớm
- compiler output vẫn deterministic để export MP4

## Nguyên tắc giữ trong tương lai

- Mở rộng primitives trước, không mở HTML/CSS vào lõi canonical.
- Mọi thứ consumer dùng phải đi qua public contract.
- Private graph của component không được trở thành API ngầm.
- Nếu thêm capability mới, phải đi kèm validation và fixture coverage.
