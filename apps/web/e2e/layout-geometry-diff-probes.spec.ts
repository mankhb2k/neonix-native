import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { captureNativeSurface, measureColorBoxes, parseLayoutProbeColors, type Box } from "./support/color-region-diff";

// Phase 0 of the CDP/Chrome-measured-layout plan: before touching any
// compiler code, decide whether native geometry actually diverges from real
// Chrome on the specific edge cases the flex/grid gap-list and geometry.ts
// don't fully cover - absolute width:auto (shrink-to-fit), margin collapse
// between adjacent siblings, height:auto on a container whose text lives in
// a NESTED node (not covered by the real HarfBuzz text-sizing pre-pass, see
// text-sizing.ts's own doc comment), and an absolutely-positioned child of a
// transformed ancestor (CSS makes a transformed box a containing block for
// absolute descendants). Each probe uses the existing "Custom HTML" mode at
// /playground/native-stage (compare-mode-custom + compare-custom-textarea),
// not a registered fixture - these are throwaway probes, not a permanent
// fixture library addition. Same measurement approach as
// layout-geometry-diff.spec.ts (flood-fill by color, no compiler-internal
// JSON join needed): a pixel diff naturally captures whatever the real
// pipeline produces, transformed or not, so no CDP/getBoundingClientRect is
// needed even for the transform probe.
const REPORT_ROOT = resolve(process.cwd(), "..", "..", "tmp", "layout-geometry-diff-probes");

const HTML_HEAD = (background = "#081018") => `<!doctype html>
<html lang="en">
<head>
<meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"durationMs":1000,"background":"${background}","colorSpace":"srgb"}}'>
<style data-neonix-bundle>
html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; background: ${background}; }`;

const PROBES = [
  {
    name: "absolute-width-auto-shrink-to-fit",
    description: "A position:absolute box with no explicit width, containing one fixed-size child - CSS shrink-to-fits the box around its content; geometry.ts's widthAuto branch instead stretches it to the full available width (geometry.ts:136-138).",
    html: `${HTML_HEAD()}
#probe-container { position: absolute; left: 0; top: 0; width: 1800px; height: 900px; }
#probe-absolute-auto { position: absolute; left: 200px; top: 200px; background: #22d3ee; padding: 20px; }
#probe-inner { width: 120px; height: 60px; background: #facc15; }
</style>
</head>
<body>
  <div id="probe-container">
    <div id="probe-absolute-auto"><div id="probe-inner"></div></div>
  </div>
</body>
</html>`,
  },
  {
    name: "margin-collapse-adjacent-siblings",
    description: "Two in-flow block siblings, margin-bottom:40px then margin-top:20px - CSS collapses adjoining margins to max(40,20)=40px between them, not the sum (60px).",
    html: `${HTML_HEAD()}
#probe-collapse { position: absolute; left: 200px; top: 200px; width: 400px; }
#probe-a { width: 400px; height: 100px; background: #22d3ee; margin-bottom: 40px; }
#probe-b { width: 400px; height: 100px; background: #fb7185; margin-top: 20px; }
</style>
</head>
<body>
  <div id="probe-collapse">
    <div id="probe-a"></div>
    <div id="probe-b"></div>
  </div>
</body>
</html>`,
  },
  {
    name: "text-height-auto-nested-non-leaf",
    description: "A height:auto container whose text lives in a nested <p>, not directly on the container - text-sizing.ts's real HarfBuzz pre-pass only covers a text-bearing LEAF node, so this falls through to compile.ts's character-count heuristic (estimateTextIntrinsicHeight).",
    html: `${HTML_HEAD()}
#probe-text-auto { position: absolute; left: 100px; top: 100px; width: 400px; background: #4ade80; }
#probe-text-auto p { margin: 0; padding: 16px; font-family: Inter, sans-serif; font-size: 32px; color: #081018; }
</style>
</head>
<body>
  <div id="probe-text-auto"><p>A reasonably long sentence that should wrap onto multiple lines to test automatic height sizing for a container whose text lives in a nested paragraph rather than directly on the box itself.</p></div>
</body>
</html>`,
  },
  {
    name: "transform-parent-absolute-child-containing-block",
    description: "A transformed box is a containing block for its absolutely-positioned descendants per the CSS Transforms spec - the child's left/top:50px must resolve against the ROTATED parent's box, not the viewport/root.",
    html: `${HTML_HEAD()}
#probe-transform-parent { position: absolute; left: 300px; top: 300px; width: 400px; height: 300px; background: #38bdf8; transform: rotate(15deg); }
#probe-transform-child { position: absolute; left: 50px; top: 50px; width: 100px; height: 100px; background: #fb7185; }
</style>
</head>
<body>
  <div id="probe-transform-parent"><div id="probe-transform-child"></div></div>
</body>
</html>`,
  },
] as const;

type ProbeReport = {
  name: string;
  description: string;
  loadMs: number;
  colors: Record<string, { browser: Box[]; skia: Box[]; countMismatch: boolean; maxAbsDelta: { dx: number; dy: number; dwidth: number; dheight: number } | null }>;
};

function renderMarkdown(reports: ProbeReport[]): string {
  const lines: string[] = [
    "# Layout geometry probes (Phase 0): real Chrome vs native Skia",
    "",
    "Go/no-go spike for the flex/grid/geometry Chrome-measured-layout plan - see the",
    "approved plan and PR discussion for context. Each row is one probe case's worst",
    "(largest-magnitude) delta across its colors. loadMs is custom-HTML compile+paint",
    "round-trip inside this same-page UI (NOT a proxy for a future headless-Chromium",
    "service's cold-start latency - that needs its own Phase 4 measurement).",
    "",
    "| probe | loadMs | color | dx | dy | dwidth | dheight | note |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const report of reports) {
    const colorEntries = Object.entries(report.colors);
    if (colorEntries.length === 0) {
      lines.push(`| ${report.name} | ${report.loadMs} | - | - | - | - | - | no probe colors found |`);
      continue;
    }
    for (const [color, result] of colorEntries) {
      if (result.countMismatch) {
        lines.push(`| ${report.name} | ${report.loadMs} | ${color} | - | - | - | - | count mismatch: browser=${result.browser.length} skia=${result.skia.length} |`);
        continue;
      }
      const d = result.maxAbsDelta!;
      lines.push(`| ${report.name} | ${report.loadMs} | ${color} | ${d.dx} | ${d.dy} | ${d.dwidth} | ${d.dheight} | |`);
    }
  }
  lines.push("", "## Probe descriptions", "");
  for (const report of reports) lines.push(`- **${report.name}**: ${report.description}`);
  return `${lines.join("\n")}\n`;
}

test("phase 0 spike: real-Chrome vs native Skia geometry on flex/grid/geometry edge cases not covered by the 3 layout fixtures", async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(REPORT_ROOT, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 3000 });
  await page.goto("/playground/native-stage", { waitUntil: "domcontentloaded" });

  // domcontentloaded fires before React hydrates, so clicking a tab button
  // immediately can be a silent no-op (no listener attached yet). Wait for a
  // state that only becomes true post-hydration (the fixture picker starts
  // disabled until the initial fixture fetch resolves) before interacting -
  // same pattern layout-geometry-diff.spec.ts relies on incidentally.
  await expect(page.getByTestId("radial-native-case-picker")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("compare-mode-custom").click();
  await page.getByTestId("compare-layout-stacked").click();
  const textarea = page.getByTestId("compare-custom-textarea");
  const browser = page.getByTestId("radial-native-browser-iframe");
  const skia = page.getByTestId("radial-native-skia-canvas");

  const reports: ProbeReport[] = [];
  for (const probe of PROBES) {
    const start = Date.now();
    await textarea.fill(probe.html);
    await expect(skia).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(skia).toHaveAttribute("data-backend", "skia");
    const loadMs = Date.now() - start;

    const colors = parseLayoutProbeColors(probe.html);
    expect(colors.length, `${probe.name} must have at least one #id{background} probe`).toBeGreaterThan(0);

    const browserPng = await captureNativeSurface(page, browser);
    const skiaPng = await captureNativeSurface(page, skia);
    const measured = await measureColorBoxes(page, browserPng, skiaPng, colors);

    writeFileSync(resolve(REPORT_ROOT, `${probe.name}.browser.png`), browserPng);
    writeFileSync(resolve(REPORT_ROOT, `${probe.name}.skia.png`), skiaPng);

    const colorResults: ProbeReport["colors"] = {};
    for (const color of colors) {
      const { browser: browserBoxes, skia: skiaBoxes } = measured[color]!;
      const countMismatch = browserBoxes.length !== skiaBoxes.length;
      let maxAbsDelta: { dx: number; dy: number; dwidth: number; dheight: number } | null = null;
      if (!countMismatch) {
        maxAbsDelta = { dx: 0, dy: 0, dwidth: 0, dheight: 0 };
        for (let index = 0; index < browserBoxes.length; index += 1) {
          const b = browserBoxes[index]!;
          const s = skiaBoxes[index]!;
          const dx = s.x - b.x, dy = s.y - b.y, dwidth = s.width - b.width, dheight = s.height - b.height;
          if (Math.abs(dx) > Math.abs(maxAbsDelta.dx)) maxAbsDelta.dx = dx;
          if (Math.abs(dy) > Math.abs(maxAbsDelta.dy)) maxAbsDelta.dy = dy;
          if (Math.abs(dwidth) > Math.abs(maxAbsDelta.dwidth)) maxAbsDelta.dwidth = dwidth;
          if (Math.abs(dheight) > Math.abs(maxAbsDelta.dheight)) maxAbsDelta.dheight = dheight;
        }
      }
      colorResults[color] = { browser: browserBoxes, skia: skiaBoxes, countMismatch, maxAbsDelta };
    }

    reports.push({ name: probe.name, description: probe.description, loadMs, colors: colorResults });
  }

  writeFileSync(resolve(REPORT_ROOT, "report.json"), JSON.stringify(reports, null, 2));
  writeFileSync(resolve(REPORT_ROOT, "report.md"), renderMarkdown(reports));
  expect(reports).toHaveLength(PROBES.length);
});
