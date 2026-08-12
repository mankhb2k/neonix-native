# Component Instance Transform Fix Plan

## Mục tiêu

Fix hai vấn đề hiện tại của `instanceTransform`:

1. `instanceTransform` đang là dữ liệu tĩnh, chưa thật sự hỗ trợ keyframe toàn bộ component instance theo thời gian.
2. `instanceTransform` đang được accept trên mọi `VisualClipV3`, trong khi nó chỉ có nghĩa với `source.kind === "component"`.

Mục tiêu cuối cùng:

- component vẫn là sealed owner-owned graph
- consumer vẫn có thể keyframe whole-component motion như một layer/group
- dữ liệu phải strict, deterministic, và fail sớm khi contract sai

## Vấn Đề Hiện Tại

### 1. `instanceTransform` chỉ là wrapper tĩnh

Hiện compiler chỉ đọc `clip.instanceTransform` một lần khi synthesize component scene.

Hệ quả:

- component instance có thể được đặt vị trí/scale/rotate ban đầu
- nhưng chưa có cơ chế keyframe theo thời gian cho whole instance

### 2. `instanceTransform` bị parse cho cả scene clip

Schema hiện cho phép field này trên mọi `VisualClipV3`.

Hệ quả:

- scene clip có thể chứa field không có ý nghĩa
- dữ liệu hợp lệ về mặt parse nhưng không có hiệu lực khi compile
- contract bị lỏng hơn mức cần thiết

## Quyết Định Kiến Trúc

### A. `instanceTransform` chỉ áp dụng cho component clip

Chỉ `source.kind === "component"` mới được phép có instance transform.

Scene clip không được mang field này.

### B. Whole-component motion phải là first-class concept

Component instance cần có lớp motion riêng, không chỉ là object tĩnh.

Có 2 hướng khả thi:

1. Giữ `instanceTransform` nhưng mở rộng nó thành transform có thể animate bằng clip/track riêng.
2. Tách thành một cấu trúc rõ ràng hơn như `instanceMotion` hoặc `instanceTransformTrack`.

Ưu tiên của plan này:

- giữ contract đơn giản nhất có thể
- nếu có thể, giữ tên `instanceTransform`
- nếu không đủ để animate, mới mở rộng schema theo hướng track-based

## Hướng Fix Đề Xuất

### Phase 1: Siết schema

- Chỉ cho phép `instanceTransform` khi `source.kind === "component"`.
- Scene clip phải reject nếu có `instanceTransform`.
- Bảo đảm `VisualClipV3` strict hơn về semantic, không chỉ strict về shape.

### Phase 2: Chuẩn hóa runtime contract

- `instanceTransform` phải được normalize sớm.
- Default identity values phải rõ ràng và thống nhất.
- Compiler/runtime không được tự suy đoán field ngoài contract.

### Phase 3: Làm whole-instance motion thật sự animatable

Cần quyết định một trong hai mô hình:

#### Option 1: Animated instance transform tracks

Thêm khả năng keyframe các field của `instanceTransform`, ví dụ:

- `x`
- `y`
- `rotation`
- `scaleX`
- `scaleY`
- `opacity`
- `visible`

Ưu điểm:

- giữ mental model gần group layer
- dễ hiểu cho consumer

Nhược điểm:

- cần schema mới cho animated transform
- compiler phải evaluate transform theo frame

#### Option 2: Instance motion clip

Tách whole-instance motion thành clip riêng, ví dụ:

- `instanceMotion`
- hoặc một track riêng cho component instance

Ưu điểm:

- rõ ràng về timeline semantics
- tách biệt giữa initial placement và animated motion

Nhược điểm:

- nhiều schema thay đổi hơn
- UI/authoring sau này sẽ cần mapping rõ hơn

### Phase 4: Compiler composition order

Compiler cần áp dụng theo thứ tự:

1. resolve component
2. resolve public targets
3. evaluate whole-instance transform/motion
4. wrap component nodes in synthetic group
5. apply public edits vào public targets
6. flatten ra runtime IR

## Schema Changes

### Required

- `instanceTransform` chỉ hợp lệ với component clip
- component clip phải có semantic validation riêng
- public target validation phải giữ nguyên

### Optional, nếu cần để animate

- thêm transform keyframes cho whole component instance
- hoặc thêm instance motion track riêng

## Validation Rules

### Must reject

- `instanceTransform` trên scene clip
- component clip có field transform invalid
- whole-instance motion không khớp bounds
- public target không tồn tại
- duplicate public target IDs
- binding tới target không public
- variable type mismatch với public target

### Must preserve

- strict object shape
- finite numeric bounds
- deterministic output
- compatibility với sealed component contract

## Test Plan

### Protocol tests

File:

- `packages/motion-protocol/src/v3/__tests__/schema.test.ts`

Add cases:

- component clip accepts `instanceTransform`
- scene clip rejects `instanceTransform`
- invalid transform values reject
- missing transform fields still parse

### Compiler tests

File:

- `packages/motion-compiler/src/__tests__/compile-v3.test.ts`

Add cases:

- component clip with `instanceTransform` produces wrapper group
- component clip without `instanceTransform` stays unchanged
- invalid `instanceTransform` causes compile failure if semantic validation misses it
- scene clip with `instanceTransform` is rejected before runtime

### Regression tests

Update goldens for:

- component instance wrapper group
- runtime scene output for component clips
- no wrapper for scene clips

## Implementation Order

1. Siết schema để `instanceTransform` chỉ dành cho component clips.
2. Thêm validation semantic tương ứng.
3. Quyết định mô hình animatable whole-instance motion.
4. Nếu giữ `instanceTransform`, mở rộng nó thành animatable contract.
5. Nếu không đủ, tách thành `instanceMotion`/track riêng.
6. Update compiler.
7. Update tests and goldens.

## Acceptance Criteria

Plan được xem là xong khi:

- scene clip không thể mang `instanceTransform`
- component clip hỗ trợ whole-instance motion đúng semantics
- compiler không bỏ qua lỗi contract
- output runtime vẫn deterministic
- sealed owner-owned component contract vẫn được giữ nguyên

## Ghi Chú

- Không cần đụng UI ở giai đoạn này.
- UI chỉ nên phản ánh contract logic sau khi schema/compiler đã chốt.
- Nếu cần lựa chọn giữa giữ tên cũ hay tách schema mới, ưu tiên phương án ít breaking nhất nhưng vẫn đúng semantics.
