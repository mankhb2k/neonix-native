# Workflow MotionVideo

## Giá trị người dùng

Người dùng đưa nội dung và brand. Hệ thống chọn một cấu trúc motion đã kiểm chứng, điền dữ liệu, cho phép chỉnh có kiểm soát và xuất MP4. Moat nằm ở template, component contract, grammar TVC Việt Nam và khả năng chỉnh sửa deterministic—not ở việc sinh pixel bằng model lớn.

## Luồng tạo project

```text
Brief / script / brand
        ↓
Template retrieval + motion grammar
        ↓
AI Planner điền Project Variables / public props / text Nodes
        ↓
parseMotionProject (canonical v2)
        ↓
Editor sửa Node, Clip, Variable và Timeline
        ↓
Lưu .mt v2
```

AI User bị giới hạn ở public surface. AI Author/Designer mới được soạn internal `.mvc`.

## Luồng import legacy

```text
.mt v1 hoặc localStorage v1
        ↓ parseMotionProjectV1
migrateMotionProjectV1ToV2
        ↓ reference validation
MotionProject v2
        ↓ lưu lại v2
```

Không có feature code chạy trên type v1.

## Luồng compile và render

```text
Authoring Project v2
  1. validate structural + references
  2. resolve exact Component dependencies
  3. apply Project bindings
  4. map public props → Component variables → internal bindings
  5. expand repeater/component namespace
  6. resolve schedule, playback rate và variable references
  7. expand preset thành literal property tracks
        ↓
Normalized Runtime IR
        ↓
frame plan → parallel raster workers → PNG → FFmpeg → MP4
```

Runtime IR không chứa preset, Component, variable reference, binding hoặc repeater.

## Thứ tự phát triển

1. Khóa use case bằng fixture.
2. Cập nhật contract và reference validator.
3. Cập nhật compiler sang Runtime IR literal.
4. Dùng cùng evaluator cho preview và export.
5. Mới mở UI/AI capability tương ứng.

Không thêm field tạm riêng cho từng preset như `speedFromVariable`; dùng `ResolvableValue`. Không tạo collection spatial thứ hai ngoài Scene Node graph.

## Definition of done

Một thay đổi motion hoàn tất khi:

- project/component parse được bằng API canonical;
- ID/reference/cycle/dependency được validate;
- AI/Web không phải chạm internal Component;
- compiler loại hết authoring-only construct;
- preview và export có cùng kết quả property/timing;
- project cũ migrate hoặc được từ chối với lỗi version rõ ràng;
- fixture, typecheck và render smoke test đều pass.
