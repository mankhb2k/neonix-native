# HTML Compiler Rules: excluded CSS surface

**Status:** normative

This file defines CSS features that are intentionally excluded from the HTML
compiler's motion/video profile. The compiler targets deterministic

`HTML/CSS -> Protocol V2 -> Runtime/Skia`

output, not a complete browser layout engine. An excluded feature must produce
an explicit diagnostic; it must never be silently ignored, approximated as a
different feature, or emitted as an invalid Protocol V2 layer.

## 1. Permanently excluded from the motion profile

### 1.1 Float-based layout

The following are excluded:

- `float: left | right | inline-start | inline-end`;
- `clear`;
- `shape-outside`;
- `shape-margin`;
- `shape-image-threshold`.

Reasons:

- they belong to legacy document layout and are rarely used in motion/video
  compositions;
- their main purpose is text exclusion around floated content, not visual
  painting;
- animated float placement causes reflow and unstable line geometry;
- the project already has deterministic `flex` and `grid` layout;
- masks, clip paths, paths and explicit text constraints are better primitives
  for motion design.

The compiler must reject these declarations with a stable diagnostic such as
`css-float-unsupported` or `css-shape-outside-unsupported`. They must not be
lowered into a mask, clip path, absolute offset, or grid/flex substitute.

### 1.2 Table and paginated document layout

The following are outside the profile:

- `display: table`, `table-row`, `table-cell`, and table layout algorithms;
- `caption-side`, table border-collapsing and table intrinsic sizing;
- multi-column layout (`column-count`, `column-width`, `column-gap`, column
  balancing);
- CSS fragmentation, paged media, regions and print layout.

These algorithms are document-flow and pagination systems. They do not map to
the fixed-frame layer model without introducing a second browser-like layout
engine.

### 1.3 Browser interaction and stateful layout

The compiler does not compile layout that depends on live browser state:

- hover, focus, active, visited and pointer/keyboard state;
- DOM event handlers and script-generated style mutation;
- selection, caret, editing and accessibility tree layout;
- intrinsic layout driven by an unbounded live DOM outside the source input.

The compiler input is a static, deterministic source snapshot. Interactivity
must be represented as explicit application state or animation tracks.

### 1.4 Browser-owned rendering features

The following are not part of the V2 motion paint contract:

- CSS Houdini/custom paint worklets;
- browser UI, safe-area behavior and platform-specific form controls;
- native scrolling chrome and scrollbar painting;
- print-only color management and pagination behavior.

## 2. Explicitly unsupported until a V2 contract exists

These features are not rejected because they are conceptually useless; they
are blocked until their source surface and deterministic runtime behavior are
defined:

- `element()` image sources: requires a live element-snapshot/source reference;
- complex `image-set()` source selection: requires deterministic asset
  selection policy;
- arbitrary CSS custom functions and Houdini values;
- browser-dependent `env()` values;
- layout-dependent intrinsic media sizing when the asset metadata is missing.

Until the contract is added, the compiler must emit a feature-specific
diagnostic instead of falling back to a color, empty paint, or unrelated asset.

## 3. Features that are not excluded

The following remain valid roadmap items and must not be added to this
exclusion list merely because they are incomplete:

- `anchor()` and `anchor-size()` positioning;
- container queries and responsive media-query variants;
- scroll-driven timelines;
- projective transforms, masks, filters and 3D surfaces;
- `image()` and URL-based `cross-fade()` within their documented asset subset.

They require compiler, Protocol V2 and Runtime/Skia tests before being enabled,
but they are compatible with the motion profile.

## 4. Diagnostic and implementation rules

1. Unsupported declarations fail closed with a stable diagnostic code and
   source location.
2. No unsupported feature may alter layout, paint order, opacity, clipping or
   animation timing as a side effect.
3. A feature may be removed from this file only after its semantic contract is
   represented in Protocol V2 and has compiler, runtime and Skia coverage.
4. Browser parity is required only for the supported deterministic subset. For
   excluded features, an explicit diagnostic is the expected behavior.
5. New preview cases must be classified by semantic category rather than by a
   phase label: layout, paint, effect, viewport, container, transform/3D,
   typography/media, animation, or combined pipeline.

## 5. Rationale for the profile boundary

The boundary keeps the compiler focused on fixed-frame motion composition:

- `grid` and `flex` describe intentional composition structure;
- paint and effect primitives describe visible pixels;
- transforms, tracks and timelines describe motion;
- Protocol V2 carries resolved, typed values between compiler and renderers.

Legacy document-flow features that primarily exist to make prose wrap around
content are intentionally not part of that core contract.
