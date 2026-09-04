import { createHtmlCssSource, createNewHtmlProject, DEFAULT_NEONIX_HTML_DOCUMENT, type HtmlCompilerFontAsset, type HtmlCssSource } from "@motionvideo/html-compiler";

export type HtmlCompilerPreviewTopic =
  | "New project"
  | "Composition & geometry"
  | "HTML tags"
  | "Cascade & values"
  | "Transform 2D"
  | "Paint"
  | "Media"
  | "Typography";

export type HtmlCompilerPreviewCase = {
  id: string;
  phase: "P0";
  topic: HtmlCompilerPreviewTopic;
  label: string;
  properties: string[];
  hint: string;
  source: HtmlCssSource;
};

export const HTML_COMPILER_PREVIEW_FONT_ASSETS: HtmlCompilerFontAsset[] = [
  { id: "preview-font-inter-regular", kind: "font", uri: "/preview/font/Inter/Inter_18pt-Regular.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "normal", integrity: "sha256:3e5f90a0138b38de4cf4d779ad78391974ea1df776b9164842bdcbb60ce383c5" },
  { id: "preview-font-inter-italic", kind: "font", uri: "/preview/font/Inter/Inter_18pt-Italic.ttf", mimeType: "font/ttf", family: "Inter", weight: 400, style: "italic", integrity: "sha256:1fe26d47c840ef8767635967acaa50ee43a57794fa00a03bf042ee4aab2792c4" },
  { id: "preview-font-inter-bold", kind: "font", uri: "/preview/font/Inter/Inter_18pt-Bold.ttf", mimeType: "font/ttf", family: "Inter", weight: 700, style: "normal", integrity: "sha256:30a5c45ec23a594af2effe8d3b589ad22c2dede27441050a1604d00ff82fd0dc" },
  { id: "preview-font-lora-regular", kind: "font", uri: "/preview/font/Lora/Lora-Regular.ttf", mimeType: "font/ttf", family: "Lora", weight: 400, style: "normal", integrity: "sha256:7ed00e7c9cdf16ab7e2fd2361fe45d4f0b61263cd60aae398b27b7ee08108827" },
  { id: "preview-font-lora-bold", kind: "font", uri: "/preview/font/Lora/Lora-Bold.ttf", mimeType: "font/ttf", family: "Lora", weight: 700, style: "normal", integrity: "sha256:7d74015e950c2fb66519c7295b8155621d22200ae2ca2a4c6b43ce3c490cac87" },
  { id: "preview-font-roboto-regular", kind: "font", uri: "/preview/font/Roboto/Roboto-Regular.ttf", mimeType: "font/ttf", family: "Roboto", weight: 400, style: "normal", integrity: "sha256:15256405ecb0d880678833a582760efad538ab2932318b52c8105b267d159459" },
  { id: "preview-font-roboto-bold", kind: "font", uri: "/preview/font/Roboto/Roboto-Bold.ttf", mimeType: "font/ttf", family: "Roboto", weight: 700, style: "normal", integrity: "sha256:4aaf8c5b661a386998c2e70cf2b87e2440f5404e0b8fd81164f0413fb3435ec6" },
  { id: "preview-font-roboto-condensed-regular", kind: "font", uri: "/preview/font/Roboto/Roboto_Condensed-Regular.ttf", mimeType: "font/ttf", family: "Roboto", weight: 400, style: "normal", stretch: "condensed", integrity: "sha256:421572e7beae914b9e400ae1e7f9690a749357a94e1a6c3a3fb1d502c54f0b7d" },
  { id: "preview-font-roboto-condensed-bold", kind: "font", uri: "/preview/font/Roboto/Roboto_Condensed-Bold.ttf", mimeType: "font/ttf", family: "Roboto", weight: 700, style: "normal", stretch: "condensed", integrity: "sha256:2523dfdb721c2e0291f92419e30dd2cb0f6105d94d2673b2206b127923fce5ee" },
  { id: "preview-font-noto-sans-regular", kind: "font", uri: "/preview/font/Noto_Sans/NotoSans-Regular.ttf", mimeType: "font/ttf", family: "Noto Sans", weight: 400, style: "normal", integrity: "sha256:fe8c022f48d8dd29f17b744d16f9346f4357e16f7d4f7be58b000ae7c291b614" },
  { id: "preview-font-noto-color-emoji", kind: "font", uri: "/preview/font/Noto_Color_Emoji/NotoColorEmoji-Regular.ttf", mimeType: "font/ttf", family: "Noto Color Emoji", weight: 400, style: "normal", integrity: "sha256:7fb39738ab18f10612d6f4595e2e8e47a0afdf34738460442d99cd0c344a4d90" },
];

/**
 * The first HTML compiler fixture is intentionally small, but exercises the
 * whole P0.1 value path in one deterministic composition. The source remains
 * HTML/CSS so the native iframe and Protocol V2 compiler consume identical
 * input.
 */
export const HTML_COMPILER_PHASE0_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.new-project.blue-rectangle",
    phase: "P0",
    topic: "New project",
    label: "New project / blue rectangle",
    properties: ["fixed composition", "one object", "rectangle", "blue paint"],
    hint: "The smallest authored project starts from the fixed composition envelope and compiles one rectangle into a valid Protocol V2 shape layer.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"blue-rectangle\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#blue-rectangle {
  position: absolute;
  left: 720px;
  top: 420px;
  width: 480px;
  height: 240px;
  background: #2563eb;
}`,
    }),
  },
  {
    id: "html-compiler.geometry.explicit-size",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / width + height",
    properties: ["width", "height", "explicit px", "composition pixels"],
    hint: "Explicit width and height resolve directly to a composition-space frame that both browser reference and Protocol V2 share.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"explicit-size\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#explicit-size {
  position: absolute;
  left: 640px;
  top: 360px;
  width: 640px;
  height: 360px;
  background: #f97316;
}`,
    }),
  },
  {
    id: "html-compiler.geometry.min-max",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / min + max",
    properties: ["min-width", "max-width", "min-height", "max-height"],
    hint: "Four child shapes make each size constraint visible: minimum width, maximum width, minimum height and maximum height are resolved before lowering.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"size-constraints\">\n    <div id=\"min-width-case\"></div>\n    <div id=\"max-width-case\"></div>\n    <div id=\"min-height-case\"></div>\n    <div id=\"max-height-case\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#size-constraints {
  position: absolute;
  left: 360px;
  top: 240px;
  width: 1200px;
  height: 600px;
}

#min-width-case,
#max-width-case,
#min-height-case,
#max-height-case {
  position: absolute;
  background: #38bdf8;
}

#min-width-case {
  left: 0;
  top: 0;
  width: 160px;
  min-width: 280px;
  height: 120px;
}

#max-width-case {
  left: 440px;
  top: 0;
  width: 520px;
  max-width: 320px;
  height: 120px;
  background: #a78bfa;
}

#min-height-case {
  left: 0;
  top: 280px;
  width: 320px;
  height: 40px;
  min-height: 120px;
  background: #facc15;
}

#max-height-case {
  left: 440px;
  top: 280px;
  width: 320px;
  height: 240px;
  max-height: 120px;
  background: #fb7185;
}`,
    }),
  },
  {
    id: "html-compiler.tags.div-shape",
    phase: "P0",
    topic: "HTML tags",
    label: "Tag / div → shape",
    properties: ["div", "one object", "rectangle", "solid paint"],
    hint: "A leaf div is the smallest visual tag: the compiler lowers it to one Protocol V2 rectangle shape layer.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"green-shape\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#green-shape {
  position: absolute;
  left: 640px;
  top: 360px;
  width: 640px;
  height: 360px;
  background: #22c55e;
}`,
    }),
  },
  {
    id: "html-compiler.tags.div-group",
    phase: "P0",
    topic: "HTML tags",
    label: "Tag / div → group",
    properties: ["div", "nested children", "group", "two shapes"],
    hint: "A div with children becomes a group; each child div becomes a rectangle layer parented to that group.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"card\">\n    <div id=\"card-background\"></div>\n    <div id=\"card-accent\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#card {
  position: absolute;
  left: 520px;
  top: 260px;
  width: 880px;
  height: 560px;
  padding: 40px;
  box-sizing: border-box;
}

#card-background {
  width: 800px;
  height: 480px;
  background: #172554;
}

#card-accent {
  position: absolute;
  left: 40px;
  top: 40px;
  width: 240px;
  height: 18px;
  background: #38bdf8;
}`,
    }),
  },
  {
    id: "html-compiler.tags.svg-path",
    phase: "P0",
    topic: "HTML tags",
    label: "Tag / svg + path",
    properties: ["svg", "path", "vector group", "cubic contour"],
    hint: "An svg container becomes a group and its path child lowers to a Protocol V2 path with fill and stroke semantics.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <svg id=\"logo\">\n    <path id=\"logo-mark\" d=\"M 0 120 C 80 0 220 0 320 120 L 320 220 L 0 220 Z\"></path>\n  </svg>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#logo {
  position: absolute;
  left: 640px;
  top: 300px;
  width: 640px;
  height: 440px;
}

#logo-mark {
  fill: #14b8a6;
  stroke: #ffffff;
  stroke-width: 8px;
  stroke-linejoin: round;
}`,
    }),
  },
  {
    id: "html-compiler.p0.cascade-values",
    phase: "P0",
    topic: "Cascade & values",
    label: "Cascade + value normalization",
    properties: ["selector list", "specificity", "inheritance", "custom properties", "calc/min/max/clamp", "!important"],
    hint: "A single card resolves selector precedence, scoped variables, inheritance, special keywords and typed length functions before lowering to V2.",
    source: createHtmlCssSource({
      html: `<div id="scene">
  <div id="card" class="card panel">
    <div id="accent" class="accent"></div>
  </div>
</div>`,
      css: `:root {
  --surface: #172b3d;
  --accent: #5eead4;
  --card-width: 720px;
}

body {
  margin: 0;
  background: #081018;
}

#scene {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  background: #081018;
}

.card,
.panel {
  position: absolute;
  left: 220px !important;
  top: calc(50% - 180px);
  width: var(--card-width);
  height: clamp(240px, 30vh, 360px);
  padding: 24px 32px;
  box-sizing: border-box;
  color: var(--accent);
  background: var(--surface);
  border: 4px solid currentColor;
}

#card {
  left: calc(50% - 360px);
  background: var(--surface);
}

#accent {
  width: min(100%, 600px);
  height: max(20px, 1vw);
  background: currentColor;
  color: var(--accent);
}`,
    }),
  },
  {
    id: "html-compiler.geometry.aspect-box-sizing",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / aspect ratio + box sizing",
    properties: ["aspect-ratio", "content-box", "border-box", "padding + border"],
    hint: "Two equal-width objects show how aspect-ratio derives height and how box-sizing changes whether padding and border expand the final frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"aspect-boxes\">\n    <div id=\"content-ratio\"></div>\n    <div id=\"border-ratio\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#aspect-boxes {
  position: absolute;
  left: 260px;
  top: 280px;
  width: 1400px;
  height: 520px;
}

#content-ratio,
#border-ratio {
  position: absolute;
  left: 0;
  width: 640px;
  height: auto;
  aspect-ratio: 16 / 9;
  padding: 20px;
  border: 4px solid #ffffff;
}

#content-ratio {
  top: 0;
  box-sizing: content-box;
  background: #f97316;
}

#border-ratio {
  left: 760px;
  top: 0;
  box-sizing: border-box;
  background: #a78bfa;
}`,
    }),
  },
  {
    id: "html-compiler.geometry.margin",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / margin",
    properties: ["margin", "margin-top", "margin-right", "margin-bottom", "margin-left"],
    hint: "Static block children make the four margin shorthand forms and the individual longhands visible in deterministic composition-space flow.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"margin-demo\">\n    <div id=\"margin-all\"></div>\n    <div id=\"margin-yx\"></div>\n    <div id=\"margin-three\"></div>\n    <div id=\"margin-longhands\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#margin-demo {
  position: absolute;
  left: 300px;
  top: 200px;
  width: 1320px;
  height: 680px;
}

#margin-all,
#margin-yx,
#margin-three,
#margin-longhands {
  width: 260px;
  height: 100px;
}

#margin-all {
  margin: 24px;
  background: #38bdf8;
}

#margin-yx {
  margin: 12px 28px;
  background: #a78bfa;
}

#margin-three {
  margin: 8px 20px 16px;
  background: #facc15;
}

#margin-longhands {
  margin-top: 10px;
  margin-right: 18px;
  margin-bottom: 22px;
  margin-left: 34px;
  background: #fb7185;
}`,
    }),
  },
  {
    id: "html-compiler.geometry.padding",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / padding",
    properties: ["padding", "padding-top", "padding-right", "padding-bottom", "padding-left"],
    hint: "Four fixed objects show how padding shorthand and longhands expand the content box into the final Protocol V2 frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"padding-demo\">\n    <div id=\"padding-all\"></div>\n    <div id=\"padding-yx\"></div>\n    <div id=\"padding-three\"></div>\n    <div id=\"padding-longhands\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#padding-demo {
  position: absolute;
  left: 260px;
  top: 220px;
  width: 1400px;
  height: 640px;
}

#padding-all,
#padding-yx,
#padding-three,
#padding-longhands {
  position: absolute;
  width: 260px;
  height: 120px;
  border: 2px solid #ffffff;
}

#padding-all {
  left: 0;
  top: 0;
  padding: 24px;
  background: #14b8a6;
}

#padding-yx {
  left: 380px;
  top: 0;
  padding: 12px 28px;
  background: #38bdf8;
}

#padding-three {
  left: 760px;
  top: 0;
  padding: 8px 20px 16px;
  background: #a78bfa;
}

#padding-longhands {
  left: 1080px;
  top: 0;
  padding-top: 10px;
  padding-right: 18px;
  padding-bottom: 22px;
  padding-left: 34px;
  background: #f97316;
      }`,
    }),
  },
  {
    id: "html-compiler.geometry.position",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / position modes",
    properties: ["position: static", "position: relative", "position: absolute", "normal flow", "inset offset"],
    hint: "Static stays in normal flow and ignores inset values; relative keeps its flow slot while offsetting its paint; absolute leaves flow and uses the positioned container.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"position-demo\">\n    <div id=\"position-static\"></div>\n    <div id=\"position-relative\"></div>\n    <div id=\"position-absolute\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#position-demo {
  position: relative;
  left: 240px;
  top: 160px;
  width: 1440px;
  height: 760px;
}

#position-static,
#position-relative,
#position-absolute {
  width: 280px;
  height: 120px;
}

#position-static {
  position: static;
  margin: 60px 0 0 80px;
  left: 900px;
  top: 900px;
  background: #38bdf8;
}

#position-relative {
  position: relative;
  margin: 20px 0 0 80px;
  left: 320px;
  top: 24px;
  background: #a78bfa;
}

#position-absolute {
  position: absolute;
  left: 980px;
  top: 220px;
  background: #f97316;
      }`,
    }),
  },
  {
    id: "html-compiler.geometry.inset",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / inset edges",
    properties: ["inset", "top", "right", "bottom", "left", "auto size"],
    hint: "Inset expands to top/right/bottom/left; when an absolute box has auto dimensions, opposite edges resolve the remaining width and height inside its containing block.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"inset-demo\">\n    <div id=\"inset-frame\"></div>\n    <div id=\"right-bottom-box\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#inset-demo {
  position: relative;
  left: 240px;
  top: 160px;
  width: 1440px;
  height: 760px;
}

#inset-frame {
  position: absolute;
  inset: 80px 120px 100px 160px;
  width: auto;
  height: auto;
  background: #0e7490;
}

#right-bottom-box {
  position: absolute;
  right: 160px;
  bottom: 120px;
  width: 300px;
  height: 160px;
  background: #f97316;
      }`,
    }),
  },
  {
    id: "html-compiler.geometry.display-visibility",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / display + visibility",
    properties: ["display: block", "display: contents", "display: none", "visibility: visible", "visibility: hidden"],
    hint: "Block creates a normal visual box, contents promotes its children into the parent flow, none removes the subtree, and hidden keeps geometry while disabling the emitted layer.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"display-demo\">\n    <div id=\"display-block\"></div>\n    <div id=\"display-contents\">\n      <div id=\"contents-cyan\"></div>\n      <div id=\"contents-purple\"></div>\n    </div>\n    <div id=\"display-none\"></div>\n    <div id=\"visibility-hidden\"></div>\n    <div id=\"visibility-visible\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#display-demo {
  position: relative;
  left: 260px;
  top: 140px;
  width: 1400px;
  height: 800px;
}

#display-block {
  display: block;
  margin: 60px 0 20px 80px;
  width: 360px;
  height: 100px;
  background: #38bdf8;
}

#display-contents {
  display: contents;
}

#contents-cyan,
#contents-purple {
  display: block;
  margin: 12px 0 12px 80px;
  width: 300px;
  height: 80px;
}

#contents-cyan {
  background: #14b8a6;
}

#contents-purple {
  background: #a78bfa;
}

#display-none {
  display: none;
  width: 360px;
  height: 100px;
  background: #fb7185;
}

#visibility-hidden,
#visibility-visible {
  position: absolute;
  right: 100px;
  width: 280px;
  height: 100px;
}

#visibility-hidden {
  top: 160px;
  visibility: hidden;
  background: #facc15;
}

#visibility-visible {
  top: 300px;
  visibility: visible;
  background: #f97316;
      }`,
    }),
  },
  {
    id: "html-compiler.geometry.opacity-z-index-overflow",
    phase: "P0",
    topic: "Composition & geometry",
    label: "Geometry / opacity + stacking + overflow",
    properties: ["opacity", "z-index", "overflow: visible", "overflow: hidden", "clipPath"],
    hint: "Opacity lowers to layer alpha, numeric z-index controls sibling paint order, and overflow hidden creates a composition-space rectangular clip for descendants.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"opacity-base\"></div>\n  <div id=\"opacity-overlay\"></div>\n  <div id=\"z-back\"></div>\n  <div id=\"z-middle\"></div>\n  <div id=\"z-front\"></div>\n  <div id=\"overflow-hidden\">\n    <div id=\"overflow-hidden-child\"></div>\n  </div>\n  <div id=\"overflow-visible\">\n    <div id=\"overflow-visible-child\"></div>\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#opacity-base,
#opacity-overlay,
#z-back,
#z-middle,
#z-front,
#overflow-hidden,
#overflow-visible {
  position: absolute;
}

#opacity-base {
  left: 160px;
  top: 180px;
  width: 440px;
  height: 260px;
  background: #14b8a6;
}

#opacity-overlay {
  left: 280px;
  top: 260px;
  width: 440px;
  height: 260px;
  opacity: 0.55;
  background: #a78bfa;
}

#z-back,
#z-middle,
#z-front {
  left: 840px;
  top: 180px;
  width: 420px;
  height: 260px;
}

#z-back {
  z-index: 1;
  background: #38bdf8;
}

#z-middle {
  left: 920px;
  top: 240px;
  z-index: 2;
  background: #facc15;
}

#z-front {
  left: 1000px;
  top: 300px;
  z-index: 3;
  background: #fb7185;
}

#overflow-hidden,
#overflow-visible {
  left: 220px;
  top: 700px;
  width: 300px;
  height: 160px;
  background: #172b3d;
}

#overflow-hidden {
  overflow: hidden;
}

#overflow-visible {
  left: 720px;
  overflow: visible;
}

#overflow-hidden-child,
#overflow-visible-child {
  position: absolute;
  left: 220px;
  top: 40px;
  width: 260px;
  height: 80px;
  background: #f97316;
      }`,
    }),
  },
  {
    id: "html-compiler.transform.functions",
    phase: "P0",
    topic: "Transform 2D",
    label: "Transform / 2D functions",
    properties: ["transform", "transform-origin", "translate", "scale", "rotate", "skew"],
    hint: "The transform list is preserved in source order and lowered to Protocol V2 operations; transform-origin becomes the local anchor for the complete list.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"transform-translate\"></div>\n  <div id=\"transform-translate-x\"></div>\n  <div id=\"transform-translate-y\"></div>\n  <div id=\"transform-scale\"></div>\n  <div id=\"transform-scale-x\"></div>\n  <div id=\"transform-rotate\"></div>\n  <div id=\"transform-rotate-z\"></div>\n  <div id=\"transform-skew\"></div>\n  <div id=\"transform-skew-x\"></div>\n  <div id=\"transform-skew-y\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#transform-translate,
#transform-translate-x,
#transform-translate-y,
#transform-scale,
#transform-scale-x,
#transform-rotate,
#transform-rotate-z,
#transform-skew,
#transform-skew-x,
#transform-skew-y {
  position: absolute;
  width: 220px;
  height: 120px;
}

#transform-translate {
  left: 120px;
  top: 180px;
  transform: translate(40px, 24px);
  background: #38bdf8;
}

#transform-translate-x {
  left: 420px;
  top: 180px;
  transform: translateX(48px);
  background: #14b8a6;
}

#transform-translate-y {
  left: 720px;
  top: 180px;
  transform: translateY(32px);
  background: #a78bfa;
}

#transform-scale {
  left: 1020px;
  top: 180px;
  transform-origin: center center;
  transform: scale(1.2, 0.75);
  background: #facc15;
}

#transform-scale-x {
  left: 1340px;
  top: 180px;
  transform-origin: left top;
  transform: scaleX(1.35);
  background: #fb7185;
}

#transform-rotate {
  left: 120px;
  top: 520px;
  transform-origin: left top;
  transform: rotate(12deg);
  background: #38bdf8;
}

#transform-rotate-z {
  left: 420px;
  top: 520px;
  transform-origin: right bottom;
  transform: rotateZ(-12deg);
  background: #14b8a6;
}

#transform-skew {
  left: 720px;
  top: 520px;
  transform: skew(10deg, -6deg);
  background: #a78bfa;
}

#transform-skew-x {
  left: 1020px;
  top: 520px;
  transform: skewX(-12deg);
  background: #facc15;
}

#transform-skew-y {
  left: 1320px;
  top: 520px;
  transform: skewY(10deg);
  background: #fb7185;
      }`,
    }),
  },
  {
    id: "html-compiler.transform.rotate-single",
    phase: "P0",
    topic: "Transform 2D",
    label: "Transform / single rotate",
    properties: ["one rectangle", "rotate", "transform-origin", "edge rasterization"],
    hint: "A single rectangle isolates transform geometry from multi-layer overlap so browser and Skia edge rasterization can be compared directly.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"rotate-single\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#rotate-single {
  position: absolute;
  left: 800px;
  top: 420px;
  width: 320px;
  height: 180px;
  transform-origin: center center;
  transform: rotate(17deg);
  background: #38bdf8;
      }`,
    }),
  },
  {
    id: "html-compiler.paint.background-basics",
    phase: "P0",
    topic: "Paint",
    label: "Paint / background basics",
    properties: ["background-color", "background solid", "multiple layers", "paint order"],
    hint: "Solid background declarations and comma-separated background layers lower to ordered rectangle paints; the first CSS layer remains visually on top of the last one.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"paint-background-color\"></div>\n  <div id=\"paint-background-solid\"></div>\n  <div id=\"paint-background-layers\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#paint-background-color,
#paint-background-solid,
#paint-background-layers {
  position: absolute;
  top: 360px;
  width: 480px;
  height: 240px;
}

#paint-background-color {
  left: 120px;
  background-color: #14b8a6;
}

#paint-background-solid {
  left: 720px;
  background: #a78bfa;
}

#paint-background-layers {
  left: 1320px;
  background: linear-gradient(90deg, #38bdf8 0%, #38bdf8 55%, #00000000 55%, #00000000 100%), #172554;
      }`,
    }),
  },
  {
    id: "html-compiler.paint.color-border",
    phase: "P0",
    topic: "Paint",
    label: "Paint / color + border",
    properties: ["color", "border", "border-width", "border-style", "border-color", "border-radius"],
    hint: "The color property resolves currentColor for paint, border shorthand and longhand declarations lower to a solid stroke, none removes the stroke, and one radius value becomes a uniform rounded rectangle.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"paint-color-border\"></div>\n  <div id=\"paint-border-longhand\"></div>\n  <div id=\"paint-border-none\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#paint-color-border,
#paint-border-longhand,
#paint-border-none {
  position: absolute;
  top: 360px;
  width: 420px;
  height: 220px;
  background-color: #172554;
}

#paint-color-border {
  left: 120px;
  color: #38bdf8;
  border: 12px solid currentColor;
  border-radius: 28px;
}

#paint-border-longhand {
  left: 750px;
  border-width: 8px;
  border-style: solid;
  border-color: #facc15;
  border-radius: 28px;
}

#paint-border-none {
  left: 1380px;
  color: #fb7185;
  border-width: 12px;
  border-style: none;
  border-color: currentColor;
  border-radius: 28px;
      }`,
    }),
  },
  {
    id: "html-compiler.paint.svg-fill",
    phase: "P0",
    topic: "Paint",
    label: "Paint / SVG fill",
    properties: ["fill", "fill-opacity", "fill-rule", "evenodd", "path"],
    hint: "SVG fill is lowered to path style, fill-opacity becomes alpha, and evenodd preserves the hole between nested contours.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <svg id=\"fill-case\">\n    <path id=\"fill-rule-evenodd\" d=\"M 0 0 H 480 V 260 H 0 Z M 140 70 H 340 V 190 H 140 Z\"></path>\n  </svg>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#fill-case {
  position: absolute;
  left: 120px;
  top: 160px;
  width: 480px;
  height: 280px;
}

#fill-rule-evenodd {
  fill: #38bdf8;
  fill-opacity: 0.72;
  fill-rule: evenodd;
}`,
    }),
  },
  {
    id: "html-compiler.paint.svg-stroke",
    phase: "P0",
    topic: "Paint",
    label: "Paint / SVG stroke",
    properties: ["stroke", "stroke-width", "stroke-opacity", "stroke-linejoin", "stroke-linecap"],
    hint: "An open SVG path isolates stroke paint, width, opacity, join and cap semantics without a fill pass.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <svg id=\"stroke-case\">\n    <path id=\"stroke-style\" d=\"M 40 230 L 180 50 L 320 230 L 460 50\"></path>\n  </svg>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#stroke-case {
  position: absolute;
  left: 720px;
  top: 160px;
  width: 480px;
  height: 280px;
}

#stroke-style {
  fill: none;
  stroke: #facc15;
  stroke-width: 28px;
  stroke-opacity: 0.82;
  stroke-linejoin: bevel;
  stroke-linecap: round;
}`,
    }),
  },
  {
    id: "html-compiler.paint.svg-dash-order",
    phase: "P0",
    topic: "Paint",
    label: "Paint / dash + paint-order",
    properties: ["stroke-dasharray", "stroke-dashoffset", "paint-order", "fill", "stroke"],
    hint: "A closed path keeps dashed stroke geometry, dash offset and explicit stroke-before-fill paint order in the lowered path style.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <svg id=\"dash-order-case\">\n    <path id=\"dash-order\" d=\"M 40 220 L 120 40 L 240 180 L 340 40 L 440 220 Z\"></path>\n  </svg>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#dash-order-case {
  position: absolute;
  left: 1320px;
  top: 160px;
  width: 480px;
  height: 280px;
}

#dash-order {
  fill: #a78bfa;
  fill-opacity: 0.65;
  fill-rule: nonzero;
  stroke: #facc15;
  stroke-width: 18px;
  stroke-opacity: 0.9;
  stroke-linejoin: round;
  stroke-linecap: butt;
  stroke-dasharray: 30px 16px;
  stroke-dashoffset: 12px;
  paint-order: stroke fill;
      }`,
    }),
  },
  {
    id: "html-compiler.paint.linear-gradient",
    phase: "P0",
    topic: "Paint",
    label: "Paint / linear gradient",
    properties: ["linear-gradient", "angle", "multi-stop", "background"],
    hint: "A multi-stop linear gradient is lowered to semantic stops and a runtime angle in composition pixels.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"linear-gradient\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#linear-gradient {
  position: absolute;
  left: 120px;
  top: 360px;
  width: 480px;
  height: 240px;
  background: linear-gradient(90deg, #38bdf8 0%, #a78bfa 50%, #facc15 100%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.radial-gradient",
    phase: "P0",
    topic: "Paint",
    label: "Paint / radial gradient",
    properties: ["radial-gradient", "center", "multi-stop", "background"],
    hint: "A centered radial gradient preserves its normalized center and color-stop sequence for Protocol V2.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"radial-gradient\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#radial-gradient {
  position: absolute;
  left: 720px;
  top: 360px;
  width: 480px;
  height: 240px;
  background: radial-gradient(circle at 50% 50%, #f8fafc 0%, #38bdf8 42%, #1e3a8a 100%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.conic-gradient",
    phase: "P0",
    topic: "Paint",
    label: "Paint / conic gradient",
    properties: ["conic-gradient", "from", "center", "multi-stop"],
    hint: "A conic gradient uses the Protocol V2 conic primitive with an explicit start angle and normalized center.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"conic-gradient\"></div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#conic-gradient {
  position: absolute;
  left: 1320px;
  top: 360px;
  width: 480px;
  height: 240px;
  background: conic-gradient(from 45deg at 50% 50%, #38bdf8 0%, #a78bfa 33%, #facc15 66%, #fb7185 100%);
}`,
    }),
  },
  {
    id: "html-compiler.media.object-fit-contain",
    phase: "P0",
    topic: "Media",
    label: "Media / object-fit contain",
    properties: ["img", "object-fit: contain", "object-position", "asset"],
    hint: "Contain preserves the image aspect ratio inside a fixed composition viewport and keeps the source centered.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <img id=\"media-contain\" src=\"/preview/image/photo-landscape.jpg\">\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#media-contain {
  position: absolute;
  left: 120px;
  top: 360px;
  width: 480px;
  height: 300px;
  object-fit: contain;
  object-position: center;
}`,
    }),
  },
  {
    id: "html-compiler.media.object-fit-cover-position",
    phase: "P0",
    topic: "Media",
    label: "Media / cover + position",
    properties: ["img", "object-fit: cover", "object-position: right top", "clipping"],
    hint: "Cover fills the viewport, clips the overflow and uses object-position to choose the visible crop region.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <img id=\"media-cover\" src=\"/preview/image/photo-portrait.jpg\">\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#media-cover {
  position: absolute;
  left: 720px;
  top: 360px;
  width: 480px;
  height: 300px;
  object-fit: cover;
  object-position: right top;
}`,
    }),
  },
  {
    id: "html-compiler.media.object-fit-fill-rendering",
    phase: "P0",
    topic: "Media",
    label: "Media / fill + pixelated",
    properties: ["img", "object-fit: fill", "image-rendering: pixelated", "asset"],
    hint: "Fill maps to a non-uniform image viewport; pixelated is lowered to nearest-neighbor sampling where the renderer can guarantee it.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <img id=\"media-fill\" src=\"/preview/image/img-alpha.png\">\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#media-fill {
  position: absolute;
  left: 1320px;
  top: 360px;
  width: 480px;
  height: 300px;
  object-fit: fill;
  image-rendering: pixelated;
}`,
    }),
  },
  {
    id: "html-compiler.media.object-fit-none-clipping",
    phase: "P0",
    topic: "Media",
    label: "Media / none + clipping",
    properties: ["img", "object-fit: none", "object-position", "overflow: hidden"],
    hint: "None keeps the intrinsic image scale and relies on the image viewport plus its overflow-hidden parent for deterministic clipping.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"media-none-viewport\">\n    <img id=\"media-none\" src=\"/preview/image/photo-landscape.jpg\">\n  </div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#media-none-viewport {
  position: absolute;
  left: 720px;
  top: 720px;
  width: 480px;
  height: 240px;
  overflow: hidden;
  background: #172333;
}

#media-none {
  position: absolute;
  left: 0;
  top: 0;
  width: 640px;
  height: 360px;
  object-fit: none;
  object-position: center;
}`,
    }),
  },
  {
    id: "html-compiler.typography.text-align-values",
    phase: "P0",
    topic: "Typography",
    label: "Typography / text-align values",
    properties: ["text-align", "start", "end", "left", "right", "center", "justify", "match-parent", "justify-all"],
    hint: "Eight CSS text-align inputs are normalized into the Protocol V2 text layout contract; match-parent resolves to left for the compiler's fixed LTR text and justify-all preserves its base justify alignment.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        `<body>
  <div id="align-start">start — logical inline start</div>
  <div id="align-end">end — logical inline end</div>
  <div id="align-left">left — physical left edge</div>
  <div id="align-right">right — physical right edge</div>
  <div id="align-center">center — centered in the line box</div>
  <div id="align-justify">justify — expanded line spacing</div>
  <div id="align-match-parent">match-parent — resolved against the parent</div>
  <div id="align-justify-all">justify-all — all lines justified</div>
</body>`,
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#align-start,
#align-end,
#align-left,
#align-right,
#align-center,
#align-justify,
#align-match-parent,
#align-justify-all {
  position: absolute;
  left: 240px;
  width: 1440px;
  height: 80px;
  color: #f8fafc;
  font-family: "Inter";
  font-size: 32px;
}

#align-start { top: 120px; text-align: start; }
#align-end { top: 220px; text-align: end; }
#align-left { top: 320px; text-align: left; }
#align-right { top: 420px; text-align: right; }
#align-center { top: 520px; text-align: center; }
#align-justify { top: 620px; text-align: justify; }
#align-match-parent { top: 720px; text-align: match-parent; }
#align-justify-all { top: 820px; text-align: justify-all; }`,
    }),
  },
  {
    id: "html-compiler.typography.text-spacing-whitespace",
    phase: "P0",
    topic: "Typography",
    label: "Typography / spacing and white-space",
    properties: ["letter-spacing", "word-spacing", "white-space", "normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces"],
    hint: "CSS letter-spacing and word-spacing are lowered into text spans; white-space preserves or collapses source whitespace before runtime wrapping and shaping.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        `<body>
  <div id="spacing-letter">letter spacing: A   B   C</div>
  <div id="spacing-word">word spacing: A B C</div>
  <div id="whitespace-normal">normal: A   B
    C</div>
  <div id="whitespace-nowrap">nowrap: A   B   C</div>
  <div id="whitespace-pre">pre: A   B
    C</div>
  <div id="whitespace-pre-wrap">pre-wrap: A   B
    C</div>
  <div id="whitespace-pre-line">pre-line: A   B
    C</div>
  <div id="whitespace-break-spaces">break-spaces: A   B   C</div>
</body>`,
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#spacing-letter,
#spacing-word,
#whitespace-normal,
#whitespace-nowrap,
#whitespace-pre,
#whitespace-pre-wrap,
#whitespace-pre-line,
#whitespace-break-spaces {
  position: absolute;
  left: 180px;
  width: 1560px;
  height: 90px;
  color: #f8fafc;
  font-family: "Inter";
  font-size: 32px;
}

#spacing-letter { top: 80px; letter-spacing: 8px; }
#spacing-word { top: 180px; word-spacing: 28px; }
#whitespace-normal { top: 280px; white-space: normal; }
#whitespace-nowrap { top: 380px; white-space: nowrap; }
#whitespace-pre { top: 480px; white-space: pre; }
#whitespace-pre-wrap { top: 580px; white-space: pre-wrap; }
#whitespace-pre-line { top: 680px; white-space: pre-line; }
#whitespace-break-spaces { top: 780px; white-space: break-spaces; }`,
    }),
  },
  {
    id: "html-compiler.typography.direction-writing-decoration",
    phase: "P0",
    topic: "Typography",
    label: "Typography / direction, writing-mode and decoration",
    properties: ["direction", "ltr", "rtl", "writing-mode", "horizontal-tb", "vertical-rl", "vertical-lr", "text-decoration", "underline", "overline", "line-through"],
    hint: "CSS direction and writing-mode are emitted on the text source; text-decoration is lowered into Protocol V2 decoration paints and thickness.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        `<body>
  <div id="direction-ltr">LTR direction — logical start</div>
  <div id="direction-rtl">RTL direction — بداية النص</div>
  <div id="writing-horizontal">horizontal-tb writing mode</div>
  <div id="writing-vertical-rl">VERTICAL-RL</div>
  <div id="writing-vertical-lr">VERTICAL-LR</div>
  <div id="decoration-all">underline overline and line-through</div>
</body>`,
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#direction-ltr,
#direction-rtl,
#writing-horizontal,
#writing-vertical-rl,
#writing-vertical-lr,
#decoration-all {
  position: absolute;
  left: 180px;
  width: 1560px;
  height: 90px;
  color: #f8fafc;
  font-family: "Inter";
  font-size: 32px;
}

#direction-ltr { top: 80px; direction: ltr; text-align: start; }
#direction-rtl { top: 180px; direction: rtl; text-align: start; }
#writing-horizontal { top: 280px; writing-mode: horizontal-tb; }
#writing-vertical-rl { top: 380px; left: 720px; width: 480px; height: 560px; writing-mode: vertical-rl; }
#writing-vertical-lr { top: 380px; left: 1260px; width: 480px; height: 560px; writing-mode: vertical-lr; }
#decoration-all { top: 980px; text-decoration: underline 3px #f97316 overline line-through; }`,
    }),
  },
  {
    id: "html-compiler.typography.font-family-three-fonts",
    phase: "P0",
    topic: "Typography",
    label: "Typography / three font families",
    properties: ["font-family", "font-size", "font-weight", "Inter", "Lora", "Roboto"],
    hint: "Three exact font assets are resolved from the ordered CSS family and weight, then emitted as semantic Protocol V2 text layers.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"font-inter\">Inter — precise interface</div>\n  <div id=\"font-lora\">Lora — editorial voice</div>\n  <div id=\"font-roboto\">Roboto — neutral motion</div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#font-inter,
#font-lora,
#font-roboto {
  position: absolute;
  left: 240px;
  width: 1440px;
  height: 100px;
  color: #f8fafc;
}

#font-inter {
  top: 220px;
  font-family: "Inter", sans-serif;
  font-size: 72px;
  font-weight: 400;
}

#font-lora {
  top: 430px;
  font-family: "Lora", serif;
  font-size: 68px;
  font-weight: 700;
}

#font-roboto {
  top: 640px;
  font-family: "Roboto", sans-serif;
  font-size: 76px;
  font-weight: 700;
}`,
    }),
  },
  {
    id: "html-compiler.typography.emoji-fallback",
    phase: "P0",
    topic: "Typography",
    label: "Typography / emoji fallback",
    properties: ["emoji", "emoji with text", "three emoji", "font-family"],
    hint: "Emoji glyphs use the explicit Noto Color Emoji fallback while the mixed line keeps Inter as its primary text face.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"emoji-single\">😀</div>\n  <div id=\"emoji-text\">Neonix 🚀</div>\n  <div id=\"emoji-triple\">🚀 🎬 ✨</div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#emoji-single,
#emoji-text,
#emoji-triple {
  position: absolute;
  left: 560px;
  width: 800px;
  height: 150px;
  color: #f8fafc;
}

#emoji-single {
  top: 180px;
  font-family: "Noto Color Emoji";
  font-size: 112px;
  font-weight: 400;
}

#emoji-text {
  top: 430px;
  font-family: "Inter", "Noto Color Emoji", sans-serif;
  font-size: 84px;
  font-weight: 700;
}

#emoji-triple {
  top: 680px;
  font-family: "Noto Color Emoji";
  font-size: 112px;
  font-weight: 400;
      }`,
    }),
  },
  {
    id: "html-compiler.typography.weight-fallback",
    phase: "P0",
    topic: "Typography",
    label: "Typography / CSS weight fallback",
    properties: ["font-family", "font-weight", "600 → 700 fallback"],
    hint: "When a requested CSS weight is unavailable, the compiler selects the deterministic nearest catalog face and records its asset ID.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"weight-fallback\">Inter 600 resolves to the next available face</div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#weight-fallback {
  position: absolute;
  left: 240px;
  top: 420px;
  width: 1440px;
  height: 120px;
  color: #f8fafc;
  font-family: "Inter", sans-serif;
  font-size: 64px;
  font-weight: 600;
}`,
    }),
  },
  {
    id: "html-compiler.typography.family-fallback",
    phase: "P0",
    topic: "Typography",
    label: "Typography / family fallback",
    properties: ["font-family", "ordered fallback", "catalog lookup"],
    hint: "A missing user-like family is skipped and the next concrete system family is selected without relying on browser-installed fonts.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"family-fallback\">Missing family → Inter catalog fallback</div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#family-fallback {
  position: absolute;
  left: 240px;
  top: 420px;
  width: 1440px;
  height: 120px;
  color: #f8fafc;
  font-family: "User Uploaded Sans", "Inter", sans-serif;
  font-size: 64px;
  font-weight: 400;
      }`,
    }),
  },
  {
    id: "html-compiler.typography.style-stretch",
    phase: "P0",
    topic: "Typography",
    label: "Typography / style + stretch",
    properties: ["font-style", "font-stretch", "italic", "condensed", "weight 400", "weight 700"],
    hint: "Style and stretch are semantic span values; the two condensed lines prove that weight 400 and 700 resolve to different catalog faces.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"style-italic\">Italic catalog face</div>\n  <div id=\"style-condensed-regular\">Condensed weight 400</div>\n  <div id=\"style-condensed-bold\">Condensed weight 700</div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#style-italic,
#style-condensed-regular,
#style-condensed-bold {
  position: absolute;
  left: 240px;
  top: 420px;
  width: 1440px;
  height: 120px;
  color: #f8fafc;
  font-family: "Inter", "Roboto";
  font-size: 72px;
}

#style-italic {
  font-family: "Inter";
  font-style: italic;
}

#style-condensed-regular,
#style-condensed-bold {
  top: 560px;
  font-family: "Roboto";
  font-stretch: condensed;
}

#style-condensed-bold {
  top: 700px;
  font-weight: 700;
      }`,
    }),
  },
  {
    id: "html-compiler.typography.line-height-short",
    phase: "P0",
    topic: "Typography",
    label: "Typography / line-height short paragraph",
    properties: ["line-height", "paragraph", "short", "64px"],
    hint: "A short paragraph with an explicit line-height is lowered to a numeric line box in composition pixels.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <p id=\"line-height-short\">A short paragraph with a fixed line box.</p>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#line-height-short {
  position: absolute;
  left: 240px;
  top: 420px;
  width: 1440px;
  height: 100px;
  margin: 0;
  color: #f8fafc;
  font-family: "Inter";
  font-size: 48px;
  line-height: 64px;
}`,
    }),
  },
  {
    id: "html-compiler.typography.line-height-normal",
    phase: "P0",
    topic: "Typography",
    label: "Typography / line-height normal",
    properties: ["line-height", "paragraph", "normal", "1.2 normalization"],
    hint: "The CSS normal keyword is normalized deterministically to 1.2 times the computed font size.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <p id=\"line-height-normal\">A normal paragraph keeps the standard deterministic line box.</p>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#line-height-normal {
  position: absolute;
  left: 240px;
  top: 420px;
  width: 1440px;
  height: 100px;
  margin: 0;
  color: #f8fafc;
  font-family: "Inter";
  font-size: 48px;
  line-height: normal;
}`,
    }),
  },
  {
    id: "html-compiler.typography.line-height-long",
    phase: "P0",
    topic: "Typography",
    label: "Typography / line-height long paragraph",
    properties: ["line-height", "paragraph", "long", "1.75"],
    hint: "A longer paragraph uses a unitless line-height, which the compiler resolves against the computed font size.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <p id=\"line-height-long\">A longer paragraph makes the vertical rhythm visible across more content. The compiler keeps the authored semantic value in HTML and lowers its resolved line box into Protocol V2 composition units for deterministic runtime rendering.</p>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#line-height-long {
  position: absolute;
  left: 240px;
  top: 320px;
  width: 1440px;
  height: 300px;
  margin: 0;
  color: #f8fafc;
  font-family: "Inter";
  font-size: 40px;
  line-height: 1.75;
}`,
    }),
  },
  {
    id: "html-compiler.typography.text-overflow-ellipsis",
    phase: "P0",
    topic: "Typography",
    label: "Typography / text-overflow ellipsis",
    properties: ["text-overflow", "ellipsis", "overflow", "nowrap", "deterministic clipping"],
    hint: "Ellipsis is emitted only for a clipped single-line text box; the runtime trims grapheme clusters before shaping the final ellipsis glyph.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"text-overflow-ellipsis\">This is a deterministic single-line overflow example that ends with an ellipsis.</div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#text-overflow-ellipsis {
  position: absolute;
  left: 240px;
  top: 420px;
  width: 720px;
  height: 90px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #f8fafc;
  font-family: "Inter";
  font-size: 48px;
}`,
    }),
  },
  {
    id: "html-compiler.typography.text-rendering-capability",
    phase: "P0",
    topic: "Typography",
    label: "Typography / text-rendering capability",
    properties: ["text-rendering", "auto", "optimizeSpeed", "geometricPrecision"],
    hint: "The authored rendering intent is preserved in Protocol V2; optimizeSpeed may use a mask while geometricPrecision selects vector glyphs.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace(
        "<body>\n</body>",
        "<body>\n  <div id=\"rendering-auto\">auto — balanced text rendering</div>\n  <div id=\"rendering-speed\">optimizeSpeed — mask-capable text rendering</div>\n  <div id=\"rendering-precision\">geometricPrecision — vector text rendering</div>\n</body>",
      ),
      css: `body {
  margin: 0;
  background: #081018;
}

#rendering-auto,
#rendering-speed,
#rendering-precision {
  position: absolute;
  left: 240px;
  width: 1440px;
  height: 90px;
  color: #f8fafc;
  font-family: "Inter";
  font-size: 48px;
}

#rendering-auto { top: 240px; text-rendering: auto; }
#rendering-speed { top: 440px; text-rendering: optimizeSpeed; }
#rendering-precision { top: 640px; text-rendering: geometricPrecision; }`,
    }),
  },
];

export const HTML_COMPILER_DEFAULT_CASE_ID = HTML_COMPILER_PHASE0_CASES[0].id;

export function htmlCompilerPreviewGroups(): Array<{ topic: HtmlCompilerPreviewTopic; cases: HtmlCompilerPreviewCase[] }> {
  const groups = new Map<HtmlCompilerPreviewTopic, HtmlCompilerPreviewCase[]>();
  for (const item of HTML_COMPILER_PHASE0_CASES) {
    const cases = groups.get(item.topic) ?? [];
    cases.push(item);
    groups.set(item.topic, cases);
  }
  return [...groups.entries()].map(([topic, cases]) => ({ topic, cases }));
}

export function htmlCompilerPreviewCaseById(id: string | null | undefined): HtmlCompilerPreviewCase {
  return HTML_COMPILER_PHASE0_CASES.find((item) => item.id === id) ?? HTML_COMPILER_PHASE0_CASES[0];
}
