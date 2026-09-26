// Reads the snapshots baked by html-compiler-layout-snapshot-bake.mts and,
// for every fixture, compiles it BOTH natively and with layoutSnapshot -
// entirely offline, no browser involved here - reporting where native
// flex/grid/geometry disagrees with the real-Chromium measurement. This is
// the fixture-level correctness check from the CDP-layout roadmap's Step 2,
// kept fast/offline/deterministic on purpose.
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileDocument, type LayoutSnapshot, type MotionProtocolV2 } from "../../../packages/html-compiler/src/index.ts";
import { HTML_COMPILER_PREVIEW_CASES, HTML_COMPILER_PREVIEW_FONT_ASSETS, HTML_COMPILER_PREVIEW_MEDIA_ASSETS } from "../lib/docs/html-compiler-preview.ts";
import { HTML_PLAYGROUND_CASES } from "../lib/playground/html-playground-cases.ts";

// Same curated-fixture addition as html-compiler-layout-snapshot-bake.mts -
// see that file's comment for why these aren't already in HTML_COMPILER_PREVIEW_CASES.
const EXTRA_CURATED_IDS = new Set(["neonix-motion-test-10s"]);
const REGISTERED_IDS = new Set(HTML_COMPILER_PREVIEW_CASES.map((c) => c.id));
const CURATED_LAYOUT_FIXTURES = HTML_PLAYGROUND_CASES.filter(
  (c) => (c.group === "layout" || EXTRA_CURATED_IDS.has(c.id)) && !REGISTERED_IDS.has(c.id),
).map((c) => ({ id: c.id, fixtureUrl: c.url }));
const FIXTURES = [...HTML_COMPILER_PREVIEW_CASES, ...CURATED_LAYOUT_FIXTURES];

const scriptDir = import.meta.dirname;
const snapshotsPath = resolve(scriptDir, ".html-compiler-layout-snapshots/snapshots.json");
const baked = JSON.parse(readFileSync(snapshotsPath, "utf8")) as Record<string, { snapshot: LayoutSnapshot; stampedHtml: string }>;

type LayerDiff = {
  fixtureId: string;
  layerId: string;
  deltaX: number;
  deltaY: number;
  deltaWidth: number;
  deltaHeight: number;
};

const TOLERANCE_PX = 1;
const diffs: LayerDiff[] = [];
const countMismatches: string[] = [];
const missingSnapshot: string[] = [];
let cleanFixtures = 0;

function layersById(protocol: MotionProtocolV2 | null): Map<string, MotionProtocolV2["layers"][number]> {
  const map = new Map<string, MotionProtocolV2["layers"][number]>();
  for (const layer of protocol?.layers ?? []) map.set(layer.id, layer);
  return map;
}

for (const fixture of FIXTURES) {
  const entry = baked[fixture.id];
  if (!entry) {
    missingSnapshot.push(fixture.id);
    continue;
  }
  const publicRoot = resolve(scriptDir, "../public");
  const html = readFileSync(join(publicRoot, fixture.fixtureUrl.replace(/^\//, "")), "utf8");
  const options = { composition: { id: fixture.id }, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS };
  const native = compileDocument({ html }, options);
  const withSnapshot = compileDocument({ html: entry.stampedHtml }, { ...options, layoutSnapshot: entry.snapshot });

  if (native.status !== "success" || withSnapshot.status !== "success") {
    countMismatches.push(`${fixture.id} (compile status: native=${native.status}, snapshot=${withSnapshot.status})`);
    continue;
  }
  const nativeLayers = layersById(native.protocol);
  const snapshotLayers = layersById(withSnapshot.protocol);
  if (nativeLayers.size !== snapshotLayers.size) {
    countMismatches.push(`${fixture.id} (layer count: native=${nativeLayers.size}, snapshot=${snapshotLayers.size})`);
    continue;
  }

  let fixtureClean = true;
  for (const [id, nativeLayer] of nativeLayers) {
    const snapshotLayer = snapshotLayers.get(id);
    if (!snapshotLayer) continue;
    const deltaX = (snapshotLayer.transform?.translate?.x ?? 0) - (nativeLayer.transform?.translate?.x ?? 0);
    const deltaY = (snapshotLayer.transform?.translate?.y ?? 0) - (nativeLayer.transform?.translate?.y ?? 0);
    const deltaWidth = (snapshotLayer.frame?.width ?? 0) - (nativeLayer.frame?.width ?? 0);
    const deltaHeight = (snapshotLayer.frame?.height ?? 0) - (nativeLayer.frame?.height ?? 0);
    if (Math.abs(deltaX) > TOLERANCE_PX || Math.abs(deltaY) > TOLERANCE_PX || Math.abs(deltaWidth) > TOLERANCE_PX || Math.abs(deltaHeight) > TOLERANCE_PX) {
      diffs.push({ fixtureId: fixture.id, layerId: id, deltaX, deltaY, deltaWidth, deltaHeight });
      fixtureClean = false;
    }
  }
  if (fixtureClean) cleanFixtures += 1;
}

const lines: string[] = [
  "# Layout snapshot vs native: fixture-wide diff (offline, baked snapshots)",
  "",
  `Fixtures checked: ${FIXTURES.length}`,
  `Clean (every layer within ${TOLERANCE_PX}px): ${cleanFixtures}`,
  `Fixtures with at least one layer diff: ${new Set(diffs.map((d) => d.fixtureId)).size}`,
  `Compile/layer-count mismatches (not comparable): ${countMismatches.length}`,
  `Missing baked snapshot: ${missingSnapshot.length}`,
  "",
];
if (countMismatches.length) {
  lines.push("## Compile/layer-count mismatches", "", ...countMismatches.map((m) => `- ${m}`), "");
}
if (missingSnapshot.length) {
  lines.push("## Missing baked snapshot", "", ...missingSnapshot.map((m) => `- ${m}`), "");
}
if (diffs.length) {
  lines.push("## Per-layer diffs (delta = snapshot - native, px)", "", "| fixture | layer | dx | dy | dwidth | dheight |", "| --- | --- | --- | --- | --- | --- |");
  for (const d of diffs) lines.push(`| ${d.fixtureId} | ${d.layerId} | ${d.deltaX.toFixed(1)} | ${d.deltaY.toFixed(1)} | ${d.deltaWidth.toFixed(1)} | ${d.deltaHeight.toFixed(1)} |`);
}

writeFileSync(resolve(scriptDir, ".html-compiler-layout-snapshots/report.md"), `${lines.join("\n")}\n`);
console.log(lines.slice(0, 8).join("\n"));
console.log(`\nFull report: scripts/.html-compiler-layout-snapshots/report.md`);
