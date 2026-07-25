# Workflow MotionVideo

## Luồng tạo project

```text
Brief / script / brand
        ↓
Template retrieval + motion grammar
        ↓
AI Planner điền Project Variables / public props / text Nodes
        ↓
parseMotionProject
        ↓
Editor sửa Node, Clip, Variable và Timeline
        ↓
Lưu canonical .mt
```

`parseMotionProject` là cổng duy nhất. Input không đúng canonical contract bị từ chối; hệ thống không đoán cấu trúc và không tự migrate.

## Luồng compile và render

```text
Authoring Project
  1. validate structure + references
  2. resolve exact Component dependencies
  3. apply Project bindings
  4. map public props → Component variables → internal bindings
  5. expand repeater và component namespace
  6. resolve schedule, playback rate và variable references
  7. expand preset thành literal property tracks
        ↓
Normalized Runtime IR
        ↓
frame plan → parallel raster workers → PNG → FFmpeg → MP4
```

Runtime IR không chứa preset, Component, variable reference, binding hoặc repeater. Vì vậy render pipeline hiện tại được giữ; tính năng hình ảnh mới phải được bổ sung ở compiler/runtime evaluator thay vì đưa authoring logic vào renderer.

## Thứ tự phát triển

1. Khóa use case bằng fixture.
2. Cập nhật contract và reference validator.
3. Cập nhật compiler sang Runtime IR literal.
4. Dùng cùng evaluator cho preview và export.
5. Mở UI/AI capability tương ứng.

Không thêm field riêng cho từng preset như `speedFromVariable`; dùng `ResolvableValue`. Không tạo collection spatial thứ hai ngoài Scene Node graph.

## Definition of done

Một thay đổi motion hoàn tất khi:

- project/component parse được bằng API canonical;
- ID/reference/cycle/dependency được validate;
- AI/Web không phải chạm internal Component;
- compiler loại hết authoring-only construct;
- preview và export có cùng kết quả property/timing;
- input sai contract bị từ chối với lỗi rõ ràng;
- fixture, typecheck và render smoke test đều pass.
