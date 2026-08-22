import GithubSlugger from "github-slugger";
import { createElement } from "react";
import { DocsMarkdown } from "@/components/docs/DocsMarkdown";
import type { DocsPageView } from "@/lib/docs/content/page-view";
import { withOnThisPage } from "@/lib/docs/content/with-on-this-page";

type V2Page = { title: string; markdown: string };

const FENCE = String.fromCharCode(96).repeat(3);
const BT = String.fromCharCode(96);

const V2_PAGES: Record<string, V2Page> = {
  "": {
    title: "NeonVideo V2 documentation",
    markdown: String.raw`# NeonVideo V2

This is the static guide to NeonVideo's current authoring vocabulary and Atomic Protocol V2. The examples on these pages are display-only teaching material. They are not sent to a compiler, runtime, preview renderer, or export process.

## Start with the model

NeonVideo separates intent from rendering:

${FENCE}text
MCP / AI / future editor
        -> high-level authoring intent
        -> Atomic Protocol V2
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

- Atomic Protocol V2 is the current protocol contract.
- Transform data is designed around a 4x4 matrix.
- A normal 2D layer is a 3D layer with zero Z rotation and zero Z position.
- ${BT}anchor${BT} describes the pivot; ${BT}z${BT} describes position along the world axis.
- High-level patterns and components are future authoring vocabulary, not atoms.
- Static documentation examples explain meaning but do not render media.

## Continue

- Read [V2 architecture](/docs/architecture) for the complete pipeline.
- Read [Authoring model](/docs/authoring) for the boundary between intent and atoms.
- Read [Atomic Protocol V2](/docs/atoms) for the atom catalog.
- Read [Runtime, preview, and export](/docs/rendering) for adapter responsibilities.`,
  },
  architecture: {
    title: "V2 architecture",
    markdown: String.raw`# V2 architecture

## One render meaning

MCP tools, AI agents, templates, and the future editor are authoring surfaces. They describe intent. They do not own GPU state, shader code, Matrix4 math, or video encoding.

${FENCE}text
MCP / AI / Editor intent
        |
        v
High-level authoring JSON
        |
        v  Compiler A
Atomic Protocol V2 JSON
        |
        v  Compiler B
Runtime IR and Matrix4 values
        |
        v
Runtime frame
        |
        +--> native preview adapter
        |
        +--> export adapter
${FENCE}

## Composition and view

The composition owns the output dimensions, frame rate, background, timeline, and node tree. The view owns projection and camera-like transform intent when the runtime needs it.

## Atomic Protocol V2

V2 is the stable interchange boundary. It contains explicit nodes and operators such as Shape, Path, Text, Transform, Timing, Effects, Mask, and Composite. A pattern or preset is expanded before it reaches this boundary.

## Runtime IR

Runtime resolves assets, text layout, animations, Matrix4 values, projection, paint commands, and effect programs. The renderer consumes the resolved result; it does not reinterpret authoring semantics.

## Preview and export

Preview and export can use different platform adapters. They must receive the same runtime meaning for the same protocol document and time. This documentation page does not execute either adapter.`,
  },
  authoring: {
    title: "Authoring model",
    markdown: String.raw`# Authoring model

## Intent first

High-level authoring is where a person, AI agent, MCP tool, template, or future editor can express rich intent:

${FENCE}json
{
  "kind": "hero-intro",
  "headline": "A calm beginning",
  "motion": "fade-up"
}
${FENCE}

This is illustrative high-level input. The fields are not Atomic Protocol V2 fields. Compiler A expands and normalizes this intent before runtime rendering.

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

| Concern | High-level authoring | Atomic Protocol V2 |
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

## Static example policy

JSON blocks in this guide teach structure. They are not validated or rendered by the web documentation page.`,
  },
  ai: {
    title: "AI and MCP guidance",
    markdown: String.raw`# AI and MCP guidance

## Generate intent, then lower it

AI should normally describe the user's goal in high-level terms first. A compiler or approved lowering step turns that intent into Atomic Protocol V2.

## Current AI rules

- Prefer explicit V2 fields over guessed shortcuts.
- Ask for missing composition dimensions, timing, asset references, and text font information.
- Use ${BT}anchor${BT} for a pivot and ${BT}translate.z${BT} for world position.
- Use ${BT}zIndex${BT} for paint order and do not treat it as world distance.
- Keep fill opacity and stroke opacity independent.
- Keep effect order explicit.
- Do not invent renderer, shader, texture, or buffer fields.
- Keep future high-level features labeled as intent until they have lowering rules.

## A good patch shape

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

The example is a teaching block. The editor or MCP contract decides how a patch is validated and applied.

## Planned vocabulary

Patterns, presets, templates, and components may be useful high-level concepts. They are not current atoms. Do not emit them inside an atomic layer payload until Compiler A has an approved lowering rule.`,
  },
  atoms: {
    title: "Atomic Protocol V2",
    markdown: String.raw`# Atomic Protocol V2

## Atom catalog

| Atom | Responsibility |
| --- | --- |
| Composition | Output size, rate, background, and document scope |
| View | Projection and view transform |
| Group | Parent-child hierarchy and group transform |
| Shape | Rectangle, ellipse, and other certified primitives |
| Path | Contours, fill rules, stroke, and morphable geometry |
| Text | Content, font reference, layout frame, and glyph intent |
| Image | Asset reference and fit/crop behavior |
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

## Composition

The composition defines the output coordinate system and timing basis.

${FENCE}json
{
  "format": "motion-protocol",
  "formatVersion": 2,
  "composition": {
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "background": "#101820",
    "view": {
      "projection": { "kind": "orthographic", "zoom": 1 },
      "transform": {
        "translate": { "x": 0, "y": 0, "z": 0 },
        "rotate": { "x": 0, "y": 0, "z": 0 }
      }
    }
  },
  "layers": []
}
${FENCE}

## View

The view chooses orthographic or perspective projection and supplies a view transform. A normal 2D composition uses orthographic projection and keeps the relevant Z values at zero.

## Coordinate units

Frame and transform coordinates are composition/world units. The preview surface may scale them to fit a browser viewport, but the document meaning does not change.

## Required distinction

Composition dimensions describe the output. A layer frame describes local geometry. A view describes projection. These are separate responsibilities.`,
  },
  "atoms/transform": {
    title: "Transform and Matrix4",
    markdown: String.raw`# Transform and Matrix4

## One transform source

V2 uses a 4x4 transform representation for both 2D and 3D.

${FENCE}json
{
  "frame": { "width": 480, "height": 270 },
  "transform": {
    "translate": { "x": 320, "y": 180, "z": 0 },
    "rotate": { "x": 0, "y": 0, "z": 8 },
    "scale": { "x": 1, "y": 1, "z": 1 },
    "anchor": { "x": 0.5, "y": 0.5, "z": 0 },
    "skew": { "x": 0, "y": 0 }
  }
}
${FENCE}

## 2D is a 3D case

For ordinary 2D content, ${BT}z = 0${BT}, X/Y rotation is zero, and the view is orthographic. The runtime still evaluates Matrix4 so future perspective and 3D motion do not require a transform-system replacement.

## Anchor

${BT}anchor.x${BT} and ${BT}anchor.y${BT} are normalized within the local frame. ${BT}anchor.z${BT} is an absolute world-unit pivot coordinate. A non-zero Z anchor changes the pivot for X/Y rotation.

## Order

The runtime owns the exact matrix composition order. Documentation describes semantic inputs and must not expose backend-specific matrix packing or shader details.`,
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

## Responsibility

Text carries content and font identity. Runtime resolves font metrics, shaping, line layout, and glyph data before a renderer consumes it.

${FENCE}json
{
  "id": "title",
  "type": "text",
  "payload": {
    "text": "NeonVideo V2",
    "font": { "assetId": "font-roboto-regular" },
    "fontSize": 64,
    "lineHeight": 1.2,
    "align": "center",
    "verticalAlign": "middle"
  },
  "frame": { "width": 800, "height": 160 }
}
${FENCE}

## Frame semantics

The text frame is the immutable layout area. Alignment positions shaped lines inside that frame. A high-level editor may calculate a convenient frame, but the atomic text node receives an explicit frame.

## Fonts

Fonts should be resolved through an asset reference so preview and export can use the same font bytes. A CDN URL is an asset delivery detail, not a text atom field.`,
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
    { "type": "drop-shadow", "offset": { "x": 18, "y": 20 }, "blur": 16, "color": "#000000", "opacity": 0.25 }
  ],
  "composite": { "opacity": 1, "blendMode": "normal" }
}
${FENCE}

## Masks

Clip, alpha, inverse-alpha, luma, nested masks, and isolation describe coverage relationships. They are not high-level layout features.

## Paint and composite opacity

Fill opacity and stroke opacity belong to their paint sources. Layer/composite opacity belongs to the composite result. Keeping them separate makes effect and export behavior predictable.

## Static teaching boundary

The figures in the web guide are explanatory pictures. They do not execute an offscreen pass or initialize a graphics API.`,
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
    body: createElement(DocsMarkdown, { markdown: page.markdown }),
  });
}

export function getPublishedV2Slugs(): string[] {
  return Object.keys(V2_PAGES);
}





