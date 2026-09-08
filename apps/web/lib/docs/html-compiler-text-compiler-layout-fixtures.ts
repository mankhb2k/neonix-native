import { createNewHtmlProject, DEFAULT_NEONIX_HTML_DOCUMENT } from "@motionvideo/html-compiler";
import type { HtmlCompilerPreviewCase } from "./html-compiler-preview";

const sourceWithBody = (body: string, css: string): HtmlCompilerPreviewCase["source"] => createNewHtmlProject({
  html: DEFAULT_NEONIX_HTML_DOCUMENT.replace("<body>\n</body>", `<body>\n${body}\n</body>`),
  css: `body { margin: 0; background: #081018; }\n${css}`,
});

/**
 * Focused text fixtures. Tag-lowering fixtures answer "what layer does this
 * tag become?"; these cases answer "what text semantics and layout contract
 * reach Protocol V2 and the runtime?".
 */
export const HTML_COMPILER_TEXT_COMPILER_LAYOUT_CASES: HtmlCompilerPreviewCase[] = [
  {
    id: "html-compiler.text.compiler.br-hard-break",
    phase: "P0",
    category: "Text compiler & layout",
    topic: "Typography",
    label: "Text compiler / br hard break",
    properties: ["br", "source newline", "normal whitespace", "text layer"],
    hint: "The compiler must preserve a <br> as a semantic hard break while keeping normal whitespace collapsing available to the runtime.",
    source: sourceWithBody(`  <h1 id="hard-break">Video title<br>line two</h1>`, `#hard-break { margin: 0; position: absolute; left: 180px; top: 180px; width: 900px; height: 180px; color: #ffffff; font-family: Inter; font-size: 72px; line-height: 86.4px; }`),
  },
  {
    id: "html-compiler.text.compiler.nested-inline-content",
    phase: "P0",
    category: "Text compiler & layout",
    topic: "Typography",
    label: "Text compiler / nested inline content",
    properties: ["p", "strong", "em", "style spans", "text layer"],
    hint: "Nested inline tags contribute text content to one semantic text layer while preserving source order, character ranges and per-span font semantics.",
    source: sourceWithBody(`  <p id="nested-inline">Prefix <strong>bold</strong> <em>italic</em></p>`, `#nested-inline { margin: 0; position: absolute; left: 180px; top: 220px; width: 1200px; height: 90px; color: #f8fafc; font-family: Inter; font-size: 48px; line-height: 60px; }`),
  },
  {
    id: "html-compiler.text.compiler.whitespace-contract",
    phase: "P0",
    category: "Text compiler & layout",
    topic: "Typography",
    label: "Text compiler / whitespace contract",
    properties: ["normal", "pre", "source whitespace", "wrap policy"],
    hint: "The compiler emits the source text and computed whitespace mode separately so normal and pre layout can be evaluated without conflating source newlines with hard breaks.",
    source: sourceWithBody(`  <div id="normal-space">A   B
C</div>
  <pre id="pre-space">A   B
C</pre>`, `#normal-space, #pre-space { margin: 0; position: absolute; left: 180px; width: 900px; height: 90px; color: #f8fafc; font-family: Inter; font-size: 42px; line-height: 58px; }
#normal-space { top: 180px; white-space: normal; }
#pre-space { top: 340px; white-space: pre; }`),
  },
  {
    id: "html-compiler.text.layout.fixed-line-height",
    phase: "P1.4",
    category: "Text compiler & layout",
    topic: "Layout",
    label: "Text layout / fixed line-height",
    properties: ["br", "fixed frame", "line-height", "baseline"],
    hint: "Explicit line-height and hard breaks produce deterministic line boxes inside a fixed text frame.",
    source: sourceWithBody(`  <p id="fixed-lines">Line one<br>Line two<br>Line three</p>`, `#fixed-lines { margin: 0; position: absolute; left: 260px; top: 180px; width: 1000px; height: 300px; color: #f8fafc; font-family: Inter; font-size: 52px; line-height: 72px; }`),
  },
  {
    id: "html-compiler.text.layout.wrap-width",
    phase: "P1.4",
    category: "Text compiler & layout",
    topic: "Layout",
    label: "Text layout / fixed width wrapping",
    properties: ["fixed width", "word wrapping", "content width", "line count"],
    hint: "A constrained width creates multiple runtime line boxes while the Protocol frame remains the authored fixed width.",
    source: sourceWithBody(`  <div id="wrap-width">A narrow composition text block wraps at deterministic word boundaries.</div>`, `#wrap-width { margin: 0; position: absolute; left: 260px; top: 180px; width: 520px; height: 300px; color: #f8fafc; font-family: Inter; font-size: 48px; line-height: 64px; white-space: normal; }`),
  },
  {
    id: "html-compiler.text.layout.auto-height",
    phase: "P1.4",
    category: "Text compiler & layout",
    topic: "Layout",
    label: "Text layout / auto-height wrapping",
    properties: ["height:auto", "fixed-width-auto-height", "intrinsic height", "wrapping"],
    hint: "When width is authored but height is auto, compiler layout estimates the wrapped text height and emits a usable frame for runtime shaping.",
    source: sourceWithBody(`  <div id="auto-height">Intrinsic height follows the number of wrapped lines in this deterministic video text block.</div>`, `#auto-height { margin: 0; position: absolute; left: 260px; top: 180px; width: 520px; height: auto; color: #f8fafc; font-family: Inter; font-size: 44px; line-height: 60px; white-space: normal; }`),
  },
];
