# ClipKit vs MotiClip

Ảnh chụp theo trạng thái repo hiện tại.

## Mục Tiêu

Ghi chú này dùng như một bản phân tích đối thủ thực chiến:

- MotiClip đang làm tốt hơn ở đâu
- ClipKit đang làm tốt hơn ở đâu
- nên học gì, tránh gì, và ưu tiên xây gì tiếp theo

## Kết Luận Nhanh

MotiClip đang mạnh hơn về kỷ luật kiến trúc, tách compiler/runtime, và các seam để mở rộng về sau.
ClipKit đang mạnh hơn ở độ mượt của playback, đồng bộ audio, preview có buffer, và đường export được tích hợp chặt.

Nếu mục tiêu là một nền tảng editor motion graphics có thể scale lâu dài, MotiClip đang đi đúng hướng hơn.
Nếu mục tiêu là một motion engine tích hợp chặt, preview trung thực và runtime mạnh, ClipKit đang dẫn trước ở tầng runtime.

## Bảng So Sánh

| Hạng mục | MotiClip làm tốt hơn | ClipKit làm tốt hơn | Nên học gì |
|---|---|---|---|
| Thiết kế schema | Tách rõ `MotionProject`, compiler, normalized runtime IR, và render contracts. Xem [motion-compiler](./packages/motion-compiler/README.md) và [render-contracts](./packages/render-contracts/README.md). | Một engine và một luồng dữ liệu nên cảm giác thống nhất hơn cho người dùng cuối. | Giữ schema, compiler, runtime, renderer tách biệt. Đừng để renderer sở hữu logic domain. |
| Ranh giới compiler | `compileMotionProject()` là một cổng vào runtime rất rõ ràng. | Compiler bị “ẩn” hơn trong engine. | Giữ compiler là cửa ngõ duy nhất đi vào runtime evaluation. |
| Hợp đồng preview | Bạn đã có seam cho Pixi, DOM, và renderer kiểu Remotion. Xem [preview-evaluate.ts](./apps/web/lib/runtime/preview-evaluate.ts), [PixiFramePainter.ts](./packages/pixi-renderer/src/PixiFramePainter.ts), [MotionComposition.tsx](./packages/remotion-renderer/src/MotionComposition.tsx). | ClipKit dùng một runtime cho cả preview và export, nên parity tự nhiên chặt hơn. | Giữ contract chung `evaluate -> paint` và để mọi renderer tiêu thụ nó. |
| Clock playback | Bạn có playback driver gọn và state UI tách biệt. Xem [playback-driver.ts](./packages/editor-core/src/playback/playback-driver.ts). | ClipKit dùng `AudioContext.currentTime` làm transport clock chính. Xem [clock.ts](./clipkit/packages/playback/src/clock.ts). | Nên tiến tới transport bám audio-clock nếu playback là nghiêm túc. |
| Đồng bộ audio | Bạn đang tách UI playback và render pipeline sạch hơn. | ClipKit có WebAudio scheduling chuẩn từng mẫu và preview audio bám export rất sát. Xem [playback README](./clipkit/packages/playback/README.md). | Hãy coi audio là dữ liệu runtime hạng nhất, không phải hiệu ứng phụ của UI. |
| Hiệu năng preview | Kiến trúc của bạn dễ thay và dễ benchmark hơn. | ClipKit dùng worker, `OffscreenCanvas`, và buffer `VideoFrame` có giới hạn. Xem [worker.ts](./clipkit/packages/playback/src/worker.ts) và [engine.ts](./clipkit/packages/playback/src/engine.ts). | Chỉ nên thêm buffer/worker khi profiling cho thấy thật sự cần. |
| Seam 3D | Bạn chủ động thiết kế `2D fast path -> 3D seam` trước khi mở field authoring. Đây là bước rất đúng. | ClipKit đã có camera perspective, depth sort, và flattening behavior trong runtime. Xem [camera.ts](./clipkit/packages/runtime/src/compositor/camera.ts), [runtime.ts](./clipkit/packages/runtime/src/runtime.ts), [scene.ts](./clipkit/packages/runtime/src/compositor/scene.ts). | Giữ seam của bạn, nhưng đừng mở schema 3D quá sớm khi runtime và painter chưa sẵn sàng. |
| Đường export | Bạn đã có đường Remotion, mạnh cho tích hợp cloud/web. | Local MP4 export của ClipKit rất trực diện: headless Chrome + WebCodecs + `mp4-muxer`, không dùng ffmpeg cho luồng MP4 chuẩn. Xem [renderer README](./clipkit/packages/renderer/README.md), [render.ts](./clipkit/packages/renderer/src/render.ts), [exporter.ts](./clipkit/packages/runtime/src/encoder/exporter.ts). | Giữ ffmpeg làm fallback hoặc post-process, không phải core của render thường ngày. |
| Export trong suốt | Kiến trúc export của bạn vẫn còn linh hoạt vì core đã tách. | ClipKit chỉ dùng ffmpeg khi thật sự cần, ví dụ ghép alpha/transparent. Xem [runtime.ts](./clipkit/packages/runtime/src/runtime.ts) và [wav.ts](./clipkit/packages/runtime/src/audio/wav.ts). | Tách opaque MP4 export khỏi các nhánh export đặc biệt. |
| Parity testing | Bạn đang có chiến lược parity multi-renderer mạnh hơn. | ClipKit có một engine duy nhất nên parity giữa nhiều renderer không phải câu chuyện trung tâm. | Dùng parity test như lợi thế cạnh tranh. Đây là một trong những điểm mạnh nhất của bạn. |
| Mở rộng | Ranh giới package của bạn phù hợp với một platform sẽ còn lớn dần. | ClipKit dễ hiểu hơn như một product engine đơn khối. | Giữ kiến trúc thân thiện với platform, nhưng chặn drift bằng runtime contract thật chặt. |

## MotiClip Đang Làm Tốt Hơn

1. Tách compiler/runtime/render sạch hơn.
2. Dễ đi tới nhiều renderer hơn mà không phải viết lại toàn bộ app.
3. Dễ test dài hạn hơn nhờ parity harness.
4. Nền tốt hơn cho workspace/project format và seam 3D trong tương lai.

## ClipKit Đang Làm Tốt Hơn

1. Clock playback bám audio.
2. Playback engine có buffer và render trong worker/offscreen.
3. Preview/export nhất quán hơn vì cùng một runtime sở hữu cả hai đường.
4. Luồng local MP4 export rất thẳng: WebCodecs + muxing.
5. 3D ở runtime đã là thật, không chỉ là kế hoạch.

## Nên Học Gì Từ ClipKit

1. Dùng `AudioContext.currentTime` hoặc một clock chính xác tương đương cho playback.
2. Làm rõ invalidation của preview: cập nhật source, cập nhật patch, và chặn stale frame.
3. Giữ camera/projection ở runtime, không để UI renderer tự quyết.
4. Đưa audio vào cùng transport và frame plan với video.
5. Chỉ thêm buffering khi số đo thực sự chứng minh nó có ích.

## Không Nên Copy Mù Quáng

1. Không gộp schema, runtime, và renderer vào chung một package.
2. Không mở field authoring 3D trước khi seam runtime đã ổn.
3. Không biến ffmpeg thành trung tâm của vòng preview/export thường ngày.
4. Không copy worker/offscreen complexity trước khi profiling chỉ ra đúng nút thắt.

## Khuyến Nghị Chiến Lược

Giữ theo hướng MotiClip:

- `MotionProject` là nguồn authoring.
- Compiler tạo runtime IR chuẩn hóa.
- Runtime sở hữu timing, media, projection, và evaluation.
- Pixi vẫn là preview engine tương tác.
- Remotion vẫn là đường export/fallback.
- 3D tương lai phải nằm sau capability gates, không phải bằng cách sửa schema 2D hiện tại.

## Các Bước Tiếp Theo Nên Làm

1. Khóa contract chung `evaluate -> paint`.
2. Thêm transport bám audio-clock cho preview playback.
3. Siết test parity preview/export.
4. Định nghĩa seam 2D/2.5D/3D ở runtime trước khi mở bất kỳ UI authoring nào.
5. Chỉ để `ffmpeg` phục vụ các case export đặc biệt, không đi vào đường render hằng ngày.

## Tài Liệu Liên Quan Trong Repo

- [motion-compiler README](./packages/motion-compiler/README.md)
- [render-contracts README](./packages/render-contracts/README.md)
- [PixiFramePainter](./packages/pixi-renderer/src/PixiFramePainter.ts)
- [preview-evaluate](./apps/web/lib/runtime/preview-evaluate.ts)
- [playback-driver](./packages/editor-core/src/playback/playback-driver.ts)
- [ClipKit playback README](./clipkit/packages/playback/README.md)
- [ClipKit transport clock](./clipkit/packages/playback/src/clock.ts)
- [ClipKit playback worker](./clipkit/packages/playback/src/worker.ts)
- [ClipKit runtime camera](./clipkit/packages/runtime/src/compositor/camera.ts)
- [ClipKit runtime scene](./clipkit/packages/runtime/src/compositor/scene.ts)
- [ClipKit runtime exporter](./clipkit/packages/runtime/src/encoder/exporter.ts)
