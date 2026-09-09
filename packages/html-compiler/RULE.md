# HTML Compiler Rules

## Canonical single-file document

AI, MCP and Preview Lab integrations must pass one HTML string to
`compileDocument({ html })`. The filename is not part of the contract. The
document must contain exactly one `meta[name="neonix-document"]` whose JSON
`content` has `kind: "neonix-html-document"`, `schemaVersion: 2`, and the
composition fields `width`, `height`, `fps`, `background`, and `colorSpace:
"srgb"`.

CSS must be inside one or more inline `<style>` resources. The compiler joins
them in document order before parsing visual HTML. External stylesheets and
inline `style="..."` attributes are not part of this contract. The supported
`<title>` tag is document metadata only and never becomes a visual layer.

## Supported HTML vocabulary

`html-compiler` chỉ hỗ trợ các tag nằm trong allowlist dưới đây. Đây là danh sách chính thức dành cho authoring HTML tạo video.

Mọi tag không nằm trong danh sách đều **không được hỗ trợ** và compiler phải trả diagnostic:

```text
code: html-tag-unsupported
```

Compiler không được tự động bỏ qua, giữ nguyên hoặc hạ thấp một tag ngoài allowlist.

## 1. Document tags

Các tag cấu trúc document được hỗ trợ:

```html
html
head
meta
title
style
body
```

`style` is a document resource consumed only by `compileDocument`; it is
collected and removed before visual DOM lowering. It is not a visual layer.

## 2. Container tags

Các tag container dùng để tổ chức composition và layout:

```html
div
main
section
article
header
footer
nav
aside
figure
figcaption
```

Các tag này không tự tạo semantic visual primitive riêng. Kết quả lowering phụ thuộc vào CSS layout và nội dung con.

## 3. Text tags

Các tag text được hỗ trợ:

```html
h1
h2
h3
h4
h5
h6
span
p
strong
b
em
i
small
br
blockquote
pre
code
```

Quy tắc text:

- `h1`–`h6`, `p`, `blockquote`, `pre`, `code` là text-flow container.
- `span`, `strong`, `b`, `em`, `i`, `small` là inline text tags.
- `strong` và `b` được lower thành text span với `font-weight: 700`.
- `em` và `i` được lower thành text span với `font-style: italic`.
- `br` được lower thành semantic hard break trong `payload.layout.hardBreaks`.
- Nested inline tags được giữ bằng `chunks[].spans[]` và `sourceRange`; không được flatten mất style semantic.

## 4. Media tags

Các tag media được hỗ trợ:

```html
img
video
audio
```

- `img` được lower thành image layer.
- `video` được lower thành video layer.
- `audio` được lower thành audio track.

## 5. SVG tags

Các SVG tag được hỗ trợ trong HTML composition:

```html
svg
g
path
rect
circle
ellipse
line
polyline
polygon
```

Quy tắc SVG:

- `svg` và `g` là container/group.
- `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` được chuẩn hóa thành path layer.
- SVG primitive không được coi là HTML tag mở rộng; chúng là một phần của allowlist SVG chính thức.

## Complete allowlist

Danh sách đầy đủ, không bao gồm tag trùng lặp:

```text
html
head
meta
body
div
main
section
article
header
footer
nav
aside
figure
figcaption
h1
h2
h3
h4
h5
h6
span
p
strong
b
em
i
small
br
blockquote
pre
code
img
video
audio
svg
g
path
rect
circle
ellipse
line
polyline
polygon
```

## Unsupported examples

Các tag HTML phổ biến sau hiện không được hỗ trợ:

```html
form
input
button
select
textarea
table
ul
ol
li
label
iframe
canvas
script
style
link
title
```

Nếu cần thêm tag mới, phải cập nhật đồng thời allowlist, lowering semantics, Protocol V2 mapping và test fixtures trước khi tag được xem là supported.

## CSS property contract

`html-compiler` chỉ nhận các CSS property trong allowlist dưới đây. CSS custom property bắt đầu bằng `--` cũng được phép để dùng với `var()`.

Property được liệt kê là property được parser nhận diện; từng property vẫn có tập value/function được compiler và Protocol V2 biểu diễn được. Value ngoài contract phải trả diagnostic cụ thể, không được silently fallback.

### Position, box model and sizing

```css
position
position-anchor
anchor-name
inset
left
right
top
bottom
width
height
min-width
max-width
min-height
max-height
aspect-ratio
margin
margin-top
margin-right
margin-bottom
margin-left
padding
padding-top
padding-right
padding-bottom
padding-left
box-sizing
```

### Background, color and opacity

```css
background
background-color
background-image
background-position
background-size
background-repeat
background-origin
background-clip
color
opacity
```

### Typography and text layout

```css
font-size
font-family
font-weight
font-style
font-stretch
line-height
letter-spacing
word-spacing
white-space
text-align
direction
writing-mode
text-decoration
text-overflow
text-rendering
```

Supported text values include:

- `white-space`: `normal`, `nowrap`, `pre`, `pre-wrap`, `pre-line`, `break-spaces`.
- `text-align`: `start`, `end`, `left`, `right`, `center`, `justify`, `match-parent`, `justify-all`.
- `direction`: `ltr`, `rtl`.
- `writing-mode`: `horizontal-tb`, `vertical-rl`, `vertical-lr`.
- `text-overflow`: `clip`, `ellipsis`.
- `text-rendering`: `auto`, `optimizeSpeed`, `geometricPrecision`.
- `text-decoration`: solid underline, overline and line-through variants supported by the typography lowering.

### Display, visibility and overflow

```css
display
visibility
z-index
overflow
```

`display` hiện hỗ trợ `none`, `block`, `contents`, `flex` và `grid`. `visibility` hỗ trợ `visible` và `hidden`. `overflow` hỗ trợ `visible` và `hidden`.

### Border, outline and shadow

```css
border
border-width
border-style
border-color
border-top
border-right
border-bottom
border-left
border-top-width
border-right-width
border-bottom-width
border-left-width
border-top-style
border-right-style
border-bottom-style
border-left-style
border-top-color
border-right-color
border-bottom-color
border-left-color
border-radius
outline
outline-width
outline-style
outline-color
outline-offset
text-shadow
box-shadow
```

### Transform and 3D presentation

```css
transform
transform-origin
perspective
perspective-origin
transform-style
backface-visibility
```

### SVG paint and path styling

```css
fill
fill-opacity
fill-rule
stroke
stroke-width
stroke-opacity
stroke-linejoin
stroke-linecap
stroke-dasharray
stroke-dashoffset
paint-order
```

### Image and video presentation

```css
object-fit
object-position
image-rendering
```

### Flex layout

```css
flex-direction
flex-wrap
justify-content
justify-items
align-items
align-self
align-content
place-items
gap
row-gap
column-gap
flex
flex-basis
flex-grow
flex-shrink
order
```

### Grid layout

```css
grid-template-columns
grid-template-rows
grid-column
grid-column-start
grid-column-end
grid-row
grid-row-start
grid-row-end
```

### Animation

```css
animation
animation-name
animation-duration
animation-delay
animation-iteration-count
animation-direction
animation-fill-mode
animation-play-state
animation-timing-function
```

`@keyframes` được hỗ trợ cho các property mà compiler có thể lower thành Protocol V2 tracks. Animation không tạo ra một CSS runtime ngoài compiler contract.

### Effects, compositing, clipping, masking and motion path

```css
filter
backdrop-filter
mix-blend-mode
isolation
clip-path
mask-image
mask-position
mask-size
mask-repeat
mask-mode
mask-composite
offset-path
offset-distance
offset-rotate
offset-anchor
```

## CSS properties ngoài allowlist

Các property CSS không nằm trong allowlist phải bị từ chối với diagnostic:

```text
code: css-property-unsupported
```

Một số property có allowlist value riêng sẽ trả diagnostic chuyên biệt, ví dụ:

```text
css-display-unsupported
css-white-space-unsupported
css-text-align-unsupported
css-writing-mode-unsupported
css-transform-function-unsupported
css-filter-unsupported
css-clip-path-unsupported
```

Khi thêm property mới, phải cập nhật đồng thời `SUPPORTED_PROPERTIES`, parser value validation, lowering/runtime mapping và test fixtures.

## CSS value and function contract

Tên property hợp lệ nhưng value không hợp lệ vẫn phải bị từ chối. Không được đổi value sai thành value mặc định của browser.

### Global value rules

Các global keyword sau được cascade xử lý khi property hỗ trợ chúng:

```css
initial
inherit
unset
```

Các biểu thức số/độ dài được hỗ trợ trong những property có yêu cầu numeric:

```text
number
px
%
em
rem
vw
vh
vmin
vmax
```

Angle được hỗ trợ ở nơi cần góc:

```text
deg
rad
grad
turn
```

Các function số được hỗ trợ trong expression:

```text
calc()  min()  max()  clamp()  abs()  sign()
floor() ceil() round() mod() rem()
sin() cos() tan() asin() acos() atan() atan2()
sqrt() pow() hypot()
```

Function ngoài danh sách trên, đơn vị ngoài danh sách trên, expression sai đơn vị hoặc kết quả không hữu hạn đều không được hỗ trợ.

### Enumerated values

Các value enum hiện được phép:

```text
position:
  static | relative | absolute

display:
  none | block | contents | flex | grid

visibility:
  visible | hidden

overflow:
  visible | hidden

box-sizing:
  content-box | border-box

white-space:
  normal | nowrap | pre | pre-wrap | pre-line | break-spaces

text-align:
  start | end | left | right | center | justify | match-parent | justify-all

direction:
  ltr | rtl

writing-mode:
  horizontal-tb | vertical-rl | vertical-lr

text-overflow:
  clip | ellipsis

text-rendering:
  auto | optimizeSpeed | geometricPrecision

object-fit:
  contain | cover | fill | none

image-rendering:
  auto | optimizeQuality | optimizeSpeed | smooth | high-quality | crisp-edges | pixelated

background-repeat:
  repeat | repeat-x | repeat-y | no-repeat

background-origin / background-clip:
  border-box | padding-box | content-box

border-style:
  solid | none | dashed | dotted | double | groove | ridge | inset | outset

outline-style:
  solid | none

flex-direction:
  row | column

flex-wrap:
  nowrap | wrap | wrap-reverse

justify-content:
  flex-start | flex-end | center | space-between | space-around | space-evenly

align-items / align-self:
  stretch | flex-start | flex-end | center | baseline

align-content:
  stretch | flex-start | flex-end | center | space-between | space-around | space-evenly

justify-items:
  stretch | start | end | center

grid item alignment:
  stretch | start | end | center

grid content alignment:
  stretch | start | end | center | space-between | space-around | space-evenly | flex-start | flex-end

mix-blend-mode:
  normal | darken | multiply | color-burn | lighten | screen | color-dodge |
  overlay | soft-light | hard-light | difference | exclusion | hue | saturation |
  color | luminosity

isolation:
  auto | isolate

animation-direction:
  normal | reverse | alternate | alternate-reverse

animation-fill-mode:
  none | forwards | backwards | both

animation-play-state:
  running | paused
```

### Typography values

```text
font-weight:
  normal | bold | integer 1..1000

font-style:
  normal | italic | oblique

font-stretch:
  ultra-condensed | extra-condensed | condensed | semi-condensed | normal |
  semi-expanded | expanded | extra-expanded | ultra-expanded

text-decoration:
  underline | overline | line-through
  solid decoration style is supported; dotted, dashed, double and wavy are not
```

Font family must resolve to a compiler-provided font asset. CSS fallback to an unregistered system font is not supported.

### Color values

The deterministic color parser supports:

```text
#rgb
#rrggbb
#rrggbbaa
rgba(r, g, b, a)
transparent
currentColor
```

`none` is accepted as transparent only in background color contexts. Other color syntaxes such as named colors, `rgb()` space syntax, `hsl()`, `hsla()`, `hwb()`, `lab()` and `color()` are not supported by the current contract.

### Background and image functions

Supported image sources/functions:

```text
none
url(...)
image(...)
cross-fade(...)
linear-gradient(...)
radial-gradient(...)
conic-gradient(...)
repeating-linear-gradient(...)
repeating-radial-gradient(...)
repeating-conic-gradient(...)
```

`image()` candidates may use URL, supported gradient or color fallback. `element()` is explicitly unsupported. `cross-fade()` currently requires two URL image sources and accepts at most one percentage.

Background position only accepts keyword or `0%`, `50%`, `100%` pairs. Background size accepts `auto`, `cover`, `contain` or two explicit lengths.

### Transform values and functions

Supported transform functions:

```text
translate()       translate3d()
translateX()      translateY()      translateZ()
scale()           scale3d()
scaleX()          scaleY()          scaleZ()
perspective()
rotate()          rotateX()         rotateY()         rotateZ()
skew()            skewX()           skewY()
matrix()          matrix3d()
```

`transform` also accepts `none`. Transform angles require `deg`, `rad` or `turn`; unsupported transform functions must return `css-transform-function-unsupported`.

### Filter values and functions

Supported filter functions:

```text
blur(length)
brightness(number-or-percentage)
contrast(number-or-percentage)
grayscale(number-or-percentage)
sepia(number-or-percentage)
invert(number-or-percentage)
opacity(number-or-percentage)
drop-shadow(offset-x offset-y [blur] [color])
```

`blur()` and drop-shadow blur cannot be negative. Brightness/contrast must resolve to `0..4`; amount filters are clamped to `0..1`. Other filter functions such as `hue-rotate()`, `saturate()`, `url()` and `backdrop()` are not supported in the current filter contract.

### Clip, mask and motion-path values

```text
clip-path:
  none
  inset(...)
  circle(...)
  ellipse(...)
  polygon(...)
  path("closed SVG path")

clip-path reference box:
  border-box | padding-box | content-box

mask-mode:
  alpha | luminance

mask-composite:
  add | subtract | intersect | exclude

offset-path:
  none | path("single SVG path contour")

offset-rotate:
  auto | reverse | auto-reverse | <angle> | auto <angle> | reverse <angle>
```

Open clip paths, multiple motion-path contours, unsupported reference boxes and unsupported path functions are rejected.

### Grid track and placement values

Grid tracks support explicit non-negative lengths, `auto`, positive `fr` units and supported `repeat()` forms. Grid line values support `auto`, positive integer lines and `span <positive-integer>`.

Negative grid spans, invalid line numbers, unsupported track functions and out-of-range explicit placement are rejected.

### Animation values

Supported timing values:

```text
linear
ease
steps(positive-integer [, jump-start|jump-end|jump-none|jump-both|start|end])
cubic-bezier(x1, y1, x2, y2) with x1/x2 in 0..1
```

Animation time requires `ms` or `s`. Keyframe selectors must be `from`, `to` or a percentage. Animation track lowering currently supports opacity, transform, background-color, border-color, border-width, width, height, perspective, perspective-origin and motion-path distance/rotation when a valid offset path exists.

## Unsupported CSS values

Any value, function, unit, keyword combination or numeric result outside this contract must fail compilation. The compiler must use the most specific diagnostic available.

The following audit is based on the current implementation and tests in `packages/html-compiler`. A diagnostic existing in source is not, by itself, proof that the public contract is complete: a contract is considered verified only when the lowering/rejection path and a focused test are both present.

### Definition of support

Một CSS property/value chỉ được gọi là `supported` khi có đủ đường đi sau:

```text
CSS parser
  -> layout/paint/motion lowering
  -> Protocol V2 hợp lệ
  -> downstream compiler/runtime có thể tiêu thụ
  -> test hoặc fixture xác nhận
```

Các quy tắc bắt buộc:

- Chỉ parser nhận diện hoặc allowlist một property không có nghĩa là được hỗ trợ.
- Có diagnostic reject nhưng không có lowering tương ứng thì mặc định là `unsupported`.
- Có lowering tạo ra Protocol V2 nhưng runtime/Skia chưa render được thì chỉ là `compiler-supported`, chưa phải app-supported.
- Không có test/fixture thì implementation chưa được xem là public contract ổn định.
- Không được silently drop declaration hoặc fallback về browser behavior ngoài Protocol V2.

| Diagnostic | Current implementation | Test evidence | Contract status |
| --- | --- | --- | --- |
| `css-value-invalid` | `compiler/values.ts` rejects invalid numeric/unit/calc values | `src/_test_/values-advanced.test.ts` exercises invalid values, but accepts either `css-property-unsupported` or `css-value-invalid`; positive calc tests exist | Implementation verified; exact diagnostic not yet verified |
| `css-color-unsupported` | `compiler/paint.ts` rejects unsupported color syntax | `src/_test_/normalization.test.ts` + paint fixtures | Verified |
| `css-display-unsupported` | `compiler/css-parser.ts` validates the display allowlist | `src/index.test.ts` negative case + `src/_test_/phase3.test.ts` positive cases | Verified |
| `css-white-space-unsupported` | `compiler/css-parser.ts` validates the white-space allowlist | `src/index.test.ts` and preview fixtures cover accepted values; no focused negative diagnostic test | Lowering verified; rejection diagnostic not yet verified |
| `css-text-align-unsupported` | `compiler/css-parser.ts` validates the text-align allowlist | `src/index.test.ts` and preview fixtures cover accepted values; no focused negative diagnostic test | Lowering verified; rejection diagnostic not yet verified |
| `css-writing-mode-unsupported` | `compiler/css-parser.ts` validates the writing-mode allowlist | `src/index.test.ts` and preview fixtures cover accepted values; no focused negative diagnostic test | Lowering verified; rejection diagnostic not yet verified |
| `css-border-style-unsupported` | `compiler/css-parser.ts` and `compiler/paint.ts` validate border styles | `src/_test_/phase2-paint-border.test.ts` covers accepted styles; no focused negative diagnostic test | Lowering verified; rejection diagnostic not yet verified |
| `css-transform-function-unsupported` | `compiler/transform.ts` rejects unknown transform functions | `src/_test_/transform.test.ts` covers supported functions; no focused unknown-function test | Lowering verified; rejection diagnostic not yet verified |
| `css-transform-value-invalid` | `compiler/transform.ts` rejects non-finite scale values | No focused negative test; supported transform tests exist | Implementation-only; not a verified public contract |
| `css-filter-unsupported` | `compiler/filter.ts` rejects unknown filter functions | `src/index.test.ts` and preview fixtures cover supported filters; no focused negative diagnostic test | Lowering verified; rejection diagnostic not yet verified |
| `css-clip-path-unsupported` | `compiler/clip.ts` rejects unknown clip-path functions | `src/index.test.ts` and preview fixtures cover supported shapes; no focused negative diagnostic test | Lowering verified; rejection diagnostic not yet verified |
| `css-object-fit-invalid` | `compiler/media.ts` validates object-fit values | `src/_test_/media.test.ts` and preview fixtures cover accepted values; no focused negative diagnostic test | Lowering verified; rejection diagnostic not yet verified |
| `css-object-position-unsupported` | `compiler/media.ts` validates supported keyword/percentage pairs | `src/_test_/media.test.ts` and preview fixtures cover accepted values; no focused negative diagnostic test | Lowering verified; rejection diagnostic not yet verified |
| `css-animation-easing-invalid` | `compiler/animation.ts` validates steps/cubic-bezier/easing names | `src/_test_/animation.test.ts` + preview negative fixture | Verified |
| `css-motion-path-unsupported` | `compiler/motion-path.ts` accepts only `none` or one quoted `path(...)` | `src/_test_/animation.test.ts` + preview fixtures cover valid paths; no focused unsupported-syntax test | Lowering verified; rejection diagnostic not yet verified |

Therefore, the rows marked “implementation-only” or “rejection diagnostic not yet verified” must not be presented as fully certified support. They are current compiler behavior, but require a focused negative fixture before becoming a stable RULE contract. When a new value/function is added, update the implementation, this table, and both positive and negative tests.

## Không hỗ trợ trong video/design-motion runtime

Các thuộc tính hoặc cơ chế dưới đây không được đưa vào Protocol V2 runtime. Nếu parser nhận diện chúng để báo diagnostic thì diagnostic phải giữ nguyên ranh giới này; không được giả lập browser behavior bằng runtime state ngầm.

### Tương tác trình duyệt

Các thuộc tính chỉ phục vụ interaction hoặc hit testing không thuộc video render contract:

- `cursor`
- `pointer-events` khi chỉ phục vụ hit testing
- `user-select`
- `touch-action`
- `caret-color`
- `resize`
- `appearance`
- `accent-color`
- `color-scheme`

### Scroll và môi trường trang

Không hỗ trợ các semantic phụ thuộc scroll container hoặc browser page environment:

- `scroll-behavior`
- `scroll-snap-*`
- `overscroll-behavior`
- scrollbar styling
- `scrollbar-gutter`
- `position: sticky`
- scroll-driven timelines
- scroll-driven animation state

### Responsive query và viewport syntax

Composition video dùng viewport cố định, vì vậy không lower các cơ chế responsive động sau:

- `container-type`
- `container-name`
- `@container`
- dynamic responsive `@media` variants
- `cqw`, `cqh`, `cqi`, `cqb`, `cqmin`, `cqmax`
- `dvw`, `dvh`, `sv*`, `lv*` và logical viewport variants
- `position-area`
- `position-try`

### In ấn và document flow không phục vụ composition

Không hỗ trợ các property/rule chỉ có ý nghĩa khi phân trang hoặc in tài liệu:

- `@page`
- `print-color-adjust`
- `break-before`
- `break-after`
- `break-inside`
- `orphans`
- `widows`
- page margin
- page size

### Browser optimization hints

Các hint tối ưu của browser không trở thành Protocol V2 visual semantic:

- `will-change`
- `contain` runtime
- `content-visibility`
- `contain-intrinsic-size`
- `background-attachment: fixed`
- `background-attachment: local`

### Transition và UI state

Các property sau không phải animation contract chính của video:

- `transition`
- `transition-duration`
- `transition-delay`

Transition phụ thuộc state change và interaction của browser. Nếu cần hỗ trợ trong tương lai, compiler phải chuyển state transition thành V2 tracks tường minh. Mặc định các property này phải được xử lý là `compile-only` hoặc `unsupported`, không được coi là animation runtime ngầm.

## Normative excluded CSS surface

The compiler targets deterministic

```text
HTML/CSS -> Protocol V2 -> Runtime/Skia
```

output, not a complete browser layout engine. An excluded feature must produce
an explicit diagnostic; it must never be silently ignored, approximated as a
different feature, or emitted as an invalid Protocol V2 layer.

### Float-based layout

The following are excluded:

- `float: left | right | inline-start | inline-end`
- `clear`
- `shape-outside`
- `shape-margin`
- `shape-image-threshold`

These features must not be lowered into a mask, clip path, absolute offset or
grid/flex substitute. The deterministic alternatives are explicit layout,
masks, clip paths, paths and text constraints.

### Table and paginated document layout

The following are outside the motion profile:

- `display: table`, `table-row`, `table-cell`
- table layout algorithms, `caption-side` and border-collapsing
- table intrinsic sizing
- multi-column layout: `column-count`, `column-width`, `column-gap`
- column balancing
- CSS fragmentation, regions and paged media

These algorithms are document-flow and pagination systems and do not map to
the fixed-frame layer model.

### Browser interaction and stateful layout

The compiler does not compile layout that depends on live browser state:

- `:hover`, `:focus`, `:active`, `:visited` and pointer/keyboard state
- DOM event handlers
- script-generated style mutation
- selection, caret, editing and accessibility-tree layout
- intrinsic layout driven by an unbounded live DOM outside the source input

Interactivity must be represented as explicit application state or animation
tracks.

### Browser-owned rendering features

The following are not part of the V2 motion paint contract:

- CSS Houdini/custom paint worklets
- browser UI, safe-area behavior and platform-specific form controls
- native scrolling chrome and scrollbar painting
- scroll-driven timelines and scroll-driven animation state
- `@media`/`@container` responsive query state
- container queries and dynamic responsive media-query state
- dynamic, small and large viewport units: `dvw`, `dvh`, `sv*`, `lv*`
- container-relative units: `cq*`
- logical viewport units: `vi`, `vb`, `svi`, `svb`, `lvi`, `lvb`, `dvi`, `dvb`
- transition-based state interpolation
- browser optimization hints such as `will-change`, `content-visibility`,
  runtime `contain` and `contain-intrinsic-size`
- print-only color management and pagination behavior

### Explicitly unsupported until a V2 contract exists

The following features remain blocked until their deterministic source and
runtime contracts are defined:

- `element()` image sources
- complex `image-set()` source selection
- arbitrary CSS custom functions and Houdini values
- browser-dependent `env()` values
- `ex`, `ch`, `cap` and `ic` units until deterministic font metrics exist
- `Q` and other authoring units without a motion use case
- `position-area` and `position-try` anchor fallback algorithms
- layout-dependent intrinsic media sizing when asset metadata is missing

Until the contract is added, the compiler must emit a feature-specific
diagnostic instead of falling back to a color, empty paint or unrelated asset.

### Features compatible with the motion profile

The following are valid roadmap items and must not be added to the exclusion
list merely because they are incomplete:

- `anchor()` and `anchor-size()` positioning
- projective transforms, masks, filters and 3D surfaces
- `image()` and URL-based `cross-fade()` within their documented asset subset

They require compiler, Protocol V2 and Runtime/Skia tests before being enabled.

### Exclusion implementation rules

1. Unsupported declarations fail closed with a stable diagnostic code and source location.
2. No unsupported feature may alter layout, paint order, opacity, clipping or animation timing as a side effect.
3. A feature may be removed from this exclusion list only after its semantic contract is represented in Protocol V2 and has compiler, runtime and Skia coverage.
4. Browser parity is required only for the supported deterministic subset. For excluded features, an explicit diagnostic is the expected behavior.
5. New preview cases must be classified by semantic category: layout, paint, effect, viewport, container, transform/3D, typography/media, animation or combined pipeline.
