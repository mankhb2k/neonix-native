# `@motionvideo/html-compiler`

Phase 0.1–4 HTML/CSS authoring boundary. The package compiles a deliberately small,
deterministic CSS subset into Atomic Protocol V2; it does not import the motion
runtime or renderer.

```text
HTML + CSS
  -> DOM subset
  -> selector matching / cascade / inheritance
  -> custom-property (`var()`) resolution
  -> typed units and `calc()` evaluation
  -> box geometry and hierarchy
  -> Motion Protocol V2 JSON
```

## Supported in Phase 0.1 — cascade and value normalization

The first P0 slice is backed by the live fixture at
`apps/web/lib/docs/html-compiler-preview.ts` and covers the normalization
contract before layout lowering:

| CSS property / feature | Accepted syntax | Normalization | V2 target | Fallback / diagnostic | Fixture |
| --- | --- | --- | --- | --- | --- |
| selector cascade | tag, `.class`, `#id`, descendant, selector list | specificity → `!important` → source order | computed style | unsupported selectors fail closed | `html-compiler.p0.cascade-values` |
| custom properties | `--name`, `var(--name, fallback)` | scoped inheritance and recursive resolution | concrete paint/length value | missing/cyclic variable diagnostic | `html-compiler.p0.cascade-values` |
| special keywords | `initial`, `inherit`, `unset` | property initial value or inherited value | concrete computed style | invalid property value diagnostic | `html-compiler.p0.cascade-values` |
| common shorthands | `margin`, `padding`, `border`, solid `background` | longhand expansion with cascade order preserved | `frame` / `style` | unsupported shorthand fails closed | `html-compiler.p0.cascade-values` |
| typed value functions | `calc()`, `min()`, `max()`, `clamp()` | fixed 1920×1080 viewport and px normalization | `frame` / `transform` | incompatible units fail closed | `html-compiler.p0.cascade-values` |
| paint keywords | `none`, `transparent`, `currentColor` | canonical V2 colors | `style.fill` / `style.stroke` | property-invalid colors fail closed | `html-compiler.p0.cascade-values` |
| text alignment | `start`, `end`, `left`, `right`, `center`, `justify`, `match-parent`, `justify-all` | Preserved as-is in Protocol V2; render anchor resolves `match-parent` against its parent in fixed LTR and falls back to start for `justify-all` | `payload.layout.textAlign` / `contentWidth` / offsets | invalid values fail closed | `html-compiler.typography.text-align-values` |
| text spacing | `letter-spacing`, `word-spacing` with `normal`, lengths and supported `calc()` units | resolved to px in text spans | `payload.chunks[].spans[].letterSpacing` / `wordSpacing` | invalid lengths fail closed | `html-compiler.typography.text-spacing-whitespace` |
| whitespace | `normal`, `nowrap`, `pre`, `pre-wrap`, `pre-line`, `break-spaces` | computed whitespace mode plus derived wrapping policy | `payload.layout.whiteSpace` / `wrap` | unsupported values fail closed | `html-compiler.typography.text-spacing-whitespace` |
| text direction | `ltr`, `rtl` | logical alignment anchor resolves against direction | `payload.source.direction` / `textAnchor` | unsupported values fail closed | `html-compiler.typography.direction-writing-decoration` |
| writing mode | `horizontal-tb`, `vertical-rl`, `vertical-lr` | normalized source writing mode | `payload.source.writingMode` | unsupported values fail closed | `html-compiler.typography.direction-writing-decoration` |
| text decoration | `none`, `underline`, `overline`, `line-through`, combinations with solid color/thickness | decoration lines become semantic span paints | `payload.chunks[].spans[].textDecoration` | dashed/dotted/double/wavy are rejected because no matching V2 atomic exists | `html-compiler.typography.direction-writing-decoration` |
| text overflow | `clip`, `ellipsis` | `ellipsis` is accepted only with `overflow:hidden`, `white-space:nowrap` and horizontal writing; the text layer receives a deterministic clip path and `maxLines:1` | `payload.layout.textOverflow` / `maxLines` / layer `clipPath` | invalid or non-deterministic combinations fail closed | `html-compiler.typography.text-overflow-ellipsis` |
| text rendering | `auto`, `optimizeSpeed`, `geometricPrecision` | authored intent is preserved; runtime may choose a mask for speed or vector glyphs for geometric precision | `payload.source.textRendering` | unsupported values fail closed; backend behavior remains capability-gated | `html-compiler.typography.text-rendering-capability` |

The preview route shows the same source in a native browser iframe and in the
Skia-backed Protocol V2 stage. Its sidebar is generated from registered
fixtures, so a property is not presented as supported until it has a source,
lowering and test coverage.

## Supported in Phase 2

- Nested visual HTML/SVG elements with `id` and `class` attributes.
- Tag allowlist: `div`, `span`, `main`, `section`, `article`, `header`,
  `footer`, `nav`, `aside`, `svg`, `g`, `path` and an optional `body` wrapper.
- Tag, class, id, descendant and selector-list matching.
- Specificity, source order and inherited text plus SVG paint properties.
- CSS custom properties with nested references and `var()` fallbacks.
- `px`, `%`, `em`, `rem`, `vw`, `vh`, `auto` and arithmetic `calc()`.
- Absolute offsets, width/height, min/max constraints, numeric
  `aspect-ratio`, margin, padding and `box-sizing` input normalization.
- Solid hex/transparent paint, opacity, `display:none`, stable IDs/order and
  parent groups for nested elements.
- Phase 3A layout primitives: `display: block|contents|none`, static block
  flow, `position: static|relative|absolute`, basic visibility and numeric
  `z-index` ordering.
- Typography MVP: text nodes lower to semantic Protocol V2 text layers with
  `font-family`, `font-size`, `font-weight`, `letter-spacing`, `word-spacing`,
  `white-space`, `text-align`, `direction`, `writing-mode` and solid
  `text-decoration`. Exact font binaries must be
  supplied through `compileHtmlCss(..., { fontAssets })`; browser/system font
  fallback is never implicit.

### Stable element identity

The compiler uses the standard HTML `id` as the canonical authoring identity,
then falls back to a deterministic DOM structural path such as
`dom/div:0/span:0`. The removed `data-atomic-id` attribute is rejected.
Explicit identities must be unique. A visual element
that lowers to multiple Protocol layers keeps the base identity for its group
  and receives stable suffixes such as `hero::paint`.

### Tag lowering rule

Generic container tags do not have a fixed Protocol type. The compiler resolves
CSS first and then classifies the visual role:

| Resolved role | Protocol output |
| --- | --- |
| Box with background/paint and no children | `shape` |
| Children or a compositing/transform boundary | `group` |
| Paint plus children | `group` + `::paint` shape |
| Transparent wrapper without a boundary | wrapper may be omitted |

The tag name supplies the allowlist and default HTML structure; CSS paint,
layout and compositing determine the lowering. Interactive/native tags such as
`button`, `input`, `form`, `canvas`, `iframe`, `audio` and `script` are outside
Phase 2 and return `html-tag-unsupported` rather than becoming a placeholder
rectangle. Text remains a dedicated later phase; media and SVG path lowering
are supported below.

The complete lowering matrix is:

| Condition / source | Protocol output | Phase 2 status |
| --- | --- | --- |
| Paint, no children | `shape` | Supported |
| No paint, has children | `group` or omit wrapper | Supported |
| Paint + children | `group` + `::paint` | Supported |
| No paint, no children | no layer | Supported |
| Text content | `TextLayout` / `GlyphRun` | Supported (typography MVP) |
| `img` | `image` | Supported (media phase) |
| `video` | `video` | Supported (media phase) |
| SVG `<svg>/<g>` | `group` | Supported |
| SVG `<path>` | `path` | Supported (`M/L/H/V/C/Z`) |

Every emitted number is resolved for the fixed composition viewport (1920x1080
by default). Protocol timing is milliseconds. Selectors, CSS variables, unit
strings and CSS syntax never appear in the output JSON.

## Phase 4 paint and border

Phase 4 lowers the CSS paint subset into Protocol V2 primitives:

- solid `background`/`background-color` values;
- `linear-gradient()`, `radial-gradient()` and `conic-gradient()` with two or
  more normalized stops (missing offsets are interpolated deterministically);
- comma-separated background layers, emitted as ordered `::paint:<index>` shape
  layers;
- `border: <width> solid <color>` and equivalent longhands;
- one uniform `border-radius` value, emitted as `payload.cornerRadius`.

Gradient coordinates are semantic Protocol fields (`angle`, `cx`/`cy`, `from`),
not CSS strings. Only solid borders and a uniform radius are accepted in this
phase; unsupported border styles or non-uniform radii fail closed with a source
diagnostic instead of being approximated. The compiler output is schema
validated before it reaches the motion compiler. Native preview backends now
sample up to eight stops for linear/radial/conic gradients; device-level pixel
parity remains an end-to-end validation gate.

Preview Lab exposes these cases under **HTML compiler / Phase 4**.

## Media lowering

The media slice lowers `<img>` and `<video>` into Protocol V2 media layers and
registers each source in the project asset manifest. The supported image
properties are `object-fit: contain | cover | fill | none`, the MVP keyword
and edge forms of `object-position`, and renderer-safe `image-rendering`
values (`auto`, `smooth`, `high-quality`, `crisp-edges` and `pixelated`).
`object-fit: none` is represented explicitly by `payload.fit`; it must not be
inferred from `preserveAspectRatio.align: "none"`, because that alignment means
stretch/fill in the SVG-compatible Protocol field. Parent `overflow: hidden`
is lowered to a clip path, and media viewport clipping is applied by the Skia
and 2D replay paths.

The four media fixtures are exposed under **HTML compiler / Media**:

- `object-fit: contain` with a landscape image;
- `object-fit: cover` with `object-position: right top`;
- `object-fit: fill` with `image-rendering: pixelated`;
- `object-fit: none` inside a clipped viewport.

## SVG/path lowering

`svg`, `g` and `path` are visual-only tags. An SVG container with children emits
a `group`; each `<path>` emits one Protocol `path` layer with its source `id`
or structural identity. The compiler accepts SVG `M`, `L`, `H`, `V`, `C` and
`Z` commands, including relative forms and multiple contours. Unsupported
commands fail closed with `svg-path-command-unsupported`.

Path paint maps directly to the V2 path style: `fill`, `fill-opacity`,
`fill-rule`, `stroke`, `stroke-width`, `stroke-opacity`, `stroke-linejoin`,
`stroke-linecap`, `stroke-dasharray` and `stroke-dashoffset`. Missing fill and
stroke use SVG's default black fill; `fill: none` is preserved as a stroke-only
path. No path is rasterized or converted to a rectangle.
The temporal `payload.morph` field is intentionally emitted by the animation
compiler later; the static HTML/CSS slice covers geometry and paint only.

## HTML compiler transform subset

The compiler also lowers the basic CSS 2D transform functions used by the
primitive preview fixtures: `translate`, `translateX/Y`, `scale`, `scaleX/Y`,
`rotate`, `skew`, `skewX/Y` and their 3D-axis spelling where the Protocol V2
transform fields can represent them. `transform-origin` resolves to the local
`anchor` in frame units; angles normalize to degrees and lengths/percentages
resolve against the element frame. The ordered `operations[]` list is retained
in the output for downstream runtime composition, while the component fields
remain populated for the current V2 compatibility contract.

Unsupported transform functions or malformed arguments fail closed with a
`css-transform-*` diagnostic. CSS transform ordering is preserved in the
Protocol `operations[]` list and composed by Motion Runtime; matrix and local
perspective parsing remain a later HTML compiler slice.

## Explicitly deferred

Flex/grid layout, masks, filters, text shaping, advanced transform matrices,
3D context, animation and transitions are later compiler phases. Unsupported
properties, selectors, text nodes and invalid values fail closed with a
diagnostic; they are not silently ignored.

## API

### Package structure

The public entrypoint in `src/index.ts` only coordinates the compiler pipeline
and re-exports the stable source API. Implementation responsibilities live
under `src/compiler/`:

```text
src/
├── source.ts                 # NeonixHtmlSourceV1 and new-project factory
├── index.ts                  # public API and compile orchestration
└── compiler/
    ├── html.ts               # HTML shell, identity and manifest parsing
    ├── css-parser.ts         # CSS rules and declarations
    ├── cascade.ts            # selectors, specificity and inheritance
    ├── cascade-values.ts     # shorthand/longhand expansion
    ├── values.ts             # var(), calc(), min(), max(), clamp() and units
    ├── paint.ts              # colors, gradients, borders and radius
    ├── path.ts               # SVG path parsing and path paint
    ├── transform.ts          # CSS transform lowering
    ├── layout.ts             # future layout-only helpers
    ├── model.ts              # internal compiler model and support tables
    ├── errors.ts             # diagnostics and source locations
    └── utils.ts              # shared parser utilities
```

New compiler features should be added to the narrowest module that owns their
semantic responsibility; `index.ts` should only connect those modules to the
Protocol V2 lowering step.

```ts
const source = createNewHtmlProject();
const sourceWithStyles = { ...source, css };
const result = compileHtmlCss(sourceWithStyles);

// result.status === "success" -> result.protocol is schema-validated V2 JSON
// result.status === "error"   -> result.diagnostics explains the source error
```

`createNewHtmlProject` is the new-project factory. It creates the complete
multiline `DOCTYPE/html/head/body` document, including the
`script#neonix-manifest` composition block, and the `NeonixHtmlSourceV1`
envelope. The compiler validates the embedded manifest before producing
Protocol V2. Every source starts with the
fixed composition envelope `{ width: 1920, height: 1080, fps: 30,
background: "#081018", colorSpace: "srgb" }`. The browser reference and
compiler must consume this same envelope; they do not independently choose a
viewport or scale. The output is validated by `MotionProtocolV2Schema` before it is returned. The
motion compiler then owns Protocol V2 -> RuntimeProjectV3 lowering; this package
does not perform runtime fallback or browser rendering.

### Composition bounds

The fixed composition is also the compiler's hard axis-aligned layout boundary.
After resolving percentages, viewport units, `calc()`, `min()`, `max()` and
`clamp()`, a node's layout rectangle is constrained to `0..1920` and
`0..1080` before it is lowered to a Protocol V2 layer. For example,
`left: 100px; width: 100%` produces a visible width of `1820px`, not a
`1920px` layer extending past the right edge. The browser reference uses the
same fixed logical viewport and `overflow: hidden` at the composition root.

This boundary applies to the resolved layout rectangle. Transforms, strokes,
shadows and future visual effects require their own clip semantics before they
can be guaranteed to remain pixel-perfectly inside the composition.

## CLI

The package includes a small project CLI for creating repeatable HTML compiler
cases. It writes the canonical `neonix-source.json` and the compiler output
`protocol-v2.json` into the target directory:

```bash
pnpm --filter @motionvideo/html-compiler cli new ./fixtures/new-project
pnpm --filter @motionvideo/html-compiler cli new ./fixtures/p0/blue-rectangle --example blue-rectangle
pnpm --filter @motionvideo/html-compiler cli compile ./fixtures/p0/blue-rectangle
```

`new` is non-destructive: it refuses to overwrite an existing source or
protocol file. The `blue-rectangle` example is the Phase 0 starter case and
uses the standard HTML document shell, a stable `id`, and the fixed
1920x1080 composition manifest.

Tests live under `src/_test_` and cover cascade/inheritance, nested groups,
variables/fallbacks, units, `calc()`, SVG/path contours and fail-closed diagnostics. The original
Gold 01 rectangle test remains as the Phase 1 compatibility gate.

Preview Lab exposes the normalization cases under **HTML compiler / Phase 2** and
paint/border cases under **HTML compiler / Phase 4**. Path source/compiled
fixtures are grouped under **Paths** and cover cubic contours, even-odd holes
and stroke options.

## Normalization contract

This package normalizes source into one deterministic representation before
lowering to Atomic Protocol V2. Equivalent CSS semantics must produce equivalent
Protocol JSON.

### Element identity

Identity precedence is:

1. `id` — canonical HTML identity.
2. A deterministic structural path such as `dom/body:0/div:0/span:0` for
   compiler-internal containers or legacy fragment inputs.

Explicit identities must match `^[A-Za-z][A-Za-z0-9_-]{0,199}$` and be unique.
Invalid and duplicate identities produce `html-identity-invalid` and
`html-duplicate-atomic-id`. Structural paths are deterministic for the same
DOM structure; use a stable HTML `id` when an identity must survive sibling
edits.

One element can lower to multiple layers while preserving its base identity:

```text
hero        -> group identity
hero::paint -> background/shape paint
hero::border
hero::shadow
```

### Classes and selectors

- Classes split on ASCII whitespace, deduplicate, and retain first-seen order.
- Class tokens must be valid CSS identifiers.
- Phase 2 selectors are tag, `.class`, `#id`, descendant and selector lists.
- Pseudo-classes, attribute selectors, pseudo-elements, `> + ~` combinators and
  media queries are not silently ignored; they fail with
  `css-selector-unsupported`.

### Colors

Protocol colors are lowercase `#rrggbb` or `#rrggbbaa`. `#rgb` expands to the
six-digit form and `transparent` becomes `#00000000`. Named colors, `rgb()`,
`hsl()`, gradients and other color functions require a later lowering phase;
unparseable colors produce `css-color-unsupported`.

### Numbers, units and box model

Phase 2 accepts finite `px`, `%`, `em`, `rem`, `vw`, `vh`, `number`, `auto` and
typed arithmetic in `calc()`. Output Protocol contains resolved numbers, never
unit strings: percentages use the containing block, `em` uses the node's
computed font size, `rem` uses the 16px root default, and viewport units use the
composition viewport.

The source composition is fixed at `1920 x 1080`, `fps = 30`, background
`#081018` and `srgb`. Compiler timing still defaults to `durationMs = 1000`
until duration becomes part of the project timeline contract.

`content-box` adds padding and border to the frame; `border-box` treats
width/height as the border box. A numeric `aspect-ratio` resolves an `auto`
dimension before min/max constraints are applied. Missing margin/padding
normalize to zero. `display:none` removes the complete subtree. Invalid units,
values or incompatible `calc()` expressions
produce `css-unit-unsupported`, `css-value-invalid` or
`css-calc-incompatible`.

### Typography font assets

HTML text is NFC-normalized and emitted as one V2 text chunk/span per visual
text element. `font-family` remains an ordered family list in the span; the
compiler resolves every concrete family against the supplied `fontAssets`
catalog and writes the selected ordered face IDs to
`resolvedFontAssetIds`. `normal` and `bold` resolve to weights 400 and 700;
numeric weights from 1 through 1000 are accepted. If a requested face is
missing, deterministic CSS weight/style/stretch matching selects the nearest
available catalog face. If no concrete family binary exists, compilation fails
with `css-font-asset-missing` instead of silently using a browser-installed
font. Protocol V2 assets contain only runtime identity (`id`, `uri`, CSS
selection `weight`, and `integrity`); catalog fields such as family and style
stay in compiler input/DB metadata.

### Output and diagnostics

`order` represents paint order within a sibling scope; it is not an element
identity. Shape layers cannot parent children, so an element with children uses
a group boundary when hierarchy must be preserved. Every successful output is
validated with `MotionProtocolV2Schema`; unsupported syntax fails closed with a
diagnostic instead of being silently dropped. Protocol timing is milliseconds.

Normalization tests are in `src/_test_/normalization.test.ts`; Phase 3A layout
tests are in `src/_test_/phase3.test.ts`. Preview Lab exposes the corresponding
Phase 3 cases under **HTML compiler / Phase 3**.

## Visual-only compiler foundation

This compiler is an authoring-to-video boundary, not a browser runtime. It
accepts static HTML/CSS and produces a resolved scene snapshot; JavaScript,
events, DOM mutation, forms, accessibility behavior and network-dependent
browser features are out of scope.

The five foundation contracts are:

1. **Source contract** — HTML fragment and CSS are supplied separately; source
   whitespace/comments are non-semantic and unsupported syntax fails closed.
2. **Cascade precedence** — supported author rules resolve by selector
   specificity (`#id` > `.class` > tag), then source order. Phase 2 intentionally
   rejects inline style, `!important` and interaction pseudo-classes with an
   explicit diagnostic until their precedence rules are implemented.
3. **Computed-style semantics** — values are resolved before lowering; Protocol
   never receives selector strings, CSS variables or unit strings. Initial,
   inherited, `auto` and invalid values are distinct states.
4. **Box coordinate contract** — composition origin is top-left, x grows right,
   y grows down, frames are border-box coordinates, and Protocol timing is ms.
    Static block flow and adjoining vertical margin collapse are supported;
    flex/grid and advanced containing-block behavior remain deferred to the
    layout phase.
5. **Source diagnostics** — parse and normalization errors carry `kind`, source
   character `offset`, `line` and `column` whenever the source span is known.

Preview Lab's **HTML compiler / Phase 2** group is the executable contract for
these rules. It shows the browser HTML/CSS reference beside the compiled
Protocol/runtime result; exact pixel parity is only claimed after the relevant
layout/paint phase is implemented.
