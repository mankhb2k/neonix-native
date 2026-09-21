---
slug: compiler
title: Compiler
description: How the compiler turns HTML, CSS or agent intent into the canonical, portable Neonix JSON V2 document.
---
# Compiler

## From authoring input to JSON V2

The compiler turns HTML, CSS or agent intent into Neonix JSON V2. The result is the canonical editable document for the project.

```text
HTML / CSS / agent intent
          |
          v
Compiler
          |
          v
Neonix JSON V2
          |
          v
        Output
```

## What authoring is normalized

CSS values, percentages, font choices, media metadata, motion paths, effects, transforms and paint references are validated and represented in the JSON document.

## Keep the document portable

Neonix JSON V2 contains authoring meaning rather than browser state, device resources or output implementation details. Keep projects portable by using documented fields and stable asset identities.

---
slug: html
title: HTML authoring
description: The HTML authoring contract: required document metadata and how an HTML/CSS source compiles into a Neonix project.
---
# HTML authoring

HTML projects are compiled into the same Neonix project model used by the editor, preview and export flows. The document metadata defines the video composition; the browser page around it is only a convenient authoring surface.

## Required document metadata

Every HTML project must contain exactly one `<meta name="neonix-document">` tag. Its JSON value declares the composition contract:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta
      name="neonix-document"
      content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1080,"height":1080,"fps":30,"background":"#081018","colorSpace":"srgb"}}'
    />
  </head>
  <body>
    <main class="scene">
      <h1>Neonix</h1>
      <p>HTML to editable motion.</p>
    </main>
  </body>
</html>
```

The following values are required:

- `kind` must be `neonix-html-document`.
- `schemaVersion` must be `2`.
- `composition.width`, `composition.height` and `composition.fps` must be positive numbers.
- `composition.background` must be a valid color.
- `composition.colorSpace` must be `srgb`.

## Composition size and body CSS

The composition metadata is the source of truth for preview and export. You do not have to set `body` to the same pixel dimensions, and the compiler does not infer the video size from body CSS.

For a document that should also look correct when opened directly in a browser, use a fluid page shell and let the composition define the render viewport:

```css
html,
body {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}

body {
  position: relative;
}

.scene {
  position: relative;
  width: 100%;
  height: 100%;
}
```

If an element paints outside the composition rectangle, the exported frame remains the declared composition size and the outside area is cropped. Set explicit dimensions on individual elements when their layout depends on a fixed design grid.

## Supported authoring surface

Use ordinary HTML and CSS for the supported compiler subset:

- semantic elements such as `div`, `section`, `main`, headings and paragraphs;
- CSS colors, opacity, borders, rounded corners, gradients, transforms and animation declarations supported by the compiler;
- local or Neonix system-font URLs for deterministic text layout;
- images and other media through the asset references supported by the HTML compiler.

The compiler validates the document before creating a project. Browser-only behavior such as event handlers, network-dependent layout, canvas state or arbitrary JavaScript is not part of the deterministic export contract.

## HTML elements that are supported

Use only the following visual HTML vocabulary. Tags are grouped by their authoring role:

| Role | Supported tags |
| --- | --- |
| Document | `html`, `head`, `meta`, `title`, `style`, `body` |
| Containers | `div`, `main`, `section`, `article`, `header`, `footer`, `nav`, `aside`, `figure`, `figcaption` |
| Text | `h1`–`h6`, `span`, `p`, `strong`, `b`, `em`, `i`, `small`, `br`, `blockquote`, `pre`, `code` |
| Media | `img`, `video`, `audio` |
| SVG | `svg`, `g`, `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon` |

Use a supported container or `span` instead of inventing a custom visual tag. Give important elements a stable `id`; ids must be unique.

## CSS properties currently supported

The following property groups are available for HTML authoring. The value still has to use the documented syntax for that property.

| Category | Properties |
| --- | --- |
| Layout and box | `position`, `position-anchor`, `anchor-name`, `inset`, `top`, `right`, `bottom`, `left`, `width`, `height`, `min-width`, `max-width`, `min-height`, `max-height`, `aspect-ratio`, `margin` and `padding` longhands, `box-sizing` |
| Visibility and order | `display`, `visibility`, `opacity`, `overflow`, `z-index` |
| Paint and borders | `background`, `background-color`, `background-image`, `background-position`, `background-size`, `background-repeat`, `background-origin`, `background-clip`, `color`, `border` and border longhands, `border-radius`, `outline` and outline longhands |
| Text | `font-family`, `font-size`, `font-weight`, `font-style`, `font-stretch`, `line-height`, `letter-spacing`, `word-spacing`, `white-space`, `text-align`, `direction`, `writing-mode`, `text-decoration`, `text-overflow`, `text-rendering`, `text-shadow` |
| Transform | `transform`, `transform-origin`, `perspective`, `perspective-origin`, `transform-style`, `backface-visibility` |
| SVG paint | `fill`, `fill-opacity`, `fill-rule`, `stroke`, `stroke-width`, `stroke-opacity`, `stroke-linejoin`, `stroke-linecap`, `stroke-dasharray`, `stroke-dashoffset`, `paint-order` |
| Media | `object-fit`, `object-position`, `image-rendering` |
| Flex and grid | `flex-direction`, `flex-wrap`, `justify-content`, `justify-items`, `align-items`, `align-self`, `align-content`, `place-items`, `gap`, `row-gap`, `column-gap`, `flex`, `flex-basis`, `flex-grow`, `flex-shrink`, `order`, `grid-template-columns`, `grid-template-rows`, `grid-column`/`grid-row` and their start/end fields |
| Motion and effects | `animation`, `animation-name`, `animation-duration`, `animation-delay`, `animation-iteration-count`, `animation-direction`, `animation-fill-mode`, `animation-play-state`, `animation-timing-function`, `filter`, `backdrop-filter`, `mix-blend-mode`, `isolation`, `clip-path`, `mask-image`, `mask-position`, `mask-size`, `mask-repeat`, `mask-mode`, `mask-composite`, `offset-path`, `offset-distance`, `offset-rotate`, `offset-anchor` |

Common supported value forms include `px`, percentages, `em`, `rem`, `vw`, `vh`, `auto`, arithmetic `calc()`, `min()`, `max()` and `clamp()`, when they are valid for the selected property. Use solid colors, supported gradients, documented transform functions and deterministic animation timing values.

## Selectors and CSS resources

Supported selectors are tag selectors, class selectors, id selectors, descendant selectors and comma-separated selector lists. CSS custom properties and `var()` fallbacks are supported when their values resolve to a supported property.

Put CSS in an inline `<style>` block in the same HTML document. External stylesheets, inline `style="..."` attributes, pseudo-classes, pseudo-elements, attribute selectors, child/sibling combinators (`>`, `+`, `~`) and media queries are not part of the current authoring contract.

## Deliberately unsupported browser features

Do not ask an AI to generate these for a Neonix video document:

- `<script>`, event handlers, forms, inputs, buttons, iframes or canvas drawing;
- `::before`, `::after` and CSS `content`;
- browser interaction, hover/focus state, responsive media-query branches or network-dependent layout;
- arbitrary HTML tags outside the allowlist;
- CSS declarations or selector syntax outside the supported vocabulary.

For generated text or decorations, use real elements instead of CSS-generated content:

```html
<div class="badge">
  <span class="badge-label">Neonix</span>
</div>
```

This makes text, shapes and animation explicit and keeps the document predictable for preview, validation and export.

## AI generation checklist

Before calling the HTML project tool, an AI should:

1. Use exactly one `neonix-document` metadata tag.
2. Use only tags from the element table above.
3. Put all CSS in an inline `<style>` block.
4. Use real HTML elements for every visible text or decoration.
5. Use only listed CSS properties and supported value forms.
6. Give important visual elements unique ids.
7. Avoid scripts, pseudo-elements, external stylesheets and browser-only behavior.
8. Validate the complete HTML and fix the first diagnostic before creating or exporting the project.

## Fonts

For stable preview and export, use a font from the Neonix system font CDN and declare it explicitly:

```css
@font-face {
  font-family: "Inter";
  src: url("https://fonts.neonix.video/inter/Inter_18pt-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

body {
  font-family: "Inter", sans-serif;
}
```

Keep the font family, weight and style explicit. Avoid relying on a user's installed fonts or loading a font from an unpinned external provider.

## Import from the dashboard

Choose **Import HTML** on the dashboard, enter a project name, then upload an `.html` file or paste the document. The import uses the same validation and compilation path as the API and opens the new project preview when it succeeds.

## Create from an authenticated product surface

Use **Import HTML** on the dashboard to create a project from an HTML file or pasted document. AI clients can create projects through the authenticated Neonix MCP connection. Both paths use the same validation and compilation flow, then open the project in preview for refinement and export.

The underlying project APIs require an authenticated integration and are intentionally not documented on this public guide.

## Validate before importing

When a document is rejected, fix the first diagnostic before retrying. Common causes are a missing or duplicated metadata tag, invalid JSON in the `content` attribute, unsupported CSS, or a font/media reference that cannot be resolved.

For an interactive compiler test, open the [compiler playground](/playground), or see [HTML to Motion Video](/html-to-video) for a product overview of the pipeline. For the authoring contract, continue with [Compiler](/docs/compiler) and [Output](/docs/rendering).

---
slug: rendering
title: Output
description: How one Neonix JSON V2 document drives both interactive preview and video export, plus a pre-export checklist.
---
# Output

## One document, two ways to use it

Neonix JSON V2 is the authoring document for both interactive preview and video export. Create one composition, inspect it, make revisions, then choose the result you need.

The public workflow is:

1. Create a valid Neonix JSON V2 document.
2. Inspect the composition in preview.
3. Correct content, timing, typography or media references.
4. Export the approved composition as a video file.

The document remains the source of truth throughout this workflow.

## Preview

Preview is an interactive way to review the meaning of a project before export. Check:

- composition width, height, frame rate and background;
- layer order, visibility, groups and transforms;
- text content, font family, weight, size, alignment and paint;
- images, videos, audio and fonts loaded from their declared asset references;
- shapes, paths, masks, clipping, gradients, filters and other documented effects;
- animation timing, interpolation, trimming and transitions between states.

Preview is also the fastest place to find a missing asset, an incorrect reference or a timing value outside the intended composition.

## Export

Export creates a video file from the same valid JSON V2 document. The result follows:

- the composition width and height;
- the declared frame rate;
- the visible layer hierarchy and timing;
- the declared colors, text, shapes, images, video clips and effects;
- the audio tracks and clip ranges, when the document contains audio.

The export duration is determined by the timed content in the composition. Make sure every video trim, animation range, audio clip and fade fits inside the intended timeline.

## Before exporting

Use this checklist when preparing a project:

- the root object has the required Neonix JSON V2 fields;
- composition dimensions and frame rate are positive and intentional;
- every referenced asset exists and has the expected kind;
- every layer and definition has a unique id;
- text uses a documented font or an available project font asset;
- video and audio ranges are within their source duration;
- animations have valid start, end and keyframe values;
- the preview shows the expected final frame and audio arrangement.

## Preview and export consistency

Both results read the same authoring values. A change to the JSON document should therefore be reviewed in preview before exporting again. Differences caused by an invalid reference, unavailable asset, unsupported value or incomplete timing should be fixed in the document rather than worked around in the output.

## What belongs in an output-ready document

Keep output-related meaning in documented JSON V2 fields: composition settings, layers, assets, paints, transforms, effects, animation and audio. Do not add browser state, temporary editor values or provider-specific metadata to an authoring document.

---
slug: validation
title: Validation and schema
description: What Neonix JSON V2 validation checks — required fields, types, references and ranges — plus an AI authoring checklist.
---
# Validation and schema

## Why validation matters

Validation makes the document predictable for both people and AI agents. It checks that the JSON uses the documented Neonix JSON V2 vocabulary, that values have the right types and that references point to real objects.

Unknown properties, invalid values and broken references are rejected before a project is accepted.

## Minimal valid document

```json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "composition": { "width": 1080, "height": 1080, "fps": 30 },
  "assets": [],
  "layers": [],
  "audio": { "sampleRate": 48000, "tracks": [] }
}
```

The root object must identify the document format and version, then provide a composition, an asset list, a layer list and an audio section. Optional features can be added only with documented fields.

## Required root fields

| Field | Purpose |
| --- | --- |
| `format` | Must be `motion-protocol`. |
| `formatVersion` | Must be `2`. |
| `composition` | Defines width, height, frame rate and optional background/color settings. |
| `assets` | Declares reusable image, video, audio and font resources. |
| `layers` | Defines the visible hierarchy and timed visual content. |
| `audio` | Defines audio settings and tracks, including an empty list when no audio is used. |

## What is checked

- exact `format` and `formatVersion`;
- required fields and their expected JSON types;
- finite numbers, supported units, valid colors and documented enum values;
- positive composition dimensions and a valid frame rate;
- unique asset, layer, definition, track and clip ids;
- valid group parents, no cycles and stable sibling order;
- valid image, video, audio and font asset references;
- valid paint, marker, clipping, mask and effect references;
- animatable property paths, typed values and keyframe bounds;
- video trim, source duration and audio fade bounds.

## IDs and references

Use short, stable and unique ids. An id may be referenced by another object, so changing it requires updating every reference to it.

Before submitting a document, verify that:

- each `assetId`, `parentId` or definition reference resolves;
- a layer does not point to itself as a parent;
- group relationships do not form a cycle;
- sibling order is not duplicated or ambiguous;
- a paint or effect reference uses the correct documented kind.

## Values and timing

Numbers must be finite JSON numbers. Do not use `NaN`, `Infinity`, numeric strings or browser expressions. Colors must use a documented color format, and enum values are case-sensitive.

For timed content, keep these values coherent:

- start and end values must describe a non-negative range;
- keyframes must use the type expected by the animated property;
- video clips must stay within the source duration;
- audio fades must stay within the clip range;
- transforms and effects must use the units documented for that property.

## Common validation errors

| Error | Typical cause | Fix |
| --- | --- | --- |
| Unknown field | A property was copied from another format or invented by an agent. | Remove it or replace it with the documented JSON V2 field. |
| Invalid type | A number, boolean or object was sent as a string. | Use the required JSON type. |
| Duplicate id | Two objects share the same id. | Give each object a unique id and update references. |
| Missing reference | A layer or clip refers to an asset or definition that is not present. | Add the object or correct the reference. |
| Invalid range | A time, trim or fade value is outside its allowed range. | Compare it with the composition or source duration. |
| Unsupported value | An enum, effect or property is outside the documented vocabulary. | Use a supported value or simplify the document. |

## AI authoring checklist

When an AI creates a document, it should:

1. Confirm the composition size, frame rate and intended duration.
2. Create the required root fields before adding optional features.
3. Generate unique ids and resolve references after all objects are created.
4. Use only fields and enum values described in the public JSON V2 documentation.
5. Check media duration, video trims, audio fades and animation ranges.
6. Keep numeric values as numbers and preserve the expected object shape.
7. Validate the complete document before presenting it as ready for preview or export.

Validation reports document problems; it does not invent missing assets, silently change unsupported values or guess the author's intended timing.
