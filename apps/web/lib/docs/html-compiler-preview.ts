import { createHtmlCssSource, createNewHtmlProject, DEFAULT_NEONIX_HTML_DOCUMENT, type HtmlCompilerFontAsset, type HtmlCssSource } from "@motionvideo/html-compiler";

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

export type HtmlCompilerPreviewCase = {
  id: string;
  phase: "P0" | "P1.1" | "P1.2" | "P1.3" | "P1.4" | "P2.0" | "P2.1" | "P2.2" | "P2.3" | "P2.4" | "P2.5" | "P2.6" | "P2.7" | "P2.8" | "P3";
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

export const HTML_COMPILER_PHASE1_1_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.layout.flex-row-fixed",
    phase: "P1.1",
    topic: "Layout",
    label: "Layout / flex row",
    properties: ["display:flex", "flex-direction:row", "fixed items"],
    hint: "A single-line row places fixed-size children in source order inside the composition frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"flex-row\">\n    <div id=\"row-cyan\"></div>\n    <div id=\"row-violet\"></div>\n    <div id=\"row-yellow\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#flex-row { position: absolute; left: 240px; top: 360px; width: 960px; height: 240px; display: flex; flex-direction: row; }
#row-cyan, #row-violet, #row-yellow { width: 240px; height: 120px; }
#row-cyan { background: #38bdf8; }
#row-violet { background: #a78bfa; }
#row-yellow { background: #facc15; }`,
    }),
  },
  {
    id: "html-compiler.layout.flex-column-gap",
    phase: "P1.1",
    topic: "Layout",
    label: "Layout / column + gap",
    properties: ["flex-direction:column", "gap", "row-gap", "column-gap"],
    hint: "A column uses the main-axis gap between fixed-size items; wrapping is intentionally outside P1.1.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"flex-column\">\n    <div id=\"column-one\"></div>\n    <div id=\"column-two\"></div>\n    <div id=\"column-three\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#flex-column { position: absolute; left: 360px; top: 220px; width: 480px; height: 640px; display: flex; flex-direction: column; gap: 28px; }
#column-one, #column-two, #column-three { width: 260px; height: 120px; }
#column-one { background: #22d3ee; }
#column-two { background: #fb7185; }
#column-three { background: #4ade80; }`,
    }),
  },
  {
    id: "html-compiler.layout.flex-justify-align",
    phase: "P1.1",
    topic: "Layout",
    label: "Layout / justify + align",
    properties: ["justify-content:space-between", "align-items:center", "align-self"],
    hint: "Main-axis distribution and cross-axis centering resolve to explicit composition coordinates.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"flex-distribution\">\n    <div id=\"distribution-one\"></div>\n    <div id=\"distribution-two\"></div>\n    <div id=\"distribution-three\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#flex-distribution { position: absolute; left: 220px; top: 330px; width: 1200px; height: 360px; display: flex; justify-content: space-between; align-items: center; }
#distribution-one, #distribution-two, #distribution-three { width: 180px; height: 100px; }
#distribution-one { background: #38bdf8; }
#distribution-two { align-self: flex-end; background: #f472b6; }
#distribution-three { background: #facc15; }`,
    }),
  },
  {
    id: "html-compiler.layout.flex-grow-shrink",
    phase: "P1.1",
    topic: "Layout",
    label: "Layout / flex grow + shrink",
    properties: ["flex", "flex-grow", "flex-shrink", "flex-basis"],
    hint: "The flex shorthand expands to grow, shrink and basis before free space is distributed.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"flex-grow\">\n    <div id=\"grow-one\"></div>\n    <div id=\"grow-two\"></div>\n    <div id=\"grow-three\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#flex-grow { position: absolute; left: 240px; top: 400px; width: 1440px; height: 180px; display: flex; gap: 24px; }
#grow-one { flex: 1; background: #38bdf8; }
#grow-two { flex: 2; background: #a78bfa; }
#grow-three { flex: 1; background: #fb7185; }`,
    }),
  },
  {
    id: "html-compiler.layout.flex-order",
    phase: "P1.1",
    topic: "Layout",
    label: "Layout / order",
    properties: ["order", "source order", "paint order"],
    hint: "Order changes the flex placement sequence while the lowered layers retain deterministic paint ordering.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"flex-order\">\n    <div id=\"order-first\"></div>\n    <div id=\"order-middle\"></div>\n    <div id=\"order-last\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#flex-order { position: absolute; left: 260px; top: 380px; width: 1200px; height: 220px; display: flex; gap: 32px; align-items: center; }
#order-first, #order-middle, #order-last { width: 240px; height: 120px; }
#order-first { order: 3; background: #38bdf8; }
#order-middle { order: 1; background: #a78bfa; }
#order-last { order: 2; background: #fb7185; }`,
    }),
  },
];

export const HTML_COMPILER_PHASE1_2_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.layout.flex-wrap-lines",
    phase: "P1.2",
    topic: "Layout",
    label: "Layout / flex wrap lines",
    properties: ["flex-wrap:wrap", "row-gap", "column-gap"],
    hint: "Items form deterministic flex lines when the main-axis content box is full; row and column gaps stay in their CSS axes.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"wrap-lines\">\n    <div id=\"wrap-one\"></div>\n    <div id=\"wrap-two\"></div>\n    <div id=\"wrap-three\"></div>\n    <div id=\"wrap-four\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#wrap-lines { position: absolute; left: 220px; top: 260px; width: 960px; height: 420px; display: flex; flex-wrap: wrap; align-content: flex-start; align-items: flex-start; row-gap: 32px; column-gap: 24px; }
#wrap-one, #wrap-two, #wrap-three, #wrap-four { width: 300px; height: 100px; }
#wrap-one { background: #38bdf8; } #wrap-two { background: #a78bfa; }
#wrap-three { background: #fb7185; } #wrap-four { background: #4ade80; }`,
    }),
  },
  {
    id: "html-compiler.layout.flex-align-content",
    phase: "P1.2",
    topic: "Layout",
    label: "Layout / align-content",
    properties: ["align-content:space-between", "multi-line alignment", "align-items:center"],
    hint: "After line formation, align-content distributes the remaining cross-axis space between flex lines.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"align-lines\">\n    <div id=\"align-one\"></div>\n    <div id=\"align-two\"></div>\n    <div id=\"align-three\"></div>\n    <div id=\"align-four\"></div>\n    <div id=\"align-five\"></div>\n    <div id=\"align-six\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#align-lines { position: absolute; left: 220px; top: 220px; width: 960px; height: 600px; display: flex; flex-wrap: wrap; align-content: space-between; align-items: center; column-gap: 24px; row-gap: 20px; }
#align-one, #align-two, #align-three, #align-four, #align-five, #align-six { width: 280px; height: 100px; }
#align-one { background: #22d3ee; } #align-two { background: #a78bfa; } #align-three { background: #facc15; }
#align-four { background: #fb7185; } #align-five { background: #4ade80; } #align-six { background: #f97316; }`,
    }),
  },
  {
    id: "html-compiler.layout.flex-wrap-reverse",
    phase: "P1.2",
    topic: "Layout",
    label: "Layout / wrap-reverse",
    properties: ["flex-wrap:wrap-reverse", "cross-axis reversal", "align-self"],
    hint: "wrap-reverse reverses the cross-axis line order while IDs and source order remain stable.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"reverse-lines\">\n    <div id=\"reverse-one\"></div>\n    <div id=\"reverse-two\"></div>\n    <div id=\"reverse-three\"></div>\n    <div id=\"reverse-four\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#reverse-lines { position: absolute; left: 280px; top: 200px; width: 840px; height: 620px; display: flex; flex-wrap: wrap-reverse; align-content: flex-start; align-items: flex-start; row-gap: 28px; column-gap: 24px; }
#reverse-one, #reverse-two, #reverse-three, #reverse-four { width: 360px; height: 120px; }
#reverse-one { background: #38bdf8; } #reverse-two { background: #a78bfa; }
#reverse-three { background: #fb7185; } #reverse-four { background: #4ade80; }`,
    }),
  },
];

export const HTML_COMPILER_PHASE1_3_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.layout.grid-explicit-columns",
    phase: "P1.3",
    topic: "Layout",
    label: "Layout / grid columns",
    properties: ["display:grid", "grid-template-columns", "px", "%", "fr"],
    hint: "Explicit px and fr columns resolve to fixed composition tracks; unassigned children use deterministic row-major placement.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"grid-columns\">\n    <div id=\"columns-one\"></div>\n    <div id=\"columns-two\"></div>\n    <div id=\"columns-three\"></div>\n    <div id=\"columns-four\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#grid-columns { position: absolute; left: 220px; top: 220px; width: 1080px; height: 560px; display: grid; grid-template-columns: 25% 1fr 2fr; grid-template-rows: 180px 180px; column-gap: 24px; row-gap: 28px; }
#columns-one, #columns-two, #columns-three, #columns-four { background: #38bdf8; }`,
    }),
  },
  {
    id: "html-compiler.layout.grid-explicit-placement",
    phase: "P1.3",
    topic: "Layout",
    label: "Layout / grid placement",
    properties: ["grid-column-start/end", "grid-row-start/end", "explicit cells"],
    hint: "Explicit grid line placement maps directly to deterministic track rectangles.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"grid-placement\">\n    <div id=\"placement-one\"></div>\n    <div id=\"placement-two\"></div>\n    <div id=\"placement-three\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#grid-placement { position: absolute; left: 240px; top: 180px; width: 960px; height: 680px; display: grid; grid-template-columns: 240px 240px 240px; grid-template-rows: 160px 200px 180px; gap: 24px; }
#placement-one { grid-column-start: 1; grid-column-end: 3; grid-row-start: 1; grid-row-end: 2; background: #22d3ee; }
#placement-two { grid-column-start: 3; grid-column-end: 4; grid-row-start: 1; grid-row-end: 3; background: #a78bfa; }
#placement-three { grid-column-start: 1; grid-column-end: 2; grid-row-start: 3; grid-row-end: 4; background: #fb7185; }`,
    }),
  },
  {
    id: "html-compiler.layout.grid-gap-alignment",
    phase: "P1.3",
    topic: "Layout",
    label: "Layout / grid gap + alignment",
    properties: ["gap", "place-items", "justify-content", "align-content"],
    hint: "Track gaps, track-area alignment and item alignment are resolved independently inside the composition content box.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"grid-alignment\">\n    <div id=\"alignment-one\"></div>\n    <div id=\"alignment-two\"></div>\n    <div id=\"alignment-three\"></div>\n    <div id=\"alignment-four\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#grid-alignment { position: absolute; left: 220px; top: 180px; width: 1000px; height: 680px; display: grid; grid-template-columns: repeat(2, 240px); grid-template-rows: repeat(2, 160px); column-gap: 32px; row-gap: 28px; justify-content: center; align-content: flex-end; place-items: center; }
#alignment-one, #alignment-two, #alignment-three, #alignment-four { width: 120px; height: 80px; }
#alignment-one { background: #38bdf8; } #alignment-two { background: #a78bfa; }
#alignment-three { background: #facc15; } #alignment-four { background: #4ade80; }`,
    }),
  },
  {
    id: "html-compiler.layout.grid-spans",
    phase: "P1.3",
    topic: "Layout",
    label: "Layout / grid spans",
    properties: ["grid-column", "grid-row", "span"],
    hint: "The grid shorthand and span syntax expand to explicit start/end lines before the item is lowered.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"grid-spans\">\n    <div id=\"span-hero\"></div>\n    <div id=\"span-side\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#grid-spans { position: absolute; left: 260px; top: 180px; width: 960px; height: 680px; display: grid; grid-template-columns: 240px 1fr 1fr; grid-template-rows: 220px 220px; gap: 24px; }
#span-hero { grid-column: 1 / span 2; grid-row: 1 / span 2; background: #38bdf8; }
#span-side { grid-column: 3 / 4; grid-row: 1 / 3; background: #fb7185; }`,
    }),
  },
];

export const HTML_COMPILER_PHASE1_4_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.layout.flex-order-minmax",
    phase: "P1.4",
    topic: "Layout",
    label: "Layout / flex order + min-max",
    properties: ["order", "min-width", "max-width", "flex distribution"],
    hint: "Flex order is applied before placement and min/max constraints are enforced after free-space distribution.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"edge-flex\">\n    <div id=\"edge-flex-first\"></div>\n    <div id=\"edge-flex-second\"></div>\n    <div id=\"edge-flex-third\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#edge-flex { position: absolute; left: 220px; top: 360px; width: 1440px; height: 220px; display: flex; gap: 24px; align-items: center; }
#edge-flex-first, #edge-flex-second, #edge-flex-third { height: 120px; }
#edge-flex-first { order: 3; flex: 1; min-width: 280px; max-width: 360px; background: #38bdf8; }
#edge-flex-second { order: 1; flex: 2; background: #a78bfa; }
#edge-flex-third { order: 2; flex: 1; background: #fb7185; }`,
    }),
  },
  {
    id: "html-compiler.layout.grid-order",
    phase: "P1.4",
    topic: "Layout",
    label: "Layout / grid order",
    properties: ["order", "grid auto-placement", "stable ids"],
    hint: "Grid auto-placement follows the order-modified sequence while the source IDs remain stable in Protocol V2.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"edge-grid\">\n    <div id=\"edge-grid-first\"></div>\n    <div id=\"edge-grid-second\"></div>\n    <div id=\"edge-grid-third\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#edge-grid { position: absolute; left: 260px; top: 320px; width: 1200px; height: 260px; display: grid; grid-template-columns: repeat(3, 240px); grid-template-rows: 120px; column-gap: 32px; align-content: center; }
#edge-grid-first { order: 3; background: #38bdf8; }
#edge-grid-second { order: 1; background: #a78bfa; }
#edge-grid-third { order: 2; background: #fb7185; }`,
    }),
  },
  {
    id: "html-compiler.layout.relative-margins",
    phase: "P1.4",
    topic: "Layout",
    label: "Layout / relative + margins",
    properties: ["position:relative", "relative offset", "non-collapsing margins"],
    hint: "Relative offsets move the painted item after its flex slot is resolved; adjacent flex margins are summed, not collapsed.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"edge-relative\">\n    <div id=\"edge-relative-one\"></div>\n    <div id=\"edge-relative-two\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#edge-relative { position: absolute; left: 260px; top: 360px; width: 1100px; height: 220px; display: flex; align-items: flex-start; }
#edge-relative-one { position: relative; left: 24px; top: 18px; width: 240px; height: 120px; margin-right: 36px; background: #38bdf8; }
#edge-relative-two { width: 240px; height: 120px; margin-left: 44px; background: #facc15; }`,
    }),
  },
  {
    id: "html-compiler.layout.contents-parent",
    phase: "P1.4",
    topic: "Layout",
    label: "Layout / contents parent",
    properties: ["display:contents", "grid parent", "parent layer"],
    hint: "A display:contents wrapper contributes no layer; its visual child is placed and parented directly under the formatting context.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"edge-contents-grid\">\n    <div id=\"edge-contents\"><div id=\"edge-contents-child\"></div></div>\n    <div id=\"edge-contents-peer\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#edge-contents-grid { position: absolute; left: 300px; top: 340px; width: 960px; height: 260px; display: grid; grid-template-columns: 420px 420px; grid-template-rows: 140px; column-gap: 32px; align-content: center; }
#edge-contents { display: contents; }
#edge-contents-child { background: #38bdf8; }
#edge-contents-peer { background: #a78bfa; }`,
    }),
  },
  {
    id: "html-compiler.layout.containing-block-clip",
    phase: "P1.4",
    topic: "Layout",
    label: "Layout / containing block + clip",
    properties: ["absolute child", "flex containing block", "overflow:hidden"],
    hint: "A flex container establishes the absolute child's containing block and its overflow clip remains attached to the parent group.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"edge-clip\">\n    <div id=\"edge-clip-absolute\"></div>\n    <div id=\"edge-clip-wide\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#edge-clip { position: absolute; left: 320px; top: 320px; width: 700px; height: 220px; padding: 20px; display: flex; overflow: hidden; }
#edge-clip-absolute { position: absolute; left: 40px; top: 30px; width: 120px; height: 80px; background: #fb7185; }
#edge-clip-wide { flex-shrink: 0; width: 1000px; height: 120px; background: #38bdf8; }`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_0_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.background-image-position-size",
    phase: "P2.0",
    topic: "Paint",
    label: "Paint / background image position + size",
    properties: ["background-image", "background-position", "background-size", "no-repeat"],
    hint: "A URL background is lowered to an image atomic with deterministic cover sizing, center positioning and a border-box clip.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-background-cover\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-background-cover {
  position: absolute;
  left: 360px;
  top: 300px;
  width: 1200px;
  height: 480px;
  background-color: #172554;
  background-image: url("/preview/image/photo-landscape.jpg");
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}`,
    }),
  },
  {
    id: "html-compiler.paint.background-origin-clip",
    phase: "P2.0",
    topic: "Paint",
    label: "Paint / background origin + clip",
    properties: ["background-origin", "background-clip", "padding-box", "content-box"],
    hint: "The image is positioned from the padding box while its paint is clipped to the content box inside an explicit border and padding.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-background-boxes\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-background-boxes {
  position: absolute;
  left: 480px;
  top: 300px;
  width: 960px;
  height: 480px;
  box-sizing: border-box;
  padding: 48px;
  border: 20px solid #38bdf8;
  background-color: #172554;
  background-image: url("/preview/image/photo-portrait.jpg");
  background-position: center;
  background-size: contain;
  background-repeat: no-repeat;
  background-origin: padding-box;
  background-clip: content-box;
}`,
    }),
  },
  {
    id: "html-compiler.paint.background-image-repeat",
    phase: "P2.0",
    topic: "Paint",
    label: "Paint / background image repeat",
    properties: ["background-image", "background-size", "repeat-x", "repeat-y", "clip"],
    hint: "An explicitly sized image is tiled into bounded image atomics and each tile is clipped to the owner paint box.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-background-repeat\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-background-repeat {
  position: absolute;
  left: 360px;
  top: 300px;
  width: 1200px;
  height: 480px;
  background-color: #172554;
  background-image: url("/preview/image/img-alpha.png");
  background-position: 0% 0%;
  background-size: 160px 120px;
  background-repeat: repeat;
}`,
    }),
  },
  {
    id: "html-compiler.paint.background-image-list",
    phase: "P2.0",
    topic: "Paint",
    label: "Paint / background image layers",
    properties: ["multiple URL layers", "layer order", "position list", "size list"],
    hint: "CSS image layers retain their authored order while the compiler emits independent image atomics above the solid base paint.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-background-layers\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-background-layers {
  position: absolute;
  left: 420px;
  top: 300px;
  width: 1080px;
  height: 480px;
  background-color: #172554;
  background-image: url("/preview/image/photo-landscape.jpg"), url("/preview/image/img-alpha.png");
  background-position: center, right bottom;
  background-size: cover, 180px 120px;
  background-repeat: no-repeat, no-repeat;
}`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_1_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.repeating-linear-gradient",
    phase: "P2.1",
    topic: "Paint",
    label: "Paint / repeating linear gradient",
    properties: ["repeating-linear-gradient", "short period", "wrap boundary"],
    hint: "A short normalized stop period repeats across the full paint box while preserving the authored angle.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-repeating-linear\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-repeating-linear {
  position: absolute;
  left: 360px;
  top: 300px;
  width: 1200px;
  height: 260px;
  background: repeating-linear-gradient(90deg, #38bdf8 0%, #38bdf8 8%, #a78bfa 8%, #a78bfa 16%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.repeating-radial-gradient",
    phase: "P2.1",
    topic: "Paint",
    label: "Paint / repeating radial gradient",
    properties: ["repeating-radial-gradient", "off-center", "wrap boundary"],
    hint: "An off-center radial gradient repeats from its normalized center, including samples on both sides of the period.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-repeating-radial\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-repeating-radial {
  position: absolute;
  left: 420px;
  top: 260px;
  width: 1080px;
  height: 520px;
  background: repeating-radial-gradient(circle at 28% 62%, #f8fafc 0%, #38bdf8 12%, #1e3a8a 24%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.repeating-conic-gradient",
    phase: "P2.1",
    topic: "Paint",
    label: "Paint / repeating conic gradient",
    properties: ["repeating-conic-gradient", "from 45deg", "off-center"],
    hint: "The repeating conic primitive keeps its start angle and off-center normalized origin while wrapping through the period.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-repeating-conic\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-repeating-conic {
  position: absolute;
  left: 620px;
  top: 260px;
  width: 680px;
  height: 560px;
  background: repeating-conic-gradient(from 45deg at 32% 62%, #facc15 0%, #fb7185 12.5%, #38bdf8 25%, #a78bfa 37.5%, #facc15 50%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.repeating-gradient-background",
    phase: "P2.1",
    topic: "Paint",
    label: "Paint / repeating gradient over solid",
    properties: ["repeating gradient", "solid background", "layer order"],
    hint: "The repeating image layer remains above the solid background layer, with both bounded by the same paint box.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-repeating-over-solid\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-repeating-over-solid {
  position: absolute;
  left: 360px;
  top: 320px;
  width: 1200px;
  height: 360px;
  background: repeating-linear-gradient(135deg, #38bdf8 0%, #38bdf8 10%, transparent 10%, transparent 20%), #172554;
}`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_2_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.border-four-sides",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / border four sides",
    properties: ["border-top/right/bottom/left", "width", "style", "color"],
    hint: "Each border side resolves independently, so width, style and color do not leak across adjacent edges.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-border-four-sides\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-border-four-sides {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #172554;
  border-top: 12px solid #38bdf8;
  border-right: 20px solid #a78bfa;
  border-bottom: 28px solid #facc15;
  border-left: 8px solid #fb7185;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-none-mixed",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / border none mixed",
    properties: ["none", "solid", "per-side resolution"],
    hint: "A none side contributes no visible border while neighboring solid sides remain deterministic.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-border-none-mixed\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-border-none-mixed {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #172554;
  border-top: 18px solid #38bdf8;
  border-right: 18px none #a78bfa;
  border-bottom: 18px solid #facc15;
  border-left: 18px none #fb7185;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-dashed-dotted",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / dashed + dotted border",
    properties: ["dashed", "dotted", "stroke dash", "side paths"],
    hint: "Dashed and dotted borders lower to fitted edge fragments: rectangles for dashes and ellipses for dots.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-border-dashed-dotted\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-border-dashed-dotted {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #172554;
  border-top: 16px dashed #38bdf8;
  border-right: 16px dotted #a78bfa;
  border-bottom: 16px dashed #facc15;
  border-left: 16px dotted #fb7185;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-double",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / double border",
    properties: ["double", "stroke", "stable side order"],
    hint: "The double style becomes two deterministic inset strokes on each side; it does not change the layout frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-border-double\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-border-double {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #172554;
  border: 24px double #38bdf8;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-groove",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / groove border",
    properties: ["groove", "deterministic shading", "paint bands"],
    hint: "Groove is lowered to two fixed-lighting bands per side; the shading is paint-only and does not change the layout frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-border-groove\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-border-groove {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #172554;
  border: 24px groove #38bdf8;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-ridge",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / ridge border",
    properties: ["ridge", "deterministic shading", "paint bands"],
    hint: "Ridge reverses the fixed groove lighting contract while preserving the same border geometry.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-border-ridge\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-border-ridge {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #172554;
  border: 24px ridge #a78bfa;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-inset",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / inset border",
    properties: ["inset", "side shading", "paint-only"],
    hint: "Inset applies the fixed recessed side shading contract without adding border width to layout twice.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-border-inset\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-border-inset {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #172554;
  border: 24px inset #facc15;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-outset",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / outset border",
    properties: ["outset", "side shading", "paint-only"],
    hint: "Outset applies the inverse fixed side shading contract and keeps the authored box geometry unchanged.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-border-outset\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-border-outset {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #172554;
  border: 24px outset #fb7185;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-radius-uniform",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / uniform radius",
    properties: ["border-radius", "uniform", "clamped corners"],
    hint: "A single radius remains the compact rectangle atom and is clamped to half of the resolved box dimensions.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-radius-uniform\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-radius-uniform {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #38bdf8;
  border: 18px solid #f8fafc;
  border-radius: 72px;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-radius-per-corner",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / per-corner radius",
    properties: ["border-radius", "four corners", "path contour"],
    hint: "Four independent corner radii are clamped by adjacent sums and lowered to a rounded path contour.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-radius-per-corner\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-radius-per-corner {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #a78bfa;
  border: 18px solid #38bdf8;
  border-radius: 96px 24px 120px 36px;
}`,
    }),
  },
  {
    id: "html-compiler.paint.border-radius-elliptical",
    phase: "P2.2",
    topic: "Paint",
    label: "Paint / elliptical radius",
    properties: ["border-radius", "horizontal / vertical radii", "ellipse arcs"],
    hint: "The slash form resolves horizontal radii against width and vertical radii against height before CSS adjacent-sum clamping.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-radius-elliptical\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-radius-elliptical {
  position: absolute;
  left: 600px;
  top: 320px;
  width: 720px;
  height: 360px;
  background: #facc15;
  border: 18px solid #fb7185;
  border-radius: 140px 48px / 64px 120px;
}`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_3_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.outline-layout-preserving",
    phase: "P2.3",
    topic: "Paint",
    label: "Paint / outline preserves layout",
    properties: ["outline", "no layout space", "sibling position"],
    hint: "The outline expands only the paint bounds; the flex sibling keeps the same layout slot and gap.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"outline-layout\">\n    <div id=\"outline-target\"></div>\n    <div id=\"outline-sibling\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#outline-layout {
  position: absolute;
  left: 300px;
  top: 300px;
  width: 1320px;
  height: 300px;
  display: flex;
  gap: 180px;
  align-items: center;
  background: #172554;
}

#outline-target,
#outline-sibling {
  width: 360px;
  height: 160px;
  background: #38bdf8;
}

#outline-target {
  margin-left: 180px;
  outline: 14px solid #facc15;
  outline-offset: 18px;
}`,
    }),
  },
  {
    id: "html-compiler.paint.outline-offsets",
    phase: "P2.3",
    topic: "Paint",
    label: "Paint / outline offsets",
    properties: ["outline-width", "outline-style", "outline-color", "outline-offset"],
    hint: "Positive offset moves the outline outward and negative offset moves it into the border box without changing either frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"outline-positive\"></div>\n  <div id=\"outline-negative\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#outline-positive,
#outline-negative {
  position: absolute;
  top: 360px;
  width: 360px;
  height: 180px;
  background: #172554;
  border: 8px solid #334155;
  outline: 14px solid #38bdf8;
}

#outline-positive {
  left: 420px;
  outline-offset: 22px;
}

#outline-negative {
  left: 1140px;
  outline-color: #f97316;
  outline-offset: -10px;
}`,
    }),
  },
  {
    id: "html-compiler.paint.outline-per-corner-radius",
    phase: "P2.3",
    topic: "Paint",
    label: "Paint / outline around per-corner radius",
    properties: ["outline", "outline-offset", "per-corner radius"],
    hint: "The outline reuses the normalized four-corner geometry and follows the same elliptical corner radii without changing layout.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"outline-rounded\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#outline-rounded {
  position: absolute;
  left: 600px;
  top: 300px;
  width: 720px;
  height: 360px;
  background: #a78bfa;
  border-radius: 96px 24px 120px 36px;
  outline: 12px solid #facc15;
  outline-offset: 16px;
}`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_4_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.box-shadow",
    phase: "P2.4",
    topic: "Paint",
    label: "Paint / box shadow",
    properties: ["box-shadow", "offset", "blur", "color"],
    hint: "A box shadow is lowered to the Protocol V2 box shadow effect without changing the owner's frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"box-shadow\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#box-shadow {
  position: absolute;
  left: 600px;
  top: 360px;
  width: 720px;
  height: 300px;
  border-radius: 32px;
  background: #2563eb;
  box-shadow: 28px 32px 36px #00000099;
}`,
    }),
  },
  {
    id: "html-compiler.paint.box-shadow-list",
    phase: "P2.4",
    topic: "Paint",
    label: "Paint / multiple box shadows",
    properties: ["box-shadow", "comma list", "source order"],
    hint: "Comma-separated box shadows remain separate ordered effects in the normalized layer contract.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"box-shadow-list\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#box-shadow-list {
  position: absolute;
  left: 600px;
  top: 360px;
  width: 720px;
  height: 300px;
  background: #172554;
  box-shadow: 0 24px 28px #00000088, 18px 0 0 #38bdf866;
}`,
    }),
  },
  {
    id: "html-compiler.paint.text-shadow",
    phase: "P2.4",
    topic: "Paint",
    label: "Paint / text shadow",
    properties: ["text-shadow", "alpha source", "blur"],
    hint: "Text shadow uses the text alpha silhouette, so the shadow follows glyphs and fallback-font runs.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"text-shadow\">Neonix shadow</div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#text-shadow {
  position: absolute;
  left: 520px;
  top: 380px;
  width: 900px;
  height: 180px;
  color: #f8fafc;
  font-family: Inter;
  font-size: 92px;
  font-weight: 700;
  text-shadow: 18px 20px 18px #38bdf899;
}`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_5_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.filter-blur",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter blur",
    properties: ["filter", "blur()", "spatial effect"],
    hint: "CSS blur lowers to an ordered blur operator over the element surface without changing its layout frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-blur\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-blur {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #38bdf8;
  filter: blur(14px);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-brightness",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter brightness",
    properties: ["filter", "brightness()", "color-adjust"],
    hint: "Brightness is lowered to the existing color-adjust atom as an exact channel multiplication for the supported range.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-brightness\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-brightness {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #38bdf8;
  filter: brightness(1.25);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-contrast",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter contrast",
    properties: ["filter", "contrast()", "color-adjust"],
    hint: "Contrast lowers to a color-adjust operator and remains in the authored filter position.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-contrast\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-contrast {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #a78bfa;
  filter: contrast(1.45);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-grayscale",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter grayscale",
    properties: ["filter", "grayscale()", "color matrix"],
    hint: "Grayscale lowers to a runtime color-matrix operator with its own input and output surface.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-grayscale\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-grayscale {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: linear-gradient(90deg, #f43f5e, #facc15, #38bdf8);
  filter: grayscale(1);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-sepia",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter sepia",
    properties: ["filter", "sepia()", "color matrix"],
    hint: "Sepia is represented as an interpolated color matrix rather than a backend-specific shader shortcut.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-sepia\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-sepia {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #38bdf8;
  filter: sepia(.85);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-invert",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter invert",
    properties: ["filter", "invert()", "color matrix"],
    hint: "Invert lowers to the ordered color-matrix path and keeps partial amounts deterministic.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-invert\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-invert {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #f97316;
  filter: invert(.8);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-opacity-layer-opacity",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter opacity vs layer opacity",
    properties: ["filter", "opacity()", "layer opacity", "separate alpha stages"],
    hint: "filter:opacity() is an ordered source-surface alpha operator; CSS opacity remains the layer alpha and is not merged into it.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-opacity-layer\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-opacity-layer {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #38bdf8;
  opacity: .82;
  filter: opacity(.48);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-drop-shadow",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter drop shadow",
    properties: ["filter", "drop-shadow()", "alpha shadow"],
    hint: "drop-shadow() uses the element alpha silhouette, unlike box-shadow which uses the box geometry atom.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-drop-shadow\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-drop-shadow {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  border-radius: 56px;
  background: #a78bfa;
  filter: drop-shadow(24px 22px 18px #38bdf899);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-color-chain",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / consecutive color filters",
    properties: ["brightness()", "contrast()", "invert()", "ordered list"],
    hint: "Consecutive color filters remain separate ordered atoms; a backend may fuse only when that preserves the same order.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-color-chain\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-color-chain {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: linear-gradient(90deg, #f43f5e, #facc15, #38bdf8);
  filter: brightness(.86) contrast(1.24) invert(.12);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-blur-between-colors",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / blur between color filters",
    properties: ["brightness()", "blur()", "contrast()", "spatial order"],
    hint: "The blur remains between the two color operators; it is never reordered into a fused color-only pass.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-blur-between-colors\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-blur-between-colors {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #38bdf8;
  filter: brightness(.9) blur(10px) contrast(1.15);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-drop-shadow-after-blur",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / drop shadow after blur",
    properties: ["blur()", "drop-shadow()", "source/output surfaces"],
    hint: "The drop shadow samples the preceding blurred surface, proving that spatial filter order is preserved end to end.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-drop-shadow-after-blur\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-drop-shadow-after-blur {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #38bdf8;
  filter: blur(8px) drop-shadow(22px 18px 12px #f9731699);
}`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_6_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.blend-multiply",
    phase: "P2.6",
    topic: "Paint",
    label: "Paint / multiply over colored background",
    properties: ["mix-blend-mode: multiply", "colored backdrop", "composite"],
    hint: "The layer is isolated for compositing and blends with the colored backdrop without changing its layout order.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"blend-multiply\"></div>\n</body>"),
      css: `body { margin: 0; background: #facc15; }

#blend-multiply {
  position: absolute;
  left: 600px;
  top: 360px;
  width: 720px;
  height: 300px;
  background: #2563eb;
  mix-blend-mode: multiply;
}`,
    }),
  },
  {
    id: "html-compiler.paint.blend-sibling-order",
    phase: "P2.6",
    topic: "Paint",
    label: "Paint / sibling blend modes",
    properties: ["multiply", "screen", "sibling order", "backdrop"],
    hint: "Two overlapping siblings keep their source order while each blend mode samples the backdrop at its own paint position.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"blend-sibling-multiply\"></div>\n  <div id=\"blend-sibling-screen\"></div>\n</body>"),
      css: `body { margin: 0; background: #172554; }

#blend-sibling-multiply {
  position: absolute;
  left: 480px;
  top: 360px;
  width: 600px;
  height: 300px;
  background: #f43f5e;
  mix-blend-mode: multiply;
}

#blend-sibling-screen {
  position: absolute;
  left: 840px;
  top: 480px;
  width: 600px;
  height: 300px;
  background: #38bdf8;
  mix-blend-mode: screen;
}`,
    }),
  },
  {
    id: "html-compiler.paint.blend-isolated-group",
    phase: "P2.6",
    topic: "Paint",
    label: "Paint / isolated group with child blend",
    properties: ["isolation: isolate", "group boundary", "child blend"],
    hint: "The group forms an offscreen compositing boundary, so the child blends with the group backdrop rather than an outside sibling.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"blend-outside\"></div>\n  <div id=\"blend-isolated-group\">\n    <div id=\"blend-isolated-child\"></div>\n    <div id=\"blend-isolated-highlight\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#blend-outside {
  position: absolute;
  left: 420px;
  top: 360px;
  width: 720px;
  height: 300px;
  background: #facc15;
}

#blend-isolated-group {
  position: absolute;
  left: 600px;
  top: 420px;
  width: 720px;
  height: 300px;
  isolation: isolate;
  background: #1e3a8a;
}

#blend-isolated-child {
  position: absolute;
  left: 80px;
  top: 50px;
  width: 360px;
  height: 200px;
  background: #f97316;
  mix-blend-mode: multiply;
}

#blend-isolated-highlight {
  position: absolute;
  left: 280px;
  top: 100px;
  width: 360px;
  height: 120px;
  background: #38bdf8;
  mix-blend-mode: screen;
}`,
    }),
  },
  {
    id: "html-compiler.paint.blend-opacity-filter",
    phase: "P2.6",
    topic: "Paint",
    label: "Paint / blend with opacity and filter",
    properties: ["mix-blend-mode: screen", "opacity", "filter", "offscreen group"],
    hint: "Layer opacity is applied at the compositing boundary while the filter remains an ordered effect program inside that boundary.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"blend-opacity-filter\"></div>\n</body>"),
      css: `body { margin: 0; background: #7c3aed; }

#blend-opacity-filter {
  position: absolute;
  left: 600px;
  top: 360px;
  width: 720px;
  height: 300px;
  background: linear-gradient(90deg, #f43f5e, #38bdf8);
  opacity: .68;
  mix-blend-mode: screen;
  filter: grayscale(.35) brightness(1.1);
}`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_7_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.clip-inset-round",
    phase: "P2.7",
    topic: "Paint",
    label: "Paint / clip-path inset round",
    properties: ["clip-path: inset()", "round corner", "reference box"],
    hint: "An inset clip lowers to a normalized rounded local path without creating a mask alpha surface.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-inset-round\"></div>\n</body>"),
      css: `body { margin: 0; background: #111827; }

#clip-inset-round {
  position: absolute;
  left: 520px;
  top: 360px;
  width: 880px;
  height: 360px;
  background: #38bdf8;
  border: 24px solid #1e3a8a;
  clip-path: inset(20px 36px 44px 52px round 42px / 26px);
}`,
    }),
  },
  {
    id: "html-compiler.paint.clip-circle-offset",
    phase: "P2.7",
    topic: "Paint",
    label: "Paint / clip-path circle offset center",
    properties: ["clip-path: circle()", "percentage center", "geometric clip"],
    hint: "The circle center resolves against the element reference box, not against the composition.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-circle-offset\"></div>\n</body>"),
      css: `body { margin: 0; background: #111827; }

#clip-circle-offset {
  position: absolute;
  left: 560px;
  top: 360px;
  width: 800px;
  height: 360px;
  background: #f97316;
  clip-path: circle(148px at 28% 64%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.clip-ellipse-offset",
    phase: "P2.7",
    topic: "Paint",
    label: "Paint / clip-path ellipse offset center",
    properties: ["clip-path: ellipse()", "independent radii", "percentage center"],
    hint: "Horizontal and vertical radii resolve independently while the center stays in local element coordinates.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-ellipse-offset\"></div>\n</body>"),
      css: `body { margin: 0; background: #111827; }

#clip-ellipse-offset {
  position: absolute;
  left: 560px;
  top: 360px;
  width: 800px;
  height: 360px;
  background: #a78bfa;
  clip-path: ellipse(260px 112px at 68% 34%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.clip-polygon-three",
    phase: "P2.7",
    topic: "Paint",
    label: "Paint / clip-path polygon three points",
    properties: ["clip-path: polygon()", "3 points", "normalized percentages"],
    hint: "A triangle is lowered as one closed path contour with percentage points resolved in the border box.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-polygon-three\"></div>\n</body>"),
      css: `body { margin: 0; background: #111827; }

#clip-polygon-three {
  position: absolute;
  left: 560px;
  top: 360px;
  width: 800px;
  height: 360px;
  background: #facc15;
  clip-path: polygon(8% 88%, 50% 8%, 92% 88%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.clip-polygon-five",
    phase: "P2.7",
    topic: "Paint",
    label: "Paint / clip-path polygon five points",
    properties: ["clip-path: polygon()", "5 points", "closed path"],
    hint: "A five-point polygon remains one deterministic contour and keeps source point order.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-polygon-five\"></div>\n</body>"),
      css: `body { margin: 0; background: #111827; }

#clip-polygon-five {
  position: absolute;
  left: 560px;
  top: 360px;
  width: 800px;
  height: 360px;
  background: #fb7185;
  clip-path: polygon(50% 4%, 94% 38%, 76% 92%, 24% 92%, 6% 38%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.clip-polygon-six",
    phase: "P2.7",
    topic: "Paint",
    label: "Paint / clip-path polygon six points",
    properties: ["clip-path: polygon()", "6 points", "closed path"],
    hint: "A six-point polygon exercises the general point-list lowering path independently from the triangle and pentagon cases.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-polygon-six\"></div>\n</body>"),
      css: `body { margin: 0; background: #111827; }

#clip-polygon-six {
  position: absolute;
  left: 560px;
  top: 360px;
  width: 800px;
  height: 360px;
  background: #34d399;
  clip-path: polygon(18% 8%, 82% 8%, 98% 50%, 82% 92%, 18% 92%, 2% 50%);
}`,
    }),
  },
  {
    id: "html-compiler.paint.clip-path-hole-evenodd",
    phase: "P2.7",
    topic: "Paint",
    label: "Paint / clip-path path hole evenodd",
    properties: ["clip-path: path()", "evenodd", "hole contour"],
    hint: "The path keeps two closed contours and lowers evenodd as geometric fill semantics, so the inner contour remains a hole.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-path-hole-evenodd\"></div>\n</body>"),
      css: `body { margin: 0; background: #111827; }

#clip-path-hole-evenodd {
  position: absolute;
  left: 560px;
  top: 360px;
  width: 800px;
  height: 360px;
  background: #38bdf8;
  clip-path: path(evenodd, "M 0 0 H 800 V 360 H 0 Z M 220 90 H 580 V 270 H 220 Z");
}`,
    }),
  },
  {
    id: "html-compiler.paint.clip-transform-overflow",
    phase: "P2.7",
    topic: "Paint",
    label: "Paint / clip-path with transform and overflow",
    properties: ["clip-path", "transform", "overflow: hidden", "intersection"],
    hint: "The geometric clip and overflow rectangle are intersected in one layer scope before the transformed subtree is composited.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-transform-overflow\">\n    <div id=\"clip-transform-overflow-child\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #111827; }

#clip-transform-overflow {
  position: absolute;
  left: 560px;
  top: 360px;
  width: 800px;
  height: 360px;
  overflow: hidden;
  transform: rotate(-6deg);
  background: #1e3a8a;
  clip-path: inset(24px round 64px);
}

#clip-transform-overflow-child {
  position: absolute;
  left: -100px;
  top: -80px;
  width: 1000px;
  height: 520px;
  background: linear-gradient(90deg, #f97316, #38bdf8);
}`,
    }),
  },
];

export const HTML_COMPILER_PAINT_PHASE2_8_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.paint.mask-alpha-gradient",
    phase: "P2.8",
    topic: "Paint",
    label: "Paint / alpha mask gradient",
    properties: ["mask-image", "linear-gradient", "mask-mode: alpha"],
    hint: "The gradient is rendered on a private mask surface; its alpha coverage clips the blue rectangle without creating a visible sibling.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"mask-alpha-gradient\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#mask-alpha-gradient {
  position: absolute;
  left: 520px;
  top: 320px;
  width: 880px;
  height: 360px;
  background: #2563eb;
  mask-image: linear-gradient(90deg, #00000000 0%, #000000ff 50%, #00000000 100%);
  mask-mode: alpha;
  mask-repeat: no-repeat;
}`,
    }),
  },
  {
    id: "html-compiler.paint.mask-luminance-image",
    phase: "P2.8",
    topic: "Paint",
    label: "Paint / luminance mask image",
    properties: ["mask-image", "asset URL", "mask-mode: luminance", "mask-size"],
    hint: "The image asset is registered in Protocol V2 and sampled as luminance coverage inside the mask source surface.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"mask-luminance-image\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#mask-luminance-image {
  position: absolute;
  left: 560px;
  top: 300px;
  width: 800px;
  height: 420px;
  background: #f97316;
  mask-image: url(/preview/image/img-alpha.png);
  mask-mode: luminance;
  mask-position: center;
  mask-size: 520px 300px;
  mask-repeat: no-repeat;
}`,
    }),
  },
  {
    id: "html-compiler.paint.mask-add-intersect",
    phase: "P2.8",
    topic: "Paint",
    label: "Paint / mask add + intersect",
    properties: ["multiple mask layers", "add", "intersect", "layer order"],
    hint: "Two authored mask layers remain ordered in JSON: the first is added, then the second intersects the accumulated coverage.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"mask-add-intersect\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#mask-add-intersect {
  position: absolute;
  left: 500px;
  top: 300px;
  width: 920px;
  height: 420px;
  background: #22c55e;
  mask-image: linear-gradient(90deg, #000000ff 0%, #000000ff 100%), radial-gradient(ellipse at 70% 45%, #000000ff 0%, #00000000 70%);
  mask-mode: alpha, alpha;
  mask-composite: intersect;
  mask-repeat: no-repeat, no-repeat;
}`,
    }),
  },
  {
    id: "html-compiler.paint.mask-subtract-edge",
    phase: "P2.8",
    topic: "Paint",
    label: "Paint / mask subtract at composition edge",
    properties: ["mask-composite", "subtract", "composition clipping"],
    hint: "The subtractive mask operation is evaluated on the private surface before the result is clipped by the composition boundary.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"mask-subtract-edge\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#mask-subtract-edge {
  position: absolute;
  left: 1420px;
  top: 260px;
  width: 720px;
  height: 440px;
  background: #a855f7;
  mask-image: linear-gradient(90deg, #000000ff 0%, #000000ff 100%), radial-gradient(circle at 30% 50%, #000000ff 0%, #000000ff 28%, #00000000 30%);
  mask-mode: alpha, alpha;
  mask-composite: subtract;
  mask-repeat: no-repeat, no-repeat;
}`,
    }),
  },
  {
    id: "html-compiler.paint.mask-clip-isolation",
    phase: "P2.8",
    topic: "Paint",
    label: "Paint / mask + clip-path + isolation",
    properties: ["mask-image", "clip-path", "isolation", "mix-blend-mode"],
    hint: "The mask surface is applied inside the isolated group after clip-path coverage and before the group opacity/blend boundary.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"mask-clip-isolation\">\n    <div id=\"mask-clip-isolation-child\"></div>\n  </div>\n</body>"),
      css: `body { margin: 0; background: #0f172a; }

#mask-clip-isolation {
  position: absolute;
  left: 520px;
  top: 280px;
  width: 880px;
  height: 460px;
  background: #1e3a8a;
  isolation: isolate;
  clip-path: inset(18px round 54px);
  mask-image: radial-gradient(ellipse at 50% 50%, #ffffff 0%, #000000 72%);
  mask-mode: alpha;
  mask-repeat: no-repeat;
}

#mask-clip-isolation-child {
  position: absolute;
  left: 180px;
  top: 90px;
  width: 760px;
  height: 300px;
  background: #f97316;
  mix-blend-mode: screen;
}`,
    }),
  },
];

export const HTML_COMPILER_MOTION_PHASE3_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.motion.opacity-delay-fill",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / opacity + delay + fill",
    properties: ["@keyframes", "opacity", "animation-delay", "animation-fill-mode"],
    hint: "The runtime samples opacity from the shared V2 track, including the backwards delay sample and forwards end sample.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-opacity\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-opacity { from { opacity: 0.15; } to { opacity: 1; } }
#motion-opacity { position: absolute; left: 620px; top: 360px; width: 680px; height: 320px; background: #22d3ee; animation-name: motion-opacity; animation-duration: 1200ms; animation-delay: 200ms; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.transform-alternate",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / transform alternate",
    properties: ["transform", "translateX", "rotate", "alternate", "cubic-bezier"],
    hint: "Transform components are typed tracks; alternate reverses the sampled direction on the second iteration.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-transform\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-transform { from { transform: translateX(0px) rotate(-8deg); } to { transform: translateX(260px) rotate(8deg); } }
#motion-transform { position: absolute; left: 500px; top: 400px; width: 360px; height: 180px; background: #a78bfa; transform-origin: center; animation-name: motion-transform; animation-duration: 1000ms; animation-iteration-count: 2; animation-direction: alternate; animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1); }`,
    }),
  },
  {
    id: "html-compiler.motion.steps-color",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / steps color",
    properties: ["background-color", "steps()", "animation-play-state"],
    hint: "A color track keeps its typed RGBA values while steps(4, jump-start) produces deterministic discrete plateaus.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-steps\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-steps { from { background-color: #2563eb; } 50% { background-color: #facc15; } to { background-color: #fb7185; } }
#motion-steps { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; animation-name: motion-steps; animation-duration: 1000ms; animation-timing-function: steps(4, start); animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.transform-scale",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / transform scale",
    properties: ["transform", "scale", "transform-origin"],
    hint: "A scale track keeps the element's layout frame fixed and applies the declared center pivot at runtime.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-scale\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-scale { from { transform: scale(0.55); } to { transform: scale(1.25); } }
#motion-scale { position: absolute; left: 540px; top: 390px; width: 360px; height: 180px; background: #a78bfa; transform-origin: center; animation-name: motion-scale; animation-duration: 1000ms; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.transform-rotate-origin",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / rotate percentage origin",
    properties: ["transform", "rotate", "transform-origin"],
    hint: "Rotation is sampled around a non-central percentage origin, matching the browser's local pivot.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-rotate-origin\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-rotate-origin { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }
#motion-rotate-origin { position: absolute; left: 560px; top: 390px; width: 360px; height: 180px; background: #fb7185; transform-origin: 25% 75%; animation-name: motion-rotate-origin; animation-duration: 1000ms; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.background-color-rgba",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / RGBA color",
    properties: ["background-color", "RGBA", "color track"],
    hint: "Background color is interpolated as a typed RGBA track, including alpha, instead of a CSS string.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-rgba\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-rgba { from { background-color: rgba(34, 211, 238, 0.25); } to { background-color: rgba(249, 115, 22, 0.85); } }
#motion-rgba { position: absolute; left: 620px; top: 360px; width: 520px; height: 240px; animation-name: motion-rgba; animation-duration: 1000ms; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.frame-size-border-box",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / frame size + border-box",
    properties: ["width", "height", "box-sizing", "frame tracks"],
    hint: "Width and height animate the V2 frame directly under border-box without changing the element's layout origin.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-frame\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-frame { from { width: 240px; height: 120px; } to { width: 520px; height: 300px; } }
#motion-frame { position: absolute; left: 700px; top: 340px; width: 240px; height: 120px; box-sizing: border-box; padding: 20px; background: #22d3ee; animation-name: motion-frame; animation-duration: 1000ms; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.keyframes-from-to",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / keyframes from + to",
    properties: ["@keyframes", "from", "to"],
    hint: "The canonical from/to declaration becomes a two-point opacity track with millisecond timestamps.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-from-to\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-from-to { from { opacity: 0.15; } to { opacity: 1; } }
#motion-from-to { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #22d3ee; animation-name: motion-from-to; animation-duration: 1000ms; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.keyframes-three-stops",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / keyframes 0 50 100",
    properties: ["0%", "50%", "100%", "ordered stops"],
    hint: "Three authored offsets remain three ordered runtime keyframes instead of being collapsed to endpoints.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-three-stops\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-three-stops { 0% { opacity: 0.1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }
#motion-three-stops { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #a78bfa; animation-name: motion-three-stops; animation-duration: 1200ms; animation-timing-function: linear; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.keyframes-missing-start",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / missing first keyframe",
    properties: ["30%", "to", "underlying value"],
    hint: "When 0% is absent, the compiler inserts the element's underlying computed opacity before the first authored offset.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-missing-start\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-missing-start { 30% { opacity: 0.35; } to { opacity: 1; } }
#motion-missing-start { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; opacity: 0.1; background: #22d3ee; animation-name: motion-missing-start; animation-duration: 1000ms; animation-timing-function: linear; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.keyframes-two-names",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / two keyframe names",
    properties: ["animation-name", "sibling layers", "independent tracks"],
    hint: "Two sibling layers resolve separate @keyframes definitions without sharing declarations or track state.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-fade\"></div>\n  <div id=\"motion-tint\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-fade { from { opacity: 0.1; } to { opacity: 1; } }
@keyframes motion-tint { from { background-color: #22d3ee; } to { background-color: #f97316; } }
#motion-fade { position: absolute; left: 430px; top: 360px; width: 320px; height: 160px; background: #22d3ee; animation-name: motion-fade; animation-duration: 1000ms; }
#motion-tint { position: absolute; left: 850px; top: 360px; width: 320px; height: 160px; animation-name: motion-tint; animation-duration: 1000ms; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.keyframes-duplicate-offset",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / duplicate keyframe offset",
    properties: ["duplicate offset", "source order", "cascade"],
    hint: "At 50%, the later keyframe block wins for opacity, so the runtime receives one deterministic keyframe at that timestamp.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-duplicate\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-duplicate { from { opacity: 0.1; } 50% { opacity: 0.2; } 50% { opacity: 0.8; } to { opacity: 1; } }
#motion-duplicate { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #facc15; animation-name: motion-duplicate; animation-duration: 1000ms; animation-timing-function: linear; animation-fill-mode: both; }`,
    }),
  },
  {
    id: "html-compiler.motion.keyframes-unknown-name",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / unknown animation diagnostic",
    properties: ["animation-name", "diagnostic", "unsupported reference"],
    hint: "An animation-name without a matching @keyframes rule is a compiler diagnostic, never a silent no-op.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-unknown\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#motion-unknown { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #fb7185; animation-name: no-such-keyframes; animation-duration: 1000ms; }`,
    }),
  },
  {
    id: "html-compiler.motion.delay-fill-none",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / delay + no fill",
    properties: ["animation-delay", "fill-mode: none"],
    hint: "During the positive delay and after the animation, the underlying opacity remains active because no fill is requested.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-delay-none\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-delay-none { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-delay-none { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; opacity: 0.35; background: #22d3ee; animation-name: motion-delay-none; animation-duration: 700ms; animation-delay: 300ms; animation-fill-mode: none; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.delay-fill-backwards",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / delay + backwards",
    properties: ["animation-delay", "fill-mode: backwards"],
    hint: "The first keyframe is visible during the positive delay, then the active animation begins at the scheduled time.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-delay-backwards\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-delay-backwards { from { opacity: 0.1; } to { opacity: 1; } }
#motion-delay-backwards { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; opacity: 0.8; background: #a78bfa; animation-name: motion-delay-backwards; animation-duration: 700ms; animation-delay: 300ms; animation-fill-mode: backwards; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.fill-forwards",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / forwards end hold",
    properties: ["animation-fill-mode: forwards", "end sample"],
    hint: "After the active interval, the final keyframe remains applied instead of returning to the underlying opacity.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-forwards\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-forwards { from { opacity: 1; } to { opacity: 0.2; } }
#motion-forwards { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #fb7185; animation-name: motion-forwards; animation-duration: 700ms; animation-fill-mode: forwards; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.fill-both",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / both delay + end",
    properties: ["animation-delay", "animation-fill-mode: both"],
    hint: "Both applies the first keyframe during delay and keeps the final keyframe after completion.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-both\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-both { from { opacity: 0.15; } to { opacity: 0.85; } }
#motion-both { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #facc15; animation-name: motion-both; animation-duration: 700ms; animation-delay: 300ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.delay-negative",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / negative delay",
    properties: ["animation-delay: -350ms", "initial progress"],
    hint: "A negative delay starts the sample inside the animation rather than waiting for a future start time.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-negative-delay\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-negative-delay { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-negative-delay { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #22d3ee; animation-name: motion-negative-delay; animation-duration: 700ms; animation-delay: -350ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.play-state-paused",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / play-state paused",
    properties: ["animation-play-state: paused", "transport"],
    hint: "An authored paused animation stays at its initial sample until transport explicitly changes the preview state.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-paused\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-paused { from { opacity: 0.15; } to { opacity: 1; } }
#motion-paused { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #a78bfa; animation-name: motion-paused; animation-duration: 700ms; animation-fill-mode: both; animation-play-state: paused; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.iteration-two",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / two iterations",
    properties: ["animation-iteration-count: 2", "cycle boundary"],
    hint: "Two complete cycles reuse one normalized keyframe track without duplicating runtime geometry.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-iteration-two\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-iteration-two { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-iteration-two { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #22d3ee; animation-name: motion-iteration-two; animation-duration: 600ms; animation-iteration-count: 2; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.iteration-fractional",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / fractional iteration",
    properties: ["animation-iteration-count: 2.5", "fractional endpoint"],
    hint: "A 2.5 iteration animation ends halfway through its third cycle, including at the exact active-duration boundary.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-iteration-fractional\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-iteration-fractional { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-iteration-fractional { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #a78bfa; animation-name: motion-iteration-fractional; animation-duration: 500ms; animation-iteration-count: 2.5; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.iteration-infinite",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / infinite loop",
    properties: ["animation-iteration-count: infinite", "loop"],
    hint: "Infinite playback keeps a bounded track and wraps sampled progress without accumulating timeline drift.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-iteration-infinite\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-iteration-infinite { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-iteration-infinite { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #facc15; animation-name: motion-iteration-infinite; animation-duration: 450ms; animation-iteration-count: infinite; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.direction-normal",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / direction normal",
    properties: ["animation-direction: normal"],
    hint: "Normal samples each iteration from the first keyframe toward the last keyframe.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-direction-normal\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-direction-normal { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-direction-normal { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #22d3ee; animation-name: motion-direction-normal; animation-duration: 1000ms; animation-direction: normal; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.direction-reverse",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / direction reverse",
    properties: ["animation-direction: reverse"],
    hint: "Reverse starts at the last keyframe and samples toward the first keyframe.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-direction-reverse\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-direction-reverse { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-direction-reverse { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #fb7185; animation-name: motion-direction-reverse; animation-duration: 1000ms; animation-direction: reverse; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.direction-alternate",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / direction alternate",
    properties: ["animation-direction: alternate", "iteration boundary"],
    hint: "Alternate reverses every second iteration while keeping the same authored keyframe sequence.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-direction-alternate\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-direction-alternate { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-direction-alternate { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #a78bfa; animation-name: motion-direction-alternate; animation-duration: 500ms; animation-iteration-count: 2; animation-direction: alternate; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.direction-alternate-reverse",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / direction alternate-reverse",
    properties: ["animation-direction: alternate-reverse", "iteration boundary"],
    hint: "Alternate-reverse starts reversed, then alternates direction at each iteration boundary.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-direction-alternate-reverse\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-direction-alternate-reverse { from { opacity: 0.1; } to { opacity: 0.9; } }
#motion-direction-alternate-reverse { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #f97316; animation-name: motion-direction-alternate-reverse; animation-duration: 500ms; animation-iteration-count: 2; animation-direction: alternate-reverse; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.easing-linear",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / easing linear",
    properties: ["animation-timing-function: linear", "opacity"],
    hint: "Linear easing keeps equal progress between each pair of keyframes.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-easing-linear\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-easing-linear { from { opacity: 0.15; } to { opacity: 1; } }
#motion-easing-linear { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #22d3ee; animation-name: motion-easing-linear; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.easing-steps-end",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / easing steps jump-end",
    properties: ["animation-timing-function: steps(4, jump-end)", "discrete plateaus"],
    hint: "Jump-end holds the current plateau until each step boundary, then advances.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-easing-steps-end\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-easing-steps-end { from { opacity: 0.15; } to { opacity: 1; } }
#motion-easing-steps-end { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #f97316; animation-name: motion-easing-steps-end; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: steps(4, jump-end); }`,
    }),
  },
  {
    id: "html-compiler.motion.easing-steps-start",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / easing steps jump-start",
    properties: ["animation-timing-function: steps(4, jump-start)", "first instant"],
    hint: "Jump-start advances to the first plateau at the first instant of the active interval.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-easing-steps-start\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-easing-steps-start { from { opacity: 0.15; } to { opacity: 1; } }
#motion-easing-steps-start { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #a78bfa; animation-name: motion-easing-steps-start; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: steps(4, jump-start); }`,
    }),
  },
  {
    id: "html-compiler.motion.easing-cubic-bezier",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / easing cubic-bezier",
    properties: ["animation-timing-function: cubic-bezier", "transform"],
    hint: "The canonical ease curve is stored as typed cubic-bezier control points in each track.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-easing-cubic\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-easing-cubic { from { transform: translateX(0px); } to { transform: translateX(260px); } }
#motion-easing-cubic { position: absolute; left: 500px; top: 360px; width: 360px; height: 180px; background: #22d3ee; animation-name: motion-easing-cubic; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1); }`,
    }),
  },
  {
    id: "html-compiler.motion.easing-per-segment",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / easing per segment",
    properties: ["keyframe-local timing", "steps()", "cubic-bezier()"],
    hint: "Each segment keeps the timing function authored on its starting keyframe; the global value is only the fallback.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-easing-segments\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-easing-segments {
  from { opacity: 0.1; animation-timing-function: steps(2, jump-start); }
  50% { opacity: 0.55; animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1); }
  to { opacity: 1; }
}
#motion-easing-segments { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #facc15; animation-name: motion-easing-segments; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.easing-invalid",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / invalid easing diagnostic",
    properties: ["steps(0)", "diagnostic", "no silent fallback"],
    hint: "Invalid step counts and cubic-bezier control points fail compilation with a specific diagnostic.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-easing-invalid\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-easing-invalid { from { opacity: 0.1; } to { opacity: 1; } }
#motion-easing-invalid { position: absolute; left: 700px; top: 360px; width: 520px; height: 240px; background: #fb7185; animation-name: motion-easing-invalid; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: steps(0, jump-end); }`,
    }),
  },
  {
    id: "html-compiler.motion.combo-transform-opacity",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / transform + opacity",
    properties: ["transform", "opacity", "one animation"],
    hint: "Transform and layer opacity remain separate typed tracks while sharing the same animation playback metadata.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-combo-transform-opacity\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-combo-transform-opacity { from { opacity: 0.15; transform: translateX(0px) rotate(-6deg); } to { opacity: 1; transform: translateX(260px) rotate(6deg); } }
#motion-combo-transform-opacity { position: absolute; left: 500px; top: 360px; width: 360px; height: 180px; background: #22d3ee; transform-origin: center; animation-name: motion-combo-transform-opacity; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.combo-transform-color",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / transform + background color",
    properties: ["transform", "background-color", "two animation tracks", "different easing"],
    hint: "Two authored animations keep transform and background-color as independent tracks with their own easing list entries.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-combo-transform-color\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-combo-move { from { transform: translateX(0px); } to { transform: translateX(260px); } }
@keyframes motion-combo-tint { from { background-color: #22d3ee; } to { background-color: #f97316; } }
#motion-combo-transform-color { position: absolute; left: 500px; top: 360px; width: 360px; height: 180px; animation-name: motion-combo-move, motion-combo-tint; animation-duration: 1000ms, 1000ms; animation-fill-mode: both, both; animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1), steps(4, jump-end); }`,
    }),
  },
  {
    id: "html-compiler.motion.combo-filter-opacity",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / filter opacity vs layer opacity",
    properties: ["filter: opacity()", "layer opacity", "separate alpha"],
    hint: "The animated layer alpha stays on the group while filter: opacity() remains an ordered source-surface effect.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-combo-filter-opacity\"></div>\n</body>"),
      css: `body { margin: 0; background: #16324f; }
@keyframes motion-combo-filter-opacity { from { opacity: 0.2; transform: translateX(0px); } to { opacity: 0.9; transform: translateX(180px); } }
#motion-combo-filter-opacity { position: absolute; left: 560px; top: 360px; width: 420px; height: 220px; background: #f97316; opacity: 0.72; filter: opacity(0.48) contrast(1.08); animation-name: motion-combo-filter-opacity; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.combo-border-paint",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / animated border paint",
    properties: ["border-color", "border-width", "paint-only track"],
    hint: "Animated border color and width target the generated border paint pass without adding a second layout computation.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-combo-border\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-combo-border { from { border-color: #22d3ee; border-width: 8px; } to { border-color: #f97316; border-width: 18px; } }
#motion-combo-border { position: absolute; left: 600px; top: 350px; width: 420px; height: 220px; box-sizing: border-box; border: 8px solid #22d3ee; background: #1e3a8a; animation-name: motion-combo-border; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.combo-clip-path",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / animated shape with clip-path",
    properties: ["transform", "opacity", "fixed clip-path", "geometric clip"],
    hint: "The clip-path remains geometric and fixed while the animated shape transform and opacity are sampled on the layer.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-combo-clip-path\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-combo-clip-path { from { opacity: 0.2; transform: translateX(0px) rotate(-8deg); } to { opacity: 1; transform: translateX(240px) rotate(8deg); } }
#motion-combo-clip-path { position: absolute; left: 500px; top: 350px; width: 520px; height: 260px; background: #a78bfa; clip-path: polygon(8% 88%, 50% 8%, 92% 88%); animation-name: motion-combo-clip-path; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.combo-isolated-blend",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / isolated group + child blend",
    properties: ["isolation: isolate", "mix-blend-mode: multiply", "child animation"],
    hint: "The child animation is sampled inside the isolated group boundary so its blend does not leak into the outside backdrop.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-combo-isolated\"><div id=\"motion-combo-isolated-child\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #17324d; }
@keyframes motion-combo-isolated-child { from { opacity: 0.25; transform: translateX(0px); } to { opacity: 0.9; transform: translateX(160px); } }
#motion-combo-isolated { position: absolute; left: 480px; top: 300px; width: 760px; height: 360px; background: #facc15; isolation: isolate; }
#motion-combo-isolated-child { position: absolute; left: 160px; top: 70px; width: 420px; height: 220px; background: #ef4444; mix-blend-mode: multiply; animation-name: motion-combo-isolated-child; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion.combo-image-clipping",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion / image transform + composition clip",
    properties: ["img", "transform", "overflow: hidden", "composition edge"],
    hint: "The image transform is animated inside a fixed overflow viewport and remains clipped at the composition boundary.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-combo-image-viewport\"><img id=\"motion-combo-image\" src=\"/preview/image/photo-landscape.jpg\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-combo-image { from { transform: translateX(-220px); } to { transform: translateX(220px); } }
#motion-combo-image-viewport { position: absolute; left: 1400px; top: 330px; width: 520px; height: 300px; overflow: hidden; background: #1e3a8a; }
#motion-combo-image { position: absolute; left: 0; top: 0; width: 760px; height: 300px; object-fit: cover; animation-name: motion-combo-image; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
];

export function htmlCompilerPreviewGroups(): Array<{ phase: HtmlCompilerPreviewCase["phase"]; topic: HtmlCompilerPreviewTopic; cases: HtmlCompilerPreviewCase[] }> {
  const groups = new Map<string, { phase: HtmlCompilerPreviewCase["phase"]; topic: HtmlCompilerPreviewTopic; cases: HtmlCompilerPreviewCase[] }>();
  for (const item of [...HTML_COMPILER_PHASE0_CASES, ...HTML_COMPILER_PHASE1_1_CASES, ...HTML_COMPILER_PHASE1_2_CASES, ...HTML_COMPILER_PHASE1_3_CASES, ...HTML_COMPILER_PHASE1_4_CASES, ...HTML_COMPILER_PAINT_PHASE2_0_CASES, ...HTML_COMPILER_PAINT_PHASE2_1_CASES, ...HTML_COMPILER_PAINT_PHASE2_2_CASES, ...HTML_COMPILER_PAINT_PHASE2_3_CASES, ...HTML_COMPILER_PAINT_PHASE2_4_CASES, ...HTML_COMPILER_PAINT_PHASE2_5_CASES, ...HTML_COMPILER_PAINT_PHASE2_6_CASES, ...HTML_COMPILER_PAINT_PHASE2_7_CASES, ...HTML_COMPILER_PAINT_PHASE2_8_CASES, ...HTML_COMPILER_MOTION_PHASE3_CASES]) {
    const key = `${item.phase}:${item.topic}`;
    const group = groups.get(key) ?? { phase: item.phase, topic: item.topic, cases: [] };
    group.cases.push(item);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function htmlCompilerPreviewCaseById(id: string | null | undefined): HtmlCompilerPreviewCase {
  return [...HTML_COMPILER_PHASE0_CASES, ...HTML_COMPILER_PHASE1_1_CASES, ...HTML_COMPILER_PHASE1_2_CASES, ...HTML_COMPILER_PHASE1_3_CASES, ...HTML_COMPILER_PHASE1_4_CASES, ...HTML_COMPILER_PAINT_PHASE2_0_CASES, ...HTML_COMPILER_PAINT_PHASE2_1_CASES, ...HTML_COMPILER_PAINT_PHASE2_2_CASES, ...HTML_COMPILER_PAINT_PHASE2_3_CASES, ...HTML_COMPILER_PAINT_PHASE2_4_CASES, ...HTML_COMPILER_PAINT_PHASE2_5_CASES, ...HTML_COMPILER_PAINT_PHASE2_6_CASES, ...HTML_COMPILER_PAINT_PHASE2_7_CASES, ...HTML_COMPILER_PAINT_PHASE2_8_CASES, ...HTML_COMPILER_MOTION_PHASE3_CASES].find((item) => item.id === id) ?? HTML_COMPILER_PHASE0_CASES[0];
}
