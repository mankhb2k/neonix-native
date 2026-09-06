# HTML/CSS Compiler — Paint CSS Implementation Plan

## Mục tiêu

Hoàn thiện nhánh paint của HTML/CSS compiler sau khi geometry và layout cơ bản
đã ổn định. CSS chỉ là input authoring; compiler phải resolve thành paint
semantic, effect graph, clip/mask relation và asset reference để Browser
reference, Skia preview và export dùng cùng một kết quả.

```text
computed CSS
  → normalized paint IR
  → Protocol V2 paint/effect/clip/mask atoms
  → runtime command buffer
  → Skia/export ở 1920 × 1080
```

Composition vẫn cố định:

```json
{
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "background": "#081018",
  "colorSpace": "srgb"
}
```

## Nguyên tắc bắt buộc

- Paint không được làm thay đổi `frame`, normal-flow slot hoặc layout result.
- Mọi gradient, shadow, filter, clip và mask phải có tọa độ local rõ ràng và
  deterministic; không dùng kích thước của panel preview làm giá trị compile.
- Background nhiều layer giữ đúng thứ tự CSS: layer đầu tiên nằm trên cùng,
  layer cuối cùng nằm gần background color nhất.
- Asset URL phải resolve qua asset manifest thành `assetId` và integrity; không
  đưa URL tùy ý trực tiếp vào runtime nếu chưa qua asset resolver.
- Effect có blur, shadow, filter, blend hoặc mask phải render trên offscreen
  surface phù hợp. Không áp dụng filter trực tiếp lên surface của sibling.
- `outline` không chiếm layout space; `box-shadow` và `text-shadow` cũng không
  mở rộng frame, chỉ mở rộng paint bounds.
- Unsupported value phải fail closed với source location và capability name.
- Mỗi nhóm phải có case riêng, JSON lowering test, Browser reference và Skia
  runtime test. Không tạo một fixture duy nhất chứa toàn bộ paint property.

## Trạng thái Protocol V2 hiện tại

Có thể tái sử dụng ngay:

- `style.fill` / `style.stroke` và các gradient `linear-gradient`,
  `radial-gradient`, `conic-gradient`;
- gradient stops, `spreadMethod`, `gradientUnits`, `gradientTransform`;
- stroke width, join, cap, dash và `paintOrder`;
- `effects[]` gồm color-adjust, grayscale, sepia, invert, filter-opacity,
  blur và shadow;
- `composite.blendMode` và `composite.isolation`;
- bảng `clipPaths[]`, `masks[]` và layer references `clipPath` / `mask`.

Cần mở rộng hoặc thống nhất trước khi code các nhóm tương ứng:

1. `background-image: url(...)` cần paint atom kiểu asset image. `V2Paint` hiện
   có màu, gradient, pattern và reference nhưng chưa có background image layer
   với position/size/repeat.
2. Per-side border cần semantic `borderSides` hoặc một lowering có source
   reference rõ ràng; một SVG stroke đơn không biểu diễn được bốn cạnh có style
   khác nhau.
3. Per-corner elliptical radius cần `cornerRadii` gồm `topLeft`, `topRight`,
   `bottomRight`, `bottomLeft`, mỗi góc có `x` và `y`, hoặc phải lower thành
   path có contour tương đương.
4. CSS mask gradient/asset và `mask-composite` cần một mask source semantic;
   bảng SVG mask hiện tại đủ cho mask node nhưng chưa mô tả toàn bộ CSS mask
   layer list.

Khuyến nghị: mở rộng Protocol V2 ở các điểm trên thay vì nhúng CSS string vào
JSON. Compiler vẫn có thể lower một số property thành generated shape/path
layer khi đó là cách duy nhất giữ parity, nhưng generated layer phải có
`sourceRef`/diagnostic để AI và editor truy ngược được CSS node gốc.

## Paint IR nội bộ

Trước khi emit Protocol V2, tạo các type nội bộ sau:

```ts
type PaintSource =
  | { kind: "solid"; color: string; opacity: number }
  | { kind: "gradient"; gradient: V2GradientFill }
  | { kind: "asset"; assetId: string; integrity: string };

type BackgroundLayerIR = {
  source: PaintSource;
  position: { x: number; y: number };
  size: { kind: "auto" | "cover" | "contain" | "length"; width?: number; height?: number };
  repeat: "repeat" | "repeat-x" | "repeat-y" | "no-repeat" | "space" | "round";
  origin: "border-box" | "padding-box" | "content-box";
  clip: "border-box" | "padding-box" | "content-box";
};

type PaintIR = {
  backgrounds: BackgroundLayerIR[];
  border?: BorderIR;
  outline?: OutlineIR;
  effects: EffectIR[];
  clip?: ClipIR;
  masks: MaskIR[];
  composite?: { blendMode: string; isolation: "auto" | "isolate" };
};
```

IR này giúp tách ba việc thường bị trộn lẫn: resolve CSS value, biểu diễn
semantic JSON và cách backend rasterize. `background-origin` quyết định vùng
định vị/kích thước; `background-clip` quyết định vùng cắt; hai giá trị không
được dùng chung một biến.

## Lộ trình triển khai

### P2.0 — Paint model và asset background

Chuẩn hóa parser và lowering cho:

- `background-image: url(asset)`;
- `background-position` với px, %, `left/center/right`, `top/center/bottom`;
- `background-size: auto`, một chiều, hai chiều, `cover`, `contain`;
- `background-repeat: repeat`, `repeat-x`, `repeat-y`, `no-repeat`;
- `background-origin` và `background-clip` ở border/padding/content box.

Implementation:

1. Thêm asset resolver dùng chung với image/video compiler.
2. Tính background positioning area từ resolved border/padding/content box,
   không từ frame của panel preview.
3. Lower ảnh thành background paint layer hoặc generated image pass nằm trong
   layer owner; không tạo layout child.
4. Clip background trước khi vẽ border/content theo đúng box.

Cases:

- một ảnh asset với `no-repeat` và `center center`;
- `cover` và `contain` trên hai box có aspect ratio khác nhau;
- repeat-x/repeat-y với `background-origin` khác `background-clip`;
- nhiều background image/gradient với thứ tự rõ ràng.

### P2.1 — Repeating gradients

Hỗ trợ:

- `repeating-linear-gradient()`;
- `repeating-radial-gradient()`;
- `repeating-conic-gradient()`.

Implementation:

- parse color-stop sequence và xác định period sau khi stop offset được
  normalize;
- map period sang `spreadMethod: "repeat"` hoặc atom tương đương, không chỉ
  đổi tên `linear-gradient`;
- giữ start angle, center, object-bounding-box/user-space và transform;
- test vùng wrap ở cả hai phía của period để phát hiện lỗi đảo màu hoặc lệch
  tâm, đặc biệt với radial/conic.

Cases:

- repeating linear với period ngắn;
- repeating radial có tâm lệch;
- repeating conic với `from` khác 0 và center không ở giữa;
- repeating gradient phủ trên solid background.

### P2.2 — Border nâng cao (implemented)

Đã triển khai border side resolution, các style `solid`/`none`/`dashed`/`dotted`/`double`, cùng uniform, per-corner và elliptical radius. Border không làm thay đổi frame lần thứ hai; solid unequal sides được hạ thành polygon joins, dashed thành các rectangle fragments đã fit theo cạnh, dotted thành các ellipse fragments, còn rounded fill có shape-union fallback cho CanvasKit.

Hỗ trợ theo từng bước:

- `border-top/right/bottom/left` và các longhand width/style/color;
- `solid`, `none`, `dashed`, `dotted`;
- `double` sau khi có pass/geometry cho hai đường biên;
- `groove`, `ridge`, `inset`, `outset` chỉ sau khi có màu/shading contract
  deterministic;
- per-corner và elliptical `border-radius`.

Implementation:

- expand shorthand trước cascade, sau đó resolve từng cạnh;
- giữ border trong paint IR, tuyệt đối không đưa border width vào layout lần
  thứ hai;
- border đồng nhất có thể lower thành `style.stroke` hiện tại;
- border khác cạnh hoặc style phức tạp lower thành generated path/shape
  passes với thứ tự stable;
- clamp elliptical radii theo tổng hai cạnh liền kề như CSS;
- dùng path contour khi Skia `drawRRect` không thể biểu diễn đủ bốn góc.

Cases:

- bốn cạnh cùng `solid` nhưng width/color khác nhau;
- `none` xen kẽ `solid`;
- dashed và dotted border;
- double border;
- uniform radius, per-corner radius và elliptical radius ở ba case riêng.

### P2.3 — Outline

Hỗ trợ:

- `outline-width`, `outline-style`, `outline-color`, `outline-offset`;
- trước mắt `solid` và `none`.

Contract:

- outline nằm ngoài border box nhưng không thay đổi `frame`, margin, padding
  hay containing block;
- nếu outline bị composition clip, clip theo composition như mọi paint khác;
- nếu radius cần chính xác, reuse normalized corner geometry của border.

Cases:

- outline không làm đổi vị trí sibling;
- outline-offset âm/dương;
- outline quanh per-corner radius.

### P2.4 — Text shadow và box shadow

Mapping:

- `text-shadow` → `effects[]` shadow với `source: "alpha"`, spread `0`,
  `inset: false`;
- `box-shadow` → `effects[]` shadow với `source: "box"`, offset, blur, signed
  spread và inset;
- nhiều shadow giữ thứ tự CSS, mỗi shadow lấy source surface gốc, không lấy
  output của shadow trước đó.

Implementation:

- parse comma-separated shadow list không nhầm comma trong color function;
- resolve blur, spread, offset theo composition pixels;
- mở rộng offscreen bounds cho paint nhưng không sửa layer frame;
- kiểm tra alpha premultiplication và clipping ở composition edge.

Cases:

- một box-shadow ngoài với blur và spread;
- inset box-shadow;
- nhiều box-shadow có thứ tự chồng lấp;
- text-shadow một dòng và nhiều glyph/fallback font.

### P2.5 — Filter effects

Hỗ trợ theo đúng thứ tự token trong `filter`:

- `blur()` → `blur` effect;
- `brightness()` và `contrast()` → `color-adjust`;
- `grayscale()` → `grayscale`;
- `sepia()` → `sepia`;
- `invert()` → `invert`;
- `opacity()` → `filter-opacity`, phân biệt với layer `opacity`;
- `drop-shadow()` → alpha shadow.

Implementation:

- parser phải tạo effect list ordered, không gom các effect tùy tiện;
- color-adjust chỉ được fuse khi không làm thay đổi thứ tự với spatial effect;
- effect program luôn khai báo source/output surface riêng;
- backend capability phải trả diagnostic nếu không tạo được filter thay vì
  silently bỏ qua.

Cases:

- từng filter đơn ở các case riêng;
- color filters liên tiếp;
- blur xen giữa color filter;
- opacity filter khác layer opacity;
- drop-shadow sau blur.

### P2.6 — Blend mode và isolation

Hỗ trợ:

- `mix-blend-mode` theo danh sách V2;
- `isolation: auto | isolate`.

Implementation:

- `mix-blend-mode` lower vào `composite.blendMode`, không đổi `order`;
- `isolation: isolate` tạo offscreen group boundary;
- child blend phải blend với backdrop đúng scope, không blend nhầm với sibling
  bên ngoài group;
- test cả Browser CSS và Skia với nền có màu để phân biệt normal/multiply/screen.

Cases:

- một layer multiply trên nền;
- hai sibling blend khác nhau;
- group isolate với child blend;
- blend layer có opacity và filter kết hợp.

### P2.7 — clip-path

Hỗ trợ:

- `inset()`;
- `circle()`;
- `ellipse()`;
- `polygon()`;
- `path()` trong grammar path đã hỗ trợ.

Implementation:

1. Parse shape function thành normalized local path.
2. Resolve `%` theo reference box đã chỉ định.
3. Tạo `clipPaths[]` với `clipPathUnits` rõ ràng và gắn reference vào layer.
4. Intersect clip-path với `overflow: hidden` và composition clip.
5. Không biến clip-path thành mask alpha khi geometric clip đủ dùng.

Cases:

- inset với round corner;
- circle và ellipse khác tâm;
- polygon 3, 5 và 6 điểm ở các case riêng;
- path có hole/evenodd;
- clip-path kết hợp transform và overflow hidden.

### P2.8 — CSS mask và mask composite cơ bản

Phạm vi đầu:

- `mask-image` là asset URL hoặc gradient;
- `mask-position`, `mask-size`, `mask-repeat` ở mức tương tự background;
- `mask-mode: alpha | luminance`;
- `mask-composite: add | subtract | intersect | exclude` nếu backend có
  capability tương ứng.

Implementation:

- tạo mask source surface riêng, không vẽ mask như visible sibling;
- alpha mode lấy alpha; luminance mode dùng color-to-coverage deterministic;
- giữ thứ tự mask layers và phép composite giữa các layer;
- gắn kết quả vào layer `mask`/effect program, sau đó mới áp dụng opacity và
  blend của layer;
- nếu Protocol V2 chưa có mask layer list/composite, mở rộng schema trước khi
  triển khai compiler; không mã hóa composite bằng tên giả trong `sourceKey`.

Cases:

- alpha mask từ gradient;
- luminance mask từ ảnh;
- hai mask layer `add` và `intersect`;
- subtract/exclude với clipping ở composition edge;
- mask kết hợp clip-path và isolation.

## Paint order chuẩn

Mỗi drawable layer phải đi qua thứ tự logic sau:

```text
background layers
  → border
  → content fill/stroke
  → text/image content
  → outline
  → shadow/filter offscreen composition
  → clip/mask/composite theo scope
```

Thứ tự thực tế phải được xác nhận theo từng atom CSS; sơ đồ này là pipeline
boundary, không phải lý do để gộp tất cả thành một bitmap. `paint-order` của
SVG fill/stroke vẫn được giữ trong content paint pass.

## Test và nghiệm thu

### Unit/compiler

- parser test cho từng grammar và shorthand;
- cascade test cho `!important`, source order và custom property trong paint;
- golden JSON test kiểm tra assetId, stop order, box reference, effect order,
  clip/mask relation;
- negative test cho URL không có asset manifest, stop invalid, filter không hỗ
  trợ và mask composite không có capability.

### Browser/Playwright

- đọc DOM computed style và `getBoundingClientRect()` để xác nhận paint không
  làm đổi geometry;
- capture Browser reference ở viewport composition 1920×1080;
- kiểm tra iframe không có scrollbar/border do preview shell; CSS panel chỉ là
  presentation fit, không phải compiler coordinate space.

### Skia/runtime/export

- render native surface 1920×1080, sau đó mới thu nhỏ ở UI nếu cần;
- pixel/region comparison với Browser reference theo tolerance đã định cho
  antialiasing;
- kiểm tra paint bounds riêng với layout bounds;
- kiểm tra edge clipping, alpha premultiplication, offscreen lifetime và effect
  order;
- chạy cùng fixture qua preview và export để bảo đảm không có nhánh renderer
  riêng làm thay đổi semantic result.

## Definition of Done

Một property chỉ được đánh dấu hoàn tất khi:

1. CSS parser/cascade resolve được value hợp lệ và fail closed value không hỗ trợ.
2. Paint IR ghi lại đầy đủ thông tin cần thiết cho AI/editor và runtime.
3. Protocol V2 schema hoặc lowering contract biểu diễn được value không mơ hồ.
4. Compiler JSON giữ đúng tọa độ composition 1920×1080.
5. Browser, Skia preview và export có cùng geometry, paint order và clipping.
6. Có fixture riêng, unit test, Playwright capture và runtime test.
