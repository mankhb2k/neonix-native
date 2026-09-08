import { createNewHtmlProject, DEFAULT_NEONIX_HTML_DOCUMENT } from "@motionvideo/html-compiler";
import type { HtmlCompilerPreviewCase } from "./html-compiler-preview";

const sourceWithBody = (body: string, css: string): HtmlCompilerPreviewCase["source"] => createNewHtmlProject({
  html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", `<body>\n${body}\n</body>`),
  css: `body { margin: 0; background: #081018; }\n${css}`,
});

/**
 * E2E fixtures for tags that select a different compiler lowering path. These
 * intentionally keep CSS simple so a failure points at tag semantics rather
 * than paint, animation or advanced layout behavior.
 */
export const HTML_COMPILER_TAG_LOWERING_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.tags.document-shell-container",
    phase: "P0",
    category: "HTML tag lowering",
    topic: "HTML tags",
    label: "Tag lowering / document shell + containers",
    properties: ["html", "head", "meta", "body", "section", "article", "div", "group"],
    hint: "The document shell is non-visual; section and article remain container aliases and lower through CSS into groups or shape layers.",
    source: sourceWithBody(`  <section id="scene">
    <article id="card">
      <div id="fill"></div>
    </article>
  </section>`, `#scene { position: absolute; left: 260px; top: 180px; width: 1400px; height: 720px; }
#card { position: absolute; left: 300px; top: 140px; width: 800px; height: 440px; }
#fill { width: 800px; height: 440px; background: #2563eb; }`),
  },
  {
    id: "html-compiler.tags.text-lowering",
    phase: "P0",
    category: "HTML tag lowering",
    topic: "HTML tags",
    label: "Tag lowering / text elements",
    properties: ["h1", "p", "strong", "br", "text layer", "nested text"],
    hint: "Heading and paragraph tags lower to Protocol text layers; strong remains nested text content and br becomes a newline.",
    source: sourceWithBody(`  <h1 id="title">Video <strong>title</strong><br>line two</h1>
  <p id="caption">A <strong>caption</strong> layer.</p>`, `#title { position: absolute; left: 180px; top: 180px; width: 900px; height: 180px; color: #ffffff; font-family: Inter; font-size: 72px; }
#caption { position: absolute; left: 180px; top: 430px; width: 800px; height: 100px; color: #38bdf8; font-family: Inter; font-size: 36px; }`),
  },
  {
    id: "html-compiler.tags.media-lowering",
    phase: "P0",
    category: "HTML tag lowering",
    topic: "HTML tags",
    label: "Tag lowering / image + video",
    properties: ["img", "video", "image layer", "video layer", "asset registry"],
    hint: "Image and video tags select media layer lowering and register deterministic Protocol assets instead of becoming generic containers.",
    source: sourceWithBody(`  <img id="poster" src="/preview/image/photo-landscape.jpg">
  <video id="clip" src="/preview/video/demo-video.mp4"></video>`, `#poster { position: absolute; left: 160px; top: 180px; width: 640px; height: 360px; object-fit: cover; }
#clip { position: absolute; left: 1120px; top: 180px; width: 640px; height: 360px; object-fit: contain; }`),
  },
  {
    id: "html-compiler.tags.audio-lowering",
    phase: "P0",
    category: "HTML tag lowering",
    topic: "HTML tags",
    label: "Tag lowering / audio track",
    properties: ["audio", "audio.tracks", "clip", "audio asset"],
    hint: "Audio is non-visual: the tag creates a root Protocol audio track and clip rather than a visual layer.",
    source: sourceWithBody(`  <audio id="music" src="/preview/audio/bed.mp3"></audio>
  <div id="audio-marker"></div>`, `#audio-marker { position: absolute; left: 760px; top: 430px; width: 400px; height: 120px; background: #22c55e; }`),
  },
  {
    id: "html-compiler.tags.svg-lowering",
    phase: "P0",
    category: "HTML tag lowering",
    topic: "HTML tags",
    label: "Tag lowering / SVG primitives",
    properties: ["svg", "rect", "circle", "line", "polygon", "path layers"],
    hint: "SVG containers remain groups while visual primitives are normalized to canonical path layers.",
    source: sourceWithBody(`  <svg id="logo" width="720" height="360">
    <rect id="panel" x="20" y="20" width="320" height="220" rx="24"></rect>
    <circle id="dot" cx="470" cy="120" r="72"></circle>
    <line id="rule" x1="80" y1="300" x2="640" y2="300"></line>
    <polygon id="arrow" points="360,260 520,260 440,330"></polygon>
  </svg>`, `#logo { position: absolute; left: 600px; top: 300px; width: 720px; height: 360px; }
#panel { fill: #2563eb; }
#dot { fill: #22c55e; }
#rule { fill: none; stroke: #ffffff; stroke-width: 8px; }
#arrow { fill: #f97316; }`),
  },
  {
    id: "html-compiler.tags.container-aliases",
    phase: "P0",
    category: "HTML tag lowering",
    topic: "HTML tags",
    label: "Tag lowering / container aliases",
    properties: ["main", "header", "nav", "aside", "figure", "figcaption", "footer", "groups"],
    hint: "Video composition containers share the CSS-driven group/shape lowering contract; their semantic names do not create browser-only layer types.",
    source: sourceWithBody(`  <main id="main">
    <header id="header"><div id="header-fill"></div></header>
    <nav id="nav"><div id="nav-fill"></div></nav>
    <aside id="aside"><div id="aside-fill"></div></aside>
    <figure id="figure"><div id="figure-fill"></div><figcaption id="figcaption">Frame</figcaption></figure>
    <footer id="footer"><div id="footer-fill"></div></footer>
  </main>`, `#main { position: absolute; left: 120px; top: 100px; width: 1680px; height: 860px; }
#header, #nav, #aside, #figure, #footer { position: absolute; width: 360px; height: 220px; }
#header { left: 0; top: 0; }
#nav { left: 440px; top: 0; }
#aside { left: 880px; top: 0; }
#figure { left: 1320px; top: 0; }
#footer { left: 440px; top: 480px; }
#header-fill, #nav-fill, #aside-fill, #figure-fill, #footer-fill { width: 360px; height: 160px; background: #2563eb; }
#nav-fill { background: #22c55e; }
#aside-fill { background: #f97316; }
#figure-fill { background: #a78bfa; }
#footer-fill { background: #ec4899; }
#figcaption { width: 360px; height: 60px; color: #ffffff; font-family: Inter; font-size: 24px; }`),
  },
  {
    id: "html-compiler.tags.text-tag-matrix",
    phase: "P0",
    category: "HTML tag lowering",
    topic: "HTML tags",
    label: "Tag lowering / complete text matrix",
    properties: ["h2-h6", "span", "b", "em", "i", "small", "blockquote", "pre", "code"],
    hint: "All supported text tags lower to semantic Protocol text layers while tag defaults and whitespace-sensitive tags remain visible in computed style.",
    source: sourceWithBody(`  <h2 id="h2">Heading two</h2>
  <h3 id="h3">Heading three</h3>
  <h4 id="h4">Heading four</h4>
  <h5 id="h5">Heading five</h5>
  <h6 id="h6">Heading six</h6>
  <span id="span">Span</span>
  <b id="bold">Bold</b>
  <em id="emphasis">Emphasis</em>
  <i id="italic">Italic</i>
  <small id="small">Small</small>
  <blockquote id="quote">Quote</blockquote>
  <pre id="pre">pre  text</pre>
  <code id="code">code()</code>`, `#h2, #h3, #h4, #h5, #h6, #span, #bold, #emphasis, #italic, #small, #quote, #pre, #code { position: absolute; left: 120px; width: 760px; color: #ffffff; font-family: Inter; }
#h2 { top: 70px; height: 70px; font-size: 48px; }
#h3 { top: 145px; height: 64px; font-size: 42px; }
#h4 { top: 215px; height: 58px; font-size: 36px; }
#h5 { top: 280px; height: 52px; font-size: 32px; }
#h6 { top: 340px; height: 48px; font-size: 28px; }
#span { top: 410px; height: 44px; font-size: 26px; }
#bold { top: 465px; height: 44px; font-size: 26px; }
#emphasis { top: 520px; height: 44px; font-size: 26px; }
#italic { top: 575px; height: 44px; font-size: 26px; }
#small { top: 630px; height: 40px; font-size: 22px; }
#quote { top: 680px; height: 44px; font-size: 24px; }
#pre { top: 735px; height: 44px; font-size: 22px; white-space: pre; }
#code { top: 790px; height: 44px; font-size: 22px; }`),
  },
  {
    id: "html-compiler.tags.svg-primitive-matrix",
    phase: "P0",
    category: "HTML tag lowering",
    topic: "HTML tags",
    label: "Tag lowering / SVG path matrix",
    properties: ["g", "path", "ellipse", "polyline", "nested group", "path layers"],
    hint: "Nested SVG groups preserve the parent coordinate space while path, ellipse and polyline primitives lower to independent Protocol path layers.",
    source: sourceWithBody(`  <svg id="matrix" width="900" height="420">
    <g id="nested-group">
      <path id="path" d="M 40 40 L 180 40 L 110 160 Z"></path>
      <ellipse id="ellipse" cx="330" cy="100" rx="90" ry="55"></ellipse>
      <polyline id="polyline" points="500,160 600,40 700,160"></polyline>
    </g>
  </svg>`, `#matrix { position: absolute; left: 520px; top: 320px; width: 900px; height: 420px; }
#path { fill: #f97316; }
#ellipse { fill: #22c55e; }
#polyline { fill: none; stroke: #38bdf8; stroke-width: 10px; }`),
  },
];
