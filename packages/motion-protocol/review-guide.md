Nên bắt đầu từ schema entrypoint, rồi đi xuống theo luồng dữ liệu thật.
Thứ tự file nên review
[project.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3\project.ts)
Đây là root schema của V3. Review xem MotionProjectV3Schema gom các phần nào và giới hạn tổng thể ra sao.

[timeline.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3\timeline.ts)
Review visual clips, component clip, instanceTransform, instanceTransformTracks. Đây là nơi quan trọng nhất cho component-as-group-layer.

[components.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3\components.ts)
Review sealed component contract: publicParams, slots, variants, publicTargets, internals.

[variables.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3\variables.ts)
Review binding model: scene binding vs component binding, consumer có được chạm internal không.

[references/project.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3\references\project.ts)
Review semantic validation: id có tồn tại không, public target có hợp lệ không, binding có đi qua public API không.

[parse.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3\parse.ts)
Review actual parse path: schema parse xong có chạy reference validation không.

[schema.test.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3__tests__\schema.test.ts)
Review bằng test: cái gì được accept, cái gì bị reject.

Tiêu chí đánh giá
Shape: dữ liệu có đúng object/field/type/range không.
Semantic: id, reference, property path có thật và đúng node type không.
Ownership: consumer có bị chặn khỏi internal component không.
Public API: component owner chỉ expose đúng publicParams, slots, variants, publicTargets.
Instance Motion: component có move/scale/keyframe như group layer mà không chạm internals không.
Determinism: cùng input có cho output/serialization ổn định không.
Artifact Sync: src schema và schema/v3.json có đồng bộ không.
Negative Tests: mọi thứ không được phép phải có test fail rõ ràng.
Migration Safety: normalizer có vô tình public hóa internal không.
Production Fit: lỗi phải bị bắt sớm ở parse/validation, không để tới compiler/render MP4 mới nổ.
Câu hỏi tự review quan trọng
Nếu tôi là user/consumer, tôi có cách nào sửa node bên trong component mà owner không expose không?
Nếu tôi nhập sai kiểu value, schema có reject ngay không?
Nếu tôi bind tới component, tôi có bắt buộc dùng targetId không?
Nếu publicTarget.property sai node type, validation có bắt không?
Nếu JSON Schema được dùng ngoài app, nó có đủ gần với Zod source of truth không?
Nếu dữ liệu legacy đi qua normalizer, nó có mở rộng public API ngoài ý owner không?
Bắt đầu tốt nhất: đọc [project.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3\project.ts), sau đó nhảy ngay sang [timeline.ts](D:\NextJS\moticlip\packages\motion-protocol\src\v3\timeline.ts) vì phần component motion nằm ở đó.
