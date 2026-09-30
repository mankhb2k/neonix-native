---
slug: atoms
title: Neonix JSON V2
description: Reference catalog of Neonix JSON V2 atoms: composition, view, group, shape, path, text, image, video, transform, timing, animation and effects.
---
# Neonix JSON V2

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

An atom is documented as supported only after its static contract, preview behavior and export behavior have been tested. This page is a reference map; it does not run those tests.

---
slug: atoms/composition
title: Composition and view
description: How composition (canvas size, frame rate, background) and view (projection, camera transform) define a Neonix JSON V2 document's output.
---
# Composition and view

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

```json
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
```

The JSON field `format` remains the schema compatibility value. The public name of the document format is Neonix JSON V2.

## Output dimensions

`width` and `height` are positive composition units. For standard 2D work they behave like output pixels, with the origin at the top-left, X increasing to the right and Y increasing downward.

The aspect ratio is determined by these two values:

| Composition | Aspect ratio | Typical use |
| --- | --- | --- |
| 1920 × 1080 | 16:9 | Landscape video |
| 1080 × 1920 | 9:16 | Vertical video |
| 1080 × 1080 | 1:1 | Square social video |
| 2048 × 2048 | 1:1 | High-resolution square output |

Changing a layer frame does not change the composition size. Changing the browser viewport does not change it either. In an HTML document, the `composition` metadata is authoritative; body CSS only controls how the authoring page is laid out.

## Frame rate and time

`fps` is the positive number of frames per second. Export samples the composition at this cadence:

```text
30 fps  ->  frame 0 at 0 ms
           frame 1 at 33.333... ms
           frame 2 at 66.666... ms
           frame 3 at 100 ms
```

Layer timing, keyframes and audio clip timing use milliseconds. The composition does not resize or stretch time when the output FPS changes; it changes the frame sampling cadence. Keep the same FPS in preview and export when comparing motion.

## Background and color space

`background` is the base color of the composition behind transparent or uncovered pixels. It is a color value, not an image asset and not a layer.

`colorSpace` is currently required to be `srgb`. Keeping this explicit makes color interpretation deterministic across browsers, preview surfaces and exported video.

## View and projection

The view is required and contains two parts:

1. `projection` maps world coordinates into the composition rectangle.
2. `transform` moves and rotates the view before projection.

### Orthographic projection

Orthographic projection is the default for ordinary 2D motion. Objects do not become smaller just because their Z position changes.

```json
{
  "kind": "orthographic",
  "zoom": 1,
  "near": 1,
  "far": 4000
}
```

- `zoom` is a positive scale factor. A larger value zooms into the world.
- `near` and `far` define the visible depth range.
- `far` must be greater than `near`.

Use orthographic projection for titles, cards, UI motion, illustrations and most HTML-to-video compositions.

### Perspective projection

Perspective projection makes depth affect apparent size. Objects with different Z positions can appear closer or farther from the view.

```json
{
  "kind": "perspective",
  "fov": 60,
  "near": 1,
  "far": 4000
}
```

- `fov` is the vertical field of view in degrees and must be between 0.001 and 179.999.
- `near` and `far` are positive depth planes.
- Keep `far` > `near` and keep visible objects inside the depth range.

Perspective belongs at the composition view level. A local group can also have its own 3D perspective semantics; that is documented under [Layers and hierarchy](/docs/atoms/layers).

## View transform

The view transform has finite 3D translation and rotation values:

```json
{
  "transform": {
    "translate": { "x": 0, "y": 0, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 0 }
  }
}
```

- `translate` moves the view in world units. Because it is a view transform, moving the view in one direction makes the scene appear to move in the opposite direction.
- `rotate` rotates the view around X, Y and Z in degrees.
- `z` is meaningful when using 3D layer positions or perspective projection.

For a normal 2D composition, keep the view at zero translation and rotation, use orthographic projection and place content with layer transforms instead.

## Composition, view and layer frame are different

Consider a 1920×1080 composition with a 640×360 card:

```text
composition.width / height  -> output canvas: 1920 × 1080
card.frame.width / height   -> local geometry: 640 × 360
card.transform.translate    -> where the card is placed
composition.view             -> how the whole world is projected
```

Changing the card frame changes only the card. Changing the view can affect every layer. Changing the composition dimensions changes the final output contract and may require repositioning content.

## Validation rules and common mistakes

- Composition must include positive `width`, `height` and `fps`.
- `background` must be a valid color and `colorSpace` must be `srgb`.
- `view`, `projection` and `transform` are required objects.
- Orthographic projection requires `zoom`, `near` and `far`.
- Perspective projection requires `fov`, `near` and `far`.
- `far` must be greater than `near`.
- Do not use body CSS, a browser window size or a layer frame as a substitute for composition dimensions.

Continue with [Transform and Matrix4](/docs/atoms/transform) for layer transforms, [Layers and hierarchy](/docs/atoms/layers) for parent-child coordinates, and [Animation and timing](/docs/animation) for time-based changes.

---
slug: atoms/assets
title: Assets
description: How Neonix JSON V2 stores portable image, video, audio and font references and metadata instead of embedding file contents.
---
# Assets

## Portable references

Assets are metadata and stable references. Neonix JSON V2 stores file identity and media metadata rather than the file contents inside the authoring document.

```json
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
```

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

```json
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
```

For public video and audio, the origin should support byte-range requests and return the correct `Content-Type`. If the media is drawn into a canvas during preview, configure CORS on the media origin as well; a public URL alone does not grant browser canvas access.

Public URLs are suitable for assets that can be downloaded by anyone. Do not put access tokens, signed query strings or private storage-provider endpoints in a public document.

### 2. Neonix private storage

Upload workspace media from the authenticated Assets screen. Neonix validates the file, records its metadata and prepares the supported derivatives before making it available to the project.

In authoring JSON, layers reference a private asset by `assetId`:

```json
{
  "id": "user-video-layer",
  "type": "video",
  "payload": { "assetId": "<asset-id>" },
  "frame": { "width": 960, "height": 540 },
  "timing": { "start": 0, "duration": 5 }
}
```

The editor resolves the asset through the current signed-in workspace session. The private delivery URL, storage provider and upload credentials are implementation details and should not be copied into authoring JSON or public HTML.

For private media, Neonix supports the original image/video/audio source, a generated video poster and an extracted audio derivative when processing has completed. Video and audio playback uses range-aware delivery internally; no direct storage access or storage-provider CORS configuration is required for the authenticated app flow.

### Delivery checklist

- Public image: stable HTTPS URL and correct image MIME type.
- Public video/audio: HTTPS, correct MIME type and HTTP Range support.
- Canvas preview from another origin: allow the Neonix origin with CORS.
- Private Neonix asset: upload it from Assets and reference it by asset id; do not hardcode a storage-provider endpoint.
- Video with sound: use the original video URI and its `variant=audio` derivative when the project needs a separate audio track.

### Private workspace fonts

User fonts follow a dedicated authenticated flow from the Assets screen. Neonix validates each font, reads its family/weight/style metadata and makes it available to the signed-in workspace. Workspace fonts are never exposed through the public system-font CDN.

After a font is ready, select its family, weight and style in the editor or Neonix JSON V2. The editor and authenticated preview resolve the private font bytes with the current workspace session; export uses the same catalog entry. Do not copy private font references into public HTML or publish workspace fonts as public files.

## System fonts and the public CDN

Neonix system fonts are served through the public font CDN:

```text
https://fonts.neonix.video/{family}/{filename}
```

Example:

```text
https://fonts.neonix.video/inter/Inter_18pt-Regular.ttf
https://fonts.neonix.video/inter/Inter_18pt-Bold.ttf
```

The CDN is a delivery endpoint for known objects. It does not expose a browser directory listing, so requesting the CDN root or a family folder is not the way to discover fonts.

## Google Fonts-compatible CSS API

For browser HTML, request the required family and weights through the CSS endpoint:

```html
<link rel="stylesheet" href="https://fonts.neonix.video/css2?family=Inter:wght@400;700;900&display=swap">
```

Then use the canonical family name in CSS:

```css
body {
  font-family: "Inter", sans-serif;
  font-weight: 700;
}
```

The CSS endpoint resolves the requested family, weight and style to the matching public font object. It does not rename the font's internal family metadata.

## Get every available font

Call `GET https://api.neonix.video/v1/fonts` without authentication to list all public system fonts:

```bash
curl https://api.neonix.video/v1/fonts
```

The signed-in editor also includes workspace fonts in its private font picker. Use the public catalog and CDN only for system fonts; workspace fonts remain private to the current workspace and should not be copied into public HTML.

## Font asset versus text style

The font catalog identifies the bytes. The text span selects the family and style:

```json
{
  "font": {
    "families": ["Inter", "sans-serif"],
    "size": 64,
    "weight": 700,
    "style": "normal"
  }
}
```

Do not put a storage URL in `families`. Use the family name in Neonix JSON V2 and use `@font-face` with the CDN URL in HTML. The compiler and export path can then resolve the same family, weight and style deterministically.

See [Text](/docs/atoms/text) for font selection, fallback and `@font-face` examples.


---
slug: atoms/layers
title: Layers and hierarchy
description: How the flat layers array expresses parent-child hierarchy with parentLayerId, sibling order and the shared layer contract.
---
# Layers and hierarchy

## A flat array, a tree in meaning

The layers array is flat so it is easy to patch, diff and stream. Parent-child relationships are expressed with parentLayerId. Only a group may be a parent, layer ids are globally unique, and higher sibling order paints later.

```json
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
```

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


---
slug: atoms/transform
title: Transform and Matrix4
description: How translate, rotate, scale, anchor and skew place a layer, and the Matrix4 model shared by 2D and 3D motion in Neonix JSON V2.
---
# Transform and Matrix4

Transform controls where a layer is placed, how it rotates and scales, and which local point acts as its pivot. Every layer has a required transform object, and the same model works for flat 2D motion and 3D motion.

## The transform model

```json
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
```

| Field | Meaning | Typical default |
| --- | --- | --- |
| `translate` | Position in the parent/world coordinate system | `{ x: 0, y: 0, z: 0 }` |
| `rotate` | Rotation around X, Y and Z axes, in degrees | `{ x: 0, y: 0, z: 0 }` |
| `scale` | Scale along X, Y and Z axes | `{ x: 1, y: 1, z: 1 }` |
| `anchor` | Local pivot point used by rotation and scale | `{ x: 0, y: 0, z: 0 }` |
| `skew` | 2D shear angles for X and Y | `{ x: 0, y: 0 }` |

All values must be finite numbers. The transform does not change the layer frame itself; it changes how that frame is placed and projected.

## Frame versus transform

The frame is local geometry. The transform is placement:

```text
frame:     480 × 270 local rectangle
anchor:    (240, 135) center of that rectangle
translate: (320, 180) position in the parent/world space
rotate.z:  8 degrees around the anchor
scale:     (1, 1, 1) unchanged size
```

Changing `frame.width` or `frame.height` changes the layer's local geometry. Changing `translate`, `rotate`, `scale` or `anchor` keeps the geometry but changes its placement or appearance.

## Translate

`translate` moves the layer in its parent coordinate system. X and Y use composition/world units. Z is used when the composition view or a parent group uses depth.

```json
"translate": { "x": 320, "y": 180, "z": 0 }
```

For a child layer, the translation is evaluated relative to its parent group. For a root layer, it is evaluated relative to the composition world.

## Scale

`scale` multiplies the local geometry around the anchor:

- `1` leaves an axis unchanged.
- A value between `0` and `1` shrinks that axis.
- A value greater than `1` enlarges that axis.
- A negative value mirrors the layer across that axis.
- `0` collapses an axis and should be used deliberately.

```json
"scale": { "x": 1.2, "y": 0.8, "z": 1 }
```

## Rotation

Rotation values are degrees. Z rotation is the usual flat 2D rotation; X and Y rotation are useful with perspective projection or 3D layers.

```json
"rotate": { "x": 0, "y": 0, "z": -12 }
```

Rotation happens around the local anchor. If the anchor is at the top-left, the layer swings around that corner. If the anchor is at the center, it rotates around its center.

## Anchor and pivot

`anchor.x` and `anchor.y` are local units, not normalized 0–1 percentages. For a 480×270 frame, the center anchor is `{ x: 240, y: 135, z: 0 }`. The pivot may be outside the frame for orbit-style motion.

```json
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
```

To place the frame's center at a world position, use the frame center as the anchor and set `translate` to that world position. To rotate around a corner, use `{ x: 0, y: 0, z: 0 }`.

## Skew

`skew.x` and `skew.y` are 2D shear angles in degrees. They are useful for slanted cards, italic-style geometric motion and simple projection accents. Use an ordered `operations` list when the exact SVG transform sequence matters.

## From CSS to Neonix JSON V2

HTML/CSS authors normally start with a CSS transform. The compiler converts the same intent into explicit JSON fields:

```css
.card {
  width: 480px;
  height: 270px;
  transform: translate(320px, 180px) rotate(8deg) scale(1.1, 0.9);
  transform-origin: 50% 50%;
}
```

```json
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
```

`transform-origin` becomes a local-unit `anchor`; percentages are resolved against the layer frame. `translateX/Y/Z`, `scaleX/Y/Z`, `rotateX/Y/Z`, `skewX/Y` and `matrix/matrix3d` become named fields or ordered operations.

## Ordered operations

The component fields above provide the simple layer transform contract. An optional `operations` array preserves an explicit ordered transform list; its order is semantic and must not be rearranged.

```json
"operations": [
  { "type": "translate", "x": 320, "y": 180 },
  { "type": "rotate", "angle": 8, "center": { "x": 240, "y": 135 } },
  { "type": "scale", "x": 1.1, "y": 1.1 },
  { "type": "skewX", "angle": 4 }
]
```

Supported 2D operations are `translate`, `scale`, `rotate`, `skewX`, `skewY` and six-value SVG `matrix`. Motion extensions add `motion.translate3d`, `motion.scale3d`, `motion.rotateX`, `motion.rotateY`, `motion.rotateZ`, `motion.perspective` and `motion.matrix4`.

When `operations` is present, it is the authored operation sequence. The transform anchor wraps that sequence as a pivot, and the layer translation places the result.

## Matrix4

Neonix uses a canonical 4×4 matrix for the final 2D/3D transform. Most authors should use the named fields or ordered operations. Use `motion.matrix4` only when importing an already-composed matrix or when a tool needs direct matrix control.

```json
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
```

Do not mix a pre-composed matrix with equivalent translate, rotate and scale values unless the duplication is intentional. Otherwise the same motion can be applied twice.

## Which transform form should I use?

| Form | Use it when | Important rule |
| --- | --- | --- |
| Named fields | You are authoring ordinary 2D or 3D motion | Easiest to read and animate with tracks |
| `operations` | You need to preserve the exact CSS/SVG transform order | Array order is semantic |
| `motion.matrix4` | You import a composed 4×4 matrix from another tool | Do not duplicate equivalent named transforms |

For animation, target one scalar or vector property such as `transform.translate.x`, `transform.rotate.z`, `transform.scale.x` or `transform.anchor.y`. Do not animate the whole matrix unless the source tool already owns matrix composition.

## Composition order

With the named fields, the conceptual local transform is:

```text
translate → pivot to anchor → rotate → skew → scale → pivot back
```

The exact matrix is evaluated consistently for preview and export. With `operations`, the listed operations replace the implicit ordered list; their order is not interchangeable. For example, scale-then-translate does not generally produce the same result as translate-then-scale.

## Parent and child layers

A group transform affects its descendants. A child transform is evaluated in the coordinate system established by its parent, then the child is painted according to sibling `order`. To understand a misplaced layer, inspect the chain from the root composition through each parent group before changing the child values.

See [Layers and hierarchy](/docs/atoms/layers) for parent relationships and [Composition and view](/docs/atoms/composition) for the global view projection.

## Animate a transform

Animation tracks target individual transform properties with dot-separated paths:

```json
{
  "path": "transform.translate.x",
  "keyframes": [
    { "time": 0, "value": { "type": "number", "value": 120 } },
    { "time": 1000, "value": { "type": "number", "value": 520 } }
  ]
}
```

Other supported paths include `transform.translate.y`, `transform.translate.z`, `transform.scale.x`, `transform.rotate.z`, `transform.skew.x` and `transform.anchor.x`. Track times are milliseconds and each keyframe value must keep the property's type.

## Common mistakes

- Using normalized anchor values such as `0.5` instead of local units such as `frame.width / 2`.
- Changing the layer frame when the intent is only to move or rotate the layer.
- Reordering `operations` and expecting the same result.
- Applying both a pre-composed `motion.matrix4` and equivalent named transform values.
- Using X/Y rotation without a perspective view and expecting visible depth scaling.
- Forgetting that a parent group transform affects every descendant.

For the global camera, read [Composition and view](/docs/atoms/composition). For time-based changes, read [Animation and timing](/docs/animation).

---
slug: atoms/shape
title: Shape
description: The Shape atom for rectangles, circles, ellipses, lines, polylines and polygons, including its geometry payload and fill/stroke style.
---
# Shape

## Responsibility

Shape is the atomic primitive for simple geometry. Its geometry lives in `payload`; its fill, stroke and marker semantics live in `style`. The supported shape kinds are `rectangle`, `circle`, `ellipse`, `line`, `polyline` and `polygon`.

## Complete rectangle

The following is a complete layer-shaped record. `parentLayerId`, `order`, `frame`, `transform` and `timing` belong to the common layer contract; shape-specific fields are under `payload` and `style`.

```json
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
```

## Geometry kinds

| Kind | Geometry fields | Notes |
| --- | --- | --- |
| `rectangle` | `cornerRadius`, `rx`, `ry` | `rx`/`ry` are optional rounded-corner radii |
| `circle` | frame width and height | The frame defines the primitive bounds |
| `ellipse` | frame width and height | The frame defines the horizontal and vertical radii |
| `line` | `start`, `end` | Requires both points |
| `polyline` | `points` | At least two points; remains open |
| `polygon` | `points` | At least three points; closes the contour |

Point coordinates are local to the shape frame. The layer `transform` moves the complete primitive; it does not rewrite the local points.

## Line, polyline and polygon examples

```json
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
```

## Paint and stroke

Fill and stroke are independent. A paint can be a color shorthand, `none`, a solid object, a linear/radial/conic gradient, a pattern or a named paint reference.

```json
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
```

| Style field | Meaning |
| --- | --- |
| `fill`, `fillOpacity` | Interior paint and alpha |
| `stroke`, `strokeWidth`, `strokeOpacity` | Outline paint, width and alpha |
| `strokeJoin` | `miter`, `bevel` or `round` |
| `strokeCap` | `butt`, `square` or `round` |
| `strokeMiterLimit` | Limit for sharp miter joins |
| `strokeDash` | Dash `array` and optional `offset` |
| `paintOrder` | Ordering of `fill`, `stroke` and `markers` |
| `vectorEffect` | `none` or `non-scaling-stroke` |

Rounded corners are geometry semantics, not a renderer resource. The `cornerRadius`, `rx` and `ry` fields are valid only for rectangles.

---
slug: atoms/path
title: Path
description: The Path atom for freeform vector geometry: named contours with line, quadratic, cubic and arc segments, fill, stroke and morphing rules.
---
# Path

## Responsibility

Path is the freeform vector primitive. It contains one or more named contours, and each contour contains an explicit start point followed by line, quadratic, cubic or arc segments. A path can be filled, stroked, or both.

## Complete path layer

```json
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
```

## Contours and segments

| Segment | Required fields | Meaning |
| --- | --- | --- |
| `line` | `to` | Straight line from the current point |
| `quadratic` | `control`, `to` | One control point |
| `cubic` | `control1`, `control2`, `to` | Two control points |
| `arc` | `radii`, `rotation`, `largeArc`, `sweep`, `to` | Elliptical arc using SVG arc flags |

Every contour requires `id`, `start`, at least one `segments` entry and `closed`. Segment `to` points become the next current point. A closed contour implicitly connects its final point back to `start`; an open contour remains open for stroke rendering.

```json
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
```

## Fill rules and holes

`nonzero` and `evenodd` decide how multiple closed contours produce filled regions. Use `evenodd` for the common “outer contour plus inner hole” case:

```json
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
```

## Stroke and drawing controls

Path style uses the same paint model as Shape:

| Field | Meaning |
| --- | --- |
| `fill`, `fillOpacity` | Interior paint and alpha |
| `stroke`, `strokeWidth`, `strokeOpacity` | Outline paint, width and alpha |
| `strokeJoin` | `miter`, `bevel` or `round` |
| `strokeCap` | `butt`, `square` or `round` |
| `strokeDash` | Dash array and offset |
| `paintOrder` | Fill, stroke and marker ordering |
| `vectorEffect` | `none` or `non-scaling-stroke` |
| `markerStart/Mid/End` | References to root marker definitions |

`pathLength` is an optional calibration length used by dash and motion semantics. It does not alter the geometry coordinates.

## Morphing between paths

A path can carry a compatible target contour set and a normalized `morph.progress` value:

```json
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
```

Morphing requires matching contour and segment structure. If the topology differs, author a separate path or use a layer transition instead of expecting the compiler to invent correspondence.

---
slug: atoms/text
title: Text
description: How Text combines source content, font selection, layout and paint in Neonix JSON V2, including gradients and the public font CDN.
---
# Text

Text combines source content, font selection, layout and paint. Choose an explicit family, weight and style so the same document remains predictable in preview and export.

## Text structure

```json
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
```

The `families` array is an ordered fallback list. The first available family is preferred; later families cover missing glyphs or unavailable styles. Keep a generic fallback such as `sans-serif` at the end, but use a Neonix system font first for stable export.

## Frame and layout

The text frame is the explicit layout area. It controls where lines can wrap and where alignment is resolved; it is not automatically resized to the browser viewport.

- Use a wider frame for a single-line headline.
- Use a fixed width and sufficient height for a paragraph.
- Keep the layer transform separate from text frame geometry.
- Use `textAnchor`, text alignment and vertical alignment to position shaped lines inside the frame.

The source ranges are UTF-16 offsets and must cover the text spans without overlap. Text source should be NFC-normalized before creating the document.

## Gradient text

Text uses the same semantic paint contract as shapes and paths. Put the paint on the text span's `fill`; do not use a CSS `background` or an implementation-specific field. Neonix JSON V2 keeps the paint attached to the text span so the text has the same meaning wherever it is previewed or exported.

```json
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
```

The color is applied only inside the characters; the area outside the text remains transparent. Multiple spans may use different paints; keep each `sourceRange` aligned with its span so each range receives the intended style.

### Gradient types

| Type | Main fields | Use |
| --- | --- | --- |
| `linear-gradient` | `x1`, `y1`, `x2`, `y2` or the `angle` shorthand | Directional color transition |
| `radial-gradient` | `cx`, `cy`, `radius`; optional `fx`, `fy`, `fr` | Circular or elliptical light falloff |
| `conic-gradient` | `from`, `cx`, `cy` | Angular color sweep |

All gradient types accept `stops`, optional `stopOpacity`, `spreadMethod` (`pad`, `reflect` or `repeat`), `gradientUnits` and `gradientTransform`. Stop offsets must be between 0 and 1 and non-decreasing. `objectBoundingBox` coordinates are normalized to the text layer bounds; `userSpaceOnUse` coordinates use composition units.

```json
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
```

Keep fonts explicit and available in the asset catalog so a fallback font does not change glyph widths, line breaks or gradient placement.

## Font fields

| Field | Meaning |
| --- | --- |
| `families` | Ordered family fallback list |
| `size` | Positive font size in SVG length units |
| `weight` | Integer weight from 1 to 1000 |
| `style` | `normal`, `italic` or `oblique |
| `stretch` | CSS width classification |
| `variations` | Optional four-character variable-font axis tags |

Do not put a CDN URL inside `families`. The family name selects the face; the asset catalog resolves the actual font bytes.

## Use the public font CDN in HTML

The system font CDN is public for GET/HEAD requests. Use an explicit `@font-face` declaration when authoring HTML outside the app:

```html
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
```

The public CDN supports browser GET/HEAD. CORS should allow the HTML page origin to request the font. Use the CDN for known files; it intentionally does not act as a browser directory listing.

## Get the complete font catalog

Use the public catalog endpoint to retrieve every enabled system font without authentication:

```bash
curl https://api.neonix.video/v1/fonts
```

The public response contains system fonts only. Workspace fonts are available inside the signed-in editor and are intentionally not exposed in this public guide. The public catalog is the source of truth for system fonts; the CDN is the delivery path for a known system-font object.

## Deterministic font workflow

1. Select a system family, weight and style from the public catalog or a workspace family from the signed-in editor.
2. In HTML, declare the matching CDN `@font-face` URL; in Neonix JSON V2, use the family name and weight in the text font object.
3. Keep the same family, weight, style and asset integrity across preview and export.
4. Avoid silently replacing a missing face with a machine-local font.

## Font loading failures

If text looks different or a font is missing, check the CDN object URL, CORS response, MIME type, weight/style match and the font catalog integrity value. A fallback family can keep text visible, but it may change glyph widths, line breaks and final composition layout.

See [Assets](/docs/atoms/assets) for the asset identity boundary and [HTML authoring](/docs/html) for the complete HTML document workflow.

---
slug: atoms/image
title: Image
description: The Image atom: referencing an asset, frame and fit policy for placing image content inside a Neonix JSON V2 composition.
---
# Image

## Responsibility

Image references an asset and defines how that source is placed inside a frame.

```json
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
```

## Frame ratio

High-level authoring can choose a frame with the same aspect ratio as the source. The atom keeps the explicit frame and fit policy; it does not infer a new frame during rendering.

## Asset identity

The atom refers to an asset. Loading, decoding, caching, and delivery belong to the asset system.

---
slug: atoms/video
title: Video
description: The Video atom: referencing a media asset with deterministic frame selection, trim and timing for preview and export.
---
# Video

## Responsibility

Video references a media asset and participates in the same frame, transform, timing, and composite model as other visual nodes.

```json
{
  "id": "clip",
  "type": "video",
  "payload": { "assetId": "intro-video" },
  "frame": { "width": 960, "height": 540 },
  "timing": { "start": 0, "duration": 3 },
  "source": { "trimStart": 0 },
  "fit": "contain"
}
```

## Deterministic time

The project chooses a source frame from composition time. The documented video contract does not depend on browser playback state.

## Delivery

The asset reference is stable. File URLs, decoding, and caching are delivery concerns.

---
slug: atoms/group
title: Group
description: How the Group layer type composes a hierarchy of child layers that share a coordinate space, timing, opacity or 3D context.
---
# Group

## What a group does

A group is a structural layer that owns a hierarchy of other layers. It has no geometry of its own; its visible result comes from its descendants.

Use a group when several layers should share a coordinate space, timing window, opacity, effect, mask, clip, blend mode or 3D context.

The hierarchy is represented by layer records. A child points to its parent with `parentLayerId`; a group does not contain a `children` array.

```json
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
```

## Parent and child layers

Every layer has a `parentLayerId` and an `order`:

- `parentLayerId: null` places the layer at the composition root;
- a group id in `parentLayerId` makes the layer a direct child of that group;
- a child layer keeps its own `frame` and local `transform`;
- `order` controls paint order among siblings, with higher values appearing later;
- a group may contain shapes, paths, text, images, videos, audio-linked visual layers and nested groups.

The parent id must refer to an existing group. A layer cannot be its own parent, and parent relationships cannot form a cycle.

## Complete nested example

This example places a card and its title inside a nested group. The title and card use local coordinates; the two group transforms move the complete hierarchy.

```json
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
```

## Shared group properties

Group properties apply to the group boundary and, where applicable, its complete descendant tree.

| Property | Purpose |
| --- | --- |
| `frame` | Defines the group's local width and height. |
| `transform` | Moves, rotates, scales, anchors or skews the group coordinate space. |
| `opacity` | Controls the opacity of the composed group result. |
| `enabled` / `visibility` | Enables, hides or collapses the group and its descendants. |
| `composite` | Sets blend mode and optional isolation for the group result. |
| `effects` | Applies documented effects to the group subtree as a unit. |
| `clipPath`, `mask`, `maskLayers` | Limits the visible coverage of the group. |
| `filter` / `backdropEffects` | Applies a documented filter or backdrop effect. |
| `timing` | Defines when the group is active on the composition timeline. |
| `tracks` | Animates supported group properties over time. |
| `render3d` | Defines a local flat or preserved 3D context for descendants. |

Only add properties that are needed. A simple container normally needs just the common layer fields, while a group with effects or perspective can opt into the corresponding documented fields.

## Parent transform and local coordinates

The group transform is composed with each child transform. Children keep their local frame and local transform semantics, so a child should normally be authored relative to its group rather than with final composition coordinates.

For a nested hierarchy, the local relationship is read from the inside out: a leaf layer uses its own transform, then inherits each parent group's coordinate space. This makes it possible to move or animate a complete scene without rewriting every child.

## Timing and animation

The group's `timing` controls the group's active window. A child can have its own timing inside that hierarchy, but for predictable authoring keep child content within the period in which its parent is active.

Animate a group when the whole hierarchy should move together. Typical track paths include:

```json
{
  "tracks": [
    { "path": "transform.translate.x", "keyframes": [{ "time": 0, "value": 240 }, { "time": 1000, "value": 540 }] },
    { "path": "transform.rotate.z", "keyframes": [{ "time": 0, "value": -4 }, { "time": 1000, "value": 0 }] },
    { "path": "opacity", "keyframes": [{ "time": 0, "value": 0 }, { "time": 500, "value": 1 }] }
  ]
}
```

Use the documented value type for each path. Animate a child instead when only one element should change.

## Compositing, masks and effects

Group-level visual properties define the scope of an operation:

- group `opacity` affects the combined group result;
- `composite.blendMode` blends the group result with surrounding content;
- `composite.isolation` keeps group blending within its declared boundary;
- `effects`, `filter`, `clipPath` and `mask` apply to the group scope when declared there;
- a child-level property affects only that child.

Put a property on the smallest layer that should own its effect. Put it on the group when the same operation must cover all descendants.

## 3D group context

Use `render3d` only when descendants need an explicit 3D relationship:

```json
{
  "render3d": {
    "transformStyle": "preserve-3d",
    "perspective": {
      "distance": 800,
      "origin": { "x": 360, "y": 210 }
    }
  }
}
```

`flat` keeps descendants in a flattened group context. `preserve-3d` keeps their 3D relationship. Perspective `distance` must be positive, and `origin` uses the group's local coordinates.

## Common mistakes

| Mistake | Why it causes a problem | Better approach |
| --- | --- | --- |
| Adding `children` to a group | Hierarchy is represented by layer records, not an embedded child array. | Set each child's `parentLayerId`. |
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
3. Set every direct child's `parentLayerId` to that group id.
4. Author child coordinates in the group's local space.
5. Use distinct sibling `order` values.
6. Keep timing and animation paths within the documented ranges.
7. Check that parent links resolve and contain no cycles.

## Boundary

Group is a container and coordinate scope. High-level component behavior, responsive layout rules and reusable template logic are not group fields; express their final authoring result with documented layers, groups and properties.
