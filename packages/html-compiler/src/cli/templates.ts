import {
  DEFAULT_NEONIX_HTML_DOCUMENT,
  createHtmlCssProject,
  type HtmlCssProject,
} from "../index";

export type HtmlProjectExample = "blank" | "blue-rectangle";

const BLUE_RECTANGLE_HTML = DEFAULT_NEONIX_HTML_DOCUMENT.replace(
  "<body>\n</body>",
  `<body>
  <div id="blue-rectangle"></div>
</body>`,
);

const BLUE_RECTANGLE_CSS = `body {
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
}`;

export function createHtmlProjectTemplate(example: HtmlProjectExample = "blank"): HtmlCssProject {
  switch (example) {
    case "blank":
      return createHtmlCssProject();
    case "blue-rectangle":
      return createHtmlCssProject({ html: BLUE_RECTANGLE_HTML, css: BLUE_RECTANGLE_CSS });
    default:
      return assertNever(example);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unknown HTML project example: ${String(value)}`);
}
