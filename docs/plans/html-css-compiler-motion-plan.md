# HTML/CSS Compiler for Video Motion — Implementation Plan

## Mục tiêu

Xây dựng compiler theo pipeline:

```text
HTML/CSS source
  → parse + cascade + normalize
  → resolve geometry trong composition cố định
  → lower visual semantics
  → Protocol V2 JSON
  → Skia / SVG / export
```

Compiler không nhằm sao chép toàn bộ browser CSS. JSON V2 là visual scene contract: chỉ giữ dữ liệu cần để render ổn định, seek được, export được và có thể đối chiếu với SVG native.

## Nguyên tắc phạm vi

- Property ảnh hưởng đến hình ảnh cuối cùng phải được hỗ trợ, compile-only hoặc báo diagnostic; không silently ignore.
- Layout CSS là input để tính geometry. Sau khi compile, `flex`, `grid`, `margin` và `padding` không nhất thiết phải xuất hiện trong runtime JSON.
- Mỗi property phải có một đích semantic rõ ràng: `frame`, `transform`, `paint`, `style`, `effects`, `clip/mask`, `text`, `media`, `composite` hoặc `tracks`.
- Renderer phải nhận giá trị deterministic theo composition viewport cố định, không phụ thuộc layout của trang docs.
- Browser reference chỉ là oracle để so sánh các feature đã nằm trong support matrix; không phải cam kết browser parity toàn bộ CSS.

## Contract hiện tại cần tuân thủ

- V2 layer base dùng các nhóm `frame`, `transform`, `opacity`, `visibility`, `clipPath`, `mask`, `filter`, `composite`, `timing` và `tracks`.
- Keyframe time ở biên Protocol V2 dùng milliseconds. Runtime có thể đổi sang seconds nội bộ.
- Transform angle và gradient angle giữ convention degrees của runtime hiện tại. Parser có thể nhận `rad`/`turn` rồi normalize về degrees.
- Màu đầu vào được canonicalize về format mà V2/renderer hỗ trợ; không tự thêm một color schema CSS mới vào V2.
- `size`/`layout` của geometry có thể là compiler IR và phải lower vào `frame`/`transform`; riêng `payload.layout` của text là semantic V2 contract đã được chuẩn hóa cho AI, user và HTML/CSS compiler.

## P0 — Thuộc tính phổ biến cần xử lý trước

Đây là phạm vi đầu tiên cho CSS motion compiler. Mỗi nhóm cần parser, normalization, V2 lowering và fixture đối chiếu native browser.

### 1. Cascade và value normalization

Giữ:

- selector tag, class, id, descendant và selector list;
- specificity, source order, inheritance;
- CSS custom properties `--name` và `var(--name, fallback)`;
- `initial`, `inherit`, `unset` ở các property được hỗ trợ;
- shorthand và longhand phổ biến;
- `!important` trong cascade;
- `none`, `auto`, `transparent`, `currentColor` theo từng property hợp lệ.

Hàm giá trị cần ưu tiên:

- `calc()`;
- `min()`;
- `max()`;
- `clamp()`.

Chưa cần triển khai toàn bộ CSS Values grammar. Parser phải fail closed và trả source location khi gặp hàm/property chưa hỗ trợ.

### 2. Composition và geometry

Giữ và compile trước:

- `width`, `height`;
- `min-width`, `max-width`, `min-height`, `max-height`;
- `aspect-ratio`;
- `box-sizing`;
- `margin`, `margin-top/right/bottom/left`;
- `padding`, `padding-top/right/bottom/left`;
- `position: static | relative | absolute`;
- `top`, `right`, `bottom`, `left`, `inset`;
- `display: block | contents | none`;
- `visibility: visible | hidden`;
- `opacity`;
- `z-index`;
- `overflow: visible | hidden` cho clipping cơ bản.

Logical properties như `inset-inline-start` chỉ được chấp nhận sau khi compiler đã resolve `direction` và `writing-mode`, sau đó normalize thành physical coordinates.

Mapping chính:

```text
width/height/min/max/aspect-ratio/margin/padding
  → resolve layout
  → frame

position/inset/z-index
  → transform/order/containing-block resolution

display:none
  → omit subtree

visibility:hidden
  → V2 visibility/enabled contract

opacity
  → V2 opacity
```

### 3. Transform 2D

Giữ:

- `transform`;
- `transform-origin`;
- `translate`, `translateX`, `translateY`;
- `scale`, `scaleX`, `scaleY`;
- `rotate`, `rotateZ`;
- `skew`, `skewX`, `skewY`.

Phải bảo toàn thứ tự operation theo CSS trước khi lower vào V2 transform. Cần test riêng transform quanh origin mặc định, origin phần trăm, transform kết hợp và animation transform.

### 4. Paint và border phổ biến

Giữ:

- `background-color`;
- `background` với solid color;
- `linear-gradient()`;
- `radial-gradient()`;
- `conic-gradient()` nếu backend capability đã xác định;
- `background` nhiều layer với thứ tự rõ ràng;
- `color`;
- `border`, `border-width`, `border-style`, `border-color` với solid/none;
- `border-radius` uniform;
- SVG `fill`, `fill-opacity`, `fill-rule`;
- SVG `stroke`, `stroke-width`, `stroke-opacity`, `stroke-linejoin`, `stroke-linecap`;
- `stroke-dasharray`, `stroke-dashoffset`, `paint-order`.

Background image và pattern cần lower thành paint/image/pattern semantic; không tạo một CSS-only object trong V2.

### 5. Media

Giữ:

- `object-fit: contain | cover | fill | none`;
- `object-position`;
- `image-rendering` với các mode renderer có thể đảm bảo;
- kích thước và clipping của image/video.

Ảnh và video phải giữ aspect-ratio deterministic và mapping nhất quán với `preserveAspectRatio`/fit hiện có.

### 6. Typography cơ bản

Ưu tiên sau geometry nhưng vẫn thuộc P0:

- `font-family`;
- `font-size`;
- `font-weight`;
- `font-style`;
- `font-stretch` ở các giá trị V2 hỗ trợ;
- `line-height`;
- `text-align`;
- `letter-spacing`;
- `word-spacing`;
- `white-space`;
- `direction`;
- `writing-mode`;
- `text-decoration` cơ bản;
- `text-overflow` chỉ khi đã có clipping deterministic;
- `text-rendering` theo capability.

Font phải resolve từ asset manifest/fallback policy. Không coi browser font fallback ngẫu nhiên là output chuẩn của compiler.

## P1 — Thuộc tính xử lý sau khi P0 ổn định

### Layout nâng cao

- `display: flex` và toàn bộ flex container/item phổ biến;
- `display: grid`, `grid-template-*`, `grid-*`;
- `gap`, `row-gap`, `column-gap`;
- `align-*`, `justify-*`, `place-*`;
- `order`;
- `flex`, `flex-grow`, `flex-shrink`, `flex-basis`;
- margin collapsing và containing block edge cases.

Các thuộc tính này nên được bake thành absolute geometry trong V2, trừ khi runtime thực sự cần thay đổi layout theo thời gian.

### Paint nâng cao

- `background-image` với URL asset;
- `background-position`;
- `background-size`;
- `background-repeat`;
- `background-origin`, `background-clip`;
- `repeating-linear-gradient`, `repeating-radial-gradient`, `repeating-conic-gradient`;
- border từng cạnh;
- border style nâng cao;
- per-corner và elliptical `border-radius`;
- `outline`, sau khi xác định mapping không làm sai layout;
- `text-shadow`;
- `box-shadow`;
- `filter: blur`, `brightness`, `contrast`, `grayscale`, `sepia`, `invert`, `opacity`, `drop-shadow`;
- `mix-blend-mode`, `isolation`;
- `clip-path` với inset/circle/ellipse/polygon/path;
- CSS mask và mask composite cơ bản.

### Color và font nâng cao

- named colors;
- `rgb()`, `rgba()`, `hsl()`, `hsla()`;
- alpha syntax hiện đại;
- `color-mix()`;
- `font-variation-settings`;
- `font-feature-settings`;
- `font-kerning`;
- `font-optical-sizing`;
- `font-variant-*`;
- `@font-face` và asset loading.

Wide-gamut color như `display-p3`, `lab`, `oklab`, `lch`, `oklch`, `rec2020` chỉ triển khai sau khi cả Protocol, Skia và export có policy color management thống nhất.

### Motion và animation

- `@keyframes`;
- `animation-name`;
- `animation-duration`;
- `animation-delay`;
- `animation-iteration-count`;
- `animation-direction`;
- `animation-fill-mode`;
- `animation-play-state`;
- `animation-timing-function` với `linear`, `steps()` và cubic-bezier;
- animation của `transform`, `opacity`, màu, frame size nếu V2 track có thể biểu diễn.

CSS animation nên compile thành V2 `tracks` với keyframe time milliseconds, typed value và easing. Không tạo runtime CSS animation engine riêng.

### Motion path

- `offset-path`;
- `offset-distance`;
- `offset-rotate`;
- `offset-anchor`.

Đây là nhóm có giá trị cao cho motion design nhưng cần thống nhất path sampling, tangent rotation và export trước khi bật mặc định.

## P2 — Chỉ xử lý khi có nhu cầu sản phẩm rõ ràng

- `perspective`, `perspective-origin`;
- `transform-style`, `backface-visibility` đầy đủ;
- `matrix()`, `matrix3d()`;
- `backdrop-filter`;
- advanced mask compositing;
- `shape-outside`, `shape-margin`, `shape-image-threshold`;
- `image()`/`cross-fade()`/`element()`;
- trig functions và power/rounding functions nâng cao;
- anchor positioning;

Các tính năng P2 cần một policy rõ ràng về viewport, asset, browser capability và export fallback trước khi đưa vào contract.

## Không hỗ trợ trong video/design-motion runtime

Các thuộc tính sau có thể bị parser nhận diện để báo diagnostic, nhưng không đưa vào Protocol V2 runtime:

### Tương tác trình duyệt

- `cursor`;
- `pointer-events` khi chỉ phục vụ hit testing;
- `user-select`;
- `touch-action`;
- `caret-color`;
- `resize`;
- `appearance`;
- `accent-color`;
- `color-scheme`.

### Scroll và môi trường trang

- `scroll-behavior`;
- `scroll-snap-*`;
- `overscroll-behavior`;
- scrollbar styling;
- `scrollbar-gutter`;
- `position: sticky`;
- scroll-driven timelines và scroll-driven animation state.

### Responsive query and viewport syntax

- `container-type`, `container-name`, `@container`;
- dynamic responsive `@media` variants;
- `cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`;
- `dvw`, `dvh`, `sv*`, `lv*` and logical viewport variants;
- `position-area` and `position-try`.

### In ấn và document flow không phục vụ composition

- `@page`;
- `print-color-adjust`;
- `break-before`, `break-after`, `break-inside`;
- `orphans`, `widows`;
- page margin/size.

### Browser optimization hint

- `will-change`;
- `contain` runtime;
- `content-visibility`;
- `contain-intrinsic-size`;
- `background-attachment: fixed | local`.

### Transition và state UI

`transition`, `transition-duration`, `transition-delay` không nên là cơ chế animation chính cho video. Transition phụ thuộc state change và interaction của browser. Nếu cần, compiler phải chuyển state transition thành V2 tracks tường minh; mặc định nên báo `compile-only` hoặc `unsupported`.

## Đơn vị và hàm giá trị

### P0

- length: `px`, `%`, `em`, `rem`, `vw`, `vh`;
- special: `auto`, `none` theo property;
- angle: `deg`, nhận thêm `rad`/`turn` rồi normalize về degrees;
- time: `ms`, `s` ở CSS input nhưng output V2 là milliseconds;
- arithmetic: `calc`, `min`, `max`, `clamp`.

### Xử lý sau

- `ex`, `ch`, `cap`, `ic` sau khi font metrics ổn định;
- `fr` chỉ trong grid compiler;
- resolution units chỉ dành cho image/render quality policy, không phải geometry;
- `Q` và các đơn vị hiếm không cần trong motion compiler.

## Support matrix bắt buộc

Mỗi property mới phải được ghi vào matrix với các cột:

```text
CSS property
accepted syntax
normalization
compile phase
V2 target
Skia support
SVG support
export support
fallback/diagnostic
fixture id
```

Không thêm property vào `SUPPORTED` chỉ vì parser đọc được. Chỉ thêm khi đã có V2 lowering, renderer behavior và test native comparison.

## Trình tự triển khai đề xuất

1. Xóa fixture HTML compiler cũ và tạo lại preview từ trạng thái rỗng.
2. Tách property capability registry khỏi parser để có trạng thái `runtime`, `compile-only`, `deferred`, `unsupported`.
3. Hoàn thiện cascade, shorthand, logical normalization và `calc/min/max/clamp`.
4. Hoàn thiện geometry P0 và thêm fixture từng property.
5. Hoàn thiện paint/media P0.
6. Hoàn thiện typography cơ bản và font asset policy.
7. Compile `@keyframes` thành V2 tracks.
8. Chỉ sau khi có parity report ổn định mới mở P1/P2.

## Tiêu chí hoàn thành P0

- Mỗi property P0 có ít nhất một fixture tối thiểu và một fixture kết hợp.
- Native browser và Skia được capture cùng viewport, DPR, font và thời điểm.
- JSON V2 validate thành công trước khi chạy renderer.
- Không có property ảnh hưởng visual bị silently ignored.
- Seek đến cùng một time cho kết quả deterministic.
- Unsupported property tạo diagnostic có code, property, selector và source location.
- Preview `/docs/preview/html-compiler` chỉ hiển thị các fixture CSS đã được thêm lại có chủ đích.

### Protocol V2 text layout contract

Typography P0 lowers CSS into an optional, CSS-independent `payload.layout`
contract. V2 keeps `source` for text, language, direction and writing semantics
and `chunks[].spans[]` for SVG-compatible ranges, font and paint. The layout
contract carries resolved `lineHeight`, `textAlign`, `whiteSpace`, `wrap` and
`textOverflow`; ellipsis is valid only with deterministic layer clipping.
Runtime glyph shaping remains a separate materialization step.
