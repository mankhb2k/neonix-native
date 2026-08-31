# `@motionvideo/html-compiler`

Phase 2–4 HTML/CSS authoring boundary. The package compiles a deliberately small,
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

## Supported in Phase 2

- Nested empty HTML elements with `id` and `class` attributes.
- Tag allowlist: `div`, `span`, `main`, `section`, `article`, `header`,
  `footer`, `nav`, `aside` and an optional `body` wrapper.
- Tag, class, id, descendant and selector-list matching.
- Specificity, source order and inherited `color`, `font-size` and `font-family`.
- CSS custom properties with nested references and `var()` fallbacks.
- `px`, `%`, `em`, `rem`, `vw`, `vh`, `auto` and arithmetic `calc()`.
- Absolute offsets, width/height, min/max constraints, margin, padding and
  `box-sizing` input normalization.
- Solid hex/transparent paint, opacity, `display:none`, stable IDs/order and
  parent groups for nested elements.
- Phase 3A layout primitives: `display: block|contents|none`, static block
  flow, `position: static|relative|absolute`, basic visibility and numeric
  `z-index` ordering.

### Stable element identity

The compiler uses `data-atomic-id` as the canonical authoring identity, then
falls back to the HTML `id`, then to a deterministic DOM structural path such
as `dom/div:0/span:0`. Explicit identities must be unique. A visual element
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
rectangle. Text, media and SVG tags are introduced in dedicated later phases.

The complete lowering matrix is:

| Condition / source | Protocol output | Phase 2 status |
| --- | --- | --- |
| Paint, no children | `shape` | Supported |
| No paint, has children | `group` or omit wrapper | Supported |
| Paint + children | `group` + `::paint` | Supported |
| No paint, no children | no layer | Supported |
| Text content | `TextLayout` / `GlyphRun` | Deferred to text phase |
| `img` | `image` | Deferred to image phase |
| `video` | `video` | Deferred to media phase |
| SVG | `group` / `path` / `shape` | Deferred to SVG/path phase |

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
`css-transform-*` diagnostic. CSS transform ordering and matrix/perspective
parity remain runtime Phase 5 work; these fixtures intentionally exercise one
basic transform operation at a time.

## Explicitly deferred

Flex/grid layout, margin collapsing, overflow clipping, images, masks, filters, text shaping,
advanced transform matrices, 3D context, animation and transitions are later compiler phases. Unsupported
properties, selectors, text nodes and invalid values fail closed with a
diagnostic; they are not silently ignored.

## API

```ts
const result = compileHtmlCss({ html, css }, {
  composition: { width: 1920, height: 1080, fps: 30, durationMs: 1000 },
});

// result.status === "success" -> result.protocol is schema-validated V2 JSON
// result.status === "error"   -> result.diagnostics explains the source error
```

The output is validated by `MotionProtocolV2Schema` before it is returned. The
motion compiler then owns Protocol V2 -> RuntimeProjectV3 lowering; this package
does not perform runtime fallback or browser rendering.

Tests live under `src/_test_` and cover cascade/inheritance, nested groups,
variables/fallbacks, units, `calc()` and fail-closed diagnostics. The original
Gold 01 rectangle test remains as the Phase 1 compatibility gate.

Preview Lab exposes the normalization cases under **HTML compiler / Phase 2** and
paint/border cases under **HTML compiler / Phase 4**.

## Normalization contract

This package normalizes source into one deterministic representation before
lowering to Atomic Protocol V2. Equivalent CSS semantics must produce equivalent
Protocol JSON.

### Element identity

Identity precedence is:

1. `data-atomic-id` — canonical identity for editor-authored elements.
2. `id` — HTML-compatible fallback.
3. A deterministic structural path such as `dom/body:0/div:0/span:0`.

Explicit identities must match `^[A-Za-z][A-Za-z0-9_-]{0,199}$` and be unique.
Invalid and duplicate identities produce `html-identity-invalid` and
`html-duplicate-atomic-id`. Structural paths are deterministic for the same
DOM structure; use `data-atomic-id` when an identity must survive sibling edits.

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

The default composition is `1920 × 1080`, `fps = 30`, `durationMs = 1000`.
`content-box` adds padding to the frame; `border-box` treats width/height as the
border box. Missing margin/padding normalize to zero. `display:none` removes
the complete subtree. Invalid units, values or incompatible `calc()` expressions
produce `css-unit-unsupported`, `css-value-invalid` or
`css-calc-incompatible`.

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
   Full browser block-flow/margin-collapse/flex/grid behavior is deferred to
   the layout phase.
5. **Source diagnostics** — parse and normalization errors carry `kind`, source
   character `offset`, `line` and `column` whenever the source span is known.

Preview Lab's **HTML compiler / Phase 2** group is the executable contract for
these rules. It shows the browser HTML/CSS reference beside the compiled
Protocol/runtime result; exact pixel parity is only claimed after the relevant
layout/paint phase is implemented.
