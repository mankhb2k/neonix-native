import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { captureNativeSurface, measureColorBoxes, parseLayoutProbeColors, type Box } from "./support/color-region-diff";

// Spike: does real-Chrome-measured layout geometry match what html-compiler's
// own flex.ts/grid.ts compute? This does NOT touch compile.ts/flex.ts/grid.ts
// - it only measures the two panels already wired up at /debug/native-stage
// (the real-Chrome iframe vs the native Skia canvas) for the existing "layout"
// fixture group, and reports per-element pixel-geometry deltas so the result
// can be evaluated before deciding whether Chrome-measured layout is worth
// wiring into the compiler at all. See the approved plan
// (sequential-seeking-summit.md) for the full context and the known flex/grid
// gap-list this report should be read against. Edge-case coverage (margin
// collapse, absolute width:auto, transform containing blocks, non-leaf text
// auto-height) lives in layout-geometry-diff-probes.spec.ts instead of here,
// since these 3 fixtures only exercise the straightforward explicit-box case.
const REPORT_ROOT = resolve(process.cwd(), "..", "..", "tmp", "layout-geometry-diff");
const FIXTURE_GROUP = "layout";
const CASES = ["grid-template-areas", "flex-direction-reverse", "grid-auto-flow"] as const;

type ProbeResult = {
  color: string;
  browserBoxes: Box[];
  skiaBoxes: Box[];
  countMismatch: boolean;
  pairs: Array<{ occurrence: number; browser: Box; skia: Box; deltaX: number; deltaY: number; deltaWidth: number; deltaHeight: number }>;
};

type FixtureReport = { fixture: string; probes: ProbeResult[] };

function renderMarkdown(reports: FixtureReport[]): string {
  const lines: string[] = [
    "# Layout geometry diff: real Chrome vs native Skia",
    "",
    "Spike report, not a regression gate - see the approved plan for context. Delta = skia - browser (px).",
    "",
    "| fixture | color | occurrence | dx | dy | dwidth | dheight | note |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const report of reports) {
    for (const probe of report.probes) {
      if (probe.countMismatch) {
        lines.push(`| ${report.fixture} | ${probe.color} | - | - | - | - | - | count mismatch: browser=${probe.browserBoxes.length} skia=${probe.skiaBoxes.length} |`);
        continue;
      }
      for (const pair of probe.pairs) {
        lines.push(`| ${report.fixture} | ${probe.color} | ${pair.occurrence} | ${pair.deltaX} | ${pair.deltaY} | ${pair.deltaWidth} | ${pair.deltaHeight} | |`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

test("compares real-Chrome vs native Skia layout geometry per fixture (spike, not a regression gate)", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(REPORT_ROOT, { recursive: true });
  await page.setViewportSize({ width: 2200, height: 3000 });
  await page.goto("/debug/native-stage", { waitUntil: "domcontentloaded" });

  const groupPicker = page.getByTestId("radial-native-group-picker");
  const picker = page.getByTestId("radial-native-case-picker");
  const browser = page.getByTestId("radial-native-browser-iframe");
  const skia = page.getByTestId("radial-native-skia-canvas");
  await expect(picker).toBeEnabled({ timeout: 30_000 });
  // The fixture picker is filtered by folder, same as box-shadow-spread-comparison.spec.ts.
  await groupPicker.selectOption(FIXTURE_GROUP);
  // Stacked layout renders both panels at native 1:1 (no CSS scale-down), which
  // the fixed-size WIDTHxHEIGHT clip below assumes.
  await page.getByTestId("compare-layout-stacked").click();

  const reports: FixtureReport[] = [];
  for (const fixture of CASES) {
    await picker.selectOption(fixture);
    await expect(picker).toHaveValue(fixture);
    await expect(skia).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
    await expect(skia).toHaveAttribute("data-backend", "skia");

    const fixtureHtml = await (await page.request.get(`/docs/html-compiler/fixtures/${FIXTURE_GROUP}/${fixture}.html`)).text();
    const colors = parseLayoutProbeColors(fixtureHtml);
    expect(colors.length, `${fixture} must have at least one #id{background} probe`).toBeGreaterThan(0);

    const browserPng = await captureNativeSurface(page, browser);
    const skiaPng = await captureNativeSurface(page, skia);
    const measured = await measureColorBoxes(page, browserPng, skiaPng, colors);

    const probes: ProbeResult[] = colors.map((color) => {
      const { browser: browserBoxes, skia: skiaBoxes } = measured[color]!;
      const countMismatch = browserBoxes.length !== skiaBoxes.length;
      const pairs = browserBoxes.slice(0, skiaBoxes.length).map((browserBox, index) => {
        const skiaBox = skiaBoxes[index]!;
        return {
          occurrence: index + 1,
          browser: browserBox,
          skia: skiaBox,
          deltaX: skiaBox.x - browserBox.x,
          deltaY: skiaBox.y - browserBox.y,
          deltaWidth: skiaBox.width - browserBox.width,
          deltaHeight: skiaBox.height - browserBox.height,
        };
      });
      return { color, browserBoxes, skiaBoxes, countMismatch, pairs };
    });

    writeFileSync(resolve(REPORT_ROOT, `${fixture}.browser.png`), browserPng);
    writeFileSync(resolve(REPORT_ROOT, `${fixture}.skia.png`), skiaPng);
    reports.push({ fixture, probes });
  }

  writeFileSync(resolve(REPORT_ROOT, "report.json"), JSON.stringify(reports, null, 2));
  writeFileSync(resolve(REPORT_ROOT, "report.md"), renderMarkdown(reports));
  expect(reports).toHaveLength(CASES.length);
});
