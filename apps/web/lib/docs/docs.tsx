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

This is the static guide to Neonix's current authoring vocabulary and Neonix JSON V2. The examples on these pages are display-only teaching material and are not submitted as projects.

## Start with the model

Neonix separates authoring intent from the document contract:

${FENCE}text
HTML / CSS / agent intent
        -> Compiler
        -> Neonix JSON V2
        -> Output
${FENCE}

This guide explains the public authoring contract and the observable output, not the implementation underneath.

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
- Read [Output](/docs/rendering) for the user-facing result.`,
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

This is illustrative high-level input. The fields are not Neonix JSON V2 fields. The compiler expands and normalizes this intent before output.

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

## Determinism

An authoring surface may be expressive. The JSON result must be explicit enough for preview and export without guessing.

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

An atom is documented as supported only after its static contract, preview behavior and export behavior have been tested. This page is a reference map; it does not run those tests.`,
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

## From CSS to Neonix JSON V2

HTML/CSS authors normally start with a CSS transform. The compiler converts the same intent into explicit JSON fields:

${FENCE}css
.card {
  width: 480px;
  height: 270px;
  transform: translate(320px, 180px) rotate(8deg) scale(1.1, 0.9);
  transform-origin: 50% 50%;
}
${FENCE}

${FENCE}json
{
  "frame": { "width": 480, "height": 270 },
  "transform": {
    "translate": { "x": 320, "y": 180, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 8 },
    "scale": { "x": 1.1, "y": 0.9, "z": 1 },
    "anchor": { "x": 240, "y": 135, "z": 0 },
    "skew": { "x": 0, "y": 0 }
  }
}
${FENCE}

${BT}transform-origin${BT} becomes a local-unit ${BT}anchor${BT}; percentages are resolved against the layer frame. ${BT}translateX/Y/Z${BT}, ${BT}scaleX/Y/Z${BT}, ${BT}rotateX/Y/Z${BT}, ${BT}skewX/Y${BT} and ${BT}matrix/matrix3d${BT} become named fields or ordered operations.

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

## Which transform form should I use?

| Form | Use it when | Important rule |
| --- | --- | --- |
| Named fields | You are authoring ordinary 2D or 3D motion | Easiest to read and animate with tracks |
| ${BT}operations${BT} | You need to preserve the exact CSS/SVG transform order | Array order is semantic |
| ${BT}motion.matrix4${BT} | You import a composed 4×4 matrix from another tool | Do not duplicate equivalent named transforms |

For animation, target one scalar or vector property such as ${BT}transform.translate.x${BT}, ${BT}transform.rotate.z${BT}, ${BT}transform.scale.x${BT} or ${BT}transform.anchor.y${BT}. Do not animate the whole matrix unless the source tool already owns matrix composition.

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

Shape is the atomic primitive for simple geometry. Its geometry lives in ${BT}payload${BT}; its fill, stroke and marker semantics live in ${BT}style${BT}. The supported shape kinds are ${BT}rectangle${BT}, ${BT}circle${BT}, ${BT}ellipse${BT}, ${BT}line${BT}, ${BT}polyline${BT} and ${BT}polygon${BT}.

## Complete rectangle

The following is a complete layer-shaped record. ${BT}parentLayerId${BT}, ${BT}order${BT}, ${BT}frame${BT}, ${BT}transform${BT} and ${BT}timing${BT} belong to the common layer contract; shape-specific fields are under ${BT}payload${BT} and ${BT}style${BT}.

${FENCE}json
{
  "id": "rounded-card",
  "type": "shape",
  "parentLayerId": null,
  "order": 0,
  "frame": { "width": 640, "height": 360 },
  "transform": {
    "translate": { "x": 320, "y": 240, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 320, "y": 180, "z": 0 },
    "skew": { "x": 0, "y": 0 }
  },
  "timing": { "start": 0, "duration": 5000 },
  "payload": {
    "shape": "rectangle",
    "cornerRadius": 28,
    "rx": 28,
    "ry": 28
  },
  "style": {
    "fill": "#102A43",
    "fillOpacity": 1,
    "stroke": "#2EE6C5",
    "strokeWidth": 4,
    "strokeOpacity": 0.9,
    "strokeJoin": "round",
    "strokeCap": "round",
    "vectorEffect": "none",
    "paintOrder": ["fill", "stroke"]
  }
}
${FENCE}

## Geometry kinds

| Kind | Geometry fields | Notes |
| --- | --- | --- |
| ${BT}rectangle${BT} | ${BT}cornerRadius${BT}, ${BT}rx${BT}, ${BT}ry${BT} | ${BT}rx${BT}/${BT}ry${BT} are optional rounded-corner radii |
| ${BT}circle${BT} | frame width and height | The frame defines the primitive bounds |
| ${BT}ellipse${BT} | frame width and height | The frame defines the horizontal and vertical radii |
| ${BT}line${BT} | ${BT}start${BT}, ${BT}end${BT} | Requires both points |
| ${BT}polyline${BT} | ${BT}points${BT} | At least two points; remains open |
| ${BT}polygon${BT} | ${BT}points${BT} | At least three points; closes the contour |

Point coordinates are local to the shape frame. The layer ${BT}transform${BT} moves the complete primitive; it does not rewrite the local points.

## Line, polyline and polygon examples

${FENCE}json
[
  {
    "id": "divider",
    "type": "shape",
    "parentLayerId": null,
    "order": 1,
    "frame": { "width": 500, "height": 80 },
    "transform": {
      "translate": { "x": 40, "y": 80, "z": 0 },
      "rotate": { "x": 0, "y": 0, "z": 0 },
      "scale": { "x": 1, "y": 1, "z": 1 },
      "anchor": { "x": 0, "y": 0, "z": 0 },
      "skew": { "x": 0, "y": 0 }
    },
    "timing": { "start": 0, "duration": 5000 },
    "payload": {
      "shape": "line",
      "start": { "x": 0, "y": 40 },
      "end": { "x": 500, "y": 40 },
      "pathLength": 500
    },
    "style": {
      "stroke": "#FFFFFF",
      "strokeWidth": 4,
      "strokeCap": "round"
    }
  },
  {
    "id": "mountain",
    "type": "shape",
    "parentLayerId": null,
    "order": 2,
    "frame": { "width": 600, "height": 300 },
    "transform": {
      "translate": { "x": 0, "y": 0, "z": 0 },
      "rotate": { "x": 0, "y": 0, "z": 0 },
      "scale": { "x": 1, "y": 1, "z": 1 },
      "anchor": { "x": 0, "y": 0, "z": 0 },
      "skew": { "x": 0, "y": 0 }
    },
    "timing": { "start": 0, "duration": 5000 },
    "payload": {
      "shape": "polygon",
      "points": [
        { "x": 0, "y": 280 },
        { "x": 140, "y": 80 },
        { "x": 260, "y": 210 },
        { "x": 390, "y": 40 },
        { "x": 600, "y": 280 }
      ]
    },
    "style": {
      "fill": "#18B89A",
      "stroke": "#D8FFF7",
      "strokeWidth": 3,
      "strokeJoin": "round"
    }
  }
]
${FENCE}

## Paint and stroke

Fill and stroke are independent. A paint can be a color shorthand, ${BT}none${BT}, a solid object, a linear/radial/conic gradient, a pattern or a named paint reference.

${FENCE}json
{
  "style": {
    "fill": {
      "type": "linear-gradient",
      "x1": 0,
      "y1": 0,
      "x2": 1,
      "y2": 1,
      "gradientUnits": "objectBoundingBox",
      "stops": [
        { "offset": 0, "color": "#2EE6C5" },
        { "offset": 1, "color": "#6257FF", "stopOpacity": 0.8 }
      ]
    },
    "stroke": "#FFFFFF",
    "strokeWidth": 6,
    "strokeOpacity": 0.75,
    "strokeDash": { "array": [12, 8], "offset": 0 }
  }
}
${FENCE}

| Style field | Meaning |
| --- | --- |
| ${BT}fill${BT}, ${BT}fillOpacity${BT} | Interior paint and alpha |
| ${BT}stroke${BT}, ${BT}strokeWidth${BT}, ${BT}strokeOpacity${BT} | Outline paint, width and alpha |
| ${BT}strokeJoin${BT} | ${BT}miter${BT}, ${BT}bevel${BT} or ${BT}round${BT} |
| ${BT}strokeCap${BT} | ${BT}butt${BT}, ${BT}square${BT} or ${BT}round${BT} |
| ${BT}strokeMiterLimit${BT} | Limit for sharp miter joins |
| ${BT}strokeDash${BT} | Dash ${BT}array${BT} and optional ${BT}offset${BT} |
| ${BT}paintOrder${BT} | Ordering of ${BT}fill${BT}, ${BT}stroke${BT} and ${BT}markers${BT} |
| ${BT}vectorEffect${BT} | ${BT}none${BT} or ${BT}non-scaling-stroke${BT} |

Rounded corners are geometry semantics, not a renderer resource. The ${BT}cornerRadius${BT}, ${BT}rx${BT} and ${BT}ry${BT} fields are valid only for rectangles.`,
  },
  "atoms/path": {
    title: "Path",
    markdown: String.raw`# Path

## Responsibility

Path is the freeform vector primitive. It contains one or more named contours, and each contour contains an explicit start point followed by line, quadratic, cubic or arc segments. A path can be filled, stroked, or both.

## Complete path layer

${FENCE}json
{
  "id": "ribbon",
  "type": "path",
  "parentLayerId": null,
  "order": 0,
  "frame": { "width": 720, "height": 420 },
  "transform": {
    "translate": { "x": 360, "y": 240, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": -4 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 360, "y": 210, "z": 0 },
    "skew": { "x": 0, "y": 0 }
  },
  "timing": { "start": 0, "duration": 5000 },
  "payload": {
    "fillRule": "nonzero",
    "pathLength": 1000,
    "contours": [{
      "id": "main-ribbon",
      "start": { "x": 40, "y": 300 },
      "closed": true,
      "segments": [
        {
          "kind": "cubic",
          "control1": { "x": 180, "y": 40 },
          "control2": { "x": 420, "y": 40 },
          "to": { "x": 680, "y": 250 }
        },
        {
          "kind": "quadratic",
          "control": { "x": 430, "y": 360 },
          "to": { "x": 40, "y": 300 }
        }
      ]
    }]
  },
  "style": {
    "fill": "#6257FF",
    "fillOpacity": 0.9,
    "stroke": "#D8FFF7",
    "strokeWidth": 5,
    "strokeOpacity": 1,
    "strokeJoin": "round",
    "strokeCap": "round"
  }
}
${FENCE}

## Contours and segments

| Segment | Required fields | Meaning |
| --- | --- | --- |
| ${BT}line${BT} | ${BT}to${BT} | Straight line from the current point |
| ${BT}quadratic${BT} | ${BT}control${BT}, ${BT}to${BT} | One control point |
| ${BT}cubic${BT} | ${BT}control1${BT}, ${BT}control2${BT}, ${BT}to${BT} | Two control points |
| ${BT}arc${BT} | ${BT}radii${BT}, ${BT}rotation${BT}, ${BT}largeArc${BT}, ${BT}sweep${BT}, ${BT}to${BT} | Elliptical arc using SVG arc flags |

Every contour requires ${BT}id${BT}, ${BT}start${BT}, at least one ${BT}segments${BT} entry and ${BT}closed${BT}. Segment ${BT}to${BT} points become the next current point. A closed contour implicitly connects its final point back to ${BT}start${BT}; an open contour remains open for stroke rendering.

${FENCE}json
{
  "contours": [{
    "id": "mixed-segments",
    "start": { "x": 80, "y": 180 },
    "closed": false,
    "segments": [
      { "kind": "line", "to": { "x": 180, "y": 80 } },
      { "kind": "quadratic", "control": { "x": 260, "y": 20 }, "to": { "x": 360, "y": 100 } },
      { "kind": "cubic", "control1": { "x": 440, "y": 180 }, "control2": { "x": 520, "y": 180 }, "to": { "x": 620, "y": 80 } },
      { "kind": "arc", "radii": { "x": 60, "y": 40 }, "rotation": 0, "largeArc": false, "sweep": true, "to": { "x": 700, "y": 160 } }
    ]
  }]
}
${FENCE}

## Fill rules and holes

${BT}nonzero${BT} and ${BT}evenodd${BT} decide how multiple closed contours produce filled regions. Use ${BT}evenodd${BT} for the common “outer contour plus inner hole” case:

${FENCE}json
{
  "payload": {
    "fillRule": "evenodd",
    "contours": [
      {
        "id": "outer",
        "start": { "x": 40, "y": 40 },
        "closed": true,
        "segments": [
          { "kind": "line", "to": { "x": 360, "y": 40 } },
          { "kind": "line", "to": { "x": 360, "y": 260 } },
          { "kind": "line", "to": { "x": 40, "y": 260 } }
        ]
      },
      {
        "id": "hole",
        "start": { "x": 120, "y": 100 },
        "closed": true,
        "segments": [
          { "kind": "line", "to": { "x": 280, "y": 100 } },
          { "kind": "line", "to": { "x": 280, "y": 200 } },
          { "kind": "line", "to": { "x": 120, "y": 200 } }
        ]
      }
    ]
  }
}
${FENCE}

## Stroke and drawing controls

Path style uses the same paint model as Shape:

| Field | Meaning |
| --- | --- |
| ${BT}fill${BT}, ${BT}fillOpacity${BT} | Interior paint and alpha |
| ${BT}stroke${BT}, ${BT}strokeWidth${BT}, ${BT}strokeOpacity${BT} | Outline paint, width and alpha |
| ${BT}strokeJoin${BT} | ${BT}miter${BT}, ${BT}bevel${BT} or ${BT}round${BT} |
| ${BT}strokeCap${BT} | ${BT}butt${BT}, ${BT}square${BT} or ${BT}round${BT} |
| ${BT}strokeDash${BT} | Dash array and offset |
| ${BT}paintOrder${BT} | Fill, stroke and marker ordering |
| ${BT}vectorEffect${BT} | ${BT}none${BT} or ${BT}non-scaling-stroke${BT} |
| ${BT}markerStart/Mid/End${BT} | References to root marker definitions |

${BT}pathLength${BT} is an optional calibration length used by dash and motion semantics. It does not alter the geometry coordinates.

## Morphing between paths

A path can carry a compatible target contour set and a normalized ${BT}morph.progress${BT} value:

${FENCE}json
{
  "payload": {
    "contours": [{
      "id": "start",
      "start": { "x": 80, "y": 80 },
      "closed": true,
      "segments": [
        { "kind": "line", "to": { "x": 280, "y": 80 } },
        { "kind": "line", "to": { "x": 180, "y": 260 } }
      ]
    }],
    "morph": {
      "progress": 0.5,
      "targetContours": [{
        "id": "target",
        "start": { "x": 80, "y": 160 },
        "closed": true,
        "segments": [
          { "kind": "line", "to": { "x": 280, "y": 160 } },
          { "kind": "line", "to": { "x": 180, "y": 40 } }
        ]
      }]
    }
  }
}
${FENCE}

Morphing requires matching contour and segment structure. If the topology differs, author a separate path or use a layer transition instead of expecting the compiler to invent correspondence.`,
  },
  "atoms/text": {
    title: "Text",
    markdown: String.raw`# Text

Text combines source content, font selection, layout and paint. Choose an explicit family, weight and style so the same document remains predictable in preview and export.

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

## Gradient text

Text uses the same semantic paint contract as shapes and paths. Put the paint on the text span's ${BT}fill${BT}; do not use a CSS ${BT}background${BT} or an implementation-specific field. Neonix JSON V2 keeps the paint attached to the text span so the text has the same meaning wherever it is previewed or exported.

${FENCE}json
{
  "type": "text",
  "payload": {
    "source": { "text": "Gradient headline", "language": "en" },
    "chunks": [{
      "id": "headline-chunk",
      "sourceRange": { "start": 0, "end": 17 },
      "textAnchor": "middle",
      "spans": [{
        "id": "headline-span",
        "sourceRange": { "start": 0, "end": 17 },
        "font": {
          "families": ["Inter", "sans-serif"],
          "size": 96,
          "weight": 700
        },
        "fill": {
          "type": "linear-gradient",
          "angle": 0,
          "stops": [
            { "offset": 0, "color": "#22D3EE" },
            { "offset": 0.5, "color": "#60A5FA" },
            { "offset": 1, "color": "#C084FC" }
          ]
        }
      }]
    }]
  },
  "frame": { "width": 1200, "height": 180 }
}
${FENCE}

The color is applied only inside the characters; the area outside the text remains transparent. Multiple spans may use different paints; keep each ${BT}sourceRange${BT} aligned with its span so each range receives the intended style.

### Gradient types

| Type | Main fields | Use |
| --- | --- | --- |
| ${BT}linear-gradient${BT} | ${BT}x1${BT}, ${BT}y1${BT}, ${BT}x2${BT}, ${BT}y2${BT} or the ${BT}angle${BT} shorthand | Directional color transition |
| ${BT}radial-gradient${BT} | ${BT}cx${BT}, ${BT}cy${BT}, ${BT}radius${BT}; optional ${BT}fx${BT}, ${BT}fy${BT}, ${BT}fr${BT} | Circular or elliptical light falloff |
| ${BT}conic-gradient${BT} | ${BT}from${BT}, ${BT}cx${BT}, ${BT}cy${BT} | Angular color sweep |

All gradient types accept ${BT}stops${BT}, optional ${BT}stopOpacity${BT}, ${BT}spreadMethod${BT} (${BT}pad${BT}, ${BT}reflect${BT} or ${BT}repeat${BT}), ${BT}gradientUnits${BT} and ${BT}gradientTransform${BT}. Stop offsets must be between 0 and 1 and non-decreasing. ${BT}objectBoundingBox${BT} coordinates are normalized to the text layer bounds; ${BT}userSpaceOnUse${BT} coordinates use composition units.

${FENCE}json
{
  "type": "radial-gradient",
  "cx": 0.5,
  "cy": 0.5,
  "radius": 0.75,
  "gradientUnits": "objectBoundingBox",
  "stops": [
    { "offset": 0, "color": "#FFFFFF" },
    { "offset": 1, "color": "#7C3AED", "stopOpacity": 0.85 }
  ]
}
${FENCE}

Keep fonts explicit and available in the asset catalog so a fallback font does not change glyph widths, line breaks or gradient placement.

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

The system font CDN is public for GET/HEAD requests. Use an explicit ${BT}@font-face${BT} declaration when authoring HTML outside the app:

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

The public CDN supports browser GET/HEAD. CORS should allow the HTML page origin to request the font. Use the CDN for known files; it intentionally does not act as a browser directory listing.

## Get the complete font catalog

Use the public catalog endpoint to retrieve every enabled system font without authentication:

${FENCE}bash
curl https://www.neonix.video/api/v1/fonts
${FENCE}

The public response contains system fonts only. Workspace fonts are available inside the signed-in editor and are intentionally not exposed in this public guide. The public catalog is the source of truth for system fonts; the CDN is the delivery path for a known system-font object.

## Deterministic font workflow

1. Select a system family, weight and style from the public catalog or a workspace family from the signed-in editor.
2. In HTML, declare the matching CDN ${BT}@font-face${BT} URL; in Neonix JSON V2, use the family name and weight in the text font object.
3. Keep the same family, weight, style and asset integrity across preview and export.
4. Avoid silently replacing a missing face with a machine-local font.

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

The project chooses a source frame from composition time. The documented video contract does not depend on browser playback state.

## Delivery

The asset reference is stable. File URLs, decoding, and caching are delivery concerns.`,
  },
  "atoms/assets": {
    title: "Assets",
    markdown: String.raw`# Assets

## Portable references

Assets are metadata and stable references. Neonix JSON V2 stores file identity and media metadata rather than the file contents inside the authoring document.

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

Layers point to assets by id. Loading and delivery happen after the document has been validated.

## Two delivery modes

Neonix supports two ways to deliver image, video and audio sources. Choose a public URL when the file is intentionally shareable. Use Neonix storage when the asset belongs to a workspace or should stay private.

### 1. Public URL

Use an absolute URL from a CDN or public object domain that you control:

${FENCE}json
{
  "assets": [
    {
      "kind": "image",
      "id": "public-logo",
      "uri": "https://cdn.example.com/brand/logo.png",
      "mimeType": "image/png",
      "width": 640,
      "height": 360
    },
    {
      "kind": "video",
      "id": "public-intro",
      "uri": "https://cdn.example.com/video/intro.mp4",
      "mimeType": "video/mp4",
      "duration": 5000,
      "fps": 30
    },
    {
      "kind": "audio",
      "id": "public-music",
      "uri": "https://cdn.example.com/audio/music.mp3",
      "mimeType": "audio/mpeg",
      "duration": 5000
    }
  ]
}
${FENCE}

For public video and audio, the origin should support byte-range requests and return the correct ${BT}Content-Type${BT}. If the media is drawn into a canvas during preview, configure CORS on the media origin as well; a public URL alone does not grant browser canvas access.

Public URLs are suitable for assets that can be downloaded by anyone. Do not put access tokens, signed query strings or private storage-provider endpoints in a public document.

### 2. Neonix private storage

Upload workspace media from the authenticated Assets screen. Neonix validates the file, records its metadata and prepares the supported derivatives before making it available to the project.

In authoring JSON, layers reference a private asset by ${BT}assetId${BT}:

${FENCE}json
{
  "id": "user-video-layer",
  "type": "video",
  "payload": { "assetId": "<asset-id>" },
  "frame": { "width": 960, "height": 540 },
  "timing": { "start": 0, "duration": 5 }
}
${FENCE}

The editor resolves the asset through the current signed-in workspace session. The private delivery URL, storage provider and upload credentials are implementation details and should not be copied into authoring JSON or public HTML.

For private media, Neonix supports the original image/video/audio source, a generated video poster and an extracted audio derivative when processing has completed. Video and audio playback uses range-aware delivery internally; no direct storage access or storage-provider CORS configuration is required for the authenticated app flow.

### Delivery checklist

- Public image: stable HTTPS URL and correct image MIME type.
- Public video/audio: HTTPS, correct MIME type and HTTP Range support.
- Canvas preview from another origin: allow the Neonix origin with CORS.
- Private Neonix asset: upload it from Assets and reference it by asset id; do not hardcode a storage-provider endpoint.
- Video with sound: use the original video URI and its ${BT}variant=audio${BT} derivative when the project needs a separate audio track.

### Private workspace fonts

User fonts follow a dedicated authenticated flow from the Assets screen. Neonix validates each font, reads its family/weight/style metadata and makes it available to the signed-in workspace. Workspace fonts are never exposed through the public system-font CDN.

After a font is ready, select its family, weight and style in the editor or Neonix JSON V2. The editor and authenticated preview resolve the private font bytes with the current workspace session; export uses the same catalog entry. Do not copy private font references into public HTML or publish workspace fonts as public files.

## System fonts and the public CDN

Neonix system fonts are served through the public font CDN:

${FENCE}text
https://fonts.neonix.video/{family}/{filename}
${FENCE}

Example:

${FENCE}text
https://fonts.neonix.video/inter/Inter_18pt-Regular.ttf
https://fonts.neonix.video/inter/Inter_18pt-Bold.ttf
${FENCE}

The CDN is a delivery endpoint for known objects. It does not expose a browser directory listing, so requesting the CDN root or a family folder is not the way to discover fonts.

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

The CSS endpoint resolves the requested family, weight and style to the matching public font object. It does not rename the font's internal family metadata.

## Get every available font

Call ${BT}GET /api/v1/fonts${BT} without authentication to list all public system fonts:

${FENCE}bash
curl https://www.neonix.video/api/v1/fonts
${FENCE}

The signed-in editor also includes workspace fonts in its private font picker. Use the public catalog and CDN only for system fonts; workspace fonts remain private to the current workspace and should not be copied into public HTML.

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

Do not put a storage URL in ${BT}families${BT}. Use the family name in Neonix JSON V2 and use ${BT}@font-face${BT} with the CDN URL in HTML. The compiler and export path can then resolve the same family, weight and style deterministically.

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

## What a group does

A group is a structural layer that owns a hierarchy of other layers. It has no geometry of its own; its visible result comes from its descendants.

Use a group when several layers should share a coordinate space, timing window, opacity, effect, mask, clip, blend mode or 3D context.

The hierarchy is represented by layer records. A child points to its parent with ${BT}parentLayerId${BT}; a group does not contain a ${BT}children${BT} array.

${FENCE}json
{
  "id": "hero-group",
  "type": "group",
  "parentLayerId": null,
  "order": 0,
  "frame": { "width": 1080, "height": 600 },
  "transform": {
    "translate": { "x": 540, "y": 300, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 0 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 540, "y": 300, "z": 0 },
    "skew": { "x": 0, "y": 0 }
  },
  "opacity": 1,
  "timing": { "start": 0, "duration": 5000 }
}
${FENCE}

## Parent and child layers

Every layer has a ${BT}parentLayerId${BT} and an ${BT}order${BT}:

- ${BT}parentLayerId: null${BT} places the layer at the composition root;
- a group id in ${BT}parentLayerId${BT} makes the layer a direct child of that group;
- a child layer keeps its own ${BT}frame${BT} and local ${BT}transform${BT};
- ${BT}order${BT} controls paint order among siblings, with higher values appearing later;
- a group may contain shapes, paths, text, images, videos, audio-linked visual layers and nested groups.

The parent id must refer to an existing group. A layer cannot be its own parent, and parent relationships cannot form a cycle.

## Complete nested example

This example places a card and its title inside a nested group. The title and card use local coordinates; the two group transforms move the complete hierarchy.

${FENCE}json
{
  "layers": [
    {
      "id": "scene",
      "type": "group",
      "parentLayerId": null,
      "order": 0,
      "frame": { "width": 1080, "height": 1080 },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 },
        "anchor": { "x": 0, "y": 0, "z": 0 },
        "skew": { "x": 0, "y": 0 }
      },
      "opacity": 1,
      "timing": { "start": 0, "duration": 5000 }
    },
    {
      "id": "card-content",
      "type": "group",
      "parentLayerId": "scene",
      "order": 0,
      "frame": { "width": 720, "height": 420 },
      "transform": {
        "translate": { "x": 540, "y": 540, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": -4 },
        "scale": { "x": 1, "y": 1, "z": 1 },
        "anchor": { "x": 360, "y": 210, "z": 0 },
        "skew": { "x": 0, "y": 0 }
      },
      "opacity": 1,
      "timing": { "start": 0, "duration": 5000 },
      "composite": { "blendMode": "normal", "isolation": "auto" }
    },
    {
      "id": "card-background",
      "type": "shape",
      "parentLayerId": "card-content",
      "order": 0,
      "frame": { "width": 720, "height": 420 },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 },
        "scale": { "x": 1, "y": 1, "z": 1 },
        "anchor": { "x": 0, "y": 0, "z": 0 },
        "skew": { "x": 0, "y": 0 }
      },
      "opacity": 1,
      "timing": { "start": 0, "duration": 5000 },
      "payload": { "shape": "rectangle", "cornerRadius": 28 },
      "style": { "fill": "#102A43" }
    }
  ]
}
${FENCE}

## Shared group properties

Group properties apply to the group boundary and, where applicable, its complete descendant tree.

| Property | Purpose |
| --- | --- |
| ${BT}frame${BT} | Defines the group's local width and height. |
| ${BT}transform${BT} | Moves, rotates, scales, anchors or skews the group coordinate space. |
| ${BT}opacity${BT} | Controls the opacity of the composed group result. |
| ${BT}enabled${BT} / ${BT}visibility${BT} | Enables, hides or collapses the group and its descendants. |
| ${BT}composite${BT} | Sets blend mode and optional isolation for the group result. |
| ${BT}effects${BT} | Applies documented effects to the group subtree as a unit. |
| ${BT}clipPath${BT}, ${BT}mask${BT}, ${BT}maskLayers${BT} | Limits the visible coverage of the group. |
| ${BT}filter${BT} / ${BT}backdropEffects${BT} | Applies a documented filter or backdrop effect. |
| ${BT}timing${BT} | Defines when the group is active on the composition timeline. |
| ${BT}tracks${BT} | Animates supported group properties over time. |
| ${BT}render3d${BT} | Defines a local flat or preserved 3D context for descendants. |

Only add properties that are needed. A simple container normally needs just the common layer fields, while a group with effects or perspective can opt into the corresponding documented fields.

## Parent transform and local coordinates

The group transform is composed with each child transform. Children keep their local frame and local transform semantics, so a child should normally be authored relative to its group rather than with final composition coordinates.

For a nested hierarchy, the local relationship is read from the inside out: a leaf layer uses its own transform, then inherits each parent group's coordinate space. This makes it possible to move or animate a complete scene without rewriting every child.

## Timing and animation

The group's ${BT}timing${BT} controls the group's active window. A child can have its own timing inside that hierarchy, but for predictable authoring keep child content within the period in which its parent is active.

Animate a group when the whole hierarchy should move together. Typical track paths include:

${FENCE}json
{
  "tracks": [
    { "path": "transform.translate.x", "keyframes": [{ "time": 0, "value": 240 }, { "time": 1000, "value": 540 }] },
    { "path": "transform.rotate.z", "keyframes": [{ "time": 0, "value": -4 }, { "time": 1000, "value": 0 }] },
    { "path": "opacity", "keyframes": [{ "time": 0, "value": 0 }, { "time": 500, "value": 1 }] }
  ]
}
${FENCE}

Use the documented value type for each path. Animate a child instead when only one element should change.

## Compositing, masks and effects

Group-level visual properties define the scope of an operation:

- group ${BT}opacity${BT} affects the combined group result;
- ${BT}composite.blendMode${BT} blends the group result with surrounding content;
- ${BT}composite.isolation${BT} keeps group blending within its declared boundary;
- ${BT}effects${BT}, ${BT}filter${BT}, ${BT}clipPath${BT} and ${BT}mask${BT} apply to the group scope when declared there;
- a child-level property affects only that child.

Put a property on the smallest layer that should own its effect. Put it on the group when the same operation must cover all descendants.

## 3D group context

Use ${BT}render3d${BT} only when descendants need an explicit 3D relationship:

${FENCE}json
{
  "render3d": {
    "transformStyle": "preserve-3d",
    "perspective": {
      "distance": 800,
      "origin": { "x": 360, "y": 210 }
    }
  }
}
${FENCE}

${BT}flat${BT} keeps descendants in a flattened group context. ${BT}preserve-3d${BT} keeps their 3D relationship. Perspective ${BT}distance${BT} must be positive, and ${BT}origin${BT} uses the group's local coordinates.

## Common mistakes

| Mistake | Why it causes a problem | Better approach |
| --- | --- | --- |
| Adding ${BT}children${BT} to a group | Hierarchy is represented by layer records, not an embedded child array. | Set each child's ${BT}parentLayerId${BT}. |
| Using a missing parent id | The hierarchy cannot be resolved. | Declare the group first and verify every reference. |
| Reusing an id | References become ambiguous. | Use unique ids across all layers. |
| Creating a parent cycle | A layer cannot be both an ancestor and a descendant of itself. | Keep the parent chain acyclic. |
| Giving every child world coordinates | Moving the group becomes difficult and can apply a transform twice. | Author child frames and transforms in the parent's local space. |
| Putting a group effect on one child | The effect will not cover the other descendants. | Move it to the group when the whole subtree is the target. |
| Using the same sibling order | Paint order becomes ambiguous. | Assign intentional, unique order values among siblings. |

## AI checklist

When an AI creates a group, it should:

1. Decide which layers must move, appear, disappear or receive effects together.
2. Create one unique group id and give it the common layer fields.
3. Set every direct child's ${BT}parentLayerId${BT} to that group id.
4. Author child coordinates in the group's local space.
5. Use distinct sibling ${BT}order${BT} values.
6. Keep timing and animation paths within the documented ranges.
7. Check that parent links resolve and contain no cycles.

## Boundary

Group is a container and coordinate scope. High-level component behavior, responsive layout rules and reusable template logic are not group fields; express their final authoring result with documented layers, groups and properties.`,
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

## Atomic effects

The layer ${BT}effects${BT} list supports these deterministic atomic operators. A list may contain at most eight effects, and every effect id must be unique within that layer.

| Type | Purpose | Main fields |
| --- | --- | --- |
| ${BT}color-adjust${BT} | Brightness, contrast, saturation and hue in one operator | ${BT}brightness${BT}, ${BT}contrast${BT}, ${BT}saturation${BT}, ${BT}hueRotate${BT} |
| ${BT}grayscale${BT} | Interpolate from the source color to grayscale | ${BT}amount${BT}: 0–1 |
| ${BT}sepia${BT} | Interpolate from the source color to sepia | ${BT}amount${BT}: 0–1 |
| ${BT}invert${BT} | Interpolate toward inverted color | ${BT}amount${BT}: 0–1 |
| ${BT}filter-opacity${BT} | Apply alpha as an ordered filter operation | ${BT}amount${BT}: 0–1 |
| ${BT}blur${BT} | Gaussian blur of the rendered layer | ${BT}radius${BT} |
| ${BT}shadow${BT} | Box shadow or alpha/drop shadow | ${BT}source${BT}, ${BT}offset${BT}, ${BT}blur${BT}, ${BT}spread${BT}, ${BT}color${BT}, ${BT}inset${BT} |
| ${BT}outer-glow${BT} | Glow outside the final alpha silhouette | ${BT}radius${BT}, ${BT}color${BT}, ${BT}opacity${BT} |
| ${BT}inner-glow${BT} | Glow inside the final alpha silhouette | ${BT}radius${BT}, ${BT}color${BT}, ${BT}opacity${BT} |
| ${BT}noise${BT} | Deterministic grain over the layer surface | ${BT}scale${BT}, ${BT}amount${BT}, ${BT}opacity${BT}, ${BT}seed${BT} |

Example combining color, blur, glow and deterministic grain:

${FENCE}json
{
  "effects": [
    {
      "id": "tone",
      "type": "color-adjust",
      "brightness": 0.04,
      "contrast": 1.08,
      "saturation": 1.15,
      "hueRotate": 0
    },
    { "id": "soften", "type": "blur", "radius": 8 },
    { "id": "halo", "type": "outer-glow", "radius": 18, "color": "#2ee6c5", "opacity": 0.55 },
    { "id": "grain", "type": "noise", "scale": 2, "amount": 0.08, "opacity": 0.2, "seed": 42 }
  ]
}
${FENCE}

### Shadow sources

${BT}shadow${BT} has two explicit sources:

- ${BT}box${BT}: uses the layer border box and supports spread and inset.
- ${BT}alpha${BT}: follows the rendered alpha silhouette; spread must be ${BT}0${BT} and ${BT}inset${BT} must be ${BT}false${BT}.

${FENCE}json
{
  "id": "card-shadow",
  "type": "shadow",
  "source": "box",
  "offset": { "x": 0, "y": 16 },
  "blur": 24,
  "spread": 0,
  "color": "#00000066",
  "inset": false
}
${FENCE}

## Root filter graphs

For SVG filter graphs, define a filter in the document's ${BT}filters${BT} collection and reference it from a layer with ${BT}filter${BT}. Filter primitives are ordered and can pass named results to later primitives:

${BT}feBlend${BT}, ${BT}feColorMatrix${BT}, ${BT}feComponentTransfer${BT}, ${BT}feComposite${BT}, ${BT}feConvolveMatrix${BT}, ${BT}feDisplacementMap${BT}, ${BT}feDropShadow${BT}, ${BT}feFlood${BT}, ${BT}feGaussianBlur${BT}, ${BT}feImage${BT}, ${BT}feMerge${BT}, ${BT}feMorphology${BT}, ${BT}feOffset${BT}, ${BT}feTile${BT}, ${BT}feTurbulence${BT}, ${BT}feDiffuseLighting${BT} and ${BT}feSpecularLighting${BT}.

Use atomic effects for common motion styling. Use a root filter graph when you need compositing, channel math, displacement, convolution, turbulence, merge or lighting primitives.

## Masks

Clip paths, alpha/luminance masks, and isolation describe coverage and compositing relationships. They are not high-level layout features.

Masks can be vector content or an image asset. A mask uses ${BT}alpha${BT} or ${BT}luminance${BT} mode; multiple CSS mask layers combine with ${BT}add${BT}, ${BT}subtract${BT}, ${BT}intersect${BT} or ${BT}exclude${BT}.

${FENCE}json
{
  "masks": [{
    "id": "reveal-mask",
    "maskType": "luminance",
    "children": [{
      "type": "circle",
      "cx": 240,
      "cy": 135,
      "r": 120,
      "fill": { "type": "solid", "color": "#ffffff" }
    }]
  }],
  "layers": [{
    "id": "photo",
    "mask": "reveal-mask"
  }]
}
${FENCE}

## Paint and composite opacity

Fill opacity and stroke opacity belong to their paint sources. Layer/composite opacity belongs to the composite result. Keeping them separate makes effect and export behavior predictable.

${BT}composite.blendMode${BT} supports ${BT}normal${BT}, ${BT}darken${BT}, ${BT}multiply${BT}, ${BT}color-burn${BT}, ${BT}lighten${BT}, ${BT}screen${BT}, ${BT}color-dodge${BT}, ${BT}overlay${BT}, ${BT}soft-light${BT}, ${BT}hard-light${BT}, ${BT}difference${BT}, ${BT}exclusion${BT}, ${BT}hue${BT}, ${BT}saturation${BT}, ${BT}color${BT} and ${BT}luminosity${BT}. Use ${BT}isolation: "isolate"${BT} when a group must composite independently.

${BT}backdropEffects${BT} applies the same atomic effect vocabulary to the already-painted backdrop rather than to the layer's own source.

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

V2 supports linear, step, cubicBezier and spring easing. interpolation may be linear or discrete. Easing changes how a value is sampled; it does not create an implicit property or a hidden animation.

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

The HTML/CSS compiler resolves path(), CSS lengths and percentages, then stores offsetDistance as a normalized ratio from 0 to 1. The documented motion-path values compose translation, rotation, anchor and authored transforms.

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

Embedded video audio stays on video.payload.audio so its visual trim and original audio identity move together.
`,
  },
  compiler: {
    title: "Compiler",
    markdown: String.raw`# Compiler

## From authoring input to JSON V2

The compiler turns HTML, CSS or agent intent into Neonix JSON V2. The result is the canonical editable document for the project.

${FENCE}text
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
${FENCE}

## What authoring is normalized

CSS values, percentages, font choices, media metadata, motion paths, effects, transforms and paint references are validated and represented in the JSON document.

## Keep the document portable

Neonix JSON V2 contains authoring meaning rather than browser state, device resources or output implementation details. Keep projects portable by using documented fields and stable asset identities.`,
  },
  rendering: {
    title: "Output",
    markdown: String.raw`# Output

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

Keep output-related meaning in documented JSON V2 fields: composition settings, layers, assets, paints, transforms, effects, animation and audio. Do not add browser state, temporary editor values or provider-specific metadata to an authoring document.`,
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

## HTML elements that are supported

Use only the following visual HTML vocabulary. Tags are grouped by their authoring role:

| Role | Supported tags |
| --- | --- |
| Document | ${BT}html${BT}, ${BT}head${BT}, ${BT}meta${BT}, ${BT}title${BT}, ${BT}style${BT}, ${BT}body${BT} |
| Containers | ${BT}div${BT}, ${BT}main${BT}, ${BT}section${BT}, ${BT}article${BT}, ${BT}header${BT}, ${BT}footer${BT}, ${BT}nav${BT}, ${BT}aside${BT}, ${BT}figure${BT}, ${BT}figcaption${BT} |
| Text | ${BT}h1${BT}–${BT}h6${BT}, ${BT}span${BT}, ${BT}p${BT}, ${BT}strong${BT}, ${BT}b${BT}, ${BT}em${BT}, ${BT}i${BT}, ${BT}small${BT}, ${BT}br${BT}, ${BT}blockquote${BT}, ${BT}pre${BT}, ${BT}code${BT} |
| Media | ${BT}img${BT}, ${BT}video${BT}, ${BT}audio${BT} |
| SVG | ${BT}svg${BT}, ${BT}g${BT}, ${BT}path${BT}, ${BT}rect${BT}, ${BT}circle${BT}, ${BT}ellipse${BT}, ${BT}line${BT}, ${BT}polyline${BT}, ${BT}polygon${BT} |

Use a supported container or ${BT}span${BT} instead of inventing a custom visual tag. Give important elements a stable ${BT}id${BT}; ids must be unique.

## CSS properties currently supported

The following property groups are available for HTML authoring. The value still has to use the documented syntax for that property.

| Category | Properties |
| --- | --- |
| Layout and box | ${BT}position${BT}, ${BT}position-anchor${BT}, ${BT}anchor-name${BT}, ${BT}inset${BT}, ${BT}top${BT}, ${BT}right${BT}, ${BT}bottom${BT}, ${BT}left${BT}, ${BT}width${BT}, ${BT}height${BT}, ${BT}min-width${BT}, ${BT}max-width${BT}, ${BT}min-height${BT}, ${BT}max-height${BT}, ${BT}aspect-ratio${BT}, ${BT}margin${BT} and ${BT}padding${BT} longhands, ${BT}box-sizing${BT} |
| Visibility and order | ${BT}display${BT}, ${BT}visibility${BT}, ${BT}opacity${BT}, ${BT}overflow${BT}, ${BT}z-index${BT} |
| Paint and borders | ${BT}background${BT}, ${BT}background-color${BT}, ${BT}background-image${BT}, ${BT}background-position${BT}, ${BT}background-size${BT}, ${BT}background-repeat${BT}, ${BT}background-origin${BT}, ${BT}background-clip${BT}, ${BT}color${BT}, ${BT}border${BT} and border longhands, ${BT}border-radius${BT}, ${BT}outline${BT} and outline longhands |
| Text | ${BT}font-family${BT}, ${BT}font-size${BT}, ${BT}font-weight${BT}, ${BT}font-style${BT}, ${BT}font-stretch${BT}, ${BT}line-height${BT}, ${BT}letter-spacing${BT}, ${BT}word-spacing${BT}, ${BT}white-space${BT}, ${BT}text-align${BT}, ${BT}direction${BT}, ${BT}writing-mode${BT}, ${BT}text-decoration${BT}, ${BT}text-overflow${BT}, ${BT}text-rendering${BT}, ${BT}text-shadow${BT} |
| Transform | ${BT}transform${BT}, ${BT}transform-origin${BT}, ${BT}perspective${BT}, ${BT}perspective-origin${BT}, ${BT}transform-style${BT}, ${BT}backface-visibility${BT} |
| SVG paint | ${BT}fill${BT}, ${BT}fill-opacity${BT}, ${BT}fill-rule${BT}, ${BT}stroke${BT}, ${BT}stroke-width${BT}, ${BT}stroke-opacity${BT}, ${BT}stroke-linejoin${BT}, ${BT}stroke-linecap${BT}, ${BT}stroke-dasharray${BT}, ${BT}stroke-dashoffset${BT}, ${BT}paint-order${BT} |
| Media | ${BT}object-fit${BT}, ${BT}object-position${BT}, ${BT}image-rendering${BT} |
| Flex and grid | ${BT}flex-direction${BT}, ${BT}flex-wrap${BT}, ${BT}justify-content${BT}, ${BT}justify-items${BT}, ${BT}align-items${BT}, ${BT}align-self${BT}, ${BT}align-content${BT}, ${BT}place-items${BT}, ${BT}gap${BT}, ${BT}row-gap${BT}, ${BT}column-gap${BT}, ${BT}flex${BT}, ${BT}flex-basis${BT}, ${BT}flex-grow${BT}, ${BT}flex-shrink${BT}, ${BT}order${BT}, ${BT}grid-template-columns${BT}, ${BT}grid-template-rows${BT}, ${BT}grid-column${BT}/${BT}grid-row${BT} and their start/end fields |
| Motion and effects | ${BT}animation${BT}, ${BT}animation-name${BT}, ${BT}animation-duration${BT}, ${BT}animation-delay${BT}, ${BT}animation-iteration-count${BT}, ${BT}animation-direction${BT}, ${BT}animation-fill-mode${BT}, ${BT}animation-play-state${BT}, ${BT}animation-timing-function${BT}, ${BT}filter${BT}, ${BT}backdrop-filter${BT}, ${BT}mix-blend-mode${BT}, ${BT}isolation${BT}, ${BT}clip-path${BT}, ${BT}mask-image${BT}, ${BT}mask-position${BT}, ${BT}mask-size${BT}, ${BT}mask-repeat${BT}, ${BT}mask-mode${BT}, ${BT}mask-composite${BT}, ${BT}offset-path${BT}, ${BT}offset-distance${BT}, ${BT}offset-rotate${BT}, ${BT}offset-anchor${BT} |

Common supported value forms include ${BT}px${BT}, percentages, ${BT}em${BT}, ${BT}rem${BT}, ${BT}vw${BT}, ${BT}vh${BT}, ${BT}auto${BT}, arithmetic ${BT}calc()${BT}, ${BT}min()${BT}, ${BT}max()${BT} and ${BT}clamp()${BT}, when they are valid for the selected property. Use solid colors, supported gradients, documented transform functions and deterministic animation timing values.

## Selectors and CSS resources

Supported selectors are tag selectors, class selectors, id selectors, descendant selectors and comma-separated selector lists. CSS custom properties and ${BT}var()${BT} fallbacks are supported when their values resolve to a supported property.

Put CSS in an inline ${BT}<style>${BT} block in the same HTML document. External stylesheets, inline ${BT}style="..."${BT} attributes, pseudo-classes, pseudo-elements, attribute selectors, child/sibling combinators (${BT}>${BT}, ${BT}+${BT}, ${BT}~${BT}) and media queries are not part of the current authoring contract.

## Deliberately unsupported browser features

Do not ask an AI to generate these for a Neonix video document:

- ${BT}<script>${BT}, event handlers, forms, inputs, buttons, iframes or canvas drawing;
- ${BT}::before${BT}, ${BT}::after${BT} and CSS ${BT}content${BT};
- browser interaction, hover/focus state, responsive media-query branches or network-dependent layout;
- arbitrary HTML tags outside the allowlist;
- CSS declarations or selector syntax outside the supported vocabulary.

For generated text or decorations, use real elements instead of CSS-generated content:

${FENCE}html
<div class="badge">
  <span class="badge-label">Neonix</span>
</div>
${FENCE}

This makes text, shapes and animation explicit and keeps the document predictable for preview, validation and export.

## AI generation checklist

Before calling the HTML project tool, an AI should:

1. Use exactly one ${BT}neonix-document${BT} metadata tag.
2. Use only tags from the element table above.
3. Put all CSS in an inline ${BT}<style>${BT} block.
4. Use real HTML elements for every visible text or decoration.
5. Use only listed CSS properties and supported value forms.
6. Give important visual elements unique ids.
7. Avoid scripts, pseudo-elements, external stylesheets and browser-only behavior.
8. Validate the complete HTML and fix the first diagnostic before creating or exporting the project.

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

## Create from an authenticated product surface

Use **Import HTML** on the dashboard to create a project from an HTML file or pasted document. AI clients can create projects through the authenticated Neonix MCP connection. Both paths use the same validation and compilation flow, then open the project in preview for refinement and export.

The underlying project APIs require an authenticated integration and are intentionally not documented on this public guide.

## Validate before importing

When a document is rejected, fix the first diagnostic before retrying. Common causes are a missing or duplicated metadata tag, invalid JSON in the ${BT}content${BT} attribute, unsupported CSS, or a font/media reference that cannot be resolved.

For an interactive compiler test, open [HTML compiler preview](/docs/preview/html-compiler). For the authoring contract, continue with [Compiler](/docs/compiler) and [Output](/docs/rendering).`,
  },
  validation: {
    title: "Validation and schema",
    markdown: String.raw`# Validation and schema

## Why validation matters

Validation makes the document predictable for both people and AI agents. It checks that the JSON uses the documented Neonix JSON V2 vocabulary, that values have the right types and that references point to real objects.

Unknown properties, invalid values and broken references are rejected before a project is accepted.

## Minimal valid document

${FENCE}json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "composition": { "width": 1080, "height": 1080, "fps": 30 },
  "assets": [],
  "layers": [],
  "audio": { "sampleRate": 48000, "tracks": [] }
}
${FENCE}

The root object must identify the document format and version, then provide a composition, an asset list, a layer list and an audio section. Optional features can be added only with documented fields.

## Required root fields

| Field | Purpose |
| --- | --- |
| ${BT}format${BT} | Must be ${BT}motion-protocol${BT}. |
| ${BT}formatVersion${BT} | Must be ${BT}2${BT}. |
| ${BT}composition${BT} | Defines width, height, frame rate and optional background/color settings. |
| ${BT}assets${BT} | Declares reusable image, video, audio and font resources. |
| ${BT}layers${BT} | Defines the visible hierarchy and timed visual content. |
| ${BT}audio${BT} | Defines audio settings and tracks, including an empty list when no audio is used. |

## What is checked

- exact ${BT}format${BT} and ${BT}formatVersion${BT};
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

- each ${BT}assetId${BT}, ${BT}parentId${BT} or definition reference resolves;
- a layer does not point to itself as a parent;
- group relationships do not form a cycle;
- sibling order is not duplicated or ambiguous;
- a paint or effect reference uses the correct documented kind.

## Values and timing

Numbers must be finite JSON numbers. Do not use ${BT}NaN${BT}, ${BT}Infinity${BT}, numeric strings or browser expressions. Colors must use a documented color format, and enum values are case-sensitive.

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

Validation reports document problems; it does not invent missing assets, silently change unsupported values or guess the author's intended timing.`,
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
  published("compiler", "Compiler", "runtime", "runtime"),
  published("html", "HTML authoring", "runtime", "runtime"),
  published("rendering", "Output", "runtime", "runtime"),
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
  { id: "runtime", label: "Authoring tools", description: "Compile, validate and export", items: [] },
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
