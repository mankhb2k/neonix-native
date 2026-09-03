import { createHtmlCssSource, createNewHtmlProject, DEFAULT_NEONIX_HTML_DOCUMENT, type HtmlCssSource } from "@motionvideo/html-compiler";

export type HtmlCompilerPreviewTopic =
  | "New project"
  | "Composition & geometry"
  | "HTML tags"
  | "Cascade & values"
  | "Transform 2D"
  | "Paint"
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
