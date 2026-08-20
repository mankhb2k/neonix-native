import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["apps", "packages"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

// These surfaces are intentionally frozen until their authoring model is
// rebuilt on Protocol V2. They must never be imported by the certified V2
// preview/export path.
const frozenLegacyPrefixes = [
  "apps/web/components/editor/",
  "apps/web/hooks/editor/",
  "apps/web/lib/editor/",
  "apps/web/lib/runtime/parse-project-input.ts",
  "apps/web/lib/runtime/preview-evaluate.ts",
  "apps/web/lib/runtime/project-composition.ts",
  "apps/web/e2e/",
  "apps/web/lib/docs/projects.test.ts",
  "apps/web/lib/docs/visual-fixtures.test.ts",
  "apps/desktop/gui/editor/",
  "apps/desktop/gui/app/editor/",
  "apps/desktop/shared/logic-parity-matrix.test.ts",
  "packages/editor-interactions/src/stage/hit-test-policy.ts",
  "packages/editor-interactions/src/__tests__/stage-hit-policy.test.ts",
  "packages/editor-react/src/stage/use-stage-selection.ts",
];

const forbiddenTokens = [
  "compileMotionProjectV1",
  "compileProjectV1",
  "evaluateCompositionFrameV1",
  "evaluateCompositionFrame",
  "compileMotionProject",
  "validateMotionProjectPresets",
  "createFacebookHistoryDemoProject",
  "createDemoMotionProject",
  "assertSnapshotContract",
  "layerGraphFromRuntime",
  "resolveTimelineAtTime",
  "listTimelineSegments",
  "timelineTotalDuration",
  "StageRendererPortShape",
];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === "dist" ||
      entry.name.startsWith(".next")
    ) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

const violations = [];
for (const sourceRoot of sourceRoots) {
  for (const file of walk(path.join(root, sourceRoot))) {
    const rel = relative(file);
    if (rel.startsWith("packages/motion-protocol/")) continue;
    if (frozenLegacyPrefixes.some((prefix) => rel.startsWith(prefix))) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        violations.push(`${rel}: ${token}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("Protocol V2 consumer gate failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log("Protocol V2 consumer gate passed.");
