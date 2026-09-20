import type { HtmlCompilerFontAsset, HtmlCompilerMediaAsset, HtmlCssComposition } from "@motionvideo/html-compiler";

export type HtmlCompilerPreviewTopic =
  | "New project"
  | "Composition & geometry"
  | "HTML tags"
  | "Cascade & values"
  | "Transform 2D"
  | "Paint"
  | "Media"
  | "Typography"
  | "Layout"
  | "Motion & animation";

export type HtmlCompilerPreviewCategory =
  | "HTML tag lowering"
  | "Text compiler & layout"
  | "Motion export samples"
  | "Layout primitives"
  | "Paint primitives"
  | "Effect primitives"
  | "Transform & 3D primitives"
  | "Typography & media primitives"
  | "Animation & keyframe primitives"
  | "Combined pipeline cases";

export type HtmlCompilerPreviewClassification = "primitive" | "combined";

export type HtmlCompilerPreviewCase = {
  id: string;
  phase: "P0" | "P1.1" | "P1.2" | "P1.3" | "P1.4" | "P2.0" | "P2.1" | "P2.2" | "P2.3" | "P2.4" | "P2.5" | "P2.6" | "P2.7" | "P2.8" | "P2.9" | "P3" | "P5" | "P6" | "P7" | "P8" | "P9";
  category?: HtmlCompilerPreviewCategory;
  classification?: HtmlCompilerPreviewClassification;
  classificationLabel?: string;
  topic: HtmlCompilerPreviewTopic;
  label: string;
  properties: string[];
  hint: string;
  fixtureUrl: string;
  composition: HtmlCssComposition;
  durationMs?: number;
};

/** Public directory containing the self-contained HTML compiler fixtures. */
export const HTML_COMPILER_FIXTURE_ROOT = "/docs/html-compiler/fixtures";

export const HTML_COMPILER_PREVIEW_FONT_ASSETS: HtmlCompilerFontAsset[] = [
  {
    "id": "preview-font-inter-regular",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter_18pt-Regular.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:3e5f90a0138b38de4cf4d779ad78391974ea1df776b9164842bdcbb60ce383c5"
  },
  {
    "id": "preview-font-inter-italic",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter_18pt-Italic.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 400,
    "style": "italic",
    "integrity": "sha256:1fe26d47c840ef8767635967acaa50ee43a57794fa00a03bf042ee4aab2792c4"
  },
  {
    "id": "preview-font-inter-bold",
    "kind": "font",
    "uri": "/preview/font/Inter/Inter_18pt-Bold.ttf",
    "mimeType": "font/ttf",
    "family": "Inter",
    "weight": 700,
    "style": "normal",
    "integrity": "sha256:30a5c45ec23a594af2effe8d3b589ad22c2dede27441050a1604d00ff82fd0dc"
  },
  {
    "id": "preview-font-lora-regular",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-Regular.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:7ed00e7c9cdf16ab7e2fd2361fe45d4f0b61263cd60aae398b27b7ee08108827"
  },
  {
    "id": "preview-font-lora-bold",
    "kind": "font",
    "uri": "/preview/font/Lora/Lora-Bold.ttf",
    "mimeType": "font/ttf",
    "family": "Lora",
    "weight": 700,
    "style": "normal",
    "integrity": "sha256:7d74015e950c2fb66519c7295b8155621d22200ae2ca2a4c6b43ce3c490cac87"
  },
  {
    "id": "preview-font-roboto-regular",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-Regular.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459"
  },
  {
    "id": "preview-font-roboto-bold",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto-Bold.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 700,
    "style": "normal",
    "integrity": "sha256:4aaf8c5b661a386998c2e70cf2b87e2440f5404e0b8fd81164f0413fb3435ec6"
  },
  {
    "id": "preview-font-roboto-condensed-regular",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto_Condensed-Regular.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 400,
    "style": "normal",
    "stretch": "condensed",
    "integrity": "sha256:421572e7beae914b9e400ae1e7f9690a749357a94e1a6c3a3fb1d502c54f0b7d"
  },
  {
    "id": "preview-font-roboto-condensed-bold",
    "kind": "font",
    "uri": "/preview/font/Roboto/Roboto_Condensed-Bold.ttf",
    "mimeType": "font/ttf",
    "family": "Roboto",
    "weight": 700,
    "style": "normal",
    "stretch": "condensed",
    "integrity": "sha256:2523dfdb721c2e0291f92419e30dd2cb0f6105d94d2673b2206b127923fce5ee"
  },
  {
    "id": "preview-font-noto-sans-regular",
    "kind": "font",
    "uri": "/preview/font/Noto_Sans/NotoSans-Regular.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Sans",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:fe8c022f48d8dd29f17b744d16f9346f4357e16f7d4f7be58b000ae7c291b614"
  },
  {
    "id": "preview-font-noto-color-emoji",
    "kind": "font",
    "uri": "/preview/font/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf",
    "mimeType": "font/ttf",
    "family": "Noto Color Emoji",
    "weight": 400,
    "style": "normal",
    "integrity": "sha256:7fb39738ab18f10612d6f4595e2e8e47a0afdf34738460442d99cd0c344a4d90"
  }
];

export const HTML_COMPILER_PREVIEW_MEDIA_ASSETS: HtmlCompilerMediaAsset[] = [
  {
    "kind": "video",
    "uri": "/preview/video/demo-video.mp4",
    "mimeType": "video/mp4",
    "width": 1920,
    "height": 1080,
    "duration": 60500,
    "fps": 30
  },
  {
    "kind": "audio",
    "uri": "/preview/audio/bed.mp3",
    "mimeType": "audio/mpeg",
    "duration": 12000,
    "sampleRate": 48000,
    "channels": 2
  }
];

export const HTML_COMPILER_PHASE0_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.new-project.blue-rectangle",
    "phase": "P0",
    "topic": "New project",
    "label": "New project / blue rectangle",
    "properties": [
      "fixed composition",
      "one object",
      "rectangle",
      "blue paint"
    ],
    "hint": "The smallest authored project starts from the fixed composition envelope and compiles one rectangle into a valid Neonix JSON V2 shape layer.",
    "fixtureUrl": "/docs/html-compiler/fixtures/new-project-blue-rectangle.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.explicit-size",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / width + height",
    "properties": [
      "width",
      "height",
      "explicit px",
      "composition pixels"
    ],
    "hint": "Explicit width and height resolve directly to a composition-space frame that both browser reference and Neonix JSON V2 share.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/explicit-size.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.min-max",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / min + max",
    "properties": [
      "min-width",
      "max-width",
      "min-height",
      "max-height"
    ],
    "hint": "Four child shapes make each size constraint visible: minimum width, maximum width, minimum height and maximum height are resolved before lowering.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/min-max.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.div-shape",
    "phase": "P0",
    "topic": "HTML tags",
    "label": "Tag / div → shape",
    "properties": [
      "div",
      "one object",
      "rectangle",
      "solid paint"
    ],
    "hint": "A leaf div is the smallest visual tag: the compiler lowers it to one Neonix JSON V2 rectangle shape layer.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/div-shape.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.div-group",
    "phase": "P0",
    "topic": "HTML tags",
    "label": "Tag / div → group",
    "properties": [
      "div",
      "nested children",
      "group",
      "two shapes"
    ],
    "hint": "A div with children becomes a group; each child div becomes a rectangle layer parented to that group.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/div-group.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.svg-path",
    "phase": "P0",
    "topic": "HTML tags",
    "label": "Tag / svg + path",
    "properties": [
      "svg",
      "path",
      "vector group",
      "cubic contour"
    ],
    "hint": "An svg container becomes a group and its path child lowers to a Neonix JSON V2 path with fill and stroke semantics.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.p0.cascade-values",
    "phase": "P0",
    "topic": "Cascade & values",
    "label": "Cascade + value normalization",
    "properties": [
      "selector list",
      "specificity",
      "inheritance",
      "custom properties",
      "calc/min/max/clamp",
      "!important"
    ],
    "hint": "A single card resolves selector precedence, scoped variables, inheritance, special keywords and typed length functions before lowering to V2.",
    "fixtureUrl": "/docs/html-compiler/fixtures/p0-cascade-values.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.aspect-box-sizing",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / aspect ratio + box sizing",
    "properties": [
      "aspect-ratio",
      "content-box",
      "border-box",
      "padding + border"
    ],
    "hint": "Two equal-width objects show how aspect-ratio derives height and how box-sizing changes whether padding and border expand the final frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/aspect-box-sizing.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.margin",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / margin",
    "properties": [
      "margin",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left"
    ],
    "hint": "Static block children make the four margin shorthand forms and the individual longhands visible in deterministic composition-space flow.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/margin.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.padding",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / padding",
    "properties": [
      "padding",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left"
    ],
    "hint": "Four fixed objects show how padding shorthand and longhands expand the content box into the final Neonix JSON V2 frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/padding.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.position",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / position modes",
    "properties": [
      "position: static",
      "position: relative",
      "position: absolute",
      "normal flow",
      "inset offset"
    ],
    "hint": "Static stays in normal flow and ignores inset values; relative keeps its flow slot while offsetting its paint; absolute leaves flow and uses the positioned container.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/position.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.inset",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / inset edges",
    "properties": [
      "inset",
      "top",
      "right",
      "bottom",
      "left",
      "auto size"
    ],
    "hint": "Inset expands to top/right/bottom/left; when an absolute box has auto dimensions, opposite edges resolve the remaining width and height inside its containing block.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/inset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.display-visibility",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / display + visibility",
    "properties": [
      "display: block",
      "display: contents",
      "display: none",
      "visibility: visible",
      "visibility: hidden"
    ],
    "hint": "Block creates a normal visual box, contents promotes its children into the parent flow, none removes the subtree, and hidden keeps geometry while disabling the emitted layer.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/display-visibility.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.geometry.opacity-z-index-overflow",
    "phase": "P0",
    "topic": "Composition & geometry",
    "label": "Geometry / opacity + stacking + overflow",
    "properties": [
      "opacity",
      "z-index",
      "overflow: visible",
      "overflow: hidden",
      "clipPath"
    ],
    "hint": "Opacity lowers to layer alpha, numeric z-index controls sibling paint order, and overflow hidden creates a composition-space rectangular clip for descendants.",
    "fixtureUrl": "/docs/html-compiler/fixtures/geometry/opacity-z-index-overflow.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.transform.functions",
    "phase": "P0",
    "topic": "Transform 2D",
    "label": "Transform / 2D functions",
    "properties": [
      "transform",
      "transform-origin",
      "translate",
      "scale",
      "rotate",
      "skew"
    ],
    "hint": "The transform list is preserved in source order and lowered to Neonix JSON V2 operations; transform-origin becomes the local anchor for the complete list.",
    "fixtureUrl": "/docs/html-compiler/fixtures/transform/functions.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.transform.rotate-single",
    "phase": "P0",
    "topic": "Transform 2D",
    "label": "Transform / single rotate",
    "properties": [
      "one rectangle",
      "rotate",
      "transform-origin",
      "edge rasterization"
    ],
    "hint": "A single rectangle isolates transform geometry from multi-layer overlap so browser and native edge rasterization can be compared directly.",
    "fixtureUrl": "/docs/html-compiler/fixtures/transform/rotate-single.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.background-basics",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / background basics",
    "properties": [
      "background-color",
      "background solid",
      "multiple layers",
      "paint order"
    ],
    "hint": "Solid background declarations and comma-separated background layers lower to ordered rectangle paints; the first CSS layer remains visually on top of the last one.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/background-basics.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.color-border",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / color + border",
    "properties": [
      "color",
      "border",
      "border-width",
      "border-style",
      "border-color",
      "border-radius"
    ],
    "hint": "The color property resolves currentColor for paint, border shorthand and longhand declarations lower to a solid stroke, none removes the stroke, and one radius value becomes a uniform rounded rectangle.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/color-border.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.svg-fill",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / SVG fill",
    "properties": [
      "fill",
      "fill-opacity",
      "fill-rule",
      "evenodd",
      "path"
    ],
    "hint": "SVG fill is lowered to path style, fill-opacity becomes alpha, and evenodd preserves the hole between nested contours.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/fill.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.svg-stroke",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / SVG stroke",
    "properties": [
      "stroke",
      "stroke-width",
      "stroke-opacity",
      "stroke-linejoin",
      "stroke-linecap"
    ],
    "hint": "An open SVG path isolates stroke paint, width, opacity, join and cap semantics without a fill pass.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/stroke.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.svg-dash-order",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / dash + paint-order",
    "properties": [
      "stroke-dasharray",
      "stroke-dashoffset",
      "paint-order",
      "fill",
      "stroke"
    ],
    "hint": "A closed path keeps dashed stroke geometry, dash offset and explicit stroke-before-fill paint order in the lowered path style.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/dash-order.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.media.object-fit-contain",
    "phase": "P0",
    "topic": "Media",
    "label": "Media / object-fit contain",
    "properties": [
      "img",
      "object-fit: contain",
      "object-position",
      "asset"
    ],
    "hint": "Contain preserves the image aspect ratio inside a fixed composition viewport and keeps the source centered.",
    "fixtureUrl": "/docs/html-compiler/fixtures/media/object-fit-contain.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.media.object-fit-cover-position",
    "phase": "P0",
    "topic": "Media",
    "label": "Media / cover + position",
    "properties": [
      "img",
      "object-fit: cover",
      "object-position: right top",
      "clipping"
    ],
    "hint": "Cover fills the viewport, clips the overflow and uses object-position to choose the visible crop region.",
    "fixtureUrl": "/docs/html-compiler/fixtures/media/object-fit-cover-position.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.media.object-fit-fill-rendering",
    "phase": "P0",
    "topic": "Media",
    "label": "Media / fill + pixelated",
    "properties": [
      "img",
      "object-fit: fill",
      "image-rendering: pixelated",
      "asset"
    ],
    "hint": "Fill maps to a non-uniform image viewport; pixelated is lowered to nearest-neighbor sampling where the renderer can guarantee it.",
    "fixtureUrl": "/docs/html-compiler/fixtures/media/object-fit-fill-rendering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.media.object-fit-none-clipping",
    "phase": "P0",
    "topic": "Media",
    "label": "Media / none + clipping",
    "properties": [
      "img",
      "object-fit: none",
      "object-position",
      "overflow: hidden"
    ],
    "hint": "None keeps the intrinsic image scale and relies on the image viewport plus its overflow-hidden parent for deterministic clipping.",
    "fixtureUrl": "/docs/html-compiler/fixtures/media/object-fit-none-clipping.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.text-align-values",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / text-align values",
    "properties": [
      "text-align",
      "start",
      "end",
      "left",
      "right",
      "center",
      "justify",
      "match-parent",
      "justify-all"
    ],
    "hint": "Eight CSS text-align inputs are normalized into the Neonix JSON V2 text layout contract; match-parent resolves to left for the compiler's fixed LTR text and justify-all preserves its base justify alignment.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/text-align-values.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.text-spacing-whitespace",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / spacing and white-space",
    "properties": [
      "letter-spacing",
      "word-spacing",
      "white-space",
      "normal",
      "nowrap",
      "pre",
      "pre-wrap",
      "pre-line",
      "break-spaces"
    ],
    "hint": "CSS letter-spacing and word-spacing are lowered into text spans; white-space preserves or collapses source whitespace before runtime wrapping and shaping.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/text-spacing-whitespace.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.direction-writing-decoration",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / direction, writing-mode and decoration",
    "properties": [
      "direction",
      "ltr",
      "rtl",
      "writing-mode",
      "horizontal-tb",
      "vertical-rl",
      "vertical-lr",
      "text-decoration",
      "underline",
      "overline",
      "line-through"
    ],
    "hint": "CSS direction and writing-mode are emitted on the text source; text-decoration is lowered into Neonix JSON V2 decoration paints and thickness.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/direction-writing-decoration.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.font-family-three-fonts",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / three font families",
    "properties": [
      "font-family",
      "font-size",
      "font-weight",
      "Inter",
      "Lora",
      "Roboto"
    ],
    "hint": "Three exact font assets are resolved from the ordered CSS family and weight, then emitted as semantic Neonix JSON V2 text layers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/font-family-three-fonts.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.emoji-fallback",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / emoji fallback",
    "properties": [
      "emoji",
      "emoji with text",
      "three emoji",
      "font-family"
    ],
    "hint": "Emoji glyphs use the explicit Noto Color Emoji fallback while the mixed line keeps Inter as its primary text face.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/emoji-fallback.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.weight-fallback",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / CSS weight fallback",
    "properties": [
      "font-family",
      "font-weight",
      "600 → 700 fallback"
    ],
    "hint": "When a requested CSS weight is unavailable, the compiler selects the deterministic nearest catalog face and records its asset ID.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/weight-fallback.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.family-fallback",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / family fallback",
    "properties": [
      "font-family",
      "ordered fallback",
      "catalog lookup"
    ],
    "hint": "A missing user-like family is skipped and the next concrete system family is selected without relying on browser-installed fonts.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/family-fallback.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.style-stretch",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / style + stretch",
    "properties": [
      "font-style",
      "font-stretch",
      "italic",
      "condensed",
      "weight 400",
      "weight 700"
    ],
    "hint": "Style and stretch are semantic span values; the two condensed lines prove that weight 400 and 700 resolve to different catalog faces.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/style-stretch.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.line-height-short",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / line-height short paragraph",
    "properties": [
      "line-height",
      "paragraph",
      "short",
      "64px"
    ],
    "hint": "A short paragraph with an explicit line-height is lowered to a numeric line box in composition pixels.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/line-height-short.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.line-height-normal",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / line-height normal",
    "properties": [
      "line-height",
      "paragraph",
      "normal",
      "1.2 normalization"
    ],
    "hint": "The CSS normal keyword is normalized deterministically to 1.2 times the computed font size.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/line-height-normal.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.line-height-long",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / line-height long paragraph",
    "properties": [
      "line-height",
      "paragraph",
      "long",
      "1.75"
    ],
    "hint": "A longer paragraph uses a unitless line-height, which the compiler resolves against the computed font size.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/line-height-long.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.text-overflow-ellipsis",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / text-overflow ellipsis",
    "properties": [
      "text-overflow",
      "ellipsis",
      "overflow",
      "nowrap",
      "deterministic clipping"
    ],
    "hint": "Ellipsis is emitted only for a clipped single-line text box; the runtime trims grapheme clusters before shaping the final ellipsis glyph.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/text-overflow-ellipsis.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.typography.text-rendering-capability",
    "phase": "P0",
    "topic": "Typography",
    "label": "Typography / text-rendering capability",
    "properties": [
      "text-rendering",
      "auto",
      "optimizeSpeed",
      "geometricPrecision"
    ],
    "hint": "The authored rendering intent is preserved in Neonix JSON V2; optimizeSpeed may use a mask while geometricPrecision selects vector glyphs.",
    "fixtureUrl": "/docs/html-compiler/fixtures/typography/text-rendering-capability.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.svg-stroke-dasharray-odd-count",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / odd-length stroke-dasharray",
    "properties": [
      "stroke-dasharray",
      "odd length",
      "spec repeat"
    ],
    "hint": "An odd-length stroke-dasharray (3 values) is repeated once to become even-length per spec before reaching Skia's PathEffect.MakeDash, which otherwise throws on a raw odd-length array.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/stroke-dasharray-odd-count.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_TAG_LOWERING_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.tags.document-shell-container",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / document shell + containers",
    "properties": [
      "html",
      "head",
      "meta",
      "body",
      "section",
      "article",
      "div",
      "group"
    ],
    "hint": "The document shell is non-visual; section and article remain container aliases and lower through CSS into groups or shape layers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/document-shell-container.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.text-lowering",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / text elements",
    "properties": [
      "h1",
      "p",
      "strong",
      "br",
      "text layer",
      "nested text"
    ],
    "hint": "Heading and paragraph tags lower to Protocol text layers; strong remains nested text content and br becomes a newline.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/text-lowering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.media-lowering",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / image + video",
    "properties": [
      "img",
      "video",
      "image layer",
      "video layer",
      "asset registry"
    ],
    "hint": "Image and video tags select media layer lowering and register deterministic Protocol assets instead of becoming generic containers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/media-lowering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.audio-lowering",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / audio track",
    "properties": [
      "audio",
      "audio.tracks",
      "clip",
      "audio asset"
    ],
    "hint": "Audio is non-visual: the tag creates a root Protocol audio track and clip rather than a visual layer.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/audio-lowering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.svg-lowering",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / SVG primitives",
    "properties": [
      "svg",
      "rect",
      "circle",
      "line",
      "polygon",
      "path layers"
    ],
    "hint": "SVG containers remain groups while visual primitives are normalized to canonical path layers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/lowering.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.container-aliases",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / container aliases",
    "properties": [
      "main",
      "header",
      "nav",
      "aside",
      "figure",
      "figcaption",
      "footer",
      "groups"
    ],
    "hint": "Video composition containers share the CSS-driven group/shape lowering contract; their semantic names do not create browser-only layer types.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/container-aliases.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.text-tag-matrix",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / complete text matrix",
    "properties": [
      "h2-h6",
      "span",
      "b",
      "em",
      "i",
      "small",
      "blockquote",
      "pre",
      "code"
    ],
    "hint": "All supported text tags lower to semantic Protocol text layers while tag defaults and whitespace-sensitive tags remain visible in computed style.",
    "fixtureUrl": "/docs/html-compiler/fixtures/tags/text-tag-matrix.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.tags.svg-primitive-matrix",
    "phase": "P0",
    "category": "HTML tag lowering",
    "topic": "HTML tags",
    "label": "Tag lowering / SVG path matrix",
    "properties": [
      "g",
      "path",
      "ellipse",
      "polyline",
      "nested group",
      "path layers"
    ],
    "hint": "Nested SVG groups preserve the parent coordinate space while path, ellipse and polyline primitives lower to independent Protocol path layers.",
    "fixtureUrl": "/docs/html-compiler/fixtures/svg/primitive-matrix.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.text.compiler.br-hard-break",
    "phase": "P0",
    "category": "Text compiler & layout",
    "topic": "Typography",
    "label": "Text compiler / br hard break",
    "properties": [
      "br",
      "source newline",
      "normal whitespace",
      "text layer"
    ],
    "hint": "The compiler must preserve a <br> as a semantic hard break while keeping normal whitespace collapsing available to the runtime.",
    "fixtureUrl": "/docs/html-compiler/fixtures/text/compiler-br-hard-break.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.compiler.nested-inline-content",
    "phase": "P0",
    "category": "Text compiler & layout",
    "topic": "Typography",
    "label": "Text compiler / nested inline content",
    "properties": [
      "p",
      "strong",
      "em",
      "style spans",
      "text layer"
    ],
    "hint": "Nested inline tags contribute text content to one semantic text layer while preserving source order, character ranges and per-span font semantics.",
    "fixtureUrl": "/docs/html-compiler/fixtures/text/compiler-nested-inline-content.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.compiler.whitespace-contract",
    "phase": "P0",
    "category": "Text compiler & layout",
    "topic": "Typography",
    "label": "Text compiler / whitespace contract",
    "properties": [
      "normal",
      "pre",
      "source whitespace",
      "wrap policy"
    ],
    "hint": "The compiler emits the source text and computed whitespace mode separately so normal and pre layout can be evaluated without conflating source newlines with hard breaks.",
    "fixtureUrl": "/docs/html-compiler/fixtures/text/compiler-whitespace-contract.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.layout.fixed-line-height",
    "phase": "P1.4",
    "category": "Text compiler & layout",
    "topic": "Layout",
    "label": "Text layout / fixed line-height",
    "properties": [
      "br",
      "fixed frame",
      "line-height",
      "baseline"
    ],
    "hint": "Explicit line-height and hard breaks produce deterministic line boxes inside a fixed text frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/text/layout-fixed-line-height.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.layout.wrap-width",
    "phase": "P1.4",
    "category": "Text compiler & layout",
    "topic": "Layout",
    "label": "Text layout / fixed width wrapping",
    "properties": [
      "fixed width",
      "word wrapping",
      "content width",
      "line count"
    ],
    "hint": "A constrained width creates multiple runtime line boxes while the Protocol frame remains the authored fixed width.",
    "fixtureUrl": "/docs/html-compiler/fixtures/text/layout-wrap-width.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.text.layout.auto-height",
    "phase": "P1.4",
    "category": "Text compiler & layout",
    "topic": "Layout",
    "label": "Text layout / auto-height wrapping",
    "properties": [
      "height:auto",
      "fixed-width-auto-height",
      "intrinsic height",
      "wrapping"
    ],
    "hint": "When width is authored but height is auto, compiler layout estimates the wrapped text height and emits a usable frame for runtime shaping.",
    "fixtureUrl": "/docs/html-compiler/fixtures/text/layout-auto-height.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_ANCHOR_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.anchor-positioning",
    "phase": "P0",
    "category": "Layout primitives",
    "topic": "Layout",
    "label": "Layout / CSS anchor positioning",
    "properties": [
      "anchor-name",
      "position-anchor",
      "anchor()",
      "anchor-size()"
    ],
    "hint": "The label is positioned from the subject's right edge and inherits its width through compiler-side anchor resolution.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/anchor-positioning.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PHASE1_1_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.flex-row-fixed",
    "phase": "P1.1",
    "topic": "Layout",
    "label": "Layout / flex row",
    "properties": [
      "display:flex",
      "flex-direction:row",
      "fixed items"
    ],
    "hint": "A single-line row places fixed-size children in source order inside the composition frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-row-fixed.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.flex-column-gap",
    "phase": "P1.1",
    "topic": "Layout",
    "label": "Layout / column + gap",
    "properties": [
      "flex-direction:column",
      "gap",
      "row-gap",
      "column-gap"
    ],
    "hint": "A column uses the main-axis gap between fixed-size items; wrapping is intentionally outside this primitive case.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-column-gap.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.flex-justify-align",
    "phase": "P1.1",
    "topic": "Layout",
    "label": "Layout / justify + align",
    "properties": [
      "justify-content:space-between",
      "align-items:center",
      "align-self"
    ],
    "hint": "Main-axis distribution and cross-axis centering resolve to explicit composition coordinates.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-justify-align.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.flex-grow-shrink",
    "phase": "P1.1",
    "topic": "Layout",
    "label": "Layout / flex grow + shrink",
    "properties": [
      "flex",
      "flex-grow",
      "flex-shrink",
      "flex-basis"
    ],
    "hint": "The flex shorthand expands to grow, shrink and basis before free space is distributed.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-grow-shrink.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.flex-order",
    "phase": "P1.1",
    "topic": "Layout",
    "label": "Layout / order",
    "properties": [
      "order",
      "source order",
      "paint order"
    ],
    "hint": "Order changes the flex placement sequence while the lowered layers retain deterministic paint ordering.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-order.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PHASE1_2_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.flex-wrap-lines",
    "phase": "P1.2",
    "topic": "Layout",
    "label": "Layout / flex wrap lines",
    "properties": [
      "flex-wrap:wrap",
      "row-gap",
      "column-gap"
    ],
    "hint": "Items form deterministic flex lines when the main-axis content box is full; row and column gaps stay in their CSS axes.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-wrap-lines.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.flex-align-content",
    "phase": "P1.2",
    "topic": "Layout",
    "label": "Layout / align-content",
    "properties": [
      "align-content:space-between",
      "multi-line alignment",
      "align-items:center"
    ],
    "hint": "After line formation, align-content distributes the remaining cross-axis space between flex lines.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-align-content.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.flex-wrap-reverse",
    "phase": "P1.2",
    "topic": "Layout",
    "label": "Layout / wrap-reverse",
    "properties": [
      "flex-wrap:wrap-reverse",
      "cross-axis reversal",
      "align-self"
    ],
    "hint": "wrap-reverse reverses the cross-axis line order while IDs and source order remain stable.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-wrap-reverse.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PHASE1_3_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.grid-explicit-columns",
    "phase": "P1.3",
    "topic": "Layout",
    "label": "Layout / grid columns",
    "properties": [
      "display:grid",
      "grid-template-columns",
      "px",
      "%",
      "fr"
    ],
    "hint": "Explicit px and fr columns resolve to fixed composition tracks; unassigned children use deterministic row-major placement.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/grid-explicit-columns.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.grid-explicit-placement",
    "phase": "P1.3",
    "topic": "Layout",
    "label": "Layout / grid placement",
    "properties": [
      "grid-column-start/end",
      "grid-row-start/end",
      "explicit cells"
    ],
    "hint": "Explicit grid line placement maps directly to deterministic track rectangles.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/grid-explicit-placement.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.grid-gap-alignment",
    "phase": "P1.3",
    "topic": "Layout",
    "label": "Layout / grid gap + alignment",
    "properties": [
      "gap",
      "place-items",
      "justify-content",
      "align-content"
    ],
    "hint": "Track gaps, track-area alignment and item alignment are resolved independently inside the composition content box.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/grid-gap-alignment.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.grid-spans",
    "phase": "P1.3",
    "topic": "Layout",
    "label": "Layout / grid spans",
    "properties": [
      "grid-column",
      "grid-row",
      "span"
    ],
    "hint": "The grid shorthand and span syntax expand to explicit start/end lines before the item is lowered.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/grid-spans.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PHASE1_4_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.flex-order-minmax",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / flex order + min-max",
    "properties": [
      "order",
      "min-width",
      "max-width",
      "flex distribution"
    ],
    "hint": "Flex order is applied before placement and min/max constraints are enforced after free-space distribution.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/flex-order-minmax.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.grid-order",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / grid order",
    "properties": [
      "order",
      "grid auto-placement",
      "stable ids"
    ],
    "hint": "Grid auto-placement follows the order-modified sequence while the source IDs remain stable in Neonix JSON V2.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/grid-order.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.relative-margins",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / relative + margins",
    "properties": [
      "position:relative",
      "relative offset",
      "non-collapsing margins"
    ],
    "hint": "Relative offsets move the painted item after its flex slot is resolved; adjacent flex margins are summed, not collapsed.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/relative-margins.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.contents-parent",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / contents parent",
    "properties": [
      "display:contents",
      "grid parent",
      "parent layer"
    ],
    "hint": "A display:contents wrapper contributes no layer; its visual child is placed and parented directly under the formatting context.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/contents-parent.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.containing-block-clip",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / containing block + clip",
    "properties": [
      "absolute child",
      "flex containing block",
      "overflow:hidden"
    ],
    "hint": "A flex container establishes the absolute child's containing block and its overflow clip remains attached to the parent group.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/containing-block-clip.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_LAYOUT_TEXT_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.layout.text-frame-baseline",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text frame baseline",
    "properties": [
      "div text",
      "line box",
      "content box",
      "baseline"
    ],
    "hint": "The element frame remains layout geometry while glyphs are painted from the content line box and baseline.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-frame-baseline.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-border-uniform",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text + uniform border",
    "properties": [
      "div text",
      "border",
      "border-box frame",
      "content origin"
    ],
    "hint": "A uniform border paints around the resolved border-box frame and is not added a second time by the runtime.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-border-uniform.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-border-asymmetric",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text + asymmetric border",
    "properties": [
      "border-top/right/bottom/left",
      "different widths",
      "content origin"
    ],
    "hint": "Different border widths move the content origin by each corresponding edge while the final frame remains one border box.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-border-asymmetric.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-border-padding",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text + padding + border",
    "properties": [
      "padding",
      "border",
      "content box",
      "baseline offset"
    ],
    "hint": "Padding separates the glyph line box from the border, and both contribute to the border-box frame without changing glyph metrics.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-border-padding.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-content-box",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text content-box sizing",
    "properties": [
      "box-sizing:content-box",
      "width",
      "padding",
      "border expansion"
    ],
    "hint": "With content-box sizing, authored width excludes padding and border; the emitted frame expands to the complete border box.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-content-box.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-border-box",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text border-box sizing",
    "properties": [
      "box-sizing:border-box",
      "width",
      "padding",
      "border inclusion"
    ],
    "hint": "With border-box sizing, authored width is the final border-box width; padding and border reduce the available content width.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-border-box.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-line-height-normal",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text normal line-height",
    "properties": [
      "line-height:normal",
      "font metrics",
      "line box",
      "border"
    ],
    "hint": "Normal line-height resolves from selected font metrics and remains distinct from the visible glyph bounds.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-line-height-normal.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-line-height-fixed",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text fixed line-height",
    "properties": [
      "line-height:88px",
      "line box",
      "baseline",
      "border"
    ],
    "hint": "A fixed line-height changes the line box and baseline placement while glyph bounds remain independent paint geometry.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-line-height-fixed.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-wrapping-border",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / wrapped text inside border",
    "properties": [
      "width",
      "white-space:normal",
      "line wrapping",
      "border-box"
    ],
    "hint": "Wrapping happens inside the content box; the border stays outside the line boxes and the final frame includes every wrapped line.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-wrapping-border.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.layout.text-border-radius",
    "phase": "P1.4",
    "topic": "Layout",
    "label": "Layout / text + rounded border",
    "properties": [
      "border-radius",
      "border",
      "content box",
      "rounded border-box"
    ],
    "hint": "The rounded border follows the same border-box frame as text layout; radius changes paint contours, not frame dimensions.",
    "fixtureUrl": "/docs/html-compiler/fixtures/layout/text-border-radius.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_0_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.background-image-position-size",
    "phase": "P2.0",
    "topic": "Paint",
    "label": "Paint / background image position + size",
    "properties": [
      "background-image",
      "background-position",
      "background-size",
      "no-repeat"
    ],
    "hint": "A URL background is lowered to an image atomic with deterministic cover sizing, center positioning and a border-box clip.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/background-image-position-size.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.background-origin-clip",
    "phase": "P2.0",
    "topic": "Paint",
    "label": "Paint / background origin + clip",
    "properties": [
      "background-origin",
      "background-clip",
      "padding-box",
      "content-box"
    ],
    "hint": "The image is positioned from the padding box while its paint is clipped to the content box inside an explicit border and padding.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/background-origin-clip.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.background-image-repeat",
    "phase": "P2.0",
    "topic": "Paint",
    "label": "Paint / background image repeat",
    "properties": [
      "background-image",
      "background-size",
      "repeat-x",
      "repeat-y",
      "clip"
    ],
    "hint": "An explicitly sized image is tiled into bounded image atomics and each tile is clipped to the owner paint box.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/background-image-repeat.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.background-image-list",
    "phase": "P2.0",
    "topic": "Paint",
    "label": "Paint / background image layers",
    "properties": [
      "multiple URL layers",
      "layer order",
      "position list",
      "size list"
    ],
    "hint": "CSS image layers retain their authored order while the compiler emits independent image atomics above the solid base paint.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/background-image-list.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.image-function-url",
    "phase": "P2.0",
    "topic": "Paint",
    "label": "Paint / image() URL source",
    "properties": [
      "image()",
      "url()",
      "asset layer",
      "cover"
    ],
    "hint": "The image() URL source remains an image atomic with the same position, sizing and clipping contract as a direct background URL.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/image-function-url.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.image-function-gradient-fallback",
    "phase": "P2.0",
    "topic": "Paint",
    "label": "Paint / image() gradient + fallback",
    "properties": [
      "image()",
      "gradient",
      "fallback color",
      "paint source"
    ],
    "hint": "A gradient image candidate is lowered to a paint shape; the fallback color remains available without introducing a synthetic asset source.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/image-function-gradient-fallback.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.cross-fade-images",
    "phase": "P2.0",
    "topic": "Paint",
    "label": "Paint / cross-fade() image sources",
    "properties": [
      "cross-fade()",
      "two URL sources",
      "opacity weights",
      "stable order"
    ],
    "hint": "The two cross-fade sources become ordered image atomics with complementary opacity weights, preserving the CSS source order.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/cross-fade-images.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_9_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.color-srgb-primaries",
    "phase": "P2.9",
    "topic": "Paint",
    "label": "Paint / sRGB primaries, secondaries, gray, alpha and animated color",
    "properties": [
      "background",
      "rgba()",
      "display: grid",
      "animation-name (color)"
    ],
    "hint": "A CSS grid of solid-fill rects covers the full RGB primary/secondary set plus black, white and 50% gray for sRGB fidelity, one cell composites a 50%-alpha rect over a solid backdrop, and one cell animates background-color to exercise track-based color interpolation. Also exercises grid layout placement (11 cells, 4 columns).",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/color-srgb-primaries.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_OPACITY_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.opacity.image",
    "phase": "P2.0",
    "category": "Paint primitives",
    "topic": "Paint",
    "label": "Opacity / image",
    "properties": [
      "img",
      "opacity: 0.48",
      "source-over",
      "image asset"
    ],
    "hint": "A photographic image is composited over a solid card at fractional opacity so image alpha, sampling and source-over blending can be compared directly.",
    "fixtureUrl": "/docs/html-compiler/fixtures/opacity/image.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.opacity.grid",
    "phase": "P2.0",
    "category": "Paint primitives",
    "topic": "Paint",
    "label": "Opacity / grid",
    "properties": [
      "display: grid",
      "repeating-linear-gradient",
      "opacity: 0.42",
      "child compositing"
    ],
    "hint": "A grid container and its child cells share one fractional opacity boundary, while thin repeating lines expose coverage and alpha differences.",
    "fixtureUrl": "/docs/html-compiler/fixtures/opacity/grid.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.opacity.shape",
    "phase": "P2.0",
    "category": "Paint primitives",
    "topic": "Paint",
    "label": "Opacity / shape",
    "properties": [
      "rectangle",
      "ellipse",
      "border-radius",
      "independent opacity"
    ],
    "hint": "Overlapping rectangle and ellipse shapes use independent opacity values, making solid paint alpha and overlap compositing easy to inspect.",
    "fixtureUrl": "/docs/html-compiler/fixtures/opacity/shape.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

/**
 * Kept as its own array purely so every basic gradient fixture (non-repeating
 * here, repeating in PHASE2_1 right after) sits together as one contiguous
 * run in the Paint dropdown, instead of being split across the far larger
 * PHASE0 catalog by unrelated background/image-function fixtures.
 */
export const HTML_COMPILER_PAINT_GRADIENT_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.linear-gradient",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / linear gradient",
    "properties": [
      "linear-gradient",
      "angle",
      "multi-stop",
      "background"
    ],
    "hint": "A multi-stop linear gradient is lowered to semantic stops and a runtime angle in composition pixels.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/linear-gradient.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.linear-gradient-4stop",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / linear gradient (4-stop diagonal)",
    "properties": [
      "linear-gradient",
      "135deg",
      "4-stop",
      "background"
    ],
    "hint": "A 4-stop diagonal (135deg) linear gradient for CanvasKit/native gradient shader parity, distinct from the axis-aligned 3-stop fixture above.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/linear-gradient-4stop.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#000000",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.radial-gradient",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / radial gradient",
    "properties": [
      "radial-gradient",
      "center",
      "multi-stop",
      "background"
    ],
    "hint": "A centered radial gradient preserves its normalized center and color-stop sequence for Neonix JSON V2.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/radial-gradient.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.conic-gradient",
    "phase": "P0",
    "topic": "Paint",
    "label": "Paint / conic gradient",
    "properties": [
      "conic-gradient",
      "from",
      "center",
      "multi-stop"
    ],
    "hint": "A conic gradient uses the Neonix JSON V2 conic primitive with an explicit start angle and normalized center.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/conic-gradient.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_1_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.repeating-linear-gradient",
    "phase": "P2.1",
    "topic": "Paint",
    "label": "Paint / repeating linear gradient",
    "properties": [
      "repeating-linear-gradient",
      "short period",
      "wrap boundary"
    ],
    "hint": "A short normalized stop period repeats across the full paint box while preserving the authored angle.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/repeating-linear-gradient.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.repeating-radial-gradient",
    "phase": "P2.1",
    "topic": "Paint",
    "label": "Paint / repeating radial gradient",
    "properties": [
      "repeating-radial-gradient",
      "off-center",
      "wrap boundary"
    ],
    "hint": "An off-center radial gradient repeats from its normalized center, including samples on both sides of the period.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/repeating-radial-gradient.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.repeating-conic-gradient",
    "phase": "P2.1",
    "topic": "Paint",
    "label": "Paint / repeating conic gradient",
    "properties": [
      "repeating-conic-gradient",
      "from 45deg",
      "off-center"
    ],
    "hint": "The repeating conic primitive keeps its start angle and off-center normalized origin while wrapping through the period.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/repeating-conic-gradient.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.repeating-gradient-background",
    "phase": "P2.1",
    "topic": "Paint",
    "label": "Paint / repeating gradient over solid",
    "properties": [
      "repeating gradient",
      "solid background",
      "layer order"
    ],
    "hint": "The repeating image layer remains above the solid background layer, with both bounded by the same paint box.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/repeating-gradient-background.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_2_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.border-four-sides",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / border four sides",
    "properties": [
      "border-top/right/bottom/left",
      "width",
      "style",
      "color"
    ],
    "hint": "Each border side resolves independently, so width, style and color do not leak across adjacent edges.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-four-sides.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-none-mixed",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / border none mixed",
    "properties": [
      "none",
      "solid",
      "per-side resolution"
    ],
    "hint": "A none side contributes no visible border while neighboring solid sides remain deterministic.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-none-mixed.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-dashed-dotted",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / dashed + dotted border",
    "properties": [
      "dashed",
      "dotted",
      "stroke dash",
      "side paths"
    ],
    "hint": "Dashed and dotted borders lower to fitted edge fragments: rectangles for dashes and ellipses for dots.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-dashed-dotted.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-double",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / double border",
    "properties": [
      "double",
      "stroke",
      "stable side order"
    ],
    "hint": "The double style becomes two deterministic inset strokes on each side; it does not change the layout frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-double.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-groove",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / groove border",
    "properties": [
      "groove",
      "deterministic shading",
      "paint bands"
    ],
    "hint": "Groove is lowered to two fixed-lighting bands per side; the shading is paint-only and does not change the layout frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-groove.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-ridge",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / ridge border",
    "properties": [
      "ridge",
      "deterministic shading",
      "paint bands"
    ],
    "hint": "Ridge reverses the fixed groove lighting contract while preserving the same border geometry.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-ridge.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-inset",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / inset border",
    "properties": [
      "inset",
      "side shading",
      "paint-only"
    ],
    "hint": "Inset applies the fixed recessed side shading contract without adding border width to layout twice.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-inset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-outset",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / outset border",
    "properties": [
      "outset",
      "side shading",
      "paint-only"
    ],
    "hint": "Outset applies the inverse fixed side shading contract and keeps the authored box geometry unchanged.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-outset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-radius-uniform",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / uniform radius",
    "properties": [
      "border-radius",
      "uniform",
      "clamped corners"
    ],
    "hint": "A single radius remains the compact rectangle atom and is clamped to half of the resolved box dimensions.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-radius-uniform.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-radius-per-corner",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / per-corner radius",
    "properties": [
      "border-radius",
      "four corners",
      "path contour"
    ],
    "hint": "Four independent corner radii are clamped by adjacent sums and lowered to a rounded path contour.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-radius-per-corner.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-radius-elliptical",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / elliptical radius",
    "properties": [
      "border-radius",
      "horizontal / vertical radii",
      "ellipse arcs"
    ],
    "hint": "The slash form resolves horizontal radii against width and vertical radii against height before CSS adjacent-sum clamping.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-radius-elliptical.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-dashed-corner-fit",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / dashed border corner fit",
    "properties": [
      "dashed",
      "sharp corners",
      "corner fit"
    ],
    "hint": "A whole number of fixed-length dashes is anchored at both ends of every edge, so every sharp corner sits fully solid instead of alternating filled/notched.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-dashed-corner-fit.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-dotted-corner-fit",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / dotted border corner fit",
    "properties": [
      "dotted",
      "sharp corners",
      "corner fit"
    ],
    "hint": "A whole number of fixed-diameter dots is anchored at both ends of every edge, so every sharp corner sits under a full dot instead of alternating filled/notched.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-dotted-corner-fit.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-dashed-rounded",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / dashed rounded border",
    "properties": [
      "dashed",
      "border-radius",
      "closed path",
      "strokeDash"
    ],
    "hint": "A rounded dashed border lowers to one continuous rounded-rect path carrying a real strokeDash, not 4 straight lines clipped by the box's own rounded mask.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-dashed-rounded.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.border-rounded-pill-stroke",
    "phase": "P2.2",
    "topic": "Paint",
    "label": "Paint / rounded pill dashed + dotted",
    "properties": [
      "dashed",
      "dotted",
      "border-radius",
      "closed perimeter",
      "pill shape"
    ],
    "hint": "A near-pill radius makes the rounded border a fully closed loop: the dash/dot count and gap must scale with the true perimeter so the pattern closes onto itself with no seam at the path's start, and the dotted round-cap dot must stay a circle, not stretch into a capsule.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/border-rounded-pill-stroke.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_3_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.outline-layout-preserving",
    "phase": "P2.3",
    "topic": "Paint",
    "label": "Paint / outline preserves layout",
    "properties": [
      "outline",
      "no layout space",
      "sibling position"
    ],
    "hint": "The outline expands only the paint bounds; the flex sibling keeps the same layout slot and gap.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/outline-layout-preserving.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.outline-offsets",
    "phase": "P2.3",
    "topic": "Paint",
    "label": "Paint / outline offsets",
    "properties": [
      "outline-width",
      "outline-style",
      "outline-color",
      "outline-offset"
    ],
    "hint": "Positive offset moves the outline outward and negative offset moves it into the border box without changing either frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/outline-offsets.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.outline-per-corner-radius",
    "phase": "P2.3",
    "topic": "Paint",
    "label": "Paint / outline around per-corner radius",
    "properties": [
      "outline",
      "outline-offset",
      "per-corner radius"
    ],
    "hint": "The outline reuses the normalized four-corner geometry and follows the same elliptical corner radii without changing layout.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/outline-per-corner-radius.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_4_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.box-shadow",
    "phase": "P2.4",
    "topic": "Paint",
    "label": "Paint / box shadow",
    "properties": [
      "box-shadow",
      "offset",
      "blur",
      "color"
    ],
    "hint": "A box shadow is lowered to the Neonix JSON V2 box shadow effect without changing the owner's frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/box-shadow.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.box-shadow-list",
    "phase": "P2.4",
    "topic": "Paint",
    "label": "Paint / multiple box shadows",
    "properties": [
      "box-shadow",
      "comma list",
      "source order"
    ],
    "hint": "Comma-separated box shadows remain separate ordered effects in the normalized layer contract.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/box-shadow-list.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.text-shadow",
    "phase": "P2.4",
    "topic": "Paint",
    "label": "Paint / text shadow",
    "properties": [
      "text-shadow",
      "alpha source",
      "blur"
    ],
    "hint": "Text shadow uses the text alpha silhouette, so the shadow follows glyphs and fallback-font runs.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/text-shadow.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.text-shadow-alpha",
    "phase": "P2.4",
    "topic": "Paint",
    "label": "Paint / text shadow alpha silhouette",
    "properties": [
      "text-shadow",
      "alpha source",
      "zero blur"
    ],
    "hint": "A zero-blur text shadow isolates the glyph alpha silhouette and tint from the blur kernel.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/text-shadow-alpha.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.text-shadow-blur",
    "phase": "P2.4",
    "topic": "Paint",
    "label": "Paint / text shadow blur",
    "properties": [
      "text-shadow",
      "alpha source",
      "blur only"
    ],
    "hint": "A centered text shadow isolates the CSS blur radius-to-sigma conversion.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/text-shadow-blur.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.text-shadow-offset",
    "phase": "P2.4",
    "topic": "Paint",
    "label": "Paint / text shadow offset",
    "properties": [
      "text-shadow",
      "alpha source",
      "offset only"
    ],
    "hint": "A zero-blur offset shadow isolates translation and compositing from the blur kernel.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/text-shadow-offset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_5_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.filter-blur",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter blur",
    "properties": [
      "filter",
      "blur()",
      "spatial effect"
    ],
    "hint": "CSS blur lowers to an ordered blur operator over the element surface without changing its layout frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/blur.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-brightness",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter brightness",
    "properties": [
      "filter",
      "brightness()",
      "color-adjust"
    ],
    "hint": "Brightness is lowered to the existing color-adjust atom as an exact channel multiplication for the supported range.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/brightness.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-contrast",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter contrast",
    "properties": [
      "filter",
      "contrast()",
      "color-adjust"
    ],
    "hint": "Contrast lowers to a color-adjust operator and remains in the authored filter position.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/contrast.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-grayscale",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter grayscale",
    "properties": [
      "filter",
      "grayscale()",
      "color matrix"
    ],
    "hint": "Grayscale lowers to a runtime color-matrix operator with its own input and output surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/grayscale.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-sepia",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter sepia",
    "properties": [
      "filter",
      "sepia()",
      "color matrix"
    ],
    "hint": "Sepia is represented as an interpolated color matrix rather than a backend-specific shader shortcut.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/sepia.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-invert",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter invert",
    "properties": [
      "filter",
      "invert()",
      "color matrix"
    ],
    "hint": "Invert lowers to the ordered color-matrix path and keeps partial amounts deterministic.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/invert.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-opacity-layer-opacity",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter opacity vs layer opacity",
    "properties": [
      "filter",
      "opacity()",
      "layer opacity",
      "separate alpha stages"
    ],
    "hint": "filter:opacity() is an ordered source-surface alpha operator; CSS opacity remains the layer alpha and is not merged into it.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/opacity-layer-opacity.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-drop-shadow",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter drop shadow",
    "properties": [
      "filter",
      "drop-shadow()",
      "alpha shadow"
    ],
    "hint": "drop-shadow() uses the element alpha silhouette, unlike box-shadow which uses the box geometry atom.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/drop-shadow.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-drop-shadow-alpha",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter drop shadow alpha silhouette",
    "properties": [
      "filter",
      "drop-shadow()",
      "alpha silhouette",
      "zero blur"
    ],
    "hint": "A zero-blur drop shadow still follows the rounded alpha silhouette and keeps the filter separate from layer opacity.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/drop-shadow-alpha.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-drop-shadow-blur",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter drop shadow blur",
    "properties": [
      "filter",
      "drop-shadow()",
      "alpha silhouette",
      "blur"
    ],
    "hint": "The blur-only drop shadow uses the element alpha silhouette rather than the rectangular box geometry.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/drop-shadow-blur.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-drop-shadow-offset",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / filter drop shadow offset",
    "properties": [
      "filter",
      "drop-shadow()",
      "alpha silhouette",
      "offset"
    ],
    "hint": "The offset-only drop shadow makes the alpha-source translation observable without changing the blur radius.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/drop-shadow-offset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-color-chain",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / consecutive color filters",
    "properties": [
      "brightness()",
      "contrast()",
      "invert()",
      "ordered list"
    ],
    "hint": "Consecutive color filters remain separate ordered atoms; a backend may fuse only when that preserves the same order.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/color-chain.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-blur-between-colors",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / blur between color filters",
    "properties": [
      "brightness()",
      "blur()",
      "contrast()",
      "spatial order"
    ],
    "hint": "The blur remains between the two color operators; it is never reordered into a fused color-only pass.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/blur-between-colors.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.filter-drop-shadow-after-blur",
    "phase": "P2.5",
    "topic": "Paint",
    "label": "Paint / drop shadow after blur",
    "properties": [
      "blur()",
      "drop-shadow()",
      "source/output surfaces"
    ],
    "hint": "The drop shadow samples the preceding blurred surface, proving that spatial filter order is preserved end to end.",
    "fixtureUrl": "/docs/html-compiler/fixtures/effect/drop-shadow-after-blur.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_6_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.blend-multiply",
    "phase": "P2.6",
    "topic": "Paint",
    "label": "Paint / multiply over colored background",
    "properties": [
      "mix-blend-mode: multiply",
      "colored backdrop",
      "composite"
    ],
    "hint": "The layer is isolated for compositing and blends with the colored backdrop without changing its layout order.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/blend-multiply.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.blend-sibling-order",
    "phase": "P2.6",
    "topic": "Paint",
    "label": "Paint / sibling blend modes",
    "properties": [
      "multiply",
      "screen",
      "sibling order",
      "backdrop"
    ],
    "hint": "Two overlapping siblings keep their source order while each blend mode samples the backdrop at its own paint position.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/blend-sibling-order.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.blend-isolated-group",
    "phase": "P2.6",
    "topic": "Paint",
    "label": "Paint / isolated group with child blend",
    "properties": [
      "isolation: isolate",
      "group boundary",
      "child blend"
    ],
    "hint": "The group forms an offscreen compositing boundary, so the child blends with the group backdrop rather than an outside sibling.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/blend-isolated-group.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.blend-opacity-filter",
    "phase": "P2.6",
    "topic": "Paint",
    "label": "Paint / blend with opacity and filter",
    "properties": [
      "mix-blend-mode: screen",
      "opacity",
      "filter",
      "offscreen group"
    ],
    "hint": "Layer opacity is applied at the compositing boundary while the filter remains an ordered effect program inside that boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/blend-opacity-filter.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.blend-mode-matrix",
    "phase": "P2.6",
    "topic": "Paint",
    "label": "Paint / blend mode matrix (16 modes)",
    "properties": [
      "normal", "darken", "multiply", "color-burn",
      "lighten", "screen", "color-dodge", "overlay",
      "soft-light", "hard-light", "difference", "exclusion",
      "hue", "saturation", "color", "luminosity"
    ],
    "hint": "Every mix-blend-mode value (including normal, multiply and screen, which also have dedicated combined fixtures elsewhere) laid out as one clean 4x4 grid over a shared gradient backdrop, so each mode's compositing math is independently comparable with no other confounding variable (isolation/opacity/sibling order) — the reference oracle for CanvasKit vs native-Skia blendMode parity.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/blend-mode-matrix.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#0f172a",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_7_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.clip-inset-round",
    "phase": "P2.7",
    "topic": "Paint",
    "label": "Paint / clip-path inset round",
    "properties": [
      "clip-path: inset()",
      "round corner",
      "reference box"
    ],
    "hint": "An inset clip lowers to a normalized rounded local path without creating a mask alpha surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/clip-inset-round.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.clip-circle-offset",
    "phase": "P2.7",
    "topic": "Paint",
    "label": "Paint / clip-path circle offset center",
    "properties": [
      "clip-path: circle()",
      "percentage center",
      "geometric clip"
    ],
    "hint": "The circle center resolves against the element reference box, not against the composition.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/clip-circle-offset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.clip-ellipse-offset",
    "phase": "P2.7",
    "topic": "Paint",
    "label": "Paint / clip-path ellipse offset center",
    "properties": [
      "clip-path: ellipse()",
      "independent radii",
      "percentage center"
    ],
    "hint": "Horizontal and vertical radii resolve independently while the center stays in local element coordinates.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/clip-ellipse-offset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.clip-polygon-three",
    "phase": "P2.7",
    "topic": "Paint",
    "label": "Paint / clip-path polygon three points",
    "properties": [
      "clip-path: polygon()",
      "3 points",
      "normalized percentages"
    ],
    "hint": "A triangle is lowered as one closed path contour with percentage points resolved in the border box.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/clip-polygon-three.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.clip-polygon-five",
    "phase": "P2.7",
    "topic": "Paint",
    "label": "Paint / clip-path polygon five points",
    "properties": [
      "clip-path: polygon()",
      "5 points",
      "closed path"
    ],
    "hint": "A five-point polygon remains one deterministic contour and keeps source point order.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/clip-polygon-five.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.clip-polygon-six",
    "phase": "P2.7",
    "topic": "Paint",
    "label": "Paint / clip-path polygon six points",
    "properties": [
      "clip-path: polygon()",
      "6 points",
      "closed path"
    ],
    "hint": "A six-point polygon exercises the general point-list lowering path independently from the triangle and pentagon cases.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/clip-polygon-six.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.clip-path-hole-evenodd",
    "phase": "P2.7",
    "topic": "Paint",
    "label": "Paint / clip-path path hole evenodd",
    "properties": [
      "clip-path: path()",
      "evenodd",
      "hole contour"
    ],
    "hint": "The path keeps two closed contours and lowers evenodd as geometric fill semantics, so the inner contour remains a hole.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/clip-path-hole-evenodd.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.clip-transform-overflow",
    "phase": "P2.7",
    "topic": "Paint",
    "label": "Paint / clip-path with transform and overflow",
    "properties": [
      "clip-path",
      "transform",
      "overflow: hidden",
      "intersection"
    ],
    "hint": "The geometric clip and overflow rectangle are intersected in one layer scope before the transformed subtree is composited.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/clip-transform-overflow.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PAINT_PHASE2_8_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.paint.mask-alpha-gradient",
    "phase": "P2.8",
    "topic": "Paint",
    "label": "Paint / alpha mask gradient",
    "properties": [
      "mask-image",
      "linear-gradient",
      "mask-mode: alpha"
    ],
    "hint": "The gradient is rendered on a private mask surface; its alpha coverage clips the blue rectangle without creating a visible sibling.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/mask-alpha-gradient.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.mask-luminance-image",
    "phase": "P2.8",
    "topic": "Paint",
    "label": "Paint / luminance mask image",
    "properties": [
      "mask-image",
      "asset URL",
      "mask-mode: luminance",
      "mask-size"
    ],
    "hint": "The image asset is registered in Neonix JSON V2 and sampled as luminance coverage inside the mask source surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/mask-luminance-image.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.mask-add-intersect",
    "phase": "P2.8",
    "topic": "Paint",
    "label": "Paint / mask add + intersect",
    "properties": [
      "multiple mask layers",
      "add",
      "intersect",
      "layer order"
    ],
    "hint": "Two authored mask layers remain ordered in JSON: the first is added, then the second intersects the accumulated coverage.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/mask-add-intersect.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.mask-subtract-edge",
    "phase": "P2.8",
    "topic": "Paint",
    "label": "Paint / mask subtract at composition edge",
    "properties": [
      "mask-composite",
      "subtract",
      "composition clipping"
    ],
    "hint": "The subtractive mask operation is evaluated on the private surface before the result is clipped by the composition boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/mask-subtract-edge.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.paint.mask-clip-isolation",
    "phase": "P2.8",
    "topic": "Paint",
    "label": "Paint / mask + clip-path + isolation",
    "properties": [
      "mask-image",
      "clip-path",
      "isolation",
      "mix-blend-mode"
    ],
    "hint": "The mask surface is applied inside the isolated group after clip-path coverage and before the group opacity/blend boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/paint/mask-clip-isolation.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_MOTION_PHASE3_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.motion.opacity-delay-fill",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / opacity + delay + fill",
    "properties": [
      "@keyframes",
      "opacity",
      "animation-delay",
      "animation-fill-mode"
    ],
    "hint": "The runtime samples opacity from the shared V2 track, including the backwards delay sample and forwards end sample.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/opacity-delay-fill.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.transform-alternate",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / transform alternate",
    "properties": [
      "transform",
      "translateX",
      "rotate",
      "alternate",
      "cubic-bezier"
    ],
    "hint": "Transform components are typed tracks; alternate reverses the sampled direction on the second iteration.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/transform-alternate.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.steps-color",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / steps color",
    "properties": [
      "background-color",
      "steps()",
      "animation-play-state"
    ],
    "hint": "A color track keeps its typed RGBA values while steps(4, jump-start) produces deterministic discrete plateaus.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/steps-color.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.transform-scale",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / transform scale",
    "properties": [
      "transform",
      "scale",
      "transform-origin"
    ],
    "hint": "A scale track keeps the element's layout frame fixed and applies the declared center pivot at runtime.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/transform-scale.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.transform-rotate-origin",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / rotate percentage origin",
    "properties": [
      "transform",
      "rotate",
      "transform-origin"
    ],
    "hint": "Rotation is sampled around a non-central percentage origin, matching the browser's local pivot.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/transform-rotate-origin.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.background-color-rgba",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / RGBA color",
    "properties": [
      "background-color",
      "RGBA",
      "color track"
    ],
    "hint": "Background color is interpolated as a typed RGBA track, including alpha, instead of a CSS string.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/background-color-rgba.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.frame-size-border-box",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / frame size + border-box",
    "properties": [
      "width",
      "height",
      "box-sizing",
      "frame tracks"
    ],
    "hint": "Width and height animate the V2 frame directly under border-box without changing the element's layout origin.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/frame-size-border-box.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.keyframes-from-to",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / keyframes from + to",
    "properties": [
      "@keyframes",
      "from",
      "to"
    ],
    "hint": "The canonical from/to declaration becomes a two-point opacity track with millisecond timestamps.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/keyframes-from-to.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.keyframes-three-stops",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / keyframes 0 50 100",
    "properties": [
      "0%",
      "50%",
      "100%",
      "ordered stops"
    ],
    "hint": "Three authored offsets remain three ordered runtime keyframes instead of being collapsed to endpoints.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/keyframes-three-stops.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.keyframes-missing-start",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / missing first keyframe",
    "properties": [
      "30%",
      "to",
      "underlying value"
    ],
    "hint": "When 0% is absent, the compiler inserts the element's underlying computed opacity before the first authored offset.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/keyframes-missing-start.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.keyframes-two-names",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / two keyframe names",
    "properties": [
      "animation-name",
      "sibling layers",
      "independent tracks"
    ],
    "hint": "Two sibling layers resolve separate @keyframes definitions without sharing declarations or track state.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/keyframes-two-names.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.keyframes-duplicate-offset",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / duplicate keyframe offset",
    "properties": [
      "duplicate offset",
      "source order",
      "cascade"
    ],
    "hint": "At 50%, the later keyframe block wins for opacity, so the runtime receives one deterministic keyframe at that timestamp.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/keyframes-duplicate-offset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.keyframes-unknown-name",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / unknown animation diagnostic",
    "properties": [
      "animation-name",
      "diagnostic",
      "unsupported reference"
    ],
    "hint": "An animation-name without a matching @keyframes rule is a compiler diagnostic, never a silent no-op.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/keyframes-unknown-name.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.delay-fill-none",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / delay + no fill",
    "properties": [
      "animation-delay",
      "fill-mode: none"
    ],
    "hint": "During the positive delay and after the animation, the underlying opacity remains active because no fill is requested.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/delay-fill-none.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.delay-fill-backwards",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / delay + backwards",
    "properties": [
      "animation-delay",
      "fill-mode: backwards"
    ],
    "hint": "The first keyframe is visible during the positive delay, then the active animation begins at the scheduled time.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/delay-fill-backwards.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.fill-forwards",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / forwards end hold",
    "properties": [
      "animation-fill-mode: forwards",
      "end sample"
    ],
    "hint": "After the active interval, the final keyframe remains applied instead of returning to the underlying opacity.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/fill-forwards.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.fill-both",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / both delay + end",
    "properties": [
      "animation-delay",
      "animation-fill-mode: both"
    ],
    "hint": "Both applies the first keyframe during delay and keeps the final keyframe after completion.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/fill-both.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.delay-negative",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / negative delay",
    "properties": [
      "animation-delay: -350ms",
      "initial progress"
    ],
    "hint": "A negative delay starts the sample inside the animation rather than waiting for a future start time.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/delay-negative.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.play-state-paused",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / play-state paused",
    "properties": [
      "animation-play-state: paused",
      "transport"
    ],
    "hint": "An authored paused animation stays at its initial sample until transport explicitly changes the preview state.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/play-state-paused.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.iteration-two",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / two iterations",
    "properties": [
      "animation-iteration-count: 2",
      "cycle boundary"
    ],
    "hint": "Two complete cycles reuse one normalized keyframe track without duplicating runtime geometry.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/iteration-two.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.iteration-fractional",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / fractional iteration",
    "properties": [
      "animation-iteration-count: 2.5",
      "fractional endpoint"
    ],
    "hint": "A 2.5 iteration animation ends halfway through its third cycle, including at the exact active-duration boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/iteration-fractional.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.iteration-infinite",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / infinite loop",
    "properties": [
      "animation-iteration-count: infinite",
      "loop"
    ],
    "hint": "Infinite playback keeps a bounded track and wraps sampled progress without accumulating timeline drift.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/iteration-infinite.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.direction-normal",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / direction normal",
    "properties": [
      "animation-direction: normal"
    ],
    "hint": "Normal samples each iteration from the first keyframe toward the last keyframe.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/direction-normal.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.direction-reverse",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / direction reverse",
    "properties": [
      "animation-direction: reverse"
    ],
    "hint": "Reverse starts at the last keyframe and samples toward the first keyframe.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/direction-reverse.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.direction-alternate",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / direction alternate",
    "properties": [
      "animation-direction: alternate",
      "iteration boundary"
    ],
    "hint": "Alternate reverses every second iteration while keeping the same authored keyframe sequence.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/direction-alternate.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.direction-alternate-reverse",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / direction alternate-reverse",
    "properties": [
      "animation-direction: alternate-reverse",
      "iteration boundary"
    ],
    "hint": "Alternate-reverse starts reversed, then alternates direction at each iteration boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/direction-alternate-reverse.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-linear",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing linear",
    "properties": [
      "animation-timing-function: linear",
      "opacity"
    ],
    "hint": "Linear easing keeps equal progress between each pair of keyframes.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-linear.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-steps-end",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing steps jump-end",
    "properties": [
      "animation-timing-function: steps(4, jump-end)",
      "discrete plateaus"
    ],
    "hint": "Jump-end holds the current plateau until each step boundary, then advances.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-steps-end.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-steps-start",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing steps jump-start",
    "properties": [
      "animation-timing-function: steps(4, jump-start)",
      "first instant"
    ],
    "hint": "Jump-start advances to the first plateau at the first instant of the active interval.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-steps-start.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-steps-jump-none",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing steps jump-none",
    "properties": [
      "animation-timing-function: steps(5, jump-none)",
      "no start or end plateau"
    ],
    "hint": "Jump-none omits both the first and last plateau, so the value never holds at the boundary steps.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-steps-jump-none.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-steps-jump-both",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing steps jump-both",
    "properties": [
      "animation-timing-function: steps(5, jump-both)",
      "extra plateau at both ends"
    ],
    "hint": "Jump-both adds a plateau at both boundaries, one more discrete step than jump-start or jump-end alone.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-steps-jump-both.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-ease",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing ease keyword",
    "properties": [
      "animation-timing-function: ease",
      "bare keyword easing"
    ],
    "hint": "The bare ease keyword resolves to its canonical cubic-bezier control points, distinct from an author-specified cubic-bezier() function.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-ease.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-cubic-bezier",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing cubic-bezier",
    "properties": [
      "animation-timing-function: cubic-bezier",
      "transform"
    ],
    "hint": "The canonical ease curve is stored as typed cubic-bezier control points in each track.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-cubic-bezier.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-per-segment",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / easing per segment",
    "properties": [
      "keyframe-local timing",
      "steps()",
      "cubic-bezier()"
    ],
    "hint": "Each segment keeps the timing function authored on its starting keyframe; the global value is only the fallback.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-per-segment.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.easing-invalid",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / invalid easing diagnostic",
    "properties": [
      "steps(0)",
      "diagnostic",
      "no silent fallback"
    ],
    "hint": "Invalid step counts and cubic-bezier control points fail compilation with a specific diagnostic.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/easing-invalid.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.combo-transform-opacity",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / transform + opacity",
    "properties": [
      "transform",
      "opacity",
      "one animation"
    ],
    "hint": "Transform and layer opacity remain separate typed tracks while sharing the same animation playback metadata.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-transform-opacity.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.combo-transform-color",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / transform + background color",
    "properties": [
      "transform",
      "background-color",
      "two animation tracks",
      "different easing"
    ],
    "hint": "Two authored animations keep transform and background-color as independent tracks with their own easing list entries.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-transform-color.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.combo-filter-opacity",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / filter opacity vs layer opacity",
    "properties": [
      "filter: opacity()",
      "layer opacity",
      "separate alpha"
    ],
    "hint": "The animated layer alpha stays on the group while filter: opacity() remains an ordered source-surface effect.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-filter-opacity.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.combo-border-paint",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / animated border paint",
    "properties": [
      "border-color",
      "border-width",
      "paint-only track"
    ],
    "hint": "Animated border color and width target the generated border paint pass without adding a second layout computation.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-border-paint.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.combo-clip-path",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / animated shape with clip-path",
    "properties": [
      "transform",
      "opacity",
      "fixed clip-path",
      "geometric clip"
    ],
    "hint": "The clip-path remains geometric and fixed while the animated shape transform and opacity are sampled on the layer.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-clip-path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.combo-isolated-blend",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / isolated group + child blend",
    "properties": [
      "isolation: isolate",
      "mix-blend-mode: multiply",
      "child animation"
    ],
    "hint": "The child animation is sampled inside the isolated group boundary so its blend does not leak into the outside backdrop.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-isolated-blend.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion.combo-image-clipping",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion / image transform + composition clip",
    "properties": [
      "img",
      "transform",
      "overflow: hidden",
      "composition edge"
    ],
    "hint": "The image transform is animated inside a fixed overflow viewport and remains clipped at the composition boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/combo-image-clipping.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion-path.line-distance",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion path / line distance",
    "properties": [
      "offset-path",
      "offset-distance",
      "linear path"
    ],
    "hint": "A layer-owned path keeps the CSS element frame while offset-distance samples a normalized point along the parent-local line.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/path-line-distance.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion-path.cubic-auto",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion path / cubic auto rotate",
    "properties": [
      "offset-path",
      "offset-rotate: auto",
      "cubic tangent"
    ],
    "hint": "The runtime follows a cubic path and aligns the layer to the sampled tangent, making direction changes visible at the midpoint.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/path-cubic-auto.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion-path.reverse-anchor",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion path / reverse + anchor",
    "properties": [
      "offset-rotate: reverse",
      "offset-anchor",
      "path endpoint"
    ],
    "hint": "Reverse adds the CSS half-turn after tangent alignment while the bottom-center anchor keeps the layer attached to the path.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/path-reverse-anchor.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.motion-path.clip-edge",
    "phase": "P3",
    "topic": "Motion & animation",
    "label": "Motion path / composition clipping",
    "properties": [
      "offset-path",
      "overflow: hidden",
      "composition clip"
    ],
    "hint": "Motion remains layer-owned and is clipped by the composition boundary when the path carries the frame beyond the right edge.",
    "fixtureUrl": "/docs/html-compiler/fixtures/motion/path-clip-edge.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE5_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.perspective.group-translate-z",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / group + translateZ",
    "properties": [
      "perspective",
      "perspective-origin",
      "translateZ",
      "Matrix4"
    ],
    "hint": "A parent perspective becomes a group render3d context while the child keeps translateZ in its ordered Matrix4 transform.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/group-translate-z.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.rotate-x",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / rotateX plane",
    "properties": [
      "perspective",
      "rotateX",
      "transform-origin"
    ],
    "hint": "The child plane rotates around its center in 3D; the compiler preserves the authored transform origin and parent camera context.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/rotate-x.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.origin-offset",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / off-center origin",
    "properties": [
      "perspective-origin",
      "rotateY",
      "translateZ"
    ],
    "hint": "An off-center perspective-origin changes the convergence point without changing the child's layout frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/origin-offset.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.flat-preserve-3d",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / flat vs preserve-3d",
    "properties": [
      "transform-style",
      "flat",
      "preserve-3d",
      "nested groups"
    ],
    "hint": "Two independent group contexts keep transform-style explicit in JSON so the runtime can apply the intended flattening boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/flat-preserve-3d.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.transform-function",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / transform() function",
    "properties": [
      "transform: perspective()",
      "ordered operations",
      "rotateY"
    ],
    "hint": "transform: perspective() remains an ordered motion.perspective operation and is kept distinct from a parent perspective context.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/transform-function.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.backface-hidden",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / hidden backface",
    "properties": [
      "backface-visibility",
      "rotateY(180deg)",
      "layer state"
    ],
    "hint": "backface-visibility is preserved on the transformed layer; the runtime decides whether the reverse surface is paintable.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/backface-hidden.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.near-far-clipping",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / near and far clipping",
    "properties": [
      "perspective",
      "translateZ",
      "near/far clip"
    ],
    "hint": "The perspective context keeps the layer's authored frame while Runtime V2 clips projected geometry at the camera planes.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/near-far-clipping.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animated-3d",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / animated translateZ + rotateY",
    "properties": [
      "@keyframes",
      "translateZ",
      "rotateY",
      "tracks"
    ],
    "hint": "3D transform keyframes lower to typed Matrix4 operations on the shared timeline; no CSS animation engine is introduced in Runtime V2.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animated-3d.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.atomic-transform-style-flat",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective atomic / transform-style flat",
    "properties": [
      "transform-style: flat",
      "single 3D child",
      "solid paint"
    ],
    "hint": "The parent establishes the minimum camera context while flat is tested without filters, masks, blending or animation.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/atomic-transform-style-flat.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.atomic-transform-style-preserve-3d",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective atomic / transform-style preserve-3d",
    "properties": [
      "transform-style: preserve-3d",
      "single 3D child",
      "solid paint"
    ],
    "hint": "The same camera and child geometry as the flat fixture isolates the preserve-3d boundary contract.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/atomic-transform-style-preserve-3d.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.atomic-backface-visible",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective atomic / backface visible",
    "properties": [
      "backface-visibility: visible",
      "rotateY(180deg)",
      "solid paint"
    ],
    "hint": "A reversed solid plane remains paintable when backface visibility is explicitly visible.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/atomic-backface-visible.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.atomic-backface-hidden",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective atomic / backface hidden",
    "properties": [
      "backface-visibility: hidden",
      "rotateY(180deg)",
      "solid paint"
    ],
    "hint": "The same reversed plane becomes non-paintable only because its backface is explicitly hidden.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/atomic-backface-hidden.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.matrix-functions",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Transform / matrix and matrix3d",
    "properties": [
      "matrix()",
      "matrix3d()",
      "ordered transform atoms",
      "Matrix4"
    ],
    "hint": "CSS affine and projective matrix functions lower to the existing ordered V2 matrix atoms without a second transform path.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/matrix-functions.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE6_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.perspective.nested-distance",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested distances",
    "properties": [
      "nested perspective",
      "distance",
      "Matrix4 chain"
    ],
    "hint": "Each nested group keeps its own perspective distance; Runtime composes both contexts instead of collapsing them into one camera.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-distance.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-origins",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested origins",
    "properties": [
      "perspective-origin",
      "nested origin",
      "rotateX",
      "rotateY"
    ],
    "hint": "Outer and inner perspective-origin values remain local to their own boxes, so convergence changes twice without changing layout frames.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-origins.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-flat-boundary",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested flat boundary",
    "properties": [
      "nested perspective",
      "transform-style: flat",
      "flatten boundary"
    ],
    "hint": "The inner group declares a flat boundary while its own perspective remains explicit for its direct child surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-flat-boundary.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-preserve-depth",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested preserve-3d depth",
    "properties": [
      "nested perspective",
      "preserve-3d",
      "sibling depth",
      "paint order"
    ],
    "hint": "Two descendants retain independent depth inside the nested preserve-3d context while their paint order remains deterministic.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-preserve-depth.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-near-plane",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested near-plane",
    "properties": [
      "nested perspective",
      "near-plane",
      "partial surface clip"
    ],
    "hint": "Only the inner perspective surface crosses its homogeneous camera plane; the outer surface remains visible and is not clipped as a whole.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-overflow-clip",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested overflow clipping",
    "properties": [
      "nested perspective",
      "overflow: hidden",
      "composition clip"
    ],
    "hint": "The inner perspective result is clipped by its own overflow boundary and then by the composition edge without leaking outside either scope.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-overflow-clip.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-backface",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested backface",
    "properties": [
      "nested perspective",
      "backface-visibility",
      "rotateY(180deg)"
    ],
    "hint": "Backface visibility is evaluated after the accumulated nested Matrix4 transform, not at an isolated child transform.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-backface.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-same-origin",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested shared origin",
    "properties": [
      "nested perspective",
      "shared origin",
      "center convergence"
    ],
    "hint": "Matching percentage origins are resolved in each local box; equal percentages do not imply a shared absolute point.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-same-origin.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-between-boundaries",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / layer between boundaries",
    "properties": [
      "nested perspective",
      "intermediate layer",
      "stable ancestor order"
    ],
    "hint": "A direct child surface and a nested perspective subtree retain separate ancestor chains instead of inheriting the inner camera.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-between-boundaries.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.nested-clip-path",
    "phase": "P6",
    "topic": "Motion & animation",
    "label": "Perspective / nested clip-path",
    "properties": [
      "nested perspective",
      "clip-path",
      "overflow",
      "composition clip"
    ],
    "hint": "Geometric clip-path and nested overflow are intersected after the complete Matrix4 chain, before the composition edge clip.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/nested-clip-path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.parallax-three-depths",
    "phase": "P5",
    "topic": "Motion & animation",
    "label": "Perspective / slow stroke parallax camera shot",
    "properties": [
      "parallax video",
      "camera translateZ",
      "perspective",
      "slow depth zoom",
      "circle + triangle + rectangle stroke"
    ],
    "hint": "A slow looping camera shot travels through three flat stroke planes. The circle is nearest, the triangle is intermediate, and the rectangle is farthest, so their apparent scale changes at different rates.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/parallax-three-depths.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE7_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.perspective.animation-distance-linear",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / distance linear",
    "properties": [
      "perspective",
      "@keyframes",
      "linear",
      "distance"
    ],
    "hint": "The group camera distance is a numeric render3d track; the child keeps translateZ while the perspective matrix is rebuilt per sample.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-distance-linear.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-distance-cubic",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / cubic-bezier",
    "properties": [
      "perspective",
      "cubic-bezier",
      "typed number track"
    ],
    "hint": "Cubic-bezier easing stays on the distance track segment and is evaluated by the shared Runtime V2 sampler.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-distance-cubic.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-distance-steps",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / steps distance",
    "properties": [
      "perspective",
      "steps(4, jump-start)",
      "discrete camera plateaus"
    ],
    "hint": "Steps easing creates deterministic discrete perspective distances without a separate CSS animation engine.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-distance-steps.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-origin-corner",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / center to corner",
    "properties": [
      "perspective-origin",
      "center",
      "right bottom",
      "vec2"
    ],
    "hint": "Perspective-origin animates as one typed vec2 track while X and Y resolve against the group's own frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-origin-corner.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-origin-xy",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / X + Y origin",
    "properties": [
      "perspective-origin",
      "percentage X",
      "percentage Y",
      "simultaneous interpolation"
    ],
    "hint": "Both origin coordinates interpolate independently, preserving local percentage resolution and the named object contract.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-origin-xy.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-delay-backwards",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / delay + backwards",
    "properties": [
      "perspective",
      "animation-delay",
      "backwards fill"
    ],
    "hint": "During the positive delay, backwards fill exposes the first camera distance through the shared playback metadata.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-delay-backwards.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-alternate",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / alternate iterations",
    "properties": [
      "perspective",
      "iteration-count",
      "alternate",
      "cycle boundary"
    ],
    "hint": "Alternate playback reverses the distance track on the second iteration while preserving the local perspective origin.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-alternate.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-paused",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / paused transport",
    "properties": [
      "perspective-origin",
      "animation-play-state",
      "paused",
      "transport"
    ],
    "hint": "The authored paused state remains playback metadata; the preview transport can still seek a deterministic sample.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-paused.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-rotate",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / distance + rotateY",
    "properties": [
      "perspective",
      "rotateY",
      "transform order",
      "combined tracks"
    ],
    "hint": "Camera distance and child rotateY remain independent typed tracks while the transform order is preserved.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-rotate.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-nested-origin",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / nested origin",
    "properties": [
      "nested perspective",
      "perspective-origin",
      "local track",
      "ancestor chain"
    ],
    "hint": "Only the inner camera origin animates; the outer perspective remains a separate ancestor context in the Matrix4 chain.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-nested-origin.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-origin-outside",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / origin outside box",
    "properties": [
      "perspective-origin",
      "negative length",
      "outside border-box",
      "no clamp"
    ],
    "hint": "Origin coordinates outside the border-box remain valid local camera coordinates and are not clamped during lowering.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-origin-outside.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.animation-sibling-tracks",
    "phase": "P7",
    "topic": "Motion & animation",
    "label": "Perspective animation / sibling camera tracks",
    "properties": [
      "two sibling groups",
      "perspective",
      "perspective-origin",
      "independent tracks"
    ],
    "hint": "Sibling perspective groups keep independent distance and origin tracks; no track is merged across layer scope.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/animation-sibling-tracks.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE8_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.texture.image-contain-rotate-y",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / image contain on rotateY",
    "properties": [
      "img",
      "object-fit: contain",
      "rotateY",
      "projective UV"
    ],
    "hint": "Contain resolves the source and destination rectangles before the image plane is projected by the accumulated Matrix4.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-contain-rotate-y.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-cover-off-center",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / cover with off-center origin",
    "properties": [
      "img",
      "object-fit: cover",
      "object-position",
      "perspective-origin"
    ],
    "hint": "Cover cropping and object-position are resolved in image space; the cropped quad then follows the off-center perspective camera.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-cover-off-center.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-alpha-tilt",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / alpha image on inclined plane",
    "properties": [
      "alpha PNG",
      "rotateX",
      "rotateY",
      "transparent texture"
    ],
    "hint": "Transparent pixels remain texture alpha on the projective surface instead of becoming a solid bounding rectangle.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-alpha-tilt.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.video-projective-quad",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / video frame on projective quad",
    "properties": [
      "video",
      "frame source",
      "rotateY",
      "shared texture path"
    ],
    "hint": "Video uses the same projective textured-surface path as image; only the decoded frame source changes per playback timestamp.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/video-projective-quad.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.media-object-position",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / image object-position",
    "properties": [
      "image",
      "object-position: left bottom",
      "UV crop",
      "projective plane"
    ],
    "hint": "Object-position changes UV crop selection without changing the projected layout frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/media-object-position.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-composition-edge",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / composition edge clipping",
    "properties": [
      "image",
      "composition clip",
      "projective bounds",
      "edge"
    ],
    "hint": "The projected image is clipped at the composition edge after projective placement, without leaking pixels outside the frame.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-composition-edge.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-clip-path",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / image with clip-path",
    "properties": [
      "image",
      "clip-path: polygon",
      "geometric clip",
      "projective UV"
    ],
    "hint": "A geometric clip remains a clip path intersected with the textured projective surface, not a sibling alpha image.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-clip-path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.video-opacity-blend",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / video opacity + blend",
    "properties": [
      "video",
      "opacity",
      "mix-blend-mode: screen",
      "offscreen"
    ],
    "hint": "Video texture is sampled first, then layer opacity and blend scope are applied to the rendered surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/video-opacity-blend.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-animated-z",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / animated translateZ",
    "properties": [
      "image",
      "@keyframes",
      "translateZ",
      "typed texture track"
    ],
    "hint": "The texture stays attached to the image plane while translateZ changes over the shared Runtime V2 timeline.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-animated-z.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-near-plane",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / near-plane partial clipping",
    "properties": [
      "image",
      "translateZ",
      "near-plane",
      "homogeneous clip"
    ],
    "hint": "Only the part of the image plane outside the near camera plane is removed before perspective division.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.nested-image-perspective",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / nested perspective",
    "properties": [
      "nested perspective",
      "image",
      "preserve-3d",
      "Matrix4 chain"
    ],
    "hint": "Nested cameras compose in order and the image receives the final projective transform as one textured surface.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/nested-image-perspective.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.texture.image-high-distortion",
    "phase": "P8",
    "topic": "Motion & animation",
    "label": "Texture / high projective distortion",
    "properties": [
      "image",
      "rotateX + rotateY",
      "subdivision",
      "seam check"
    ],
    "hint": "A strongly inclined plane exercises the projective texture path and its subdivision/seam contract.",
    "fixtureUrl": "/docs/html-compiler/fixtures/texture/image-high-distortion.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_PERSPECTIVE_PHASE9_CASES: HtmlCompilerPreviewCase[] = [
  {
    "id": "html-compiler.perspective.mask-alpha-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / alpha mask near-plane",
    "properties": [
      "mask-image",
      "alpha",
      "near-plane",
      "homogeneous clip"
    ],
    "hint": "The alpha mask follows the projective surface and remains partially visible across the near camera plane.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-alpha-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-luminance-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / luminance mask near-plane",
    "properties": [
      "mask-image",
      "luminance",
      "asset URL",
      "near-plane"
    ],
    "hint": "Luminance coverage is sampled from the projective image mask and converted to deterministic alpha.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-luminance-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-add-intersect-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / add then intersect",
    "properties": [
      "two mask layers",
      "add",
      "intersect",
      "near-plane"
    ],
    "hint": "Mask sources remain ordered: the first establishes coverage and the second intersects it on the projective plane.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-add-intersect-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-subtract-composition-edge",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / subtract at composition edge",
    "properties": [
      "mask-composite",
      "subtract",
      "composition clip",
      "private surface"
    ],
    "hint": "Subtract is evaluated on the private mask surface before the layer is clipped at the composition boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-subtract-composition-edge.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-exclude-inclined",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / exclude on inclined surface",
    "properties": [
      "mask-composite",
      "exclude",
      "rotateX",
      "rotateY"
    ],
    "hint": "Exclude preserves the symmetric difference of two coverage sources while the visible surface is inclined.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-exclude-inclined.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.filter-blur-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / blur source near-plane",
    "properties": [
      "filter",
      "blur",
      "near-plane",
      "offscreen surface"
    ],
    "hint": "Blur is applied to the projectively clipped source surface and cannot leak outside the composition edge.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/filter-blur-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.filter-drop-shadow-after-blur-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / drop-shadow after blur",
    "properties": [
      "blur",
      "drop-shadow",
      "ordered effects",
      "near-plane"
    ],
    "hint": "The drop-shadow samples the preceding blurred source, preserving CSS filter order.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/filter-drop-shadow-after-blur-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.filter-mask-clip-path",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / mask + clip-path",
    "properties": [
      "mask-image",
      "clip-path",
      "filter",
      "intersected coverage"
    ],
    "hint": "Geometric clip coverage is intersected with the mask before the filtered projective surface is composited.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/filter-mask-clip-path.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.isolated-mask-filter-projective",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / isolated projective group",
    "properties": [
      "isolation",
      "mask",
      "filter",
      "projective group"
    ],
    "hint": "The isolated group owns its mask and filter offscreen surface; its child blend remains inside that boundary.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/isolated-mask-filter-projective.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-different-perspective-boundary",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / nested mask camera",
    "properties": [
      "nested perspective",
      "mask source",
      "different boundary",
      "Matrix4 chain"
    ],
    "hint": "The mask source is resolved in the element box while the visible child inherits a different nested perspective context.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-different-perspective-boundary.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.filter-far-plane-bounds",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / filter bounds at far-plane",
    "properties": [
      "filter",
      "far-plane",
      "expanded bounds",
      "composition clip"
    ],
    "hint": "The filtered surface keeps expanded offscreen bounds while far-plane and composition clipping remain deterministic.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/filter-far-plane-bounds.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.mask-one-corner-near-plane",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Mask/filter / one-corner near-plane cut",
    "properties": [
      "mask-image",
      "one corner",
      "rotateX + rotateY",
      "partial source clip"
    ],
    "hint": "Only one corner of the mask source crosses the near plane; remaining coverage is retained without alpha inversion.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/mask-one-corner-near-plane.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.backdrop-filter-blur",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Backdrop / blur over colored layers",
    "properties": [
      "backdrop-filter",
      "blur",
      "backdrop surface",
      "layer opacity"
    ],
    "hint": "The backdrop is captured before the translucent card is painted; blur affects the colored backdrop only and remains separate from the card's own filter.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/backdrop-filter-blur.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  },
  {
    "id": "html-compiler.perspective.backdrop-filter-order",
    "phase": "P9",
    "classification": "combined",
    "classificationLabel": "Combined pipeline",
    "topic": "Motion & animation",
    "label": "Backdrop / ordered blur and contrast",
    "properties": [
      "backdrop-filter",
      "blur",
      "contrast",
      "ordered effects"
    ],
    "hint": "Backdrop effects retain CSS token order and never become a visible sibling or a source filter on the translucent panel.",
    "fixtureUrl": "/docs/html-compiler/fixtures/perspective/backdrop-filter-order.html",
    "composition": {
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "background": "#081018",
      "colorSpace": "srgb"
    }
  }
];

export const HTML_COMPILER_DEFAULT_CASE_ID = HTML_COMPILER_PHASE0_CASES[0].id;

const HTML_COMPILER_ALL_CASES: HtmlCompilerPreviewCase[] = [
  ...HTML_COMPILER_PHASE0_CASES,
  ...HTML_COMPILER_TAG_LOWERING_CASES,
  ...HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES,
  ...HTML_COMPILER_ANCHOR_CASES,
  ...HTML_COMPILER_PHASE1_1_CASES,
  ...HTML_COMPILER_PHASE1_2_CASES,
  ...HTML_COMPILER_PHASE1_3_CASES,
  ...HTML_COMPILER_PHASE1_4_CASES,
  ...HTML_COMPILER_LAYOUT_TEXT_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_0_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_9_CASES,
  ...HTML_COMPILER_OPACITY_CASES,
  ...HTML_COMPILER_PAINT_GRADIENT_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_1_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_2_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_3_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_4_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_5_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_6_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_7_CASES,
  ...HTML_COMPILER_PAINT_PHASE2_8_CASES,
  ...HTML_COMPILER_MOTION_PHASE3_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE5_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE6_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE7_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE8_CASES,
  ...HTML_COMPILER_PERSPECTIVE_PHASE9_CASES,
];

const HTML_COMPILER_PREVIEW_CATEGORY_ORDER: HtmlCompilerPreviewCategory[] = [
  "HTML tag lowering",
  "Text compiler & layout",
  "Layout primitives",
  "Paint primitives",
  "Effect primitives",
  "Transform & 3D primitives",
  "Typography & media primitives",
  "Animation & keyframe primitives",
  "Combined pipeline cases",
];

export type CategorizedHtmlCompilerPreviewCase = HtmlCompilerPreviewCase & {
  category: HtmlCompilerPreviewCategory;
};

function categoryForCase(item: HtmlCompilerPreviewCase): HtmlCompilerPreviewCategory {
  if (item.category !== undefined) return item.category;
  if (item.classification === "combined") return "Combined pipeline cases";
  if (item.phase === "P0") {
    if (item.topic === "Paint") return "Paint primitives";
    if (item.topic === "Transform 2D") return "Transform & 3D primitives";
    if (item.topic === "Typography" || item.topic === "Media") return "Typography & media primitives";
    return "Layout primitives";
  }
  if (item.topic === "Layout") return "Layout primitives";
  if (["P2.4", "P2.5", "P2.6", "P2.7", "P2.8"].includes(item.phase)) {
    return item.id.includes("mask-clip-path-isolation") ? "Combined pipeline cases" : "Effect primitives";
  }
  if (["P2.0", "P2.1", "P2.2", "P2.3"].includes(item.phase)) return "Paint primitives";
  if (item.phase === "P3" || item.phase === "P7" || item.id.includes("animated-translate-z")) return "Animation & keyframe primitives";
  if (item.phase === "P5" && !item.id.includes("slow-stroke")) return "Transform & 3D primitives";
  return "Combined pipeline cases";
}

function categorizedCase(item: HtmlCompilerPreviewCase): CategorizedHtmlCompilerPreviewCase {
  const category = categoryForCase(item);
  const classification = item.classification ?? (category === "Combined pipeline cases" ? "combined" : "primitive");
  return {
    ...item,
    category,
    classification,
    classificationLabel: item.classificationLabel ?? (classification === "combined" ? "Combined pipeline" : "Primitive"),
  };
}

export const HTML_COMPILER_PREVIEW_CASES: CategorizedHtmlCompilerPreviewCase[] = HTML_COMPILER_ALL_CASES.map(categorizedCase);

export function htmlCompilerPreviewGroups(): Array<{ category: HtmlCompilerPreviewCategory; cases: CategorizedHtmlCompilerPreviewCase[] }> {
  const groups = new Map<HtmlCompilerPreviewCategory, CategorizedHtmlCompilerPreviewCase[]>();
  for (const item of HTML_COMPILER_PREVIEW_CASES) {
    const cases = groups.get(item.category) ?? [];
    cases.push(item);
    groups.set(item.category, cases);
  }
  return HTML_COMPILER_PREVIEW_CATEGORY_ORDER
    .filter((category) => groups.has(category))
    .map((category) => ({ category, cases: groups.get(category)! }));
}

export function htmlCompilerPreviewCaseById(id: string | null | undefined): CategorizedHtmlCompilerPreviewCase {
  return HTML_COMPILER_PREVIEW_CASES.find((item) => item.id === id) ?? categorizedCase(HTML_COMPILER_PHASE0_CASES[0]);
}
