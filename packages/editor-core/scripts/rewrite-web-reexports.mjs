import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB = path.join(ROOT, "apps/web/lib/editor");

const REEXPORT_ALL = [
  "model/timeline-types.ts",
  "model/editor-selection.ts",
  "model/editor-selectors.ts",
  "timeline/document.ts",
  "timeline/assert-never.ts",
  "timeline/clip-capabilities.ts",
  "timeline/indexes.ts",
  "timeline/geometry/timeline-geometry.ts",
  "timeline/policies/placement-policy.ts",
  "timeline/policies/snapping-policy.ts",
  "timeline/policies/zoom-fit-policy.ts",
  "timeline/policies/drop-target-policy.ts",
  "timeline/selectors/visible-range.ts",
  "timeline/history/history-types.ts",
  "timeline/history/history-manager.ts",
  "timeline/migration/parse-timeline.ts",
  "timeline/migration/project-migration.ts",
  "operations/clip-move.ts",
  "operations/lane-flags.ts",
  "timeline-clips.ts",
  "clip-clipboard.ts",
  "overlay-scenes.ts",
  "store/internal/placement-adapter.ts",
  "store/internal/resize-collision.ts",
  "store/internal/scene-utils.ts",
  "store/internal/timeline-project-sync.ts",
  "timeline/commands/command-types.ts",
  "timeline/commands/command-runner.ts",
];

for (const rel of REEXPORT_ALL) {
  const file = path.join(WEB, rel);
  fs.writeFileSync(file, 'export * from "@motionvideo/editor-core";\n');
  console.log("rewrote", rel);
}
