import { createHtmlCssSource, createNewHtmlProject, DEFAULT_NEONIX_HTML_DOCUMENT, type HtmlCompilerFontAsset, type HtmlCompilerMediaAsset, type HtmlCssSource } from "@motionvideo/html-compiler";
import { finalizeHtmlCompilerPreviewCases } from "./html-compiler-document";
import { HTML_COMPILER_TAG_LOWERING_CASES } from "./html-compiler-tag-lowering-fixtures";
import { HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES } from "./html-compiler-text-compiler-layout-fixtures";

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
  phase: "P0" | "P1.1" | "P1.2" | "P1.3" | "P1.4" | "P2.0" | "P2.1" | "P2.2" | "P2.3" | "P2.4" | "P2.5" | "P2.6" | "P2.7" | "P2.8" | "P3" | "P5" | "P6" | "P7" | "P8" | "P9";
  /** UI ordering category; legacy phase remains internal for fixture provenance. */
  category?: HtmlCompilerPreviewCategory;
  /** Distinguishes an atomic primitive fixture from a cross-stage pipeline fixture. */
  classification?: HtmlCompilerPreviewClassification;
  /** Short title shown beside the fixture title in the preview UI. */
  classificationLabel?: string;
  topic: HtmlCompilerPreviewTopic;
  label: string;
  properties: string[];
  hint: string;
  source: HtmlCssSource;
  /** Canonical single-file document consumed by compileDocument and the iframe. */
  html?: string;
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
    hint: "A column uses the main-axis gap between fixed-size items; wrapping is intentionally outside this primitive case.",
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

/** Text frames use border-box layout geometry and content-box text metrics. */
const textLayoutCase = (
  id: string,
  label: string,
  properties: string[],
  hint: string,
  text: string,
  css: string,
): HtmlCompilerPreviewCase => ({
  id: `html-compiler.layout.${id}`,
  phase: "P1.4",
  topic: "Layout",
  label,
  properties,
  hint,
  source: createNewHtmlProject({
    html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", `<body>\n  <div id="${id}">${text}</div>\n</body>`),
    css: `body { margin: 0; background: #081018; }\n\n${css}`,
  }),
});

export const HTML_COMPILER_LAYOUT_TEXT_CASES: HtmlCompilerPreviewCase[] = [
  textLayoutCase(
    "text-frame-baseline",
    "Layout / text frame baseline",
    ["div text", "line box", "content box", "baseline"],
    "The element frame remains layout geometry while glyphs are painted from the content line box and baseline.",
    "Hello",
    `#text-frame-baseline { position: absolute; left: 520px; top: 360px; width: 880px; padding: 24px; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 72px; font-weight: 700; line-height: normal; }`,
  ),
  textLayoutCase(
    "text-border-uniform",
    "Layout / text + uniform border",
    ["div text", "border", "border-box frame", "content origin"],
    "A uniform border paints around the resolved border-box frame and is not added a second time by the runtime.",
    "Hello",
    `#text-border-uniform { position: absolute; left: 520px; top: 340px; width: 760px; padding: 28px; border: 12px solid #38bdf8; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 72px; font-weight: 700; line-height: 88px; }`,
  ),
  textLayoutCase(
    "text-border-asymmetric",
    "Layout / text + asymmetric border",
    ["border-top/right/bottom/left", "different widths", "content origin"],
    "Different border widths move the content origin by each corresponding edge while the final frame remains one border box.",
    "Hello",
    `#text-border-asymmetric { position: absolute; left: 500px; top: 320px; width: 800px; padding: 24px 36px; border-top: 8px solid #22d3ee; border-right: 24px solid #a78bfa; border-bottom: 18px solid #facc15; border-left: 14px solid #fb7185; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 68px; font-weight: 700; line-height: 84px; }`,
  ),
  textLayoutCase(
    "text-border-padding",
    "Layout / text + padding + border",
    ["padding", "border", "content box", "baseline offset"],
    "Padding separates the glyph line box from the border, and both contribute to the border-box frame without changing glyph metrics.",
    "Padding frame",
    `#text-border-padding { position: absolute; left: 420px; top: 320px; width: 1080px; padding: 44px 56px; border: 10px solid #4ade80; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 64px; font-weight: 700; line-height: 80px; }`,
  ),
  textLayoutCase(
    "text-content-box",
    "Layout / text content-box sizing",
    ["box-sizing:content-box", "width", "padding", "border expansion"],
    "With content-box sizing, authored width excludes padding and border; the emitted frame expands to the complete border box.",
    "Content box",
    `#text-content-box { box-sizing: content-box; position: absolute; left: 520px; top: 360px; width: 720px; padding: 32px; border: 16px solid #38bdf8; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 68px; font-weight: 700; line-height: 84px; }`,
  ),
  textLayoutCase(
    "text-border-box",
    "Layout / text border-box sizing",
    ["box-sizing:border-box", "width", "padding", "border inclusion"],
    "With border-box sizing, authored width is the final border-box width; padding and border reduce the available content width.",
    "Border box",
    `#text-border-box { box-sizing: border-box; position: absolute; left: 520px; top: 360px; width: 720px; padding: 32px; border: 16px solid #a78bfa; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 68px; font-weight: 700; line-height: 84px; }`,
  ),
  textLayoutCase(
    "text-line-height-normal",
    "Layout / text normal line-height",
    ["line-height:normal", "font metrics", "line box", "border"],
    "Normal line-height resolves from selected font metrics and remains distinct from the visible glyph bounds.",
    "Normal line box",
    `#text-line-height-normal { position: absolute; left: 420px; top: 340px; width: 1080px; padding: 24px; border: 8px solid #f97316; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 72px; font-weight: 700; line-height: normal; }`,
  ),
  textLayoutCase(
    "text-line-height-fixed",
    "Layout / text fixed line-height",
    ["line-height:88px", "line box", "baseline", "border"],
    "A fixed line-height changes the line box and baseline placement while glyph bounds remain independent paint geometry.",
    "Fixed line box",
    `#text-line-height-fixed { position: absolute; left: 420px; top: 340px; width: 1080px; padding: 24px; border: 8px solid #facc15; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 72px; font-weight: 700; line-height: 88px; }`,
  ),
  textLayoutCase(
    "text-wrapping-border",
    "Layout / wrapped text inside border",
    ["width", "white-space:normal", "line wrapping", "border-box"],
    "Wrapping happens inside the content box; the border stays outside the line boxes and the final frame includes every wrapped line.",
    "A wrapped text block keeps its line boxes inside the padded content box while the border stays part of the outer frame.",
    `#text-wrapping-border { position: absolute; left: 420px; top: 260px; width: 1080px; padding: 36px 48px; border: 12px solid #22d3ee; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 56px; font-weight: 700; line-height: 76px; white-space: normal; }`,
  ),
  textLayoutCase(
    "text-border-radius",
    "Layout / text + rounded border",
    ["border-radius", "border", "content box", "rounded border-box"],
    "The rounded border follows the same border-box frame as text layout; radius changes paint contours, not frame dimensions.",
    "Rounded text frame",
    `#text-border-radius { position: absolute; left: 420px; top: 340px; width: 1080px; padding: 32px 48px; border: 12px solid #fb7185; border-radius: 48px; color: #f8fafc; background: #172554; font-family: Inter, sans-serif; font-size: 64px; font-weight: 700; line-height: 80px; }`,
  ),
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
  {
    id: "html-compiler.paint.image-function-url",
    phase: "P2.0",
    topic: "Paint",
    label: "Paint / image() URL source",
    properties: ["image()", "url()", "asset layer", "cover"],
    hint: "The image() URL source remains an image atomic with the same position, sizing and clipping contract as a direct background URL.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-image-function-url\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-image-function-url {
  position: absolute;
  left: 420px;
  top: 300px;
  width: 1080px;
  height: 480px;
  background-color: #172554;
  background-image: image(url("/preview/image/photo-landscape.jpg"));
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}`,
    }),
  },
  {
    id: "html-compiler.paint.image-function-gradient-fallback",
    phase: "P2.0",
    topic: "Paint",
    label: "Paint / image() gradient + fallback",
    properties: ["image()", "gradient", "fallback color", "paint source"],
    hint: "A gradient image candidate is lowered to a paint shape; the fallback color remains available without introducing a synthetic asset source.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-image-function-gradient\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-image-function-gradient {
  position: absolute;
  left: 420px;
  top: 300px;
  width: 1080px;
  height: 480px;
  background-image: image(linear-gradient(135deg, #38bdf8 0%, #a78bfa 52%, #fb7185 100%), #172554);
  background-repeat: no-repeat;
}`,
    }),
  },
  {
    id: "html-compiler.paint.cross-fade-images",
    phase: "P2.0",
    topic: "Paint",
    label: "Paint / cross-fade() image sources",
    properties: ["cross-fade()", "two URL sources", "opacity weights", "stable order"],
    hint: "The two cross-fade sources become ordered image atomics with complementary opacity weights, preserving the CSS source order.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"paint-cross-fade\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#paint-cross-fade {
  position: absolute;
  left: 420px;
  top: 300px;
  width: 1080px;
  height: 480px;
  background-color: #172554;
  background-image: cross-fade(url("/preview/image/photo-landscape.jpg"), url("/preview/image/photo-portrait.jpg"), 50%);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
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
  {
    id: "html-compiler.paint.text-shadow-alpha",
    phase: "P2.4",
    topic: "Paint",
    label: "Paint / text shadow alpha silhouette",
    properties: ["text-shadow", "alpha source", "zero blur"],
    hint: "A zero-blur text shadow isolates the glyph alpha silhouette and tint from the blur kernel.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"text-shadow-alpha\">Neonix shadow</div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#text-shadow-alpha {
  position: absolute;
  left: 520px;
  top: 380px;
  width: 900px;
  height: 180px;
  color: #f8fafc;
  font-family: Inter;
  font-size: 92px;
  font-weight: 700;
  text-shadow: 0 0 0 #38bdf899;
}`,
    }),
  },
  {
    id: "html-compiler.paint.text-shadow-blur",
    phase: "P2.4",
    topic: "Paint",
    label: "Paint / text shadow blur",
    properties: ["text-shadow", "alpha source", "blur only"],
    hint: "A centered text shadow isolates the CSS blur radius-to-sigma conversion.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"text-shadow-blur\">Neonix shadow</div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#text-shadow-blur {
  position: absolute;
  left: 520px;
  top: 380px;
  width: 900px;
  height: 180px;
  color: #f8fafc;
  font-family: Inter;
  font-size: 92px;
  font-weight: 700;
  text-shadow: 0 0 18px #38bdf899;
}`,
    }),
  },
  {
    id: "html-compiler.paint.text-shadow-offset",
    phase: "P2.4",
    topic: "Paint",
    label: "Paint / text shadow offset",
    properties: ["text-shadow", "alpha source", "offset only"],
    hint: "A zero-blur offset shadow isolates translation and compositing from the blur kernel.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"text-shadow-offset\">Neonix shadow</div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#text-shadow-offset {
  position: absolute;
  left: 520px;
  top: 380px;
  width: 900px;
  height: 180px;
  color: #f8fafc;
  font-family: Inter;
  font-size: 92px;
  font-weight: 700;
  text-shadow: 18px 20px 0 #38bdf899;
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
    id: "html-compiler.paint.filter-drop-shadow-alpha",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter drop shadow alpha silhouette",
    properties: ["filter", "drop-shadow()", "alpha silhouette", "zero blur"],
    hint: "A zero-blur drop shadow still follows the rounded alpha silhouette and keeps the filter separate from layer opacity.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-drop-shadow-alpha\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-drop-shadow-alpha {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  border-radius: 56px;
  background: #a78bfa;
  filter: drop-shadow(0 0 0 #38bdf899);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-drop-shadow-blur",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter drop shadow blur",
    properties: ["filter", "drop-shadow()", "alpha silhouette", "blur"],
    hint: "The blur-only drop shadow uses the element alpha silhouette rather than the rectangular box geometry.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-drop-shadow-blur\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-drop-shadow-blur {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  border-radius: 56px;
  background: #a78bfa;
  filter: drop-shadow(0 0 18px #38bdf899);
}`,
    }),
  },
  {
    id: "html-compiler.paint.filter-drop-shadow-offset",
    phase: "P2.5",
    topic: "Paint",
    label: "Paint / filter drop shadow offset",
    properties: ["filter", "drop-shadow()", "alpha silhouette", "offset"],
    hint: "The offset-only drop shadow makes the alpha-source translation observable without changing the blur radius.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"filter-drop-shadow-offset\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }

#filter-drop-shadow-offset {
  position: absolute;
  left: 660px;
  top: 360px;
  width: 600px;
  height: 300px;
  border-radius: 56px;
  background: #a78bfa;
  filter: drop-shadow(24px 22px 0 #38bdf899);
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
  {
    id: "html-compiler.motion-path.line-distance",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion path / line distance",
    properties: ["offset-path", "offset-distance", "linear path"],
    hint: "A layer-owned path keeps the CSS element frame while offset-distance samples a normalized point along the parent-local line.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-path-line\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-path-line { from { offset-distance: 0%; } to { offset-distance: 100%; } }
#motion-path-line { position: absolute; left: 0; top: 0; width: 180px; height: 100px; background: #22d3ee; offset-path: path("M 180 420 L 1500 420"); offset-distance: 0%; offset-rotate: 0deg; offset-anchor: 50% 50%; animation-name: motion-path-line; animation-duration: 1400ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion-path.cubic-auto",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion path / cubic auto rotate",
    properties: ["offset-path", "offset-rotate: auto", "cubic tangent"],
    hint: "The runtime follows a cubic path and aligns the layer to the sampled tangent, making direction changes visible at the midpoint.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-path-cubic\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-path-cubic { from { offset-distance: 0%; } to { offset-distance: 100%; } }
#motion-path-cubic { position: absolute; left: 0; top: 0; width: 150px; height: 80px; background: #a78bfa; offset-path: path("M 180 650 C 420 220, 920 980, 1540 520"); offset-distance: 0%; offset-rotate: auto 0deg; offset-anchor: 50% 50%; animation-name: motion-path-cubic; animation-duration: 1800ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.motion-path.reverse-anchor",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion path / reverse + anchor",
    properties: ["offset-rotate: reverse", "offset-anchor", "path endpoint"],
    hint: "Reverse adds the CSS half-turn after tangent alignment while the bottom-center anchor keeps the layer attached to the path.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-path-reverse\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
@keyframes motion-path-reverse { from { offset-distance: 0%; } to { offset-distance: 100%; } }
#motion-path-reverse { position: absolute; left: 0; top: 0; width: 180px; height: 100px; background: #fb7185; offset-path: path("M 260 820 L 1320 820"); offset-distance: 0%; offset-rotate: reverse 0deg; offset-anchor: 50% 100%; animation-name: motion-path-reverse; animation-duration: 1200ms; animation-fill-mode: both; animation-timing-function: steps(4, jump-end); }`,
    }),
  },
  {
    id: "html-compiler.motion-path.clip-edge",
    phase: "P3",
    topic: "Motion & animation",
    label: "Motion path / composition clipping",
    properties: ["offset-path", "overflow: hidden", "composition clip"],
    hint: "Motion remains layer-owned and is clipped by the composition boundary when the path carries the frame beyond the right edge.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"motion-path-edge\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; overflow: hidden; }
@keyframes motion-path-edge { from { offset-distance: 0%; } to { offset-distance: 100%; } }
#motion-path-edge { position: absolute; left: 0; top: 0; width: 260px; height: 140px; background: #facc15; offset-path: path("M 1540 180 L 2100 180"); offset-distance: 0%; offset-rotate: 0deg; offset-anchor: 0% 0%; animation-name: motion-path-edge; animation-duration: 1000ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
];

export const HTML_COMPILER_PERSPECTIVE_PHASE5_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.perspective.group-translate-z",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / group + translateZ",
    properties: ["perspective", "perspective-origin", "translateZ", "Matrix4"],
    hint: "A parent perspective becomes a group render3d context while the child keeps translateZ in its ordered Matrix4 transform.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"perspective-scene\"><div id=\"perspective-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#perspective-scene { position: absolute; left: 520px; top: 250px; width: 880px; height: 520px; perspective: 760px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#perspective-card { position: absolute; left: 260px; top: 150px; width: 360px; height: 220px; background: #22d3ee; transform: translateZ(140px) rotateY(-16deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.rotate-x",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / rotateX plane",
    properties: ["perspective", "rotateX", "transform-origin"],
    hint: "The child plane rotates around its center in 3D; the compiler preserves the authored transform origin and parent camera context.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"rotate-x-scene\"><div id=\"rotate-x-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#rotate-x-scene { position: absolute; left: 520px; top: 220px; width: 880px; height: 560px; perspective: 900px; }
#rotate-x-card { position: absolute; left: 260px; top: 160px; width: 360px; height: 220px; background: #a78bfa; transform-origin: 50% 50%; transform: rotateX(28deg) translateZ(80px); }`,
    }),
  },
  {
    id: "html-compiler.perspective.origin-offset",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / off-center origin",
    properties: ["perspective-origin", "rotateY", "translateZ"],
    hint: "An off-center perspective-origin changes the convergence point without changing the child's layout frame.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"origin-scene\"><div id=\"origin-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#origin-scene { position: absolute; left: 520px; top: 240px; width: 880px; height: 500px; perspective: 700px; perspective-origin: 18% 82%; }
#origin-card { position: absolute; left: 270px; top: 140px; width: 340px; height: 220px; background: #f97316; transform: rotateY(-32deg) translateZ(120px); }`,
    }),
  },
  {
    id: "html-compiler.perspective.flat-preserve-3d",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / flat vs preserve-3d",
    properties: ["transform-style", "flat", "preserve-3d", "nested groups"],
    hint: "Two independent group contexts keep transform-style explicit in JSON so the runtime can apply the intended flattening boundary.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"flat-scene\"><div id=\"flat-card\"></div></div><div id=\"preserve-scene\"><div id=\"preserve-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#flat-scene, #preserve-scene { position: absolute; top: 260px; width: 620px; height: 400px; perspective: 760px; }
#flat-scene { left: 220px; transform-style: flat; }
#preserve-scene { left: 1080px; transform-style: preserve-3d; }
#flat-card, #preserve-card { position: absolute; left: 170px; top: 110px; width: 280px; height: 180px; background: #38bdf8; transform: rotateY(30deg) translateZ(120px); }`,
    }),
  },
  {
    id: "html-compiler.perspective.transform-function",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / transform() function",
    properties: ["transform: perspective()", "ordered operations", "rotateY"],
    hint: "transform: perspective() remains an ordered motion.perspective operation and is kept distinct from a parent perspective context.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"transform-perspective\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#transform-perspective { position: absolute; left: 700px; top: 360px; width: 520px; height: 280px; background: #facc15; transform-origin: 50% 50%; transform: perspective(620px) rotateY(-24deg) translateZ(80px); }`,
    }),
  },
  {
    id: "html-compiler.perspective.backface-hidden",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / hidden backface",
    properties: ["backface-visibility", "rotateY(180deg)", "layer state"],
    hint: "backface-visibility is preserved on the transformed layer; the runtime decides whether the reverse surface is paintable.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"backface-scene\"><div id=\"backface-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#backface-scene { position: absolute; left: 620px; top: 270px; width: 680px; height: 400px; perspective: 800px; }
#backface-card { position: absolute; left: 190px; top: 90px; width: 300px; height: 220px; background: #fb7185; transform: rotateY(180deg); backface-visibility: hidden; }`,
    }),
  },
  {
    id: "html-compiler.perspective.near-far-clipping",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / near and far clipping",
    properties: ["perspective", "translateZ", "near/far clip"],
    hint: "The perspective context keeps the layer's authored frame while Runtime V2 clips projected geometry at the camera planes.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"clip-scene\"><div id=\"clip-visible\"></div><div id=\"clip-edge\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; overflow: hidden; }
#clip-scene { position: absolute; left: 580px; top: 270px; width: 760px; height: 420px; perspective: 180px; }
#clip-visible, #clip-edge { position: absolute; left: 250px; top: 100px; width: 260px; height: 200px; background: #34d399; transform: rotateY(18deg); }
#clip-visible { transform: translateZ(80px) rotateY(18deg); }
#clip-edge { transform: translateZ(320px) rotateY(18deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.animated-3d",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / animated translateZ + rotateY",
    properties: ["@keyframes", "translateZ", "rotateY", "tracks"],
    hint: "3D transform keyframes lower to typed Matrix4 operations on the shared timeline; no CSS animation engine is introduced in Runtime V2.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"animated-scene\"><div id=\"animated-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#animated-scene { position: absolute; left: 560px; top: 250px; width: 800px; height: 480px; perspective: 820px; perspective-origin: 35% 60%; transform-style: preserve-3d; }
@keyframes animated-3d { from { transform: translateZ(0px) rotateY(-30deg); } to { transform: translateZ(180px) rotateY(30deg); } }
#animated-card { position: absolute; left: 270px; top: 120px; width: 260px; height: 220px; background: #f472b6; animation-name: animated-3d; animation-duration: 1200ms; animation-fill-mode: both; animation-timing-function: linear; }`,
    }),
  },
  {
    id: "html-compiler.perspective.atomic-transform-style-flat",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective atomic / transform-style flat",
    properties: ["transform-style: flat", "single 3D child", "solid paint"],
    hint: "The parent establishes the minimum camera context while flat is tested without filters, masks, blending or animation.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"atomic-flat-scene\"><div id=\"atomic-flat-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#atomic-flat-scene { position: absolute; left: 520px; top: 220px; width: 880px; height: 560px; perspective: 760px; transform-style: flat; }
#atomic-flat-card { position: absolute; left: 250px; top: 150px; width: 380px; height: 240px; background: #38bdf8; transform: translateZ(140px) rotateY(-24deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.atomic-transform-style-preserve-3d",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective atomic / transform-style preserve-3d",
    properties: ["transform-style: preserve-3d", "single 3D child", "solid paint"],
    hint: "The same camera and child geometry as the flat fixture isolates the preserve-3d boundary contract.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"atomic-preserve-scene\"><div id=\"atomic-preserve-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#atomic-preserve-scene { position: absolute; left: 520px; top: 220px; width: 880px; height: 560px; perspective: 760px; transform-style: preserve-3d; }
#atomic-preserve-card { position: absolute; left: 250px; top: 150px; width: 380px; height: 240px; background: #38bdf8; transform: translateZ(140px) rotateY(-24deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.atomic-backface-visible",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective atomic / backface visible",
    properties: ["backface-visibility: visible", "rotateY(180deg)", "solid paint"],
    hint: "A reversed solid plane remains paintable when backface visibility is explicitly visible.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"atomic-backface-visible-scene\"><div id=\"atomic-backface-visible-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#atomic-backface-visible-scene { position: absolute; left: 520px; top: 220px; width: 880px; height: 560px; perspective: 760px; }
#atomic-backface-visible-card { position: absolute; left: 250px; top: 150px; width: 380px; height: 240px; background: #f97316; transform: rotateY(180deg) translateZ(80px); backface-visibility: visible; }`,
    }),
  },
  {
    id: "html-compiler.perspective.atomic-backface-hidden",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective atomic / backface hidden",
    properties: ["backface-visibility: hidden", "rotateY(180deg)", "solid paint"],
    hint: "The same reversed plane becomes non-paintable only because its backface is explicitly hidden.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"atomic-backface-hidden-scene\"><div id=\"atomic-backface-hidden-card\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#atomic-backface-hidden-scene { position: absolute; left: 520px; top: 220px; width: 880px; height: 560px; perspective: 760px; }
#atomic-backface-hidden-card { position: absolute; left: 250px; top: 150px; width: 380px; height: 240px; background: #f97316; transform: rotateY(180deg) translateZ(80px); backface-visibility: hidden; }`,
    }),
  },
  {
    id: "html-compiler.perspective.matrix-functions",
    phase: "P5",
    topic: "Motion & animation",
    label: "Transform / matrix and matrix3d",
    properties: ["matrix()", "matrix3d()", "ordered transform atoms", "Matrix4"],
    hint: "CSS affine and projective matrix functions lower to the existing ordered V2 matrix atoms without a second transform path.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"matrix-scene\"><div id=\"matrix-2d\"></div><div id=\"matrix-3d\"></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#matrix-scene { position: absolute; left: 320px; top: 180px; width: 1280px; height: 700px; perspective: 720px; transform-style: preserve-3d; }
#matrix-2d { position: absolute; left: 180px; top: 190px; width: 360px; height: 220px; background: #22d3ee; transform: matrix(1.08, 0.18, -0.12, 0.92, 28, 12); }
#matrix-3d { position: absolute; left: 720px; top: 180px; width: 360px; height: 220px; background: #f97316; transform: matrix3d(1, 0.12, 0, 0.001, 0.08, 1, 0, 0, 0, 0, 1, -0.0012, 0, 0, 120, 1); }`,
    }),
  },
];

export const HTML_COMPILER_PREVIEW_MEDIA_ASSETS: HtmlCompilerMediaAsset[] = [
  { kind: "video", uri: "/preview/video/demo-video.mp4", mimeType: "video/mp4", width: 1920, height: 1080, duration: 60500, fps: 30 },
  { kind: "audio", uri: "/preview/audio/bed.mp3", mimeType: "audio/mpeg", duration: 12000, sampleRate: 48000, channels: 2 },
];

export const HTML_COMPILER_PERSPECTIVE_PHASE6_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.perspective.nested-distance",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested distances",
    properties: ["nested perspective", "distance", "Matrix4 chain"],
    hint: "Each nested group keeps its own perspective distance; Runtime composes both contexts instead of collapsing them into one camera.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-distance-outer\"><div id=\"nested-distance-inner\"><div id=\"nested-distance-card\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#nested-distance-outer { position: absolute; left: 360px; top: 180px; width: 1200px; height: 720px; perspective: 900px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#nested-distance-inner { position: absolute; left: 180px; top: 110px; width: 840px; height: 500px; perspective: 420px; perspective-origin: 75% 25%; transform-style: preserve-3d; }
#nested-distance-card { position: absolute; left: 250px; top: 130px; width: 340px; height: 220px; background: #22d3ee; transform: translateZ(160px) rotateY(-22deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-origins",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested origins",
    properties: ["perspective-origin", "nested origin", "rotateX", "rotateY"],
    hint: "Outer and inner perspective-origin values remain local to their own boxes, so convergence changes twice without changing layout frames.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-origin-outer\"><div id=\"nested-origin-inner\"><div id=\"nested-origin-card\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#nested-origin-outer { position: absolute; left: 360px; top: 160px; width: 1200px; height: 760px; perspective: 820px; perspective-origin: 15% 80%; transform-style: preserve-3d; }
#nested-origin-inner { position: absolute; left: 220px; top: 130px; width: 760px; height: 500px; perspective: 460px; perspective-origin: 85% 20%; transform-style: preserve-3d; }
#nested-origin-card { position: absolute; left: 220px; top: 120px; width: 320px; height: 230px; background: #f97316; transform: translateZ(130px) rotateY(-28deg) rotateX(12deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-flat-boundary",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested flat boundary",
    properties: ["nested perspective", "transform-style: flat", "flatten boundary"],
    hint: "The inner group declares a flat boundary while its own perspective remains explicit for its direct child surface.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-flat-outer\"><div id=\"nested-flat-inner\"><div id=\"nested-flat-card\"><div id=\"nested-flat-face\"></div></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#nested-flat-outer { position: absolute; left: 300px; top: 180px; width: 1320px; height: 700px; perspective: 760px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#nested-flat-inner { position: absolute; left: 260px; top: 110px; width: 800px; height: 500px; perspective: 400px; perspective-origin: 35% 65%; transform-style: flat; }
#nested-flat-card { position: absolute; left: 250px; top: 120px; width: 300px; height: 240px; transform: translateZ(150px) rotateY(-26deg); background: #a78bfa; }
#nested-flat-face { position: absolute; left: 50px; top: 45px; width: 200px; height: 150px; background: #facc15; transform: translateZ(120px) rotateX(26deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-preserve-depth",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested preserve-3d depth",
    properties: ["nested perspective", "preserve-3d", "sibling depth", "paint order"],
    hint: "Two descendants retain independent depth inside the nested preserve-3d context while their paint order remains deterministic.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-depth-outer\"><div id=\"nested-depth-inner\"><div id=\"nested-depth-back\"></div><div id=\"nested-depth-front\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#nested-depth-outer { position: absolute; left: 300px; top: 170px; width: 1320px; height: 720px; perspective: 860px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#nested-depth-inner { position: absolute; left: 270px; top: 110px; width: 780px; height: 500px; perspective: 520px; perspective-origin: 50% 50%; transform-style: preserve-3d; transform: rotateY(-12deg); }
#nested-depth-back, #nested-depth-front { position: absolute; left: 220px; top: 120px; width: 340px; height: 240px; transform: rotateY(18deg); }
#nested-depth-back { background: #38bdf8; transform: translateZ(40px) rotateY(18deg); }
#nested-depth-front { background: #fb7185; transform: translateZ(190px) rotateY(18deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-near-plane",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested near-plane",
    properties: ["nested perspective", "near-plane", "partial surface clip"],
    hint: "Only the inner perspective surface crosses its homogeneous camera plane; the outer surface remains visible and is not clipped as a whole.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-near-outer\"><div id=\"nested-near-inner\"><div id=\"nested-near-visible\"></div><div id=\"nested-near-edge\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; overflow: hidden; }
#nested-near-outer { position: absolute; left: 300px; top: 150px; width: 1320px; height: 760px; perspective: 900px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#nested-near-inner { position: absolute; left: 230px; top: 130px; width: 820px; height: 500px; perspective: 170px; perspective-origin: 22% 78%; transform-style: preserve-3d; }
#nested-near-visible, #nested-near-edge { position: absolute; left: 250px; top: 120px; width: 300px; height: 220px; background: #34d399; transform: rotateY(24deg); }
#nested-near-visible { transform: translateZ(70px) rotateY(24deg); }
#nested-near-edge { left: 570px; transform: translateZ(240px) rotateY(24deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-overflow-clip",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested overflow clipping",
    properties: ["nested perspective", "overflow: hidden", "composition clip"],
    hint: "The inner perspective result is clipped by its own overflow boundary and then by the composition edge without leaking outside either scope.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-overflow-outer\"><div id=\"nested-overflow-inner\"><div id=\"nested-overflow-card\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; overflow: hidden; }
#nested-overflow-outer { position: absolute; left: 180px; top: 140px; width: 1580px; height: 800px; perspective: 880px; perspective-origin: 50% 50%; transform-style: preserve-3d; overflow: hidden; }
#nested-overflow-inner { position: absolute; left: 980px; top: 180px; width: 520px; height: 360px; perspective: 360px; perspective-origin: 18% 70%; transform-style: preserve-3d; overflow: hidden; }
#nested-overflow-card { position: absolute; left: 170px; top: 70px; width: 360px; height: 260px; background: #fb7185; transform: translateZ(170px) rotateY(-38deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-backface",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested backface",
    properties: ["nested perspective", "backface-visibility", "rotateY(180deg)"],
    hint: "Backface visibility is evaluated after the accumulated nested Matrix4 transform, not at an isolated child transform.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-backface-outer\"><div id=\"nested-backface-inner\"><div id=\"nested-backface-card\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#nested-backface-outer { position: absolute; left: 320px; top: 180px; width: 1280px; height: 700px; perspective: 820px; transform-style: preserve-3d; }
#nested-backface-inner { position: absolute; left: 240px; top: 100px; width: 800px; height: 500px; perspective: 440px; perspective-origin: 76% 24%; transform-style: preserve-3d; transform: rotateY(18deg); }
#nested-backface-card { position: absolute; left: 230px; top: 120px; width: 340px; height: 240px; background: #f43f5e; transform: translateZ(140px) rotateY(180deg); backface-visibility: hidden; }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-same-origin",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested shared origin",
    properties: ["nested perspective", "shared origin", "center convergence"],
    hint: "Matching percentage origins are resolved in each local box; equal percentages do not imply a shared absolute point.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-same-outer\"><div id=\"nested-same-inner\"><div id=\"nested-same-card\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#nested-same-outer { position: absolute; left: 300px; top: 160px; width: 1320px; height: 760px; perspective: 900px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#nested-same-inner { position: absolute; left: 250px; top: 130px; width: 820px; height: 500px; perspective: 440px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#nested-same-card { position: absolute; left: 240px; top: 120px; width: 340px; height: 230px; background: #22c55e; transform: translateZ(150px) rotateY(-24deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-between-boundaries",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / layer between boundaries",
    properties: ["nested perspective", "intermediate layer", "stable ancestor order"],
    hint: "A direct child surface and a nested perspective subtree retain separate ancestor chains instead of inheriting the inner camera.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-between-outer\"><div id=\"nested-between-direct\"></div><div id=\"nested-between-inner\"><div id=\"nested-between-card\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#nested-between-outer { position: absolute; left: 240px; top: 150px; width: 1440px; height: 780px; perspective: 880px; perspective-origin: 45% 55%; transform-style: preserve-3d; }
#nested-between-direct { position: absolute; left: 180px; top: 190px; width: 300px; height: 220px; background: #f59e0b; transform: translateZ(90px) rotateY(18deg); }
#nested-between-inner { position: absolute; left: 700px; top: 130px; width: 600px; height: 500px; perspective: 380px; perspective-origin: 70% 30%; transform-style: preserve-3d; }
#nested-between-card { position: absolute; left: 120px; top: 140px; width: 300px; height: 220px; background: #38bdf8; transform: translateZ(180px) rotateY(-26deg); }`,
    }),
  },
  {
    id: "html-compiler.perspective.nested-clip-path",
    phase: "P6",
    topic: "Motion & animation",
    label: "Perspective / nested clip-path",
    properties: ["nested perspective", "clip-path", "overflow", "composition clip"],
    hint: "Geometric clip-path and nested overflow are intersected after the complete Matrix4 chain, before the composition edge clip.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"nested-clip-outer\"><div id=\"nested-clip-inner\"><div id=\"nested-clip-card\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; overflow: hidden; }
#nested-clip-outer { position: absolute; left: 220px; top: 130px; width: 1500px; height: 820px; perspective: 860px; perspective-origin: 50% 50%; transform-style: preserve-3d; overflow: hidden; }
#nested-clip-inner { position: absolute; left: 780px; top: 160px; width: 620px; height: 440px; perspective: 360px; perspective-origin: 20% 75%; transform-style: preserve-3d; overflow: hidden; }
#nested-clip-card { position: absolute; left: 90px; top: 70px; width: 480px; height: 340px; background: #a855f7; transform: translateZ(210px) rotateY(-34deg) rotateX(9deg); clip-path: polygon(8% 0, 100% 12%, 88% 100%, 0 84%); }`,
    }),
  },
  {
    id: "html-compiler.perspective.parallax-three-depths",
    phase: "P5",
    topic: "Motion & animation",
    label: "Perspective / slow stroke parallax camera shot",
    properties: ["parallax video", "camera translateZ", "perspective", "slow depth zoom", "circle + triangle + rectangle stroke"],
    hint: "A slow looping camera shot travels through three flat stroke planes. The circle is nearest, the triangle is intermediate, and the rectangle is farthest, so their apparent scale changes at different rates.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"parallax-viewport\"><div id=\"parallax-world\"><div id=\"parallax-rectangle\"></div><svg id=\"parallax-triangle\" viewBox=\"0 0 800 560\" width=\"800\" height=\"560\" aria-hidden=\"true\"><path id=\"parallax-triangle-path\" d=\"M 400 12 L 788 548 L 12 548 Z\"></path></svg><div id=\"parallax-circle\"></div></div></div>\n</body>"),
      css: `body { margin: 0; background: #081018; overflow: hidden; }
#parallax-viewport { position: absolute; left: 260px; top: 150px; width: 1400px; height: 780px; perspective: 680px; perspective-origin: 50% 50%; overflow: hidden; }
#parallax-world { position: absolute; inset: 0; transform-style: preserve-3d; transform-origin: 50% 50%; animation-name: parallax-camera; animation-duration: 12000ms; animation-iteration-count: infinite; animation-fill-mode: both; animation-timing-function: linear; }
@keyframes parallax-camera {
  0% { transform: translateZ(-80px); }
  30% { transform: translateZ(80px); }
  55% { transform: translateZ(150px); }
  68% { transform: translateZ(180px); }
  76% { transform: translateZ(180px); }
  100% { transform: translateZ(-80px); }
}
#parallax-rectangle, #parallax-triangle, #parallax-circle { position: absolute; transform-origin: 50% 50%; }
#parallax-rectangle { left: 100px; top: 65px; width: 1200px; height: 650px; background: transparent; border: 12px solid #38bdf8; transform: translateZ(-380px); }
#parallax-triangle { display: block; left: 300px; top: 110px; width: 800px; height: 560px; overflow: visible; transform: translateZ(-90px); }
#parallax-triangle-path { fill: none; stroke: #facc15; stroke-width: 24px; stroke-linejoin: miter; }
#parallax-circle { left: 490px; top: 180px; width: 420px; height: 420px; background: transparent; border: 14px solid #fb7185; border-radius: 50%; transform: translateZ(140px); }`,
    }),
  },
];

const perspectiveAnimationCase = (
  id: string,
  label: string,
  properties: string[],
  hint: string,
  body: string,
  css: string,
): HtmlCompilerPreviewCase => ({
  id: `html-compiler.perspective.${id}`,
  phase: "P7",
  topic: "Motion & animation",
  label,
  properties,
  hint,
  source: createNewHtmlProject({
    html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", `<body>\n  ${body}\n</body>`),
    css: `body { margin: 0; background: #081018; }\n${css}`,
  }),
});

export const HTML_COMPILER_PERSPECTIVE_PHASE7_CASES: HtmlCompilerPreviewCase[] = [
  perspectiveAnimationCase(
    "animation-distance-linear",
    "Perspective animation / distance linear",
    ["perspective", "@keyframes", "linear", "distance"],
    "The group camera distance is a numeric render3d track; the child keeps translateZ while the perspective matrix is rebuilt per sample.",
    `<div id="p7-distance-linear"><div class="p7-card"></div></div>`,
    `@keyframes p7-distance-linear { from { perspective: 360px; } to { perspective: 900px; } }
#p7-distance-linear { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 360px; perspective-origin: 50% 50%; transform-style: preserve-3d; animation-name: p7-distance-linear; animation-duration: 1200ms; animation-fill-mode: both; animation-timing-function: linear; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #22d3ee; transform: translateZ(150px) rotateY(-22deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-distance-cubic",
    "Perspective animation / cubic-bezier",
    ["perspective", "cubic-bezier", "typed number track"],
    "Cubic-bezier easing stays on the distance track segment and is evaluated by the shared Runtime V2 sampler.",
    `<div id="p7-distance-cubic"><div class="p7-card"></div></div>`,
    `@keyframes p7-distance-cubic { from { perspective: 420px; } to { perspective: 980px; } }
#p7-distance-cubic { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 420px; perspective-origin: 30% 65%; transform-style: preserve-3d; animation-name: p7-distance-cubic; animation-duration: 1400ms; animation-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1); animation-fill-mode: both; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #a78bfa; transform: translateZ(170px) rotateY(24deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-distance-steps",
    "Perspective animation / steps distance",
    ["perspective", "steps(4, jump-start)", "discrete camera plateaus"],
    "Steps easing creates deterministic discrete perspective distances without a separate CSS animation engine.",
    `<div id="p7-distance-steps"><div class="p7-card"></div></div>`,
    `@keyframes p7-distance-steps { from { perspective: 300px; } 25% { perspective: 500px; } 50% { perspective: 700px; } to { perspective: 1000px; } }
#p7-distance-steps { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 300px; perspective-origin: 50% 50%; transform-style: preserve-3d; animation-name: p7-distance-steps; animation-duration: 1600ms; animation-timing-function: steps(4, jump-start); animation-fill-mode: both; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #facc15; transform: translateZ(160px) rotateY(-18deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-origin-corner",
    "Perspective animation / center to corner",
    ["perspective-origin", "center", "right bottom", "vec2"],
    "Perspective-origin animates as one typed vec2 track while X and Y resolve against the group's own frame.",
    `<div id="p7-origin-corner"><div class="p7-card"></div></div>`,
    `@keyframes p7-origin-corner { from { perspective-origin: center; } to { perspective-origin: right bottom; } }
#p7-origin-corner { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 620px; perspective-origin: 50% 50%; transform-style: preserve-3d; animation-name: p7-origin-corner; animation-duration: 1200ms; animation-timing-function: linear; animation-fill-mode: both; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #fb7185; transform: translateZ(180px) rotateY(-26deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-origin-xy",
    "Perspective animation / X + Y origin",
    ["perspective-origin", "percentage X", "percentage Y", "simultaneous interpolation"],
    "Both origin coordinates interpolate independently, preserving local percentage resolution and the named object contract.",
    `<div id="p7-origin-xy"><div class="p7-card"></div></div>`,
    `@keyframes p7-origin-xy { from { perspective-origin: 8% 88%; } to { perspective-origin: 92% 12%; } }
#p7-origin-xy { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 560px; perspective-origin: 8% 88%; transform-style: preserve-3d; animation-name: p7-origin-xy; animation-duration: 1300ms; animation-fill-mode: both; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #34d399; transform: translateZ(150px) rotateX(14deg) rotateY(22deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-delay-backwards",
    "Perspective animation / delay + backwards",
    ["perspective", "animation-delay", "backwards fill"],
    "During the positive delay, backwards fill exposes the first camera distance through the shared playback metadata.",
    `<div id="p7-delay-backwards"><div class="p7-card"></div></div>`,
    `@keyframes p7-delay-backwards { from { perspective: 360px; } to { perspective: 860px; } }
#p7-delay-backwards { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 360px; perspective-origin: 50% 50%; transform-style: preserve-3d; animation-name: p7-delay-backwards; animation-duration: 900ms; animation-delay: 300ms; animation-fill-mode: backwards; animation-timing-function: linear; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #f97316; transform: translateZ(170px) rotateY(-20deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-alternate",
    "Perspective animation / alternate iterations",
    ["perspective", "iteration-count", "alternate", "cycle boundary"],
    "Alternate playback reverses the distance track on the second iteration while preserving the local perspective origin.",
    `<div id="p7-alternate"><div class="p7-card"></div></div>`,
    `@keyframes p7-alternate { from { perspective: 400px; } to { perspective: 900px; } }
#p7-alternate { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 400px; perspective-origin: 70% 30%; transform-style: preserve-3d; animation-name: p7-alternate; animation-duration: 700ms; animation-iteration-count: 2; animation-direction: alternate; animation-fill-mode: both; animation-timing-function: linear; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #38bdf8; transform: translateZ(150px) rotateY(26deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-paused",
    "Perspective animation / paused transport",
    ["perspective-origin", "animation-play-state", "paused", "transport"],
    "The authored paused state remains playback metadata; the preview transport can still seek a deterministic sample.",
    `<div id="p7-paused"><div class="p7-card"></div></div>`,
    `@keyframes p7-paused { from { perspective-origin: 20% 80%; } to { perspective-origin: 80% 20%; } }
#p7-paused { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 650px; perspective-origin: 20% 80%; transform-style: preserve-3d; animation-name: p7-paused; animation-duration: 1000ms; animation-play-state: paused; animation-fill-mode: both; animation-timing-function: linear; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #a78bfa; transform: translateZ(180px) rotateY(-24deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-rotate",
    "Perspective animation / distance + rotateY",
    ["perspective", "rotateY", "transform order", "combined tracks"],
    "Camera distance and child rotateY remain independent typed tracks while the transform order is preserved.",
    `<div id="p7-rotate"><div class="p7-card"></div></div>`,
    `@keyframes p7-camera-rotate { from { perspective: 420px; } to { perspective: 900px; } }
@keyframes p7-card-rotate { from { transform: translateZ(120px) rotateY(-30deg); } to { transform: translateZ(220px) rotateY(30deg); } }
#p7-rotate { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 420px; perspective-origin: 35% 60%; transform-style: preserve-3d; animation-name: p7-camera-rotate; animation-duration: 1200ms; animation-fill-mode: both; animation-timing-function: linear; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #22d3ee; animation-name: p7-card-rotate; animation-duration: 1200ms; animation-fill-mode: both; animation-timing-function: linear; }`,
  ),
  perspectiveAnimationCase(
    "animation-nested-origin",
    "Perspective animation / nested origin",
    ["nested perspective", "perspective-origin", "local track", "ancestor chain"],
    "Only the inner camera origin animates; the outer perspective remains a separate ancestor context in the Matrix4 chain.",
    `<div id="p7-nested-outer"><div id="p7-nested-inner"><div class="p7-card"></div></div></div>`,
    `@keyframes p7-inner-origin { from { perspective-origin: 15% 80%; } to { perspective-origin: 85% 20%; } }
#p7-nested-outer { position: absolute; left: 300px; top: 140px; width: 1320px; height: 760px; perspective: 900px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#p7-nested-inner { position: absolute; left: 220px; top: 120px; width: 880px; height: 520px; perspective: 430px; perspective-origin: 15% 80%; transform-style: preserve-3d; animation-name: p7-inner-origin; animation-duration: 1400ms; animation-fill-mode: both; animation-timing-function: linear; }
.p7-card { position: absolute; left: 260px; top: 150px; width: 360px; height: 240px; background: #fb7185; transform: translateZ(180px) rotateX(12deg) rotateY(-24deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-origin-outside",
    "Perspective animation / origin outside box",
    ["perspective-origin", "negative length", "outside border-box", "no clamp"],
    "Origin coordinates outside the border-box remain valid local camera coordinates and are not clamped during lowering.",
    `<div id="p7-origin-outside"><div class="p7-card"></div></div>`,
    `@keyframes p7-origin-outside { from { perspective-origin: -160px 720px; } to { perspective-origin: 1240px -120px; } }
#p7-origin-outside { position: absolute; left: 420px; top: 210px; width: 1080px; height: 620px; perspective: 600px; perspective-origin: -160px 720px; transform-style: preserve-3d; animation-name: p7-origin-outside; animation-duration: 1100ms; animation-fill-mode: both; animation-timing-function: linear; }
.p7-card { position: absolute; left: 360px; top: 180px; width: 360px; height: 240px; background: #f59e0b; transform: translateZ(160px) rotateY(20deg); }`,
  ),
  perspectiveAnimationCase(
    "animation-sibling-tracks",
    "Perspective animation / sibling camera tracks",
    ["two sibling groups", "perspective", "perspective-origin", "independent tracks"],
    "Sibling perspective groups keep independent distance and origin tracks; no track is merged across layer scope.",
    `<div id="p7-sibling-left"><div class="p7-sibling-card left"></div></div><div id="p7-sibling-right"><div class="p7-sibling-card right"></div></div>`,
    `@keyframes p7-sibling-left { from { perspective: 380px; perspective-origin: 15% 50%; } to { perspective: 820px; perspective-origin: 85% 50%; } }
@keyframes p7-sibling-right { from { perspective: 820px; perspective-origin: 85% 50%; } to { perspective: 380px; perspective-origin: 15% 50%; } }
#p7-sibling-left, #p7-sibling-right { position: absolute; top: 260px; width: 520px; height: 360px; transform-style: preserve-3d; animation-duration: 1200ms; animation-fill-mode: both; animation-timing-function: linear; }
#p7-sibling-left { left: 260px; perspective: 380px; perspective-origin: 15% 50%; animation-name: p7-sibling-left; }
#p7-sibling-right { left: 1140px; perspective: 820px; perspective-origin: 85% 50%; animation-name: p7-sibling-right; }
.p7-sibling-card { position: absolute; left: 110px; top: 90px; width: 300px; height: 180px; transform: translateZ(120px) rotateY(-18deg); }
.p7-sibling-card.left { background: #22d3ee; }
.p7-sibling-card.right { background: #a78bfa; transform: translateZ(180px) rotateY(18deg); }`,
  ),
];

const perspectiveTextureCase = (
  id: string,
  label: string,
  properties: string[],
  hint: string,
  body: string,
  css: string,
): HtmlCompilerPreviewCase => ({
  id: `html-compiler.texture.${id}`,
  phase: "P8",
  topic: "Motion & animation",
  label,
  properties,
  hint,
  source: createNewHtmlProject({
    html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", `<body>\n  ${body}\n</body>`),
    css: `body { margin: 0; background: #081018; overflow: hidden; }\n${css}`,
  }),
});

export const HTML_COMPILER_PERSPECTIVE_PHASE8_CASES: HtmlCompilerPreviewCase[] = [
  perspectiveTextureCase(
    "image-contain-rotate-y",
    "Texture / image contain on rotateY",
    ["img", "object-fit: contain", "rotateY", "projective UV"],
    "Contain resolves the source and destination rectangles before the image plane is projected by the accumulated Matrix4.",
    `<div id="texture-contain-scene"><img id="texture-contain" src="/preview/image/photo-landscape.jpg"></div>`,
    `#texture-contain-scene { position: absolute; left: 360px; top: 220px; width: 1200px; height: 620px; perspective: 760px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#texture-contain { position: absolute; left: 350px; top: 150px; width: 500px; height: 300px; object-fit: contain; object-position: center; transform: translateZ(120px) rotateY(-28deg); }`,
  ),
  perspectiveTextureCase(
    "image-cover-off-center",
    "Texture / cover with off-center origin",
    ["img", "object-fit: cover", "object-position", "perspective-origin"],
    "Cover cropping and object-position are resolved in image space; the cropped quad then follows the off-center perspective camera.",
    `<div id="texture-cover-scene"><img id="texture-cover" src="/preview/image/photo-portrait.jpg"></div>`,
    `#texture-cover-scene { position: absolute; left: 360px; top: 180px; width: 1200px; height: 700px; perspective: 680px; perspective-origin: 18% 78%; transform-style: preserve-3d; }
#texture-cover { position: absolute; left: 360px; top: 170px; width: 480px; height: 300px; object-fit: cover; object-position: right top; transform: translateZ(130px) rotateY(26deg); }`,
  ),
  perspectiveTextureCase(
    "image-alpha-tilt",
    "Texture / alpha image on inclined plane",
    ["alpha PNG", "rotateX", "rotateY", "transparent texture"],
    "Transparent pixels remain texture alpha on the projective surface instead of becoming a solid bounding rectangle.",
    `<div id="texture-alpha-scene"><img id="texture-alpha" src="/preview/image/img-alpha.png"></div>`,
    `#texture-alpha-scene { position: absolute; left: 360px; top: 190px; width: 1200px; height: 660px; perspective: 720px; transform-style: preserve-3d; }
#texture-alpha { position: absolute; left: 380px; top: 150px; width: 440px; height: 320px; object-fit: fill; transform: translateZ(100px) rotateX(24deg) rotateY(-22deg); }`,
  ),
  perspectiveTextureCase(
    "video-projective-quad",
    "Texture / video frame on projective quad",
    ["video", "frame source", "rotateY", "shared texture path"],
    "Video uses the same projective textured-surface path as image; only the decoded frame source changes per playback timestamp.",
    `<div id="texture-video-scene"><video id="texture-video" src="/preview/video/demo-video.mp4" muted playsinline></video></div>`,
    `#texture-video-scene { position: absolute; left: 360px; top: 180px; width: 1200px; height: 700px; perspective: 760px; perspective-origin: 50% 50%; transform-style: preserve-3d; }
#texture-video { position: absolute; left: 340px; top: 150px; width: 520px; height: 300px; object-fit: cover; transform: translateZ(130px) rotateY(-24deg); }`,
  ),
  perspectiveTextureCase(
    "media-object-position",
    "Texture / image object-position",
    ["image", "object-position: left bottom", "UV crop", "projective plane"],
    "Object-position changes UV crop selection without changing the projected layout frame.",
    `<div id="texture-position-scene"><img id="texture-position" src="/preview/image/photo-portrait.jpg"></div>`,
    `#texture-position-scene { position: absolute; left: 360px; top: 180px; width: 1200px; height: 700px; perspective: 720px; perspective-origin: 72% 28%; transform-style: preserve-3d; }
#texture-position { position: absolute; left: 360px; top: 170px; width: 480px; height: 300px; object-fit: cover; object-position: left bottom; transform: translateZ(120px) rotateX(-16deg) rotateY(24deg); }`,
  ),
  perspectiveTextureCase(
    "image-composition-edge",
    "Texture / composition edge clipping",
    ["image", "composition clip", "projective bounds", "edge"],
    "The projected image is clipped at the composition edge after projective placement, without leaking pixels outside the frame.",
    `<div id="texture-edge-scene"><img id="texture-edge" src="/preview/image/photo-landscape.jpg"></div>`,
    `#texture-edge-scene { position: absolute; left: 1380px; top: 260px; width: 720px; height: 500px; perspective: 520px; transform-style: preserve-3d; }
#texture-edge { position: absolute; left: 120px; top: 90px; width: 620px; height: 360px; object-fit: cover; transform: translateZ(180px) rotateY(-36deg); }`,
  ),
  perspectiveTextureCase(
    "image-clip-path",
    "Texture / image with clip-path",
    ["image", "clip-path: polygon", "geometric clip", "projective UV"],
    "A geometric clip remains a clip path intersected with the textured projective surface, not a sibling alpha image.",
    `<div id="texture-clip-scene"><img id="texture-clip" src="/preview/image/photo-landscape.jpg"></div>`,
    `#texture-clip-scene { position: absolute; left: 360px; top: 180px; width: 1200px; height: 700px; perspective: 740px; transform-style: preserve-3d; }
#texture-clip { position: absolute; left: 350px; top: 160px; width: 500px; height: 300px; object-fit: cover; transform: translateZ(120px) rotateY(-20deg); clip-path: polygon(8% 0, 100% 14%, 86% 100%, 0 82%); }`,
  ),
  perspectiveTextureCase(
    "video-opacity-blend",
    "Texture / video opacity + blend",
    ["video", "opacity", "mix-blend-mode: screen", "offscreen"],
    "Video texture is sampled first, then layer opacity and blend scope are applied to the rendered surface.",
    `<div id="texture-blend-scene"><div id="texture-blend-backdrop"></div><video id="texture-blend" src="/preview/video/demo-video.mp4" muted playsinline></video></div>`,
    `#texture-blend-scene { position: absolute; left: 360px; top: 180px; width: 1200px; height: 700px; perspective: 760px; transform-style: preserve-3d; }
#texture-blend-backdrop { position: absolute; left: 300px; top: 120px; width: 620px; height: 420px; background: #7c3aed; }
#texture-blend { position: absolute; left: 360px; top: 170px; width: 520px; height: 300px; object-fit: cover; opacity: .72; mix-blend-mode: screen; transform: translateZ(140px) rotateY(22deg); }`,
  ),
  perspectiveTextureCase(
    "image-animated-z",
    "Texture / animated translateZ",
    ["image", "@keyframes", "translateZ", "typed texture track"],
    "The texture stays attached to the image plane while translateZ changes over the shared Runtime V2 timeline.",
    `<div id="texture-animated-scene"><img id="texture-animated" src="/preview/image/photo-landscape.jpg"></div>`,
    `@keyframes texture-animated-z { from { transform: translateZ(0px) rotateY(-28deg); } to { transform: translateZ(220px) rotateY(28deg); } }
#texture-animated-scene { position: absolute; left: 360px; top: 180px; width: 1200px; height: 700px; perspective: 720px; transform-style: preserve-3d; }
#texture-animated { position: absolute; left: 350px; top: 160px; width: 500px; height: 300px; object-fit: cover; animation-name: texture-animated-z; animation-duration: 1200ms; animation-fill-mode: both; animation-timing-function: linear; }`,
  ),
  perspectiveTextureCase(
    "image-near-plane",
    "Texture / near-plane partial clipping",
    ["image", "translateZ", "near-plane", "homogeneous clip"],
    "Only the part of the image plane outside the near camera plane is removed before perspective division.",
    `<div id="texture-near-scene"><img id="texture-near" src="/preview/image/photo-landscape.jpg"></div>`,
    `#texture-near-scene { position: absolute; left: 580px; top: 240px; width: 760px; height: 520px; perspective: 190px; transform-style: preserve-3d; }
#texture-near { position: absolute; left: 230px; top: 100px; width: 420px; height: 280px; object-fit: cover; transform: translateZ(160px) rotateY(28deg); }`,
  ),
  perspectiveTextureCase(
    "nested-image-perspective",
    "Texture / nested perspective",
    ["nested perspective", "image", "preserve-3d", "Matrix4 chain"],
    "Nested cameras compose in order and the image receives the final projective transform as one textured surface.",
    `<div id="texture-nested-outer"><div id="texture-nested-inner"><img id="texture-nested" src="/preview/image/photo-landscape.jpg"></div></div>`,
    `#texture-nested-outer { position: absolute; left: 300px; top: 150px; width: 1320px; height: 760px; perspective: 900px; transform-style: preserve-3d; }
#texture-nested-inner { position: absolute; left: 220px; top: 120px; width: 880px; height: 520px; perspective: 430px; perspective-origin: 22% 78%; transform-style: preserve-3d; transform: rotateY(-12deg); }
#texture-nested { position: absolute; left: 250px; top: 140px; width: 500px; height: 300px; object-fit: contain; transform: translateZ(170px) rotateX(14deg) rotateY(-28deg); }`,
  ),
  perspectiveTextureCase(
    "image-high-distortion",
    "Texture / high projective distortion",
    ["image", "rotateX + rotateY", "subdivision", "seam check"],
    "A strongly inclined plane exercises the projective texture path and its subdivision/seam contract.",
    `<div id="texture-distortion-scene"><img id="texture-distortion" src="/preview/image/photo-landscape.jpg"></div>`,
    `#texture-distortion-scene { position: absolute; left: 300px; top: 120px; width: 1320px; height: 820px; perspective: 460px; perspective-origin: 68% 30%; transform-style: preserve-3d; }
#texture-distortion { position: absolute; left: 350px; top: 180px; width: 620px; height: 360px; object-fit: cover; transform: translateZ(180px) rotateX(34deg) rotateY(-42deg); }`,
  ),
];

const perspectiveMaskFilterCase = (
  id: string,
  label: string,
  properties: string[],
  hint: string,
  body: string,
  css: string,
): HtmlCompilerPreviewCase => ({
  id: `html-compiler.perspective.${id}`,
  phase: "P9",
  topic: "Motion & animation",
  label,
  classification: "combined",
  classificationLabel: "Combined pipeline",
  properties,
  hint,
  source: createNewHtmlProject({
    html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", `<body>\n  ${body}\n</body>`),
    css: `body { margin: 0; background: #081018; overflow: hidden; }\n${css}`,
  }),
});

export const HTML_COMPILER_PERSPECTIVE_PHASE9_CASES: HtmlCompilerPreviewCase[] = [
  perspectiveMaskFilterCase("mask-alpha-near-plane", "Mask/filter / alpha mask near-plane", ["mask-image", "alpha", "near-plane", "homogeneous clip"], "The alpha mask follows the projective surface and remains partially visible across the near camera plane.", `<div id="p9-alpha-scene"><div id="p9-alpha-card"></div></div>`, `#p9-alpha-scene { position: absolute; left: 580px; top: 240px; width: 760px; height: 520px; perspective: 190px; transform-style: preserve-3d; }
#p9-alpha-card { position: absolute; left: 230px; top: 100px; width: 420px; height: 280px; background: #22d3ee; mask-image: linear-gradient(90deg, #00000000 0%, #ffffffff 38%, #ffffffff 100%); mask-mode: alpha; mask-repeat: no-repeat; transform: translateZ(160px) rotateY(28deg); }`),
  perspectiveMaskFilterCase("mask-luminance-near-plane", "Mask/filter / luminance mask near-plane", ["mask-image", "luminance", "asset URL", "near-plane"], "Luminance coverage is sampled from the projective image mask and converted to deterministic alpha.", `<div id="p9-luma-scene"><div id="p9-luma-card"></div></div>`, `#p9-luma-scene { position: absolute; left: 580px; top: 240px; width: 760px; height: 520px; perspective: 190px; transform-style: preserve-3d; }
#p9-luma-card { position: absolute; left: 230px; top: 100px; width: 420px; height: 280px; background: #f97316; mask-image: url(/preview/image/img-alpha.png); mask-mode: luminance; mask-size: 420px 280px; mask-position: center; mask-repeat: no-repeat; transform: translateZ(160px) rotateY(28deg); }`),
  perspectiveMaskFilterCase("mask-add-intersect-near-plane", "Mask/filter / add then intersect", ["two mask layers", "add", "intersect", "near-plane"], "Mask sources remain ordered: the first establishes coverage and the second intersects it on the projective plane.", `<div id="p9-add-intersect-scene"><div id="p9-add-intersect-card"></div></div>`, `#p9-add-intersect-scene { position: absolute; left: 470px; top: 220px; width: 980px; height: 600px; perspective: 260px; transform-style: preserve-3d; }
#p9-add-intersect-card { position: absolute; left: 250px; top: 130px; width: 480px; height: 300px; background: #a78bfa; mask-image: linear-gradient(90deg, #ffffffff 0%, #ffffffff 100%), radial-gradient(ellipse at 72% 44%, #ffffffff 0%, #ffffffff 34%, #000000 72%); mask-mode: alpha, alpha; mask-composite: intersect; mask-repeat: no-repeat, no-repeat; transform: translateZ(180px) rotateY(-24deg); }`),
  perspectiveMaskFilterCase("mask-subtract-composition-edge", "Mask/filter / subtract at composition edge", ["mask-composite", "subtract", "composition clip", "private surface"], "Subtract is evaluated on the private mask surface before the layer is clipped at the composition boundary.", `<div id="p9-subtract-scene"><div id="p9-subtract-card"></div></div>`, `#p9-subtract-scene { position: absolute; left: 1360px; top: 260px; width: 760px; height: 520px; perspective: 520px; transform-style: preserve-3d; }
#p9-subtract-card { position: absolute; left: 90px; top: 90px; width: 620px; height: 360px; background: #c026d3; mask-image: linear-gradient(90deg, #ffffffff 0%, #ffffffff 100%), radial-gradient(circle at 28% 50%, #ffffffff 0%, #ffffffff 24%, #000000 28%); mask-mode: alpha, alpha; mask-composite: subtract; mask-repeat: no-repeat, no-repeat; transform: translateZ(180px) rotateY(-36deg); }`),
  perspectiveMaskFilterCase("mask-exclude-inclined", "Mask/filter / exclude on inclined surface", ["mask-composite", "exclude", "rotateX", "rotateY"], "Exclude preserves the symmetric difference of two coverage sources while the visible surface is inclined.", `<div id="p9-exclude-scene"><div id="p9-exclude-card"></div></div>`, `#p9-exclude-scene { position: absolute; left: 360px; top: 180px; width: 1200px; height: 700px; perspective: 620px; perspective-origin: 65% 32%; transform-style: preserve-3d; }
#p9-exclude-card { position: absolute; left: 350px; top: 150px; width: 520px; height: 320px; background: #38bdf8; mask-image: radial-gradient(circle at 35% 50%, #ffffffff 0%, #ffffffff 36%, #000000 38%), radial-gradient(circle at 68% 50%, #ffffffff 0%, #ffffffff 34%, #000000 36%); mask-mode: alpha, alpha; mask-composite: exclude; mask-repeat: no-repeat, no-repeat; transform: translateZ(150px) rotateX(22deg) rotateY(-28deg); }`),
  perspectiveMaskFilterCase("filter-blur-near-plane", "Mask/filter / blur source near-plane", ["filter", "blur", "near-plane", "offscreen surface"], "Blur is applied to the projectively clipped source surface and cannot leak outside the composition edge.", `<div id="p9-blur-scene"><div id="p9-blur-card"></div></div>`, `#p9-blur-scene { position: absolute; left: 580px; top: 240px; width: 760px; height: 520px; perspective: 190px; transform-style: preserve-3d; }
#p9-blur-card { position: absolute; left: 230px; top: 100px; width: 420px; height: 280px; background: #34d399; filter: blur(14px); transform: translateZ(160px) rotateY(28deg); }`),
  perspectiveMaskFilterCase("filter-drop-shadow-after-blur-near-plane", "Mask/filter / drop-shadow after blur", ["blur", "drop-shadow", "ordered effects", "near-plane"], "The drop-shadow samples the preceding blurred source, preserving CSS filter order.", `<div id="p9-drop-shadow-scene"><div id="p9-drop-shadow-card"></div></div>`, `#p9-drop-shadow-scene { position: absolute; left: 470px; top: 210px; width: 980px; height: 620px; perspective: 250px; transform-style: preserve-3d; }
#p9-drop-shadow-card { position: absolute; left: 260px; top: 140px; width: 460px; height: 300px; background: #fb7185; filter: blur(8px) drop-shadow(24px 20px 14px #38bdf899); transform: translateZ(180px) rotateY(-24deg); }`),
  perspectiveMaskFilterCase("filter-mask-clip-path", "Mask/filter / mask + clip-path", ["mask-image", "clip-path", "filter", "intersected coverage"], "Geometric clip coverage is intersected with the mask before the filtered projective surface is composited.", `<div id="p9-mask-clip-scene"><div id="p9-mask-clip-card"></div></div>`, `#p9-mask-clip-scene { position: absolute; left: 380px; top: 180px; width: 1160px; height: 680px; perspective: 600px; transform-style: preserve-3d; }
#p9-mask-clip-card { position: absolute; left: 300px; top: 150px; width: 520px; height: 320px; background: #facc15; mask-image: radial-gradient(ellipse at 52% 48%, #ffffffff 0%, #ffffffff 54%, #000000 82%); mask-mode: alpha; mask-repeat: no-repeat; clip-path: polygon(8% 0, 100% 14%, 88% 100%, 0 82%); filter: blur(6px); transform: translateZ(160px) rotateX(10deg) rotateY(26deg); }`),
  perspectiveMaskFilterCase("isolated-mask-filter-projective", "Mask/filter / isolated projective group", ["isolation", "mask", "filter", "projective group"], "The isolated group owns its mask and filter offscreen surface; its child blend remains inside that boundary.", `<div id="p9-isolated-scene"><div id="p9-isolated-group"><div id="p9-isolated-card"></div><div id="p9-isolated-accent"></div></div></div>`, `#p9-isolated-scene { position: absolute; left: 320px; top: 170px; width: 1280px; height: 720px; perspective: 720px; transform-style: preserve-3d; }
#p9-isolated-group { position: absolute; left: 240px; top: 130px; width: 760px; height: 460px; isolation: isolate; mask-image: linear-gradient(90deg, #00000000 0%, #ffffffff 22%, #ffffffff 88%, #00000000 100%); mask-mode: alpha; mask-repeat: no-repeat; filter: contrast(1.12) blur(3px); transform: translateZ(120px) rotateY(-18deg); }
#p9-isolated-card { position: absolute; left: 100px; top: 80px; width: 520px; height: 300px; background: #8b5cf6; }
#p9-isolated-accent { position: absolute; left: 260px; top: 130px; width: 360px; height: 180px; background: #22d3ee; mix-blend-mode: screen; }`),
  perspectiveMaskFilterCase("mask-different-perspective-boundary", "Mask/filter / nested mask camera", ["nested perspective", "mask source", "different boundary", "Matrix4 chain"], "The mask source is resolved in the element box while the visible child inherits a different nested perspective context.", `<div id="p9-boundary-outer"><div id="p9-boundary-inner"><div id="p9-boundary-card"></div></div></div>`, `#p9-boundary-outer { position: absolute; left: 280px; top: 150px; width: 1360px; height: 760px; perspective: 900px; transform-style: preserve-3d; }
#p9-boundary-inner { position: absolute; left: 300px; top: 120px; width: 760px; height: 500px; perspective: 360px; perspective-origin: 24% 72%; transform-style: preserve-3d; }
#p9-boundary-card { position: absolute; left: 140px; top: 100px; width: 500px; height: 300px; background: #4ade80; mask-image: radial-gradient(ellipse at 68% 42%, #ffffffff 0%, #ffffffff 38%, #000000 76%); mask-mode: alpha; mask-repeat: no-repeat; filter: brightness(1.08) blur(4px); transform: translateZ(190px) rotateY(-30deg); }`),
  perspectiveMaskFilterCase("filter-far-plane-bounds", "Mask/filter / filter bounds at far-plane", ["filter", "far-plane", "expanded bounds", "composition clip"], "The filtered surface keeps expanded offscreen bounds while far-plane and composition clipping remain deterministic.", `<div id="p9-far-scene"><div id="p9-far-card"></div></div>`, `#p9-far-scene { position: absolute; left: 260px; top: 160px; width: 1400px; height: 760px; perspective: 420px; transform-style: preserve-3d; }
#p9-far-card { position: absolute; left: 420px; top: 200px; width: 520px; height: 300px; background: #f97316; filter: blur(18px) drop-shadow(-28px 18px 12px #a855f799); transform: translateZ(-260px) rotateY(34deg); }`),
  perspectiveMaskFilterCase("mask-one-corner-near-plane", "Mask/filter / one-corner near-plane cut", ["mask-image", "one corner", "rotateX + rotateY", "partial source clip"], "Only one corner of the mask source crosses the near plane; remaining coverage is retained without alpha inversion.", `<div id="p9-corner-scene"><div id="p9-corner-card"></div></div>`, `#p9-corner-scene { position: absolute; left: 420px; top: 190px; width: 1080px; height: 660px; perspective: 260px; perspective-origin: 74% 24%; transform-style: preserve-3d; }
#p9-corner-card { position: absolute; left: 290px; top: 150px; width: 520px; height: 320px; background: #60a5fa; mask-image: linear-gradient(135deg, #00000000 0%, #ffffffff 30%, #ffffffff 100%); mask-mode: alpha; mask-repeat: no-repeat; filter: blur(7px); transform: translateZ(210px) rotateX(25deg) rotateY(-32deg); }`),
  perspectiveMaskFilterCase("backdrop-filter-blur", "Backdrop / blur over colored layers", ["backdrop-filter", "blur", "backdrop surface", "layer opacity"], "The backdrop is captured before the translucent card is painted; blur affects the colored backdrop only and remains separate from the card's own filter.", `<div id="p9-backdrop-scene"><div id="p9-backdrop-color"></div><div id="p9-backdrop-card"></div></div>`, `#p9-backdrop-scene { position: absolute; left: 360px; top: 180px; width: 1200px; height: 700px; background: linear-gradient(135deg, #7c3aed 0%, #22d3ee 52%, #f97316 100%); overflow: hidden; }
#p9-backdrop-color { position: absolute; left: 170px; top: 100px; width: 760px; height: 500px; background: repeating-linear-gradient(45deg, #f43f5e 0%, #f43f5e 12%, #facc15 12%, #facc15 24%); transform: rotate(-8deg); }
#p9-backdrop-card { position: absolute; left: 300px; top: 180px; width: 600px; height: 300px; background: #ffffff55; border: 4px solid #ffffffaa; backdrop-filter: blur(18px); }`),
  perspectiveMaskFilterCase("backdrop-filter-order", "Backdrop / ordered blur and contrast", ["backdrop-filter", "blur", "contrast", "ordered effects"], "Backdrop effects retain CSS token order and never become a visible sibling or a source filter on the translucent panel.", `<div id="p9-backdrop-order-scene"><div id="p9-backdrop-order-grid"></div><div id="p9-backdrop-order-card"></div></div>`, `#p9-backdrop-order-scene { position: absolute; left: 320px; top: 170px; width: 1280px; height: 720px; background: linear-gradient(90deg, #172554, #581c87 50%, #164e63); overflow: hidden; }
#p9-backdrop-order-grid { position: absolute; inset: 80px 140px; background: repeating-linear-gradient(90deg, #22d3ee 0%, #22d3ee 8%, #f43f5e 8%, #f43f5e 16%), repeating-linear-gradient(0deg, transparent 0%, transparent 8%, #facc15 8%, #facc15 16%); transform: rotate(12deg) scale(1.15); }
#p9-backdrop-order-card { position: absolute; left: 340px; top: 170px; width: 600px; height: 320px; background: #ffffff66; backdrop-filter: blur(10px) contrast(1.25); }`),
];

export const HTML_COMPILER_ANCHOR_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.layout.anchor-positioning",
    phase: "P0",
    category: "Layout primitives",
    topic: "Layout",
    label: "Layout / CSS anchor positioning",
    properties: ["anchor-name", "position-anchor", "anchor()", "anchor-size()"],
    hint: "The label is positioned from the subject's right edge and inherits its width through compiler-side anchor resolution.",
    source: createNewHtmlProject({
      html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", "<body>\n  <div id=\"anchor-subject\"></div>\n  <div id=\"anchor-label\"></div>\n</body>"),
      css: `body { margin: 0; background: #081018; }
#anchor-subject { position: absolute; left: 520px; top: 380px; width: 360px; height: 180px; background: #38bdf8; anchor-name: --subject; }
#anchor-label { position: absolute; position-anchor: --subject; left: anchor(--subject right); top: anchor(--subject top); width: anchor-size(--subject width); height: 72px; margin-left: 28px; background: #fb7185; }`,
    }),
  },
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

// All phase arrays keep their legacy source fields for inspection, but every
// object is finalized in place so the public fixture contract also exposes
// one self-contained HTML document for compileDocument and the iframe.
finalizeHtmlCompilerPreviewCases(HTML_COMPILER_ALL_CASES);

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
  if (["P2.0", "P2.1", "P2.2", "P2.3"].includes(item.phase)) {
    return "Paint primitives";
  }
  if (item.phase === "P3" || item.phase === "P7" || item.id.includes("animated-translate-z")) {
    return "Animation & keyframe primitives";
  }
  if (item.phase === "P5" && !item.id.includes("slow-stroke")) {
    return "Transform & 3D primitives";
  }
  return "Combined pipeline cases";
}

type CategorizedHtmlCompilerPreviewCase = HtmlCompilerPreviewCase & { category: HtmlCompilerPreviewCategory };

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
