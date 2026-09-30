import { expect, test } from "@playwright/test";
import { LAYOUT_PROBE_ID_ATTRIBUTE, runLayoutProbe, stampNodeIds } from "@motionvideo/html-compiler";

// Phase 2 of the CDP/Chrome-measured-layout plan: proves the id-stamping +
// probe mechanism itself is correct in a real browser, independent of any
// browser-vs-native comparison (that's what layout-geometry-diff*.spec.ts
// do). This measures ONE known box against hand-computed CSS math - if this
// ever fails, the probe mechanism itself (stampNodeIds/runLayoutProbe in
// packages/html-compiler/src/layout-probe.ts) is broken, not html-compiler's
// flex/grid/geometry logic.
const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"durationMs":1000,"background":"#081018","colorSpace":"srgb"}}'>
<style data-neonix-bundle>
html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; background: #081018; }
#probe-outer { position: absolute; left: 10px; top: 10px; background: #22d3ee; padding: 8px; border: 3px solid #facc15; }
#probe-inner { width: 40px; height: 20px; background: #38bdf8; }
</style>
</head>
<body>
  <div id="probe-outer"><div id="probe-inner"></div></div>
</body>
</html>`;

test("runLayoutProbe measures real-browser border-box/padding/border matching hand-computed CSS math", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 2200, height: 3000 });
  await page.goto("/debug/native-stage", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("radial-native-case-picker")).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId("compare-mode-custom").click();

  const stamped = stampNodeIds(FIXTURE_HTML);
  await page.getByTestId("compare-custom-textarea").fill(stamped);
  await expect(page.getByTestId("radial-native-skia-canvas")).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });

  const iframeHandle = await page.getByTestId("radial-native-browser-iframe").elementHandle();
  const frame = await iframeHandle?.contentFrame();
  if (!frame) throw new Error("Browser reference iframe has no content frame");

  const result = await frame.evaluate(runLayoutProbe, LAYOUT_PROBE_ID_ATTRIBUTE);
  const ids = Object.keys(result);
  expect(ids.length).toBeGreaterThanOrEqual(2);

  const outer = Object.values(result).find((box) => box.border[0] === 3);
  const inner = Object.values(result).find((box) => box.width === 40 && box.height === 20);
  // #probe-outer: content 40x20 (from its child's natural flow size) + 8px
  // padding each side + 3px border each side = border-box 62x38 at (10,10).
  expect(outer).toBeDefined();
  expect(outer!.x).toBeCloseTo(10, 0);
  expect(outer!.y).toBeCloseTo(10, 0);
  expect(outer!.padding).toEqual([8, 8, 8, 8]);
  expect(outer!.border).toEqual([3, 3, 3, 3]);
  // #probe-inner: explicit 40x20 content box, no padding/border of its own.
  expect(inner).toBeDefined();
  expect(inner!.width).toBeCloseTo(40, 0);
  expect(inner!.height).toBeCloseTo(20, 0);
  expect(inner!.padding).toEqual([0, 0, 0, 0]);
  expect(inner!.border).toEqual([0, 0, 0, 0]);
});
