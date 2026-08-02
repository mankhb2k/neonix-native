/**
 * One-shot copy of pure editor modules into packages/editor-core with import rewrites.
 * Run from repo root: node packages/editor-core/scripts/copy-from-web.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const WEB = path.join(ROOT, "apps/web/lib/editor");
const CORE = path.join(ROOT, "packages/editor-core/src");

/** web relative path under lib/editor → core relative under src */
const MAP = [
  ["model/timeline-types.ts", "timeline/model/timeline-types.ts"],
  ["model/editor-selection.ts", "selection/editor-selection.ts"],
  ["model/editor-selectors.ts", "selection/editor-selectors.ts"],
  ["timeline/document.ts", "document/document.ts"],
  ["timeline/assert-never.ts", "timeline/assert-never.ts"],
  ["timeline/clip-capabilities.ts", "timeline/clip-capabilities.ts"],
  ["timeline/indexes.ts", "timeline/indexes.ts"],
  ["timeline/geometry/timeline-geometry.ts", "timeline/geometry/timeline-geometry.ts"],
  ["timeline/policies/placement-policy.ts", "timeline/policies/placement-policy.ts"],
  ["timeline/policies/snapping-policy.ts", "timeline/policies/snapping-policy.ts"],
  ["timeline/policies/zoom-fit-policy.ts", "timeline/policies/zoom-fit-policy.ts"],
  ["timeline/policies/drop-target-policy.ts", "timeline/policies/drop-target-policy.ts"],
  ["timeline/selectors/visible-range.ts", "timeline/selectors/visible-range.ts"],
  ["timeline/history/history-types.ts", "history/history-types.ts"],
  ["timeline/history/history-manager.ts", "history/history-manager.ts"],
  ["timeline/migration/parse-timeline.ts", "timeline/migrations/parse-timeline.ts"],
  ["timeline/migration/project-migration.ts", "timeline/migrations/project-migration.ts"],
  ["operations/clip-move.ts", "operations/clip-move.ts"],
  ["operations/lane-flags.ts", "operations/lane-flags.ts"],
  ["timeline-clips.ts", "timeline/timeline-clips.ts"],
  ["clip-clipboard.ts", "timeline/clip-clipboard.ts"],
  ["overlay-scenes.ts", "overlay-scenes.ts"],
  ["store/internal/placement-adapter.ts", "timeline/internal/placement-adapter.ts"],
  ["store/internal/resize-collision.ts", "timeline/internal/resize-collision.ts"],
  ["store/internal/scene-utils.ts", "timeline/internal/scene-utils.ts"],
  ["store/internal/timeline-project-sync.ts", "timeline/internal/timeline-project-sync.ts"],
  ["timeline/commands/command-types.ts", "timeline/commands/command-types.ts"],
  ["timeline/commands/command-runner.ts", "timeline/commands/command-runner.ts"],
];

/** Map @/lib/editor/X → core module path key for rewrite hints */
const ALIAS_TO_CORE = {
  "@/lib/editor/model/timeline-types": "../timeline/model/timeline-types.js",
  "@/lib/editor/model/editor-selection": "../selection/editor-selection.js",
  "@/lib/editor/model/editor-selectors": "../selection/editor-selectors.js",
  "@/lib/editor/timeline/document": "../document/document.js",
  "@/lib/editor/timeline/assert-never": "./assert-never.js",
  "@/lib/editor/timeline/clip-capabilities": "./clip-capabilities.js",
  "@/lib/editor/timeline/indexes": "./indexes.js",
  "@/lib/editor/timeline/geometry/timeline-geometry": "./geometry/timeline-geometry.js",
  "@/lib/editor/timeline/policies/placement-policy": "./policies/placement-policy.js",
  "@/lib/editor/timeline/policies/snapping-policy": "./policies/snapping-policy.js",
  "@/lib/editor/timeline/policies/zoom-fit-policy": "./policies/zoom-fit-policy.js",
  "@/lib/editor/timeline/policies/drop-target-policy": "./policies/drop-target-policy.js",
  "@/lib/editor/timeline/selectors/visible-range": "./selectors/visible-range.js",
  "@/lib/editor/timeline/history/history-types": "../history/history-types.js",
  "@/lib/editor/timeline/history/history-manager": "../history/history-manager.js",
  "@/lib/editor/timeline/migration/parse-timeline": "./migrations/parse-timeline.js",
  "@/lib/editor/timeline/migration/project-migration": "./migrations/project-migration.js",
  "@/lib/editor/operations/clip-move": "../operations/clip-move.js",
  "@/lib/editor/operations/lane-flags": "../operations/lane-flags.js",
  "@/lib/editor/timeline-clips": "./timeline-clips.js",
  "@/lib/editor/clip-clipboard": "./clip-clipboard.js",
  "@/lib/editor/overlay-scenes": "../overlay-scenes.js",
  "@/lib/editor/frame-library": "../frame-draft.js",
  "@/lib/editor/store/internal/placement-adapter": "./internal/placement-adapter.js",
  "@/lib/editor/store/internal/resize-collision": "./internal/resize-collision.js",
  "@/lib/editor/store/internal/scene-utils": "./internal/scene-utils.js",
  "@/lib/editor/store/internal/timeline-project-sync": "./internal/timeline-project-sync.js",
  "@/lib/editor/timeline/commands/command-types": "./command-types.js",
  "@/lib/editor/timeline/commands/command-runner": "./command-runner.js",
};

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function rewriteImports(source, fromCoreRel) {
  let out = source;
  // Strip .js from our map values when writing TS source (bundler resolution)
  const dir = path.posix.dirname(fromCoreRel.replace(/\\/g, "/"));

  for (const [alias, _hint] of Object.entries(ALIAS_TO_CORE)) {
    // Resolve proper relative path from this file to the target core file
    const targetWeb = alias.replace("@/lib/editor/", "");
    const mapEntry = MAP.find(([w]) => w.replace(/\\/g, "/") === `${targetWeb}.ts` || w.replace(/\\/g, "/") === targetWeb);
    // Find core path for alias
    let coreTarget = null;
    for (const [webRel, coreRel] of MAP) {
      const webKey = webRel.replace(/\.ts$/, "").replace(/\\/g, "/");
      if (alias === `@/lib/editor/${webKey}`) {
        coreTarget = coreRel.replace(/\\/g, "/");
        break;
      }
    }
    if (alias === "@/lib/editor/frame-library") {
      coreTarget = "frame-draft.ts";
    }
    if (!coreTarget) continue;

    const fromDir = path.posix.dirname(fromCoreRel.replace(/\\/g, "/"));
    let rel = path.posix.relative(fromDir, coreTarget.replace(/\.ts$/, ""));
    if (!rel.startsWith(".")) rel = `./${rel}`;

    const patterns = [
      new RegExp(`from ["']${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "g"),
      new RegExp(`from ["']${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.js["']`, "g"),
    ];
    for (const re of patterns) {
      out = out.replace(re, `from "${rel}"`);
    }
  }
  return out;
}

for (const [webRel, coreRel] of MAP) {
  const srcPath = path.join(WEB, webRel);
  const destPath = path.join(CORE, coreRel);
  if (!fs.existsSync(srcPath)) {
    console.warn("missing", srcPath);
    continue;
  }
  let source = fs.readFileSync(srcPath, "utf8");
  source = rewriteImports(source, coreRel.replace(/\\/g, "/"));
  ensureDir(destPath);
  fs.writeFileSync(destPath, source);
  console.log("copied", webRel, "→", coreRel);
}

console.log("done");
