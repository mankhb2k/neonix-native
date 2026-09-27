---
name: neonix-html-compiler-contract
description: Authoritative reference for the HTML tags, CSS properties and values the Neonix HTML compiler accepts, so an AI agent authors Neonix motion-video HTML that compiles on the first try instead of guessing and iterating on diagnostics.
---

# Neonix HTML Compiler Contract

## Purpose

Neonix compiles one self-contained HTML document into `MotionProtocolV2` JSON,
the canonical source of truth for preview and export. The compiler is **not**
a browser: it accepts a deliberately small, deterministic HTML/CSS subset and
fails closed (returns a diagnostic) on anything outside that subset instead of
approximating it. This skill is the static contract distilled from
`packages/html-compiler/RULE.md` and `packages/html-compiler/README.md` so an
agent can write compiler-compatible HTML directly.

Use this skill together with, not instead of, the `neonix-html-authoring` /
`neonix-project-workflow` skills: those own the MCP tool workflow
(`validate_html`, `update_project_html`, revision guards); this skill owns
"what HTML/CSS is legal." If a live `get_capabilities` result ever disagrees
with this document, trust the live tool result — the compiler is the ground
truth and this reference can drift.

For a throwaway HTML snippet written only to test or debug the compiler, this
level of detail is overkill — use `neonix-html-debug-scaffold` instead and
let `validate_html` diagnostics answer "is this supported" directly. Reach
for this skill when the result needs to be right on the first try: real
project authoring, or explaining *why* a diagnostic fired.

## When to use

Read this before writing or editing any HTML/CSS for a Neonix project:
creating a new composition, adding a layer, animating something, or fixing a
`validate_html` diagnostic. Re-check the relevant section whenever a
diagnostic mentions `html-tag-unsupported`, `css-property-unsupported`, or any
`css-*-unsupported` code.

## Non-negotiable rules

1. **One HTML document, HTML → JSON only.** The document is the sole input;
   never author or hand-edit `MotionProtocolV2` JSON to reproduce something
   HTML can already express, and never try to reverse-compile JSON back into
   HTML.
2. **Fail-closed, no approximation.** An unsupported tag, property, value, or
   combination must be rejected, not silently dropped, substituted, or
   emulated with a different mechanism (e.g. never fake `float` with absolute
   positioning, never fake a named CSS color with a close hex guess).
3. **CSS lives in `<style>` elements only.** No external stylesheets
   (`<link>`), no inline `style="..."` attributes, no `<script>`, no
   JavaScript, events, forms, or other browser-interactive behavior.
4. **Composition is fixed and explicit.** Width, height, fps, background, and
   color space come only from the required `meta[name="neonix-document"]`
   manifest (see below) and must never be silently changed from what the user
   requested.
5. **Everything is deterministic.** No live browser state, no responsive
   queries, no scroll, no hover/focus/active, no transitions driven by
   interaction — only what a static document plus `@keyframes` can express.

## Document contract

Exactly one `meta[name="neonix-document"]` tag, whose JSON `content` supplies
the composition:

```html
<meta
  name="neonix-document"
  content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'
>
```

- Common compositions: 1920×1080 (16:9), 1080×1920 (9:16), 1080×1080 (1:1).
  Use whatever the user asked for; never default over it silently.
- `colorSpace` is always `"srgb"`.
- Duration is never set directly — it is `max(durationMs, longest @keyframes
  timeline in the document)`. Set `durationMs` only to hold the export open
  past the last animation (e.g. to match a music track length); it can never
  truncate content.
- `<title>` is metadata only, never a visual layer.

## Supported HTML tags (complete allowlist)

Anything not in this list fails with `html-tag-unsupported`:

```text
html head meta body
div main section article header footer nav aside figure figcaption
h1 h2 h3 h4 h5 h6 span p strong b em i small br blockquote pre code
img video audio
svg g path rect circle ellipse line polyline polygon
style   (document resource only — collected and stripped before lowering, never a layer)
```

Common tags that look plausible but are **not supported** — do not use them,
and do not approximate their effect with a supported tag:
`form`, `input`, `button`, `select`, `textarea`, `table`/`ul`/`ol`/`li`,
`label`, `iframe`, `canvas`, `script`, `link`.

### How a tag lowers

The compiler ignores the tag's own "meaning" for Protocol output and instead
classifies by resolved CSS + children:

| Condition | Protocol output |
| --- | --- |
| Paint (background/border/shadow), no children | `shape` |
| No paint, has children | `group` (or the wrapper is omitted if fully transparent) |
| Paint + children | `group` + a `::paint` shape sublayer |
| Text content | text chunk/span (`TextLayout`/`GlyphRun`) |
| `img` | `image` layer |
| `video` | `video` layer |
| `audio` | root `audio.tracks[].clips[]` (one track/clip per tag — see limits below) |
| `svg`/`g` | `group` |
| `path`/`rect`/`circle`/`ellipse`/`line`/`polyline`/`polygon` | `path` layer |

`strong`/`b` → span with `font-weight:700`; `em`/`i` → span with
`font-style:italic`; `br` → a semantic hard break, not a layout hack (don't
use `br` to patch an incorrectly sized box).

Element identity: use a stable HTML `id` (`^[A-Za-z][A-Za-z0-9_-]{0,199}$`,
unique) whenever the element must survive sibling edits; otherwise the
compiler derives a structural path that shifts if siblings change.

## Supported CSS properties (complete allowlist)

A property not listed fails with `css-property-unsupported`. Custom
properties (`--name`, consumed via `var(--name, fallback)`) are always
allowed.

```text
# Position, box model, sizing
position position-anchor anchor-name inset left right top bottom
width height min-width max-width min-height max-height aspect-ratio
margin margin-top margin-right margin-bottom margin-left
padding padding-top padding-right padding-bottom padding-left
box-sizing

# Background, color, opacity
background background-color background-image background-position
background-size background-repeat background-origin background-clip
color opacity

# Typography
font-size font-family font-weight font-style font-stretch line-height
letter-spacing word-spacing white-space text-align direction writing-mode
text-decoration text-overflow text-rendering

# Display / visibility / overflow
display visibility z-index overflow

# Border, outline, shadow
border border-width border-style border-color
border-top/right/bottom/left (+ -width/-style/-color per side)
border-radius outline outline-width outline-style outline-color
outline-offset text-shadow box-shadow

# Transform / 3D
transform transform-origin perspective perspective-origin
transform-style backface-visibility

# SVG paint
fill fill-opacity fill-rule stroke stroke-width stroke-opacity
stroke-linejoin stroke-linecap stroke-dasharray stroke-dashoffset paint-order

# Image / video presentation
object-fit object-position image-rendering

# Flex
flex-direction flex-wrap justify-content justify-items align-items
align-self align-content place-items gap row-gap column-gap
flex flex-basis flex-grow flex-shrink order

# Grid
grid-template-columns grid-template-rows
grid-column grid-column-start grid-column-end
grid-row grid-row-start grid-row-end

# Animation
animation animation-name animation-duration animation-delay
animation-iteration-count animation-direction animation-fill-mode
animation-play-state animation-timing-function

# Effects / compositing / clipping / masking / motion path
filter backdrop-filter mix-blend-mode isolation clip-path
mask-image mask-position mask-size mask-repeat mask-mode mask-composite
offset-path offset-distance offset-rotate offset-anchor
```

### Enumerated / value-restricted properties — exact accepted values

```text
position:        static | relative | absolute
display:          none | block | contents | flex | grid
visibility:       visible | hidden
overflow:         visible | hidden
box-sizing:       content-box | border-box
white-space:      normal | nowrap | pre | pre-wrap | pre-line | break-spaces
text-align:       start | end | left | right | center | justify | match-parent | justify-all
direction:        ltr | rtl
writing-mode:     horizontal-tb | vertical-rl | vertical-lr
text-overflow:    clip | ellipsis   (ellipsis only with overflow:hidden + white-space:nowrap + horizontal writing mode)
text-rendering:   auto | optimizeSpeed | geometricPrecision
text-decoration:  underline | overline | line-through, SOLID style only (dotted/dashed/double/wavy are rejected)
object-fit:       contain | cover | fill | none
image-rendering:  auto | optimizeQuality | optimizeSpeed | smooth | high-quality | crisp-edges | pixelated
background-repeat: repeat | repeat-x | repeat-y | no-repeat
background-origin / background-clip: border-box | padding-box | content-box
border-style:     solid | none | dashed | dotted | double | groove | ridge | inset | outset
outline-style:    solid | none
font-weight:      normal | bold | integer 1..1000
font-style:       normal | italic | oblique
font-stretch:     ultra-condensed .. ultra-expanded (9-step keyword scale)
flex-direction:   row | column
flex-wrap:        nowrap | wrap | wrap-reverse
justify-content:  flex-start | flex-end | center | space-between | space-around | space-evenly
align-items / align-self: stretch | flex-start | flex-end | center | baseline
align-content:    stretch | flex-start | flex-end | center | space-between | space-around | space-evenly
justify-items / grid item alignment: stretch | start | end | center
grid content alignment: stretch | start | end | center | space-between | space-around | space-evenly | flex-start | flex-end
mix-blend-mode:   normal | darken | multiply | color-burn | lighten | screen | color-dodge | overlay | soft-light | hard-light | difference | exclusion | hue | saturation | color | luminosity
isolation:        auto | isolate
animation-direction: normal | reverse | alternate | alternate-reverse
animation-fill-mode: none | forwards | backwards | both
animation-play-state: running | paused
```

### Colors — hex/rgba only, no named colors, no hsl/lab/color()

```text
#rgb  #rrggbb  #rrggbbaa  rgba(r, g, b, a)  transparent  currentColor
```

Named colors (`red`, `steelblue`, ...), `rgb()` space syntax, `hsl()`,
`hsla()`, `hwb()`, `lab()`, `color()` are **all unsupported** —
`css-color-unsupported`. Always author literal hex or `rgba()`.

### Units, angles, math functions

```text
Lengths:   number px % em rem vw vh vmin vmax
Angles:    deg rad grad turn
Functions: calc() min() max() clamp() abs() sign()
           floor() ceil() round() mod() rem()
           sin() cos() tan() asin() acos() atan() atan2()
           sqrt() pow() hypot()
Global keywords: initial inherit unset
```

`ex`, `ch`, `cap`, `ic`, `Q`, container-relative units (`cq*`), dynamic/small/
large viewport units (`dvw`, `dvh`, `sv*`, `lv*`) and logical viewport units
(`vi`, `vb`, ...) are **not supported**.

### Backgrounds and images

```text
none  url(...)  image(...)  cross-fade(...)
linear-gradient() radial-gradient() conic-gradient()
repeating-linear-gradient() repeating-radial-gradient() repeating-conic-gradient()
```

`background-position` only accepts keywords or `0%`/`50%`/`100%` pairs.
`background-size` accepts `auto`, `cover`, `contain`, or two explicit
lengths. `element()` is explicitly unsupported (reserved for later).
`cross-fade()` requires exactly two URL sources and at most one percentage.

### Transform functions

```text
translate() translate3d() translateX() translateY() translateZ()
scale() scale3d() scaleX() scaleY() scaleZ()
rotate() rotateX() rotateY() rotateZ()
skew() skewX() skewY()
matrix() matrix3d() perspective()
```

Angles require `deg`/`rad`/`turn`. Unknown functions →
`css-transform-function-unsupported`.

### Filter functions

```text
blur(length)              — never negative
brightness(number|%)      contrast(number|%)   — clamp to 0..4
grayscale(number|%) sepia(number|%) invert(number|%) opacity(number|%) — clamp to 0..1
drop-shadow(x y [blur] [color])
```

`hue-rotate()`, `saturate()`, `url()`, `backdrop()` filter functions are
**not supported**.

### Clip-path / mask / motion path

```text
clip-path: none | inset() | circle() | ellipse() | polygon() | path("closed SVG path")
           reference box: border-box | padding-box | content-box
mask-mode: alpha | luminance
mask-composite: add | subtract | intersect | exclude
offset-path: none | path("single SVG path contour")
offset-rotate: auto | reverse | auto-reverse | <angle> | auto <angle> | reverse <angle>
```

Open (non-closed) clip paths and multiple motion-path contours are rejected.

### Grid tracks

Explicit non-negative lengths, `auto`, positive `fr`, and simple `repeat()`
for tracks; `auto`, positive integer lines, or `span <positive-integer>` for
placement. Negative spans, invalid line numbers and unsupported track
functions are rejected. **Grid auto-placement beyond the deterministic
row-major default, named lines, `minmax()`, implicit track sizing beyond the
supported auto case, and subgrid are not implemented** — lay out explicit
tracks/placement instead of relying on browser-style auto-fit behavior.

### Animation (`@keyframes`)

```text
Timing:  linear | ease | steps(n[, jump-start|jump-end|jump-none|jump-both|start|end])
         | cubic-bezier(x1,y1,x2,y2)   (x1/x2 in 0..1)
Time:    ms or s only
Keyframe selectors: from | to | <percentage>
```

Animatable properties: `opacity`, `transform`, `background-color`,
`border-color`, `border-width`, `width`, `height`, `perspective`,
`perspective-origin`, and motion-path distance/rotation (when a valid
`offset-path` exists). **`spring` easing has no CSS syntax — it must be
authored directly in Protocol V2 JSON, not through HTML.** There is no CSS
`transition` support at all (see excluded list below); express every
state change as `@keyframes`.

## Layout capabilities and known limits

- **Static block flow**: supported, including sibling-to-sibling margin
  collapse and one level of parent/first-child collapse. Multi-level collapse
  chains and self-collapsing empty boxes are not implemented.
- **Flexbox (P1.1–P1.4)**: single-line and wrapping flex, `flex-wrap`,
  `align-content`, `order`, min/max clamping are all supported. Auto margins
  and `display:contents` inside a flex context are still deferred.
- **Grid (P1.3–P1.4)**: explicit tracks/placement only (see above); no
  auto-placement beyond row-major default.
- **`height:auto` shrink-wrap**: a block container recursively shrink-wraps
  its children's flow height — **except inside a `flex`/`grid` container**,
  where auto-height track sizing isn't implemented yet and falls back to
  available space. Prefer explicit heights on flex/grid items when precise
  sizing matters.
- Flex and Grid containers establish the containing block for `position:
  absolute` children and do not collapse adjacent margins.
- `overflow:hidden` always lowers to a clip path (parent viewport clipping
  applies to media too).

## Typography

- Text is one V2 chunk/span per visual text element; nested inline tags keep
  their own spans (never flattened).
- `font-family` must resolve to a font asset actually supplied to the
  project. **There is no implicit browser/system font fallback** — an
  unavailable family fails with `css-font-asset-missing`, it never silently
  substitutes a default font.
- `text-overflow: ellipsis` requires the combination `overflow:hidden` +
  `white-space:nowrap` + horizontal writing-mode; anything else with
  `ellipsis` fails closed rather than approximating.

## Media and audio

- `img`/`video` support `object-fit` (`contain|cover|fill|none`),
  `object-position` (keyword/edge forms), `image-rendering`.
- `audio` lowers to exactly **one** root audio track + one clip per tag.
  Per-track/per-clip `gainDb`, `pan`, `muted`, `trim`, `playbackRate`,
  `fadeIn`/`fadeOut` and multi-track mixing have **no HTML/CSS surface** —
  those require a direct Protocol V2 JSON patch (see the JSON-patch skill),
  never an HTML attribute or CSS hack.

## Explicitly unsupported — do not attempt, do not approximate

These fail closed by design; never fake them with a supported mechanism
(flex/grid/absolute-position/mask substitutes are not acceptable
workarounds):

- **Float layout**: `float`, `clear`, `shape-outside`, `shape-margin`,
  `shape-image-threshold`.
- **Table/paginated layout**: `display:table*`, multi-column
  (`column-count`/`column-width`/`column-gap`), CSS fragmentation/regions,
  paged media, `@page`, `break-before/after/inside`, `orphans`/`widows`.
- **Interaction/state**: `:hover`/`:focus`/`:active`/`:visited`, DOM events,
  script-driven style mutation, `cursor`, `pointer-events` (hit-testing use),
  `user-select`, `touch-action`, `caret-color`, `resize`, `appearance`,
  `accent-color`, `color-scheme`.
- **Scroll/page environment**: `scroll-behavior`, `scroll-snap-*`,
  `overscroll-behavior`, scrollbar styling, `position:sticky`,
  scroll-driven timelines/animations.
- **Responsive/viewport**: `@media`, `@container`, `container-type`,
  `container-name`, `position-area`, `position-try`, container-relative and
  dynamic/logical viewport units.
- **Browser optimization hints**: `will-change`, runtime `contain`,
  `content-visibility`, `contain-intrinsic-size`,
  `background-attachment: fixed|local`.
- **Transitions**: `transition`, `transition-duration`, `transition-delay` —
  use `@keyframes` instead, always.
- **Raw SVG paint-graph elements**: `<linearGradient>`, `<pattern>`,
  `<marker>`, `<clipPath>`, `<mask>`, `<filter>`, `<use>`, `<symbol>` as
  literal tags — express the same result via the CSS
  gradient/mask/clip-path/filter properties instead; only shape primitives
  (`svg`, `g`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`,
  `polygon`) are real tags here.
- Houdini/custom paint worklets, `env()`, `image-set()` complex selection,
  `element()` image sources.

## Common authoring mistakes checklist

Before calling `validate_html`, check the draft against every line:

- [ ] Colors are `#hex`/`#hexa`/`rgba()`/`transparent`/`currentColor` — no
      named colors, no `hsl()`.
- [ ] No `<style>` other than inline elements inside the document; no
      `style="..."` attributes; no `<link>` stylesheets.
- [ ] No tag outside the allowlist (`table`, `ul/li`, `form`, `button`,
      `iframe`, `canvas`, `script` are the usual accidental picks).
- [ ] `text-decoration` uses solid lines only, not dashed/dotted/wavy.
- [ ] `text-overflow:ellipsis` is paired with `overflow:hidden` +
      `white-space:nowrap`.
- [ ] No `transition`, `:hover`, or other interaction-driven styling —
      animate with `@keyframes` instead.
- [ ] No `@media`/`@container` queries — the composition viewport is fixed.
- [ ] Grid layouts specify explicit tracks/placement rather than relying on
      auto-fit/auto-placement beyond the default row-major behavior.
- [ ] Every `font-family` used actually has a font asset attached to the
      project.
- [ ] Multi-track/per-clip audio needs, if any, are flagged to the user as
      "requires a JSON patch" rather than attempted in HTML.

## Workflow reminder

This skill only defines *what is legal*. For *how to save it*, follow
`neonix-html-authoring`/`neonix-project-workflow`: call `validate_html`
before `update_project_html`, fix every error diagnostic first, and prefer
`get_capabilities` as the live tie-breaker if this document and the server
ever disagree.
