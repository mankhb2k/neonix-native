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

This is the static guide to Neonix's current authoring vocabulary and Atomic Protocol V2. The examples on these pages are display-only teaching material. They are not sent to a compiler, runtime, preview renderer, or export process.

## Start with the model

Neonix separates intent from rendering:

${FENCE}text
Claude via MCP / future editor
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

- Read [Authoring model](/docs/authoring) for the boundary between intent and atoms.
- Read [Atomic Protocol V2](/docs/atoms) for the atom catalog.
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

## MCP authoring

MCP is an authoring transport, not a second protocol. An agent should express intent first, then create or update explicit Protocol V2 fields.

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

Text preserves SVG-like source, chunks, spans, font requests and paint semantics. The compiler resolves shaping, fallback, clusters and glyph positions before a renderer consumes it.

${FENCE}json
{
  "id": "title",
  "type": "text",
  "payload": {
    "source": { "text": "Neonix V2", "language": "en" },
    "chunks": [{
      "id": "title-chunk",
      "sourceRange": { "start": 0, "end": 9 },
      "textAnchor": "middle",
      "spans": [{
        "id": "title-span",
        "sourceRange": { "start": 0, "end": 9 },
        "font": { "families": ["Roboto", "sans-serif"], "size": 64 },
        "fill": "#ffffff"
      }]
    }]
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
  "atoms/assets": {
    title: "Assets",
    markdown: String.raw`# Assets

## Portable references

Assets are metadata and stable references. Protocol V2 never stores decoded pixels, video elements, PCM buffers, font objects, GPU handles, or runtime caches in authoring JSON.

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
      "uri": "/fonts/Inter-Regular.woff2",
      "weight": 400,
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

Protocol V2 owns authoring meaning. The compiler resolves that meaning into Runtime V3 without replacing the authoring contract.

${FENCE}text
HTML / CSS / agent intent
          |
          v
Protocol V2 JSON
          |
          v
motion-compiler
          |
          v
RuntimeProjectV3 / RuntimeFrameV3
          |
          +--> browser SVG
          +--> Skia preview
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
  validation: {
    title: "Validation and schema",
    markdown: String.raw`# Validation and schema

## Validate at the boundary

The canonical contract is the Zod schema in packages/motion-protocol/src/v2. The generated JSON Schema is packages/motion-protocol/schema/v2.json. Strict object boundaries reject unknown properties.

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
  published("atoms", "Atomic Protocol V2", "protocol", "protocol"),
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
  { id: "protocol", label: "Atomic Protocol V2", description: "The JSON contract", items: [] },
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
