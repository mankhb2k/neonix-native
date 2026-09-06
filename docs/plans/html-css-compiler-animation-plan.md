# HTML/CSS compiler — motion và animation plan

## Mục tiêu

Compile CSS animation thành Protocol V2 `layer.tracks`, để cùng một dữ liệu được sample bởi runtime, preview Skia/SVG và export. Compiler không tạo CSS animation engine riêng và không lấy animation clock từ browser.

Pipeline:

```text
@keyframes + animation declarations
  → parse + cascade
  → resolve shorthand, time, iteration, direction, fill and easing
  → normalize keyframe properties to typed V2 values
  → emit ordered layer.tracks
  → runtime samples at composition time in milliseconds
```

## Nguyên tắc contract

- `@keyframes` chỉ là input authoring; không xuất hiện trong runtime JSON.
- Mỗi animated CSS property trở thành một V2 track duy nhất trên layer sở hữu nó.
- `time` của keyframe là milliseconds, tăng strictly và tính theo local animation timeline.
- Track dùng typed value: `number`, `vec2/vec3`, `color`, `enum` hoặc `string`; không serialize CSS string cho giá trị cần interpolate.
- `transform` được normalize thành transform value có thứ tự operation ổn định; không nội suy hai chuỗi CSS tùy ý.
- `opacity`, màu và frame size phải dùng đúng domain của V2; opacity luôn clamp 0..1 và color dùng RGBA canonical.
- `animation-delay`, direction, iteration và fill được bake vào keyframe timeline hoặc layer timing; runtime chỉ sample track.
- `animation-play-state` chỉ là metadata cho transport state của preview/editor. Shared transport clock quyết định sample time; paused transport không advance nhưng seek vẫn được phép.
- CSS browser preview là reference; Skia và export dùng cùng Protocol V2 sample để bảo đảm seek và frame determinism.
- Property/value không lower được phải trả diagnostic có selector, element và source location; không silently bỏ qua.

## Phạm vi triển khai

### M0 — parser và animation declaration

Hỗ trợ:

- `@keyframes` với selector `from`, `to` và phần trăm;
- `animation-name`;
- `animation-duration`;
- `animation-delay`;
- `animation-iteration-count` là số hữu hạn hoặc `infinite`;
- `animation-direction: normal | reverse | alternate | alternate-reverse`;
- `animation-fill-mode: none | forwards | backwards | both`;
- `animation-play-state: running | paused`;
- shorthand `animation` sau khi đã tách token ở top level.

Implementation:

1. Parse keyframes độc lập với selector rules và giữ source order.
2. Cascade animation declarations theo specificity, source order và `!important`.
3. Expand shorthand trước khi tạo animation IR.
4. Normalize time về milliseconds; normalize offset về 0..1.
5. Kiểm tra duplicate offset, missing endpoints, invalid property và animation name không tồn tại.
6. Tạo animation IR trung gian để một property có nhiều keyframe không bị trộn với property khác.

### M1 — easing và timeline

Hỗ trợ:

- `linear`;
- `steps(n, jump-start | jump-end | jump-none | jump-both)` theo capability;
- `cubic-bezier(x1, y1, x2, y2)` với x1/x2 trong 0..1.

Implementation:

- Map `linear` vào `{ type: "linear" }`.
- Map `steps()` vào step easing deterministic; nếu runtime chỉ có step hold thì báo capability rõ ràng cho các jump mode chưa hỗ trợ.
- Map cubic-bezier vào `{ type: "cubicBezier", x1, y1, x2, y2 }`.
- Giữ easing gắn với segment rời keyframe hiện tại.
- Tạo đủ chu kỳ cho iteration hữu hạn; với `infinite`, giữ track chu kỳ và metadata/timing để runtime lặp mà không nhân vô hạn keyframe.
- Áp dụng direction cho từng iteration trước khi emit/sample.
- `delay` âm bắt đầu tại vị trí tương ứng trong timeline; delay dương kết hợp với fill-mode.

### M2 — animated property lowering

Ưu tiên các property có thể map rõ vào V2:

- `transform` → transform track;
- `opacity` → number track;
- `background-color`, `color`, `border-color`, SVG `fill`/`stroke` → color track;
- `width`, `height` → frame-size track nếu layer/frame contract cho phép;
- `translate`, `scale`, `rotate` → transform component tracks hoặc một transform track canonical.

Không hỗ trợ trong đợt đầu:

- thay đổi layout flex/grid trong animation;
- animation của `display`, `visibility` hoặc `content` nếu không có discrete contract;
- gradient stop topology thay đổi số lượng stop;
- font fallback, text wrapping hoặc asset source thay đổi theo thời gian.

## Case test bắt buộc

Mỗi case là một fixture riêng trong `docs/preview/html-compiler` và có Browser CSS reference, normalized JSON và Skia output.

### Nhóm A — một property

1. `opacity` 0 → 1 với `linear`.
2. `transform: translateX()`.
3. `transform: scale()` với `transform-origin` ở tâm.
4. `transform: rotate()` quanh origin phần trăm.
5. `background-color` giữa hai màu RGBA.
6. `width`/`height` thay đổi với `box-sizing: border-box`.

Trạng thái: Nhóm A đã hoàn tất trong compiler/runtime preview. Các transform
track giữ layout translation và transform-origin; màu RGBA được normalize thành
typed color; width/height được lower thành `frame.width`/`frame.height` và được
sample trước khi tạo visual content cho Skia.

### Nhóm B — keyframe declaration

7. `from`/`to`.
8. Ba keyframe `0%`, `50%`, `100%`.
9. Keyframe không khai báo `0%` nhưng có `30%` và `to`.
10. Hai `@keyframes` khác tên trên hai layer.
11. Duplicate offset được resolve theo source order.
12. Animation name không tồn tại trả diagnostic.

Trạng thái: Nhóm B đã hoàn tất. Compiler giữ các offset authored theo milliseconds,
chèn underlying value khi thiếu endpoint, tôn trọng source order cho duplicate offset
theo từng property, và trả diagnostic `css-animation-name-unknown` khi không tìm thấy
`@keyframes`. Runtime/Skia dùng track đã normalize nên không cần runtime CSS animation
engine riêng.

### Nhóm C — duration, delay, fill và play state

13. Delay dương với `fill-mode: none`.
14. Delay dương với `backwards`.
15. `forwards` giữ giá trị cuối sau khi kết thúc.
16. `both` giữ giá trị đầu trong delay và cuối sau animation.
17. Delay âm bắt đầu giữa animation.
18. `animation-play-state: paused` không tự tiến transport.
19. Preview play/pause dùng cùng sample time với Skia.

Trạng thái: Nhóm C đã hoàn tất. Delay dương/âm, các fill-mode `none`, `backwards`,
`forwards`, `both` và play-state đã được lower vào playback metadata và sample qua
cùng một clock. Preview Browser/Skia giữ cùng playhead khi seek và khi bật/tắt Play;
`animation-play-state: paused` không tự làm tiến clock nhưng vẫn cho phép seek.

### Nhóm D — iteration và direction

20. `iteration-count: 2`.
21. `iteration-count: 2.5` với endpoint deterministic.
22. `infinite` lặp qua nhiều chu kỳ mà không drift time.
23. `normal`.
24. `reverse`.
25. `alternate`.
26. `alternate-reverse`.

Trạng thái: Nhóm D đã hoàn tất. Runtime sampler xử lý direction theo từng iteration,
giữ `infinite` ở một track hữu hạn và không nhân bản keyframe vô hạn; fractional
iteration dừng đúng progress cuối thay vì nhảy nhầm tới keyframe cuối.

### Nhóm E — easing

27. `linear`.
28. `steps(4, jump-end)`.
29. `steps(4, jump-start)`.
30. `cubic-bezier(0.25, 0.1, 0.25, 1)`.
31. Easing riêng trên từng segment.
32. Invalid cubic-bezier và steps trả diagnostic, không fallback silent sang linear.

Trạng thái: Nhóm E đã hoàn tất. Compiler hạ `linear`, `steps()` và `cubic-bezier()` thành
easing typed trong từng track; easing khai báo tại keyframe được giữ theo từng segment.
`steps()` yêu cầu count nguyên dương, cubic-bezier kiểm tra giá trị hữu hạn và `x1/x2`
trong `[0, 1]`; giá trị sai trả diagnostic `css-animation-easing-invalid`.

### Nhóm F — phối hợp property và paint

33. Transform + opacity cùng animation.
34. Transform + background color với easing khác nhau.
35. Opacity layer khác `filter: opacity()`.
36. Border color + border width nhưng không thay đổi layout lần hai.
37. Animated shape có clip-path cố định.
38. Animated layer trong isolated group với blend mode.
39. Animated image transform với clipping composition edge.

Trạng thái: Nhóm F đã hoàn tất. Compiler giữ các property animation độc lập trong
ordered tracks: transform/opacity, màu nền với easing khác nhau, layer opacity và
filter opacity, border color/width, clip-path cố định, blend trong isolated group và
image transform trong overflow/composition clip. Border animation được hạ thành
generated path paint pass để `style.stroke` và `style.strokeWidth` hợp lệ trong V2,
không đưa border width quay lại layout. Playwright capture tại midpoint cho cả bảy
case xác nhận Browser CSS và Skia có hình học/layer order tương ứng.

## Kiểm thử và acceptance

- Unit test parser/cascade/normalizer cho từng nhóm A–F.
- Compiler test kiểm tra track path, typed value, keyframe time, easing và source order.
- Schema test chạy `MotionProtocolV2Schema` trên mọi output.
- Runtime test sample tại `0`, delay boundary, mỗi keyframe, iteration boundary và composition end.
- Playwright test kiểm tra nút play/pause, slider, time progression và reset/loop.
- Pixel comparison Browser/SVG/Skia chỉ so sánh các case deterministic; các khác biệt raster được đánh dấu capability, không sửa bằng CSS scale.
- Không chấp nhận output có CSS animation còn sót lại hoặc track không có property path rõ ràng.

## Thứ tự thực hiện

1. M0 parser, shorthand và animation IR.
2. M1 timeline, direction, iteration, fill và easing.
3. M2 transform/opacity/color.
4. Frame-size track sau khi chốt runtime geometry sampling.
5. Thêm fixture theo nhóm và Playwright transport assertions.
6. Chạy toàn bộ compiler, runtime, web test và export smoke test trước khi mở rộng sang transition/motion path.
