import { expect, test } from "@playwright/test";
import { LAYOUT_PROBE_ID_ATTRIBUTE, compileDocument, runLayoutProbe, stampNodeIds } from "@motionvideo/html-compiler";

// Closes the loop end-to-end: layout-geometry-diff-probes.spec.ts (Phase 0)
// found that a position:absolute box with width:auto stretches to the full
// available width instead of shrink-to-fitting around its content (~1558px
// off). This proves node-box.ts's snapshot mode (Phase 3) actually fixes
// that specific, real bug when fed a real-browser measurement - not just
// that the wiring is inert-safe (layout-probe.test.ts already covers that
// with synthetic data).
const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"durationMs":1000,"background":"#081018","colorSpace":"srgb"}}'>
<style data-neonix-bundle>
html, body { width: 1920px; height: 1080px; margin: 0; overflow: hidden; background: #081018; }
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
</html>`;

test("snapshot mode fixes the absolute width:auto shrink-to-fit bug found in Phase 0", async ({ page }) => {
  const stamped = stampNodeIds(FIXTURE_HTML);
  const outerProbeId = /<div id="probe-absolute-auto"[^>]*data-neonix-probe-id="([^"]+)"/.exec(stamped)![1]!;

  await page.setContent(stamped, { waitUntil: "domcontentloaded" });
  const snapshot = await page.evaluate(runLayoutProbe, LAYOUT_PROBE_ID_ATTRIBUTE);
  const browserWidth = snapshot[outerProbeId]!.width;
  // Ground truth: content (120px) + 20px padding each side = 160px, nowhere
  // near the ~1718px-wide box the native bug produces (1800px container -
  // 2*10 title margin, roughly). If this assertion itself ever fails, the
  // fixture/browser changed, not node-box.ts - fix the expectation, not the
  // compiler.
  expect(browserWidth).toBeGreaterThan(150);
  expect(browserWidth).toBeLessThan(170);

  const withoutSnapshot = compileDocument({ html: stamped });
  const withSnapshot = compileDocument({ html: stamped }, { layoutSnapshot: snapshot });

  // Snapshot mode only changes geometry, never which nodes become layers.
  expect(withSnapshot.protocol!.layers.length).toBe(withoutSnapshot.protocol!.layers.length);

  // Each element with an explicit HTML id compiles to a layer of the same
  // id (atomicId falls back to the authored id when present) - a stable,
  // direct way to find #probe-absolute-auto's own box (the "group" layer,
  // not its "::paint" sibling) in both compiles.
  const findOuterGroup = (result: typeof withoutSnapshot) =>
    result.protocol!.layers.find((layer) => layer.id === "probe-absolute-auto");
  const outerBefore = findOuterGroup(withoutSnapshot)!;
  const outerAfter = findOuterGroup(withSnapshot)!;

  expect(outerBefore.frame.width).toBeGreaterThan(1500); // the confirmed bug, still present without a snapshot
  expect(outerAfter.frame.width).toBeCloseTo(browserWidth, 0); // fixed with a real-browser snapshot
});
