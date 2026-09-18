import GithubSlugger from "github-slugger";
import { createElement } from "react";
import { DocsMarkdown } from "@/components/docs/DocsMarkdown";
import { DocsOverview } from "@/components/docs/DocsOverview";
import type { ReactNode } from "react";

export type DocsPageView = {
  title: string;
  toc: Array<{ id: string; title: string }>;
  showToc?: boolean;
  previewProject?: unknown;
  body: ReactNode;
};

function withOnThisPage(page: DocsPageView): DocsPageView {
  return { ...page, showToc: page.showToc ?? true };
}

type V2Page = { title: string; markdown: string };

const FENCE = String.fromCharCode(96).repeat(3);
const BT = String.fromCharCode(96);

const V2_PAGES: Record<string, V2Page> = {
  "": {
    title: "Neonix V2 documentation",
    markdown: String.raw`# Neonix V2

This is the static guide to Neonix's current authoring vocabulary and Neonix JSON V2. The examples on these pages are display-only teaching material. They are not sent to a compiler, runtime, preview renderer, or export process.

## Start with the model

Neonix separates intent from rendering:

${FENCE}text
Claude via MCP / future editor
        -> high-level authoring intent
        -> Neonix JSON V2
        -> Runtime IR
        -> frame evaluation
        -> preview or export adapter
${FENCE}

The same V2 meaning must be preserved across preview and export, but this guide itself only explains the contracts.

## Composition tree

${FENCE}text
Composition
+-- View
+-- Background
+-- Timeline
\-- Nodes
    +-- Shape
    +-- Path
    +-- Text
    \-- Group
${FENCE}

## Current rules

- Neonix JSON V2 is the current public document contract.
- Transform data is designed around a 4x4 matrix.
- A normal 2D layer is a 3D layer with zero Z rotation and zero Z position.
- ${BT}anchor${BT} describes the pivot; ${BT}z${BT} describes position along the world axis.
- High-level patterns and components are future authoring vocabulary, not atoms.
- Static documentation examples explain meaning but do not render media.

## Continue

- Read [Authoring model](/docs/authoring) for the boundary between intent and atoms.
- Read [HTML authoring](/docs/html) for the document metadata, CSS shell and import flow.
- Read [Neonix JSON V2](/docs/atoms) for the atom catalog.
- Read [Runtime, preview, and export](/docs/rendering) for adapter responsibilities.`,
  },
  authoring: {
    title: "Authoring model",
    markdown: String.raw`# Authoring model

## Intent first

High-level authoring is where a person, Claude via MCP, a template, or the editor can express rich intent:

${FENCE}json
{
  "kind": "hero-intro",
  "headline": "A calm beginning",
  "motion": "fade-up"
}
${FENCE}

This is illustrative high-level input. The fields are not Neonix JSON V2 fields. Compiler A expands and normalizes this intent before runtime rendering.

## Atomic input

An atomic document is explicit and deterministic:

${FENCE}json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "composition": { "width": 1920, "height": 1080, "fps": 30 },
  "layers": []
}
${FENCE}

## What belongs where

| Concern | High-level authoring | Neonix JSON V2 |
| --- | --- | --- |
| Pattern and preset names | Yes | No |
| Semantic motion intent | Yes | No |
| Shape geometry | Described | Explicit |
| Transform pivot | Requested | ${BT}anchor${BT} |
| World position | Requested | ${BT}translate.z${BT} |
| Timeline window | Requested | ${BT}timing${BT} |
| GPU resources | No | No |

## Determinism

An authoring surface may be expressive. The atomic result must be explicit enough that two runtimes can evaluate the same frame without guessing.

## MCP authoring

MCP is an authoring transport, not a second format. An agent should express intent first, then create or update explicit Neonix JSON V2 fields.

- Ask for missing composition dimensions, timing, asset references and font information.
- Use ${BT}anchor${BT} for a pivot, ${BT}translate.z${BT} for world position and ${BT}order${BT} for paint order.
- Keep fill opacity, stroke opacity and effect order independent.
- Do not invent renderer, shader, texture, buffer or preview-state fields.
- Keep patterns, presets, templates and components labeled as intent until a lowering rule exists.

For a targeted edit, send a small patch instead of replacing the whole document:

${FENCE}json
{
  "operation": "update",
  "target": "layers.hero.transform",
  "set": {
    "anchor": { "x": 0.5, "y": 0.5, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": -4 }
  }
}
${FENCE}

## Static example policy

JSON blocks in this guide teach structure. They are not validated or rendered by the web documentation page.`,
  },
  atoms: {
    title: "Neonix JSON V2",
    markdown: String.raw`# Neonix JSON V2

## Atom catalog

| Atom | Responsibility |
| --- | --- |
| Composition | Output size, rate, background, and document scope |
| View | Projection and view transform |
| Group | Parent-child hierarchy and group transform |
| Shape | Rectangle, ellipse, and other certified primitives |
| Path | Contours, fill rules, stroke, and morphable geometry |
| Text | Content, font reference, layout frame, and glyph intent |
| Image | SVG image viewport, preserveAspectRatio, and rendering behavior |
| Video | Asset reference and deterministic frame selection |
| Frame | Local width and height |
| Transform | Matrix4 inputs such as translate, rotate, scale, anchor, skew |
| Timing | Active time window |
| Animation | Keyframes targeting atomic properties |
| Effects | Ordered effect operators |
| Mask | Coverage relationship between source and mask |
| Composite | Opacity and blend operation |

## Atomic means explicit

An atom should describe one stable responsibility. High-level pattern names, UI behavior, and renderer resources do not belong in the atomic vocabulary.

## Certification

An atom is documented as certified only after its static contract, runtime meaning, preview behavior, and export parity have been tested. This page is a reference map; it does not run those tests.`,
  },
  "atoms/composition": {
    title: "Composition and view",
    markdown: String.raw`# Composition and view

Composition and view are the two global settings that define how a Neonix JSON V2 document becomes a visual output. Composition defines the canvas and time base. View defines how world coordinates are projected into that canvas.

## The mental model

| Concept | Responsibility | Changes the output size? |
| --- | --- | --- |
| Composition | Canvas dimensions, frame rate, background and color space | Yes |
| View | Projection, camera position and camera rotation | No |
| Layer frame | Local width and height of one layer | No |
| Layer transform | Position, rotation, scale and anchor of one layer | No |

The order is intentional: authoring defines the composition, layers are placed in world space, and the view projects that world into the declared output rectangle.

## Complete composition example

The composition object is required. This is a valid 1920×1080, 30 FPS document envelope:

${FENCE}json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "composition": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "background": "#101820",
    "colorSpace": "srgb",
    "view": {
      "projection": {
        "kind": "orthographic",
        "zoom": 1,
        "near": 1,
        "far": 4000
      },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 }
      }
    }
  },
  "layers": []
}
${FENCE}

The JSON field ${BT}format${BT} remains the schema compatibility value. The public name of the document format is Neonix JSON V2.

## Output dimensions

${BT}width${BT} and ${BT}height${BT} are positive composition units. For standard 2D work they behave like output pixels, with the origin at the top-left, X increasing to the right and Y increasing downward.

The aspect ratio is determined by these two values:

| Composition | Aspect ratio | Typical use |
| --- | --- | --- |
| 1920 × 1080 | 16:9 | Landscape video |
| 1080 × 1920 | 9:16 | Vertical video |
| 1080 × 1080 | 1:1 | Square social video |
| 2048 × 2048 | 1:1 | High-resolution square output |

Changing a layer frame does not change the composition size. Changing the browser viewport does not change it either. In an HTML document, the ${BT}composition${BT} metadata is authoritative; body CSS only controls how the authoring page is laid out.

## Frame rate and time

${BT}fps${BT} is the positive number of frames per second. Export samples the composition at this cadence:

${FENCE}text
30 fps  ->  frame 0 at 0 ms
           frame 1 at 33.333... ms
           frame 2 at 66.666... ms
           frame 3 at 100 ms
${FENCE}

Layer timing, keyframes and audio clip timing use milliseconds. The composition does not resize or stretch time when the output FPS changes; it changes the frame sampling cadence. Keep the same FPS in preview and export when comparing motion.

## Background and color space

${BT}background${BT} is the base color of the composition behind transparent or uncovered pixels. It is a color value, not an image asset and not a layer.

${BT}colorSpace${BT} is currently required to be ${BT}srgb${BT}. Keeping this explicit makes color interpretation deterministic across browsers, preview surfaces and exported video.

## View and projection

The view is required and contains two parts:

1. ${BT}projection${BT} maps world coordinates into the composition rectangle.
2. ${BT}transform${BT} moves and rotates the view before projection.

### Orthographic projection

Orthographic projection is the default for ordinary 2D motion. Objects do not become smaller just because their Z position changes.

${FENCE}json
{
  "kind": "orthographic",
  "zoom": 1,
  "near": 1,
  "far": 4000
}
${FENCE}

- ${BT}zoom${BT} is a positive scale factor. A larger value zooms into the world.
- ${BT}near${BT} and ${BT}far${BT} define the visible depth range.
- ${BT}far${BT} must be greater than ${BT}near${BT}.

Use orthographic projection for titles, cards, UI motion, illustrations and most HTML-to-video compositions.

### Perspective projection

Perspective projection makes depth affect apparent size. Objects with different Z positions can appear closer or farther from the view.

${FENCE}json
{
  "kind": "perspective",
  "fov": 60,
  "near": 1,
  "far": 4000
}
${FENCE}

- ${BT}fov${BT} is the vertical field of view in degrees and must be between 0.001 and 179.999.
- ${BT}near${BT} and ${BT}far${BT} are positive depth planes.
- Keep ${BT}far${BT} > ${BT}near${BT} and keep visible objects inside the depth range.

Perspective belongs at the composition view level. A local group can also have its own 3D perspective semantics; that is documented under [Layers and hierarchy](/docs/atoms/layers).

## View transform

The view transform has finite 3D translation and rotation values:

${FENCE}json
{
  "transform": {
    "translate": { "x": 0, "y": 0, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 0 }
  }
}
${FENCE}

- ${BT}translate${BT} moves the view in world units. Because it is a view transform, moving the view in one direction makes the scene appear to move in the opposite direction.
- ${BT}rotate${BT} rotates the view around X, Y and Z in degrees.
- ${BT}z${BT} is meaningful when using 3D layer positions or perspective projection.

For a normal 2D composition, keep the view at zero translation and rotation, use orthographic projection and place content with layer transforms instead.

## Composition, view and layer frame are different

Consider a 1920×1080 composition with a 640×360 card:

${FENCE}text
composition.width / height  -> output canvas: 1920 × 1080
card.frame.width / height   -> local geometry: 640 × 360
card.transform.translate    -> where the card is placed
composition.view             -> how the whole world is projected
${FENCE}

Changing the card frame changes only the card. Changing the view can affect every layer. Changing the composition dimensions changes the final output contract and may require repositioning content.

## Validation rules and common mistakes

- Composition must include positive ${BT}width${BT}, ${BT}height${BT} and ${BT}fps${BT}.
- ${BT}background${BT} must be a valid color and ${BT}colorSpace${BT} must be ${BT}srgb${BT}.
- ${BT}view${BT}, ${BT}projection${BT} and ${BT}transform${BT} are required objects.
- Orthographic projection requires ${BT}zoom${BT}, ${BT}near${BT} and ${BT}far${BT}.
- Perspective projection requires ${BT}fov${BT}, ${BT}near${BT} and ${BT}far${BT}.
- ${BT}far${BT} must be greater than ${BT}near${BT}.
- Do not use body CSS, a browser window size or a layer frame as a substitute for composition dimensions.

Continue with [Transform and Matrix4](/docs/atoms/transform) for layer transforms, [Layers and hierarchy](/docs/atoms/layers) for parent-child coordinates, and [Animation and timing](/docs/animation) for time-based changes.`,
  },
  "atoms/transform": {
    title: "Transform and Matrix4",
    markdown: String.raw`# Transform and Matrix4

Transform controls where a layer is placed, how it rotates and scales, and which local point acts as its pivot. Every layer has a required transform object, and the same model works for flat 2D motion and 3D motion.

## The transform model

${FENCE}json
{
  "frame": { "width": 480, "height": 270 },
  "transform": {
    "translate": { "x": 320, "y": 180, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 8 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 240, "y": 135, "z": 0 },
    "skew": { "x": 0, "y": 0 }
  }
}
${FENCE}

| Field | Meaning | Typical default |
| --- | --- | --- |
| ${BT}translate${BT} | Position in the parent/world coordinate system | ${BT}{ x: 0, y: 0, z: 0 }${BT} |
| ${BT}rotate${BT} | Rotation around X, Y and Z axes, in degrees | ${BT}{ x: 0, y: 0, z: 0 }${BT} |
| ${BT}scale${BT} | Scale along X, Y and Z axes | ${BT}{ x: 1, y: 1, z: 1 }${BT} |
| ${BT}anchor${BT} | Local pivot point used by rotation and scale | ${BT}{ x: 0, y: 0, z: 0 }${BT} |
| ${BT}skew${BT} | 2D shear angles for X and Y | ${BT}{ x: 0, y: 0 }${BT} |

All values must be finite numbers. The transform does not change the layer frame itself; it changes how that frame is placed and projected.

## Frame versus transform

The frame is local geometry. The transform is placement:

${FENCE}text
frame:     480 × 270 local rectangle
anchor:    (240, 135) center of that rectangle
translate: (320, 180) position in the parent/world space
rotate.z:  8 degrees around the anchor
scale:     (1, 1, 1) unchanged size
${FENCE}

Changing ${BT}frame.width${BT} or ${BT}frame.height${BT} changes the layer's local geometry. Changing ${BT}translate${BT}, ${BT}rotate${BT}, ${BT}scale${BT} or ${BT}anchor${BT} keeps the geometry but changes its placement or appearance.

## Translate

${BT}translate${BT} moves the layer in its parent coordinate system. X and Y use composition/world units. Z is used when the composition view or a parent group uses depth.

${FENCE}json
"translate": { "x": 320, "y": 180, "z": 0 }
${FENCE}

For a child layer, the translation is evaluated relative to its parent group. For a root layer, it is evaluated relative to the composition world.

## Scale

${BT}scale${BT} multiplies the local geometry around the anchor:

- ${BT}1${BT} leaves an axis unchanged.
- A value between ${BT}0${BT} and ${BT}1${BT} shrinks that axis.
- A value greater than ${BT}1${BT} enlarges that axis.
- A negative value mirrors the layer across that axis.
- ${BT}0${BT} collapses an axis and should be used deliberately.

${FENCE}json
"scale": { "x": 1.2, "y": 0.8, "z": 1 }
${FENCE}

## Rotation

Rotation values are degrees. Z rotation is the usual flat 2D rotation; X and Y rotation are useful with perspective projection or 3D layers.

${FENCE}json
"rotate": { "x": 0, "y": 0, "z": -12 }
${FENCE}

Rotation happens around the local anchor. If the anchor is at the top-left, the layer swings around that corner. If the anchor is at the center, it rotates around its center.

## Anchor and pivot

${BT}anchor.x${BT} and ${BT}anchor.y${BT} are local units, not normalized 0–1 percentages. For a 480×270 frame, the center anchor is ${BT}{ x: 240, y: 135, z: 0 }${BT}. The pivot may be outside the frame for orbit-style motion.

${FENCE}json
{
  "frame": { "width": 480, "height": 270 },
  "transform": {
    "translate": { "x": 540, "y": 405, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 20 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 240, "y": 135, "z": 0 },
    "skew": { "x": 0, "y": 0 }
  }
}
${FENCE}

To place the frame's center at a world position, use the frame center as the anchor and set ${BT}translate${BT} to that world position. To rotate around a corner, use ${BT}{ x: 0, y: 0, z: 0 }${BT}.

## Skew

${BT}skew.x${BT} and ${BT}skew.y${BT} are 2D shear angles in degrees. They are useful for slanted cards, italic-style geometric motion and simple projection accents. Use an ordered ${BT}operations${BT} list when the exact SVG transform sequence matters.

## Ordered operations

The component fields above provide the simple layer transform contract. An optional ${BT}operations${BT} array preserves an explicit ordered transform list; its order is semantic and must not be rearranged.

${FENCE}json
"operations": [
  { "type": "translate", "x": 320, "y": 180 },
  { "type": "rotate", "angle": 8, "center": { "x": 240, "y": 135 } },
  { "type": "scale", "x": 1.1, "y": 1.1 },
  { "type": "skewX", "angle": 4 }
]
${FENCE}

Supported 2D operations are ${BT}translate${BT}, ${BT}scale${BT}, ${BT}rotate${BT}, ${BT}skewX${BT}, ${BT}skewY${BT} and six-value SVG ${BT}matrix${BT}. Motion extensions add ${BT}motion.translate3d${BT}, ${BT}motion.scale3d${BT}, ${BT}motion.rotateX${BT}, ${BT}motion.rotateY${BT}, ${BT}motion.rotateZ${BT}, ${BT}motion.perspective${BT} and ${BT}motion.matrix4${BT}.

When ${BT}operations${BT} is present, it is the authored operation sequence. The transform anchor wraps that sequence as a pivot, and the layer translation places the result.

## Matrix4

Neonix uses a canonical 4×4 matrix for the final 2D/3D transform. Most authors should use the named fields or ordered operations. Use ${BT}motion.matrix4${BT} only when importing an already-composed matrix or when a tool needs direct matrix control.

${FENCE}json
{
  "type": "extension",
  "name": "motion.matrix4",
  "value": [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    320, 180, 0, 1
  ]
}
${FENCE}

Do not mix a pre-composed matrix with equivalent translate, rotate and scale values unless the duplication is intentional. Otherwise the same motion can be applied twice.

## Composition order

With the named fields, the conceptual local transform is:

${FENCE}text
translate → pivot to anchor → rotate → skew → scale → pivot back
${FENCE}

The exact matrix is evaluated consistently for preview and export. With ${BT}operations${BT}, the listed operations replace the implicit ordered list; their order is not interchangeable. For example, scale-then-translate does not generally produce the same result as translate-then-scale.

## Parent and child layers

A group transform affects its descendants. A child transform is evaluated in the coordinate system established by its parent, then the child is painted according to sibling ${BT}order${BT}. To understand a misplaced layer, inspect the chain from the root composition through each parent group before changing the child values.

See [Layers and hierarchy](/docs/atoms/layers) for parent relationships and [Composition and view](/docs/atoms/composition) for the global view projection.

## Animate a transform

Animation tracks target individual transform properties with dot-separated paths:

${FENCE}json
{
  "path": "transform.translate.x",
  "keyframes": [
    { "time": 0, "value": { "type": "number", "value": 120 } },
    { "time": 1000, "value": { "type": "number", "value": 520 } }
  ]
}
${FENCE}

Other supported paths include ${BT}transform.translate.y${BT}, ${BT}transform.translate.z${BT}, ${BT}transform.scale.x${BT}, ${BT}transform.rotate.z${BT}, ${BT}transform.skew.x${BT} and ${BT}transform.anchor.x${BT}. Track times are milliseconds and each keyframe value must keep the property's type.

## Common mistakes

- Using normalized anchor values such as ${BT}0.5${BT} instead of local units such as ${BT}frame.width / 2${BT}.
- Changing the layer frame when the intent is only to move or rotate the layer.
- Reordering ${BT}operations${BT} and expecting the same result.
- Applying both a pre-composed ${BT}motion.matrix4${BT} and equivalent named transform values.
- Using X/Y rotation without a perspective view and expecting visible depth scaling.
- Forgetting that a parent group transform affects every descendant.

For the global camera, read [Composition and view](/docs/atoms/composition). For time-based changes, read [Animation and timing](/docs/animation).`,
  },
  "atoms/shape": {
    title: "Shape",
    markdown: String.raw`# Shape

## Responsibility

Shape describes certified primitive geometry. The first certified primitives are rectangle and ellipse.

${FENCE}json
{
  "id": "card",
  "type": "shape",
  "shape": { "kind": "rectangle" },
  "frame": { "width": 640, "height": 360 },
  "fill": "#18B89A",
  "fillOpacity": 1,
  "stroke": "#FFFFFF",
  "strokeOpacity": 1,
  "strokeWidth": 4,
  "transform": {
    "translate": { "x": 120, "y": 80, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 0.5, "y": 0.5, "z": 0 }
  }
}
${FENCE}

## Paint independence

Fill and stroke are separate paint inputs. Their colors and opacity values must not be silently merged.

## Rounded geometry

Rounded corners are geometry semantics. They are not a CSS-only feature and are not represented as a renderer resource.`,
  },
  "atoms/path": {
    title: "Path",
    markdown: String.raw`# Path

## Responsibility

Path describes one or more contours made from explicit segments. A path can be filled, stroked, or both.

${FENCE}json
{
  "id": "five-point-star",
  "type": "path",
  "payload": {
    "fillRule": "nonzero",
    "contours": [
      {
        "closed": true,
        "segments": [
          { "kind": "line", "to": { "x": 120, "y": 20 } },
          { "kind": "line", "to": { "x": 150, "y": 110 } },
          { "kind": "line", "to": { "x": 60, "y": 55 } }
        ]
      }
    ]
  }
}
${FENCE}

## Fill rules

${BT}nonzero${BT} and ${BT}evenodd${BT} are path fill semantics. They determine which regions are inside a multi-contour path. They are not separate visual layers.

## Stroke

Stroke width, cap, join, dash, color, and opacity are paint semantics applied to the path contour.`,
  },
  "atoms/text": {
    title: "Text",
    markdown: String.raw`# Text

Text combines source content, font selection, layout and paint. The compiler resolves the requested font family, weight and style into deterministic font assets before text is previewed or exported.

## Text structure

${FENCE}json
{
  "id": "title",
  "type": "text",
  "payload": {
    "source": { "text": "Neonix JSON V2", "language": "en" },
    "chunks": [{
      "id": "title-chunk",
      "sourceRange": { "start": 0, "end": 14 },
      "textAnchor": "middle",
      "spans": [{
        "id": "title-span",
        "sourceRange": { "start": 0, "end": 14 },
        "font": {
          "families": ["Inter", "sans-serif"],
          "size": 64,
          "weight": 700,
          "style": "normal"
        },
        "fill": "#ffffff"
      }]
    }]
  },
  "frame": { "width": 800, "height": 160 }
}
${FENCE}

The ${BT}families${BT} array is an ordered fallback list. The first available family is preferred; later families cover missing glyphs or unavailable styles. Keep a generic fallback such as ${BT}sans-serif${BT} at the end, but use a Neonix system font first for stable export.

## Frame and layout

The text frame is the explicit layout area. It controls where lines can wrap and where alignment is resolved; it is not automatically resized to the browser viewport.

- Use a wider frame for a single-line headline.
- Use a fixed width and sufficient height for a paragraph.
- Keep the layer transform separate from text frame geometry.
- Use ${BT}textAnchor${BT}, text alignment and vertical alignment to position shaped lines inside the frame.

The source ranges are UTF-16 offsets and must cover the text spans without overlap. Text source should be NFC-normalized before creating the document.

## Font fields

| Field | Meaning |
| --- | --- |
| ${BT}families${BT} | Ordered family fallback list |
| ${BT}size${BT} | Positive font size in SVG length units |
| ${BT}weight${BT} | Integer weight from 1 to 1000 |
| ${BT}style${BT} | ${BT}normal${BT}, ${BT}italic${BT} or ${BT}oblique |
| ${BT}stretch${BT} | CSS width classification |
| ${BT}variations${BT} | Optional four-character variable-font axis tags |

Do not put a CDN URL inside ${BT}families${BT}. The family name selects the face; the asset catalog resolves the actual font bytes.

## Use the public font CDN in HTML

The system font bucket is public for GET/HEAD requests. Use an explicit ${BT}@font-face${BT} declaration when authoring HTML outside the app:

${FENCE}html
<style>
  @font-face {
    font-family: "Inter";
    src: url("https://fonts.neonix.video/inter/Inter_18pt-Regular.ttf") format("truetype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: "Inter";
    src: url("https://fonts.neonix.video/inter/Inter_18pt-Bold.ttf") format("truetype");
    font-weight: 700;
    font-style: normal;
    font-display: swap;
  }

  .headline {
    font-family: "Inter", sans-serif;
    font-weight: 700;
  }
</style>
${FENCE}

The public CDN supports browser GET/HEAD. CORS should allow the HTML page origin to request the font. Use the CDN for known files; the bucket intentionally does not act as a browser directory listing.

## Get the complete font catalog

Use the public catalog endpoint to retrieve every enabled system font without authentication:

${FENCE}bash
curl https://www.neonix.video/api/v1/fonts
${FENCE}

When an access token is provided, the same endpoint also includes enabled custom fonts from the authenticated workspace:

${FENCE}bash
curl https://www.neonix.video/api/v1/fonts \\
  -H "Authorization: Bearer <access-token>"
${FENCE}

The response is shaped as ${BT}{ fonts: [...] }${BT}. Each entry includes ${BT}source${BT}, ${BT}familyName${BT}, ${BT}subfamilyName${BT}, ${BT}weight${BT}, ${BT}style${BT}, ${BT}format${BT}, ${BT}integrity${BT} and a usable ${BT}uri${BT}. System entries use the protected system-font API URI; custom entries use the workspace asset URI.

The unauthenticated response has ${BT}scope: "public"${BT} and contains system fonts only. The authenticated response contains system and workspace fonts. The catalog endpoint is the source of truth for applications and AI clients that need to show every available font; the public CDN is the delivery path for a known system-font object.

## Deterministic font workflow

1. Fetch the catalog with the user's authenticated session.
2. Select a family, weight and style that exist in the response.
3. In HTML, declare the matching CDN ${BT}@font-face${BT} URL; in Neonix JSON V2, use the family name and weight in the text font object.
4. Keep the same family, weight, style and asset integrity across preview and export.
5. Avoid silently replacing a missing face with a machine-local font.

## Font loading failures

If text looks different or a font is missing, check the CDN object URL, CORS response, MIME type, weight/style match and the font catalog integrity value. A fallback family can keep text visible, but it may change glyph widths, line breaks and final composition layout.

See [Assets](/docs/atoms/assets) for the asset identity boundary and [HTML authoring](/docs/html) for the complete HTML document workflow.`,
  },
  "atoms/image": {
    title: "Image",
    markdown: String.raw`# Image

## Responsibility

Image references an asset and defines how that source is placed inside a frame.

${FENCE}json
{
  "id": "photo",
  "type": "image",
  "payload": { "assetId": "photo-square" },
  "frame": { "width": 480, "height": 480 },
  "fit": "cover",
  "transform": {
    "translate": { "x": 720, "y": 180, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 0.5, "y": 0.5, "z": 0 }
  }
}
${FENCE}

## Frame ratio

High-level authoring can choose a frame with the same aspect ratio as the source. The atom keeps the explicit frame and fit policy; it does not infer a new frame during rendering.

## Asset identity

The atom refers to an asset. Loading, decoding, caching, and delivery belong to the asset system.`,
  },
  "atoms/video": {
    title: "Video",
    markdown: String.raw`# Video

## Responsibility

Video references a media asset and participates in the same frame, transform, timing, and composite model as other visual nodes.

${FENCE}json
{
  "id": "clip",
  "type": "video",
  "payload": { "assetId": "intro-video" },
  "frame": { "width": 960, "height": 540 },
  "timing": { "start": 0, "duration": 3 },
  "source": { "trimStart": 0 },
  "fit": "contain"
}
${FENCE}

## Deterministic time

Runtime chooses the source frame from the evaluated composition time. The documentation does not play the video or depend on browser playback state.

## Delivery

The asset reference is stable. File URLs, decoding, and caching are delivery concerns.`,
  },
  "atoms/assets": {
    title: "Assets",
    markdown: String.raw`# Assets

## Portable references

Assets are metadata and stable references. Neonix JSON V2 never stores decoded pixels, video elements, PCM buffers, font objects, GPU handles, or runtime caches in authoring JSON.

${FENCE}json
{
  "assets": [
    {
      "kind": "image",
      "id": "logo",
      "uri": "/assets/logo.png",
      "mimeType": "image/png",
      "width": 640,
      "height": 360,
      "integrity": "sha256-..."
    },
    {
      "kind": "font",
      "id": "inter-regular",
      "uri": "https://fonts.neonix.video/inter/Inter_18pt-Regular.ttf",
      "mimeType": "font/ttf",
      "weight": 400,
      "style": "normal",
      "integrity": "sha256-..."
    }
  ]
}
${FENCE}

## Four asset kinds

| Kind | Responsibility |
| --- | --- |
| image | URI and optional intrinsic dimensions |
| video | source metadata, duration, fps and optional audio derivative |
| audio | URI, MIME type, duration, sample rate and channels |
| font | URI, CSS weight and integrity |

## Identity boundary

Layers point to assets by id. Loading, decoding, caching and delivery happen after validation in the compiler or runtime.

## System fonts and the public CDN

Neonix system fonts are stored in the public-read ${BT}neonix-system-fonts${BT} bucket and served through:

${FENCE}text
https://fonts.neonix.video/{family}/{filename}
${FENCE}

Example:

${FENCE}text
https://fonts.neonix.video/inter/Inter_18pt-Regular.ttf
https://fonts.neonix.video/inter/Inter_18pt-Bold.ttf
${FENCE}

The CDN is a delivery endpoint for known objects. R2 does not expose a browser directory listing, so requesting the bucket root or a family folder is not the way to discover fonts.

## Google Fonts-compatible CSS API

For browser HTML, request the required family and weights through the CSS endpoint:

${FENCE}html
<link rel="stylesheet" href="https://fonts.neonix.video/css2?family=Inter:wght@400;700;900&display=swap">
${FENCE}

Then use the canonical family name in CSS:

${FENCE}css
body {
  font-family: "Inter", sans-serif;
  font-weight: 700;
}
${FENCE}

The CSS endpoint resolves the requested family, weight and style to the matching public R2 object. It does not rename the font's internal family metadata.

## Get every available font

Call ${BT}GET /api/v1/fonts${BT} without authentication to list all public system fonts:

${FENCE}bash
curl https://www.neonix.video/api/v1/fonts
${FENCE}

For a workspace-aware catalog that also includes the user's custom fonts, add the access token:

${FENCE}bash
curl https://www.neonix.video/api/v1/fonts \\
  -H "Authorization: Bearer <access-token>"
${FENCE}

The response contains ${BT}{ "fonts": [...] }${BT} and includes enabled system fonts plus enabled custom fonts belonging to the current workspace. Each item exposes the family, subfamily, weight, style, format, integrity hash and a usable URI.

Use the catalog to populate a font picker or help an AI choose an available face. Use the public CDN URI when the HTML document is loaded outside the authenticated app. Custom workspace fonts remain private asset URLs and should not be copied into public HTML.

## Font asset versus text style

The font catalog identifies the bytes. The text span selects the family and style:

${FENCE}json
{
  "font": {
    "families": ["Inter", "sans-serif"],
    "size": 64,
    "weight": 700,
    "style": "normal"
  }
}
${FENCE}

Do not put an R2 URL in ${BT}families${BT}. Use the family name in Neonix JSON V2 and use ${BT}@font-face${BT} with the CDN URL in HTML. The compiler and export path can then resolve the same family, weight and style deterministically.

See [Text](/docs/atoms/text) for font selection, fallback and ${BT}@font-face${BT} examples.
`,
  },
  "atoms/layers": {
    title: "Layers and hierarchy",
    markdown: String.raw`# Layers and hierarchy

## A flat array, a tree in meaning

The layers array is flat so it is easy to patch, diff and stream. Parent-child relationships are expressed with parentLayerId. Only a group may be a parent, layer ids are globally unique, and higher sibling order paints later.

${FENCE}json
{
  "layers": [
    {
      "id": "hero-group",
      "parentLayerId": null,
      "order": 0,
      "type": "group",
      "frame": { "width": 1080, "height": 1920 },
      "transform": { "...": " },
      "timing": { "start": 0, "duration": 4000 },
      "payload": { "children": ["title", "badge"] }
    },
    {
      "id": "title",
      "parentLayerId": "hero-group",
      "order": 1,
      "type": "text",
      "frame": { "width": 720, "height": 120 },
      "timing": { "start": 0, "duration": 2400 }
    }
  ]
}
${FENCE}

## Shared layer contract

Every layer carries id, parentLayerId, order, frame, transform, timing, type and a type-specific payload. Optional fields such as opacity, visibility, clipPath, mask, filter, motion, composite, tracks and effects remain explicit rather than hidden in renderer state.

## Certified layer types

| Type | Meaning |
| --- | --- |
| group | hierarchy, inherited state and optional local 3D context |
| shape | rectangle, circle, ellipse, line, polyline or polygon |
| path | explicit contours and segments |
| text | source, chunks, spans, font and layout semantics |
| image | asset viewport and preserveAspectRatio |
| video | asset range, fit policy and embedded audio controls |
`,
  },
  "atoms/paint": {
    title: "Paint and SVG definitions",
    markdown: String.raw`# Paint and SVG definitions

## Paint is semantic data

V2 keeps fill, stroke, opacity, paint order and markers separate. A paint value may be a color, none, currentColor, context-fill, context-stroke or a structured paint object.

${FENCE}json
{
  "style": {
    "fill": { "type": "reference", "id": "brand-gradient" },
    "fillOpacity": 1,
    "stroke": "#FFFFFF",
    "strokeWidth": 3,
    "paintOrder": ["fill", "stroke", "markers"]
  },
  "paintServers": [
    {
      "id": "brand-gradient",
      "paint": {
        "type": "linear-gradient",
        "angle": 90,
        "stops": [
          { "offset": 0, "color": "#3AEDAE" },
          { "offset": 1, "color": "#2563EB", "stopOpacity": 0.8 }
        ]
      }
    }
  ]
}
${FENCE}

## Gradients, patterns and references

Linear, radial and conic gradients preserve SVG coordinates, units, spread method, transforms and stops. Patterns preserve their content nodes and viewBox. Named paint servers live at the root and are referenced by id. Unknown ids and reference cycles are rejected.

## Stroke and markers

Stroke width, opacity, cap, join, miter limit, dash and vectorEffect map directly to SVG semantics. Marker start, mid and end point to root marker definitions.
`,
  },
  "atoms/group": {
    title: "Group",
    markdown: String.raw`# Group

## Responsibility

Group provides hierarchy and an optional parent transform. It is a structural atomic node, not a GPU resource.

${FENCE}json
{
  "id": "hero-group",
  "type": "group",
  "children": ["title", "photo"],
  "transform": {
    "translate": { "x": 0, "y": 0, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 0.5, "y": 0.5, "z": 0 }
  }
}
${FENCE}

## Parent transform

Runtime composes the group transform with each child transform. Children keep their local frame and local transform semantics.

## Current boundary

Group is a container. High-level component behavior, responsive layout, and reusable template logic are not group fields.`,
  },
  "atoms/effects": {
    title: "Effects, masks, and composite",
    markdown: String.raw`# Effects, masks, and composite

## Ordered operators

Effects are explicit operators evaluated in order. The order is part of the visual meaning.

${FENCE}json
{
  "effects": [
    { "type": "blur", "radius": 24 },
    { "type": "shadow", "source": "alpha", "offset": { "x": 18, "y": 20 }, "blur": 16, "spread": 0, "color": "#00000040", "inset": false }
  ],
  "composite": { "opacity": 1, "blendMode": "normal" }
}
${FENCE}

## Masks

Clip paths, alpha/luminance masks, and isolation describe coverage and compositing relationships. They are not high-level layout features.

## Paint and composite opacity

Fill opacity and stroke opacity belong to their paint sources. Layer/composite opacity belongs to the composite result. Keeping them separate makes effect and export behavior predictable.

## Static teaching boundary

The figures in the web guide are explanatory pictures. They do not execute an offscreen pass or initialize a graphics API.`,
  },
  animation: {
    title: "Animation and timing",
    markdown: String.raw`# Animation and timing

## Two clocks

Each layer has a composition-time window. Tracks evaluate inside that layer&apos;s local time, so a layer can enter the composition at 1200 ms while its animation still starts at local time 0.

${FENCE}json
{
  "timing": { "start": 1200, "duration": 2400 },
  "tracks": [
    {
      "id": "move-x",
      "path": "transform.translate.x",
      "keyframes": [
        { "time": 0, "value": { "type": "number", "value": -120 } },
        {
          "time": 600,
          "value": { "type": "number", "value": 0 },
          "easing": {
            "type": "cubicBezier",
            "x1": 0.22,
            "y1": 1,
            "x2": 0.36,
            "y2": 1
          }
        }
      ]
    }
  ]
}
${FENCE}

## Typed keyframes

Tracks target a dot-separated property path such as transform.translate.x, opacity, style.fill or motion.offsetDistance. Values are explicitly typed as number, vec2, vec3, vec4, color, boolean, string or enum.

Keyframe times are strictly increasing and cannot exceed the layer duration. Vector sizes are fixed and the schema checks that the value kind matches the target property.

## Easing

V2 supports linear, step, cubicBezier and spring easing. interpolation may be linear or discrete. Easing changes how a value is sampled; it does not create an implicit property or a hidden runtime animation.

## Deterministic playback

Preview and export evaluate the same track at the same composition time. No browser CSS animation state is part of the protocol contract.
`,
  },
  "animation/motion-paths": {
    title: "Motion paths",
    markdown: String.raw`# Motion paths

## A layer-owned path

Motion paths are part of the layer model. The path is not a visible paint and does not create a second layout pass.

${FENCE}json
{
  "motion": {
    "offsetPath": {
      "type": "path",
      "coordinateSpace": "parent-local",
      "referenceBox": "border-box",
      "contours": [
        {
          "id": "orbit",
          "start": { "x": 100, "y": 100 },
          "segments": [
            { "kind": "cubic", "control1": { "x": 180, "y": 0 }, "control2": { "x": 420, "y": 0 }, "to": { "x": 500, "y": 100 } }
          ],
          "closed": false
        }
      ]
    },
    "offsetDistance": 0,
    "offsetRotate": { "mode": "auto", "angle": 0 },
    "offsetAnchor": { "x": 40, "y": 40 }
  },
  "tracks": [
    {
      "id": "path-progress",
      "path": "motion.offsetDistance",
      "keyframes": [
        { "time": 0, "value": { "type": "number", "value": 0 } },
        { "time": 1400, "value": { "type": "number", "value": 1 } }
      ]
    }
  ]
}
${FENCE}

## Lowering rules

The HTML/CSS compiler resolves path(), CSS lengths and percentages, then stores offsetDistance as a normalized ratio from 0 to 1. Runtime samples the path and tangent before composing translation, rotation, anchor and authored transforms.

Only supported deterministic path grammar is accepted. Empty paths, zero-length paths, non-finite values and unsupported grammar produce diagnostics.
`,
  },
  audio: {
    title: "Audio",
    markdown: String.raw`# Audio

## A parallel timeline

Audio is a required root domain next to visual layers. A silent project still declares a sample rate and an empty track list.

${FENCE}json
{
  "audio": {
    "sampleRate": 48000,
    "tracks": [
      {
        "id": "music",
        "gainDb": -3,
        "pan": 0,
        "muted": false,
        "clips": [
          {
            "id": "music-clip",
            "assetId": "audio-001",
            "timing": { "start": 0, "duration": 30000 },
            "trim": { "start": 0, "duration": 30000 },
            "playbackRate": 1,
            "enabled": true,
            "fadeIn": { "duration": 250, "curve": "linear" },
            "fadeOut": { "duration": 500, "curve": "equal-power" }
          }
        ]
      }
    ]
  }
}
${FENCE}

## Time and mix rules

Clip timing is composition time; trim is source time. Playback rate is positive, pan is normalized to -1..1, and fade durations cannot exceed clip duration. An enabled false clip stays on the timeline while silencing its input.

## Video audio

Embedded video audio stays on video.payload.audio so its visual trim and original audio identity move together. The compiler lowers the audio part to independent runtime audio data.
`,
  },
  compiler: {
    title: "Compiler pipeline",
    markdown: String.raw`# Compiler pipeline

## Lower once, present many ways

Neonix JSON V2 owns authoring meaning. The compiler resolves that meaning into Runtime V3 without replacing the authoring contract.

${FENCE}text
HTML / CSS / agent intent
          |
          v
Neonix JSON V2
          |
          v
motion-compiler
          |
          v
RuntimeProjectV3 / RuntimeFrameV3
          |
          +--> browser SVG
          +--> Native preview
          +--> export renderer
${FENCE}

## What the compiler resolves

CSS cascade, percentages, font fallback, text shaping, media metadata, motion paths, effect programs, transforms and paint references are resolved after protocol validation.

## What it does not do

The protocol does not expose runtime IR, Matrix4 buffers, decoded media, GPU resources, preview state or export commands. Those are implementation concerns of the compiler and adapters.

## One meaning, multiple adapters

For one document and one time value, preview and export must receive the same evaluated runtime values. Backend-specific differences are presentation details, not new protocol semantics.`,
  },
  rendering: {
    title: "Runtime, preview, and export",
    markdown: String.raw`# Runtime, preview, and export

## Runtime first

Runtime resolves a V2 document into deterministic frame data. This includes animation values, Matrix4 transforms, projection, text layout, asset state, effect programs, and paint commands.

## Preview adapter

The native preview adapter presents a frame interactively. WebGPU is the preferred backend and WebGL2 is the fallback. Both consume the same runtime meaning.

## Export adapter

The export adapter schedules the same runtime frames for a video renderer and encoder. Export is not a second authoring protocol.

## What this page does not do

This is an architectural explanation only. The documentation page does not create a canvas, request a GPU device, load a video, render a frame, or encode an output.

## Parity rule

For one V2 document and one time value:

${FENCE}text
same protocol meaning
        -> same runtime values
        -> adapter-specific presentation
${FENCE}

Backend differences are implementation details, not new protocol semantics.`,
  },
  html: {
    title: "HTML authoring",
    markdown: String.raw`# HTML authoring

HTML projects are compiled into the same Neonix project model used by the editor, preview and export flows. The document metadata defines the video composition; the browser page around it is only a convenient authoring surface.

## Required document metadata

Every HTML project must contain exactly one ${BT}<meta name="neonix-document">${BT} tag. Its JSON value declares the composition contract:

${FENCE}html
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
${FENCE}

The following values are required:

- ${BT}kind${BT} must be ${BT}neonix-html-document${BT}.
- ${BT}schemaVersion${BT} must be ${BT}2${BT}.
- ${BT}composition.width${BT}, ${BT}composition.height${BT} and ${BT}composition.fps${BT} must be positive numbers.
- ${BT}composition.background${BT} must be a valid color.
- ${BT}composition.colorSpace${BT} must be ${BT}srgb${BT}.

## Composition size and body CSS

The composition metadata is the source of truth for preview and export. You do not have to set ${BT}body${BT} to the same pixel dimensions, and the compiler does not infer the video size from body CSS.

For a document that should also look correct when opened directly in a browser, use a fluid page shell and let the composition define the render viewport:

${FENCE}css
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
${FENCE}

If an element paints outside the composition rectangle, the exported frame remains the declared composition size and the outside area is cropped. Set explicit dimensions on individual elements when their layout depends on a fixed design grid.

## Supported authoring surface

Use ordinary HTML and CSS for the supported compiler subset:

- semantic elements such as ${BT}div${BT}, ${BT}section${BT}, ${BT}main${BT}, headings and paragraphs;
- CSS colors, opacity, borders, rounded corners, gradients, transforms and animation declarations supported by the compiler;
- local or Neonix system-font URLs for deterministic text layout;
- images and other media through the asset references supported by the HTML compiler.

The compiler validates the document before creating a project. Browser-only behavior such as event handlers, network-dependent layout, canvas state or arbitrary JavaScript is not part of the deterministic export contract.

## Fonts

For stable preview and export, use a font from the Neonix system font CDN and declare it explicitly:

${FENCE}css
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
${FENCE}

Keep the font family, weight and style explicit. Avoid relying on a user's installed fonts or loading a font from an unpinned external provider.

## Import from the dashboard

Choose **Import HTML** on the dashboard, enter a project name, then upload an ${BT}.html${BT} file or paste the document. The import uses the same validation and compilation path as the API and opens the new project preview when it succeeds.

## Create through the API

The HTML project endpoint accepts the same document as a string:

${FENCE}bash
curl -X POST https://www.neonix.video/api/v1/projects/html \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <access-token>" \\
  -d '{
    "title": "Neonix intro",
    "html": "<!doctype html><html>...</html>",
    "idempotencyKey": "neonix-intro-v1"
  }'
${FENCE}

On success, the response contains the created project identifier. The project can then be opened in preview, refined in the editor and exported through the normal project flow.

## Validate before importing

When a document is rejected, fix the first diagnostic before retrying. Common causes are a missing or duplicated metadata tag, invalid JSON in the ${BT}content${BT} attribute, unsupported CSS, or a font/media reference that cannot be resolved.

For an interactive compiler test, open [HTML compiler preview](/docs/preview/html-compiler). For the underlying project and API contracts, continue with [Compiler pipeline](/docs/compiler) and [Runtime, preview, and export](/docs/rendering).`,
  },
  validation: {
    title: "Validation and schema",
    markdown: String.raw`# Validation and schema

## Validate at the boundary

The canonical implementation is the Zod schema in packages/motion-protocol/src/v2. The generated JSON Schema is packages/motion-protocol/schema/v2.json. Strict object boundaries reject unknown properties.

${FENCE}ts
import {
  MotionProtocolV2Schema,
  parseMotionProtocol,
  serializeMotionProtocol,
} from "@motionvideo/motion-protocol";

const project = MotionProtocolV2Schema.parse(input);
const parsed = parseMotionProtocol(input);
const json = serializeMotionProtocol(parsed);
${FENCE}

## What is checked

- exact format and formatVersion;
- finite numbers, units, colors and enum values;
- unique asset, layer, definition, track and clip ids;
- valid group parents, no cycles and unique sibling order;
- valid image, video and audio asset references;
- valid paint-server, marker, clipPath, mask and filter references;
- animatable track paths, typed values and keyframe bounds;
- video trim, source duration and audio fade bounds.

## Valid does not mean supported everywhere

A schema-valid value is valid authoring data. Compiler capability decides whether an optional SVG or 3D feature has a lowering path for a specific adapter.

## Checks

${FENCE}bash
pnpm --filter @motionvideo/motion-protocol typecheck
pnpm --filter @motionvideo/motion-protocol test
pnpm --filter @motionvideo/motion-protocol check:schema
${FENCE}`,
  },
  examples: {
    title: "Static examples",
    markdown: String.raw`# Static examples

## Example: a centered card

The following JSON is a teaching example. It is shown as text and is not executed by this page.

${FENCE}json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "composition": { "width": 1920, "height": 1080, "fps": 30 },
  "layers": [
    {
      "id": "card",
      "type": "shape",
      "shape": { "kind": "rectangle" },
      "frame": { "width": 720, "height": 420 },
      "fill": "#18B89A",
      "transform": {
        "translate": { "x": 600, "y": 300, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 },
        "anchor": { "x": 0.5, "y": 0.5, "z": 0 }
      }
    }
  ]
}
${FENCE}

## Example: future intent

${FENCE}json
{
  "kind": "photo-carousel",
  "items": 4,
  "motion": "orbit"
}
${FENCE}

This is high-level intent, not an atomic layer. It becomes publishable only after an approved lowering rule exists.

## Visual policy

Static figures may show the expected visual idea. They must not claim to be a pixel comparison with the real preview or export output.`,
  },
  "examples/project": {
    title: "Complete project",
    markdown: String.raw`# Complete project

## A small animated composition

This teaching project shows the root, one shape layer and a typed animation track.

${FENCE}json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "id": "neon-card",
  "composition": {
    "width": 1080,
    "height": 1080,
    "fps": 30,
    "background": "#07111F",
    "colorSpace": "srgb",
    "view": {
      "projection": { "kind": "orthographic", "zoom": 1, "near": 0.1, "far": 1000 },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 }
      }
    }
  },
  "assets": [],
  "layers": [
    {
      "id": "card",
      "parentLayerId": null,
      "order": 0,
      "frame": { "width": 640, "height": 360 },
      "timing": { "start": 0, "duration": 4000 },
      "type": "shape",
      "payload": { "shape": "rectangle", "cornerRadius": 28 },
      "style": { "fill": "#14B8A6" },
      "tracks": [
        {
          "id": "card-in",
          "path": "opacity",
          "keyframes": [
            { "time": 0, "value": { "type": "number", "value": 0 } },
            { "time": 800, "value": { "type": "number", "value": 1 } }
          ]
        }
      ]
    }
  ],
  "audio": { "sampleRate": 48000, "tracks": [] }
}
${FENCE}

## Add motion

Attach tracks to the layer when the property is atomic and animatable. Keep the layer timing window separate from keyframe times.
`,
  },
};

function tocFromMarkdown(markdown: string): Array<{ id: string; title: string }> {
  const slugger = new GithubSlugger();
  return markdown.split(/\r?\n/).flatMap((line) => {
    const match = /^##\s+(.+)$/.exec(line);
    if (!match) return [];
    const title = match[1].trim();
    return [{ id: slugger.slug(title), title }];
  });
}

export function getV2DocsPage(slug: string): DocsPageView | null {
  const page = V2_PAGES[slug];
  if (!page) return null;
  return withOnThisPage({
    title: page.title,
    toc: tocFromMarkdown(page.markdown),
    body: slug === "" ? createElement(DocsOverview) : createElement(DocsMarkdown, { markdown: page.markdown }),
  });
}

export type DocsEntryStatus = "published" | "planned" | "hidden";
export type DocsSurface =
  | "authoring"
  | "protocol"
  | "runtime"
  | "export"
  | "high-level";

export type DocsEntry = {
  slug: string;
  label: string;
  group: string;
  status: DocsEntryStatus;
  surface: DocsSurface;
};

export type DocsNavItem = { href: string; label: string };
export type DocsNavGroup = {
  id: string;
  label: string;
  description?: string;
  items: DocsNavItem[];
};

const published = (
  slug: string,
  label: string,
  group: string,
  surface: DocsSurface,
): DocsEntry => ({ slug, label, group, surface, status: "published" });

const hidden = (slug: string, label: string, surface: DocsSurface): DocsEntry => ({
  slug,
  label,
  group: "hidden",
  surface,
  status: "hidden",
});

export const DOCS_ENTRIES: DocsEntry[] = [
  published("", "Overview", "start", "authoring"),
  published("authoring", "Authoring model", "start", "authoring"),
  published("atoms", "Neonix JSON V2", "protocol", "protocol"),
  published("atoms/composition", "Composition and view", "protocol", "protocol"),
  published("atoms/assets", "Assets", "protocol", "protocol"),
  published("atoms/layers", "Layers and hierarchy", "protocol", "protocol"),
  published("atoms/transform", "Transform and Matrix4", "protocol", "protocol"),
  published("atoms/shape", "Shape", "protocol", "protocol"),
  published("atoms/path", "Path", "protocol", "protocol"),
  published("atoms/text", "Text", "protocol", "protocol"),
  published("atoms/image", "Image", "protocol", "protocol"),
  published("atoms/video", "Video", "protocol", "protocol"),
  published("atoms/group", "Group", "protocol", "protocol"),
  published("atoms/paint", "Paint and SVG definitions", "visual", "protocol"),
  published("atoms/effects", "Masks, filters, and effects", "visual", "protocol"),
  published("animation", "Animation and timing", "animation", "protocol"),
  published("animation/motion-paths", "Motion paths", "animation", "protocol"),
  published("audio", "Audio", "animation", "protocol"),
  published("compiler", "Compiler pipeline", "runtime", "runtime"),
  published("html", "HTML authoring", "runtime", "runtime"),
  published("rendering", "Runtime, preview, and export", "runtime", "runtime"),
  published("validation", "Validation and schema", "runtime", "protocol"),
  published("examples", "Static examples", "examples", "authoring"),
  published("examples/project", "Complete project", "examples", "authoring"),
  hidden("components", "Components", "high-level"),
  hidden("components/props", "Component props", "high-level"),
  hidden("components/variants", "Component variants", "high-level"),
  hidden("components/bindings", "Component bindings", "high-level"),
  hidden("components/nested", "Nested components", "high-level"),
];

export const DOCS_NAV: DocsNavGroup[] = [
  { id: "start", label: "Start here", description: "Understand the model", items: [] },
  { id: "protocol", label: "Neonix JSON V2", description: "The JSON contract", items: [] },
  { id: "animation", label: "Animation system", description: "Time, tracks and paths", items: [] },
  { id: "visual", label: "Visual semantics", description: "Paint, masks and effects", items: [] },
  { id: "runtime", label: "Compiler & runtime", description: "Validate, lower and render", items: [] },
  { id: "examples", label: "Examples", description: "Put the pieces together", items: [] },
  {
    id: "mcp",
    label: "MCP",
    description: "Connect your AI clients",
    items: [
      { href: "/docs/mcp", label: "Overview" },
      { href: "/docs/mcp/chatgpt", label: "ChatGPT" },
      { href: "/docs/mcp/claude", label: "Claude" },
      { href: "/docs/mcp/grok", label: "Grok" },
    ],
  },
].map((group) => ({
  ...group,
  items:
    group.id === "mcp"
      ? group.items
      : DOCS_ENTRIES
          .filter((entry) => entry.status === "published" && entry.group === group.id)
          .map((entry) => ({ href: docsHref(entry.slug), label: entry.label })),
}));

export const DOCS_PAGE_SLUGS = DOCS_ENTRIES
  .filter((entry) => entry.status === "published")
  .map((entry) => entry.slug);

export type DocsPageSlug = (typeof DOCS_PAGE_SLUGS)[number];

function docsHref(slug: string): string {
  return slug === "" ? "/docs" : `/docs/${slug}`;
}

export function isHiddenDocsSlug(slug: string): boolean {
  return DOCS_ENTRIES.some((entry) => entry.slug === slug && entry.status !== "published");
}

export function getDocsPage(slug: string): DocsPageView {
  const page = getV2DocsPage(slug);
  if (!page) throw new Error(`Unknown published documentation slug: ${slug}`);
  return page;
}
