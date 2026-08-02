/**
 * Port pure web editor tests into editor-core with import rewrites.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const WEB_TESTS = path.join(ROOT, "apps/web/lib/editor/__tests__");
const CORE_TESTS = path.join(ROOT, "packages/editor-core/src/__tests__");

const FILES = [
  "document-invariants.test.ts",
  "clip-move-ops.test.ts",
  "lane-flags.test.ts",
  "editor-selection.test.ts",
  "visible-range.test.ts",
  "lane-drop-target.test.ts",
  "virtualization-budget.test.ts",
  "command-runner.test.ts",
  "history-seam.test.ts",
];

const REPLACEMENTS = [
  [/@\/lib\/editor\/__fixtures__\/projects/g, "../testing/fixtures/projects"],
  [/@\/lib\/editor\/__fixtures__\/large-timeline/g, "../testing/fixtures/large-timeline"],
  [/@\/lib\/editor\/timeline\/document/g, "../document/document"],
  [/@\/lib\/editor\/timeline\/indexes/g, "../timeline/indexes"],
  [/@\/lib\/editor\/timeline-clips/g, "../timeline/timeline-clips"],
  [/@\/lib\/editor\/operations\/clip-move/g, "../operations/clip-move"],
  [/@\/lib\/editor\/operations\/lane-flags/g, "../operations/lane-flags"],
  [/@\/lib\/editor\/model\/editor-selection/g, "../selection/editor-selection"],
  [/@\/lib\/editor\/model\/timeline-types/g, "../timeline/model/timeline-types"],
  [/@\/lib\/editor\/timeline\/selectors\/visible-range/g, "../timeline/selectors/visible-range"],
  [/@\/lib\/editor\/timeline\/policies\/drop-target-policy/g, "../timeline/policies/drop-target-policy"],
  [/@\/lib\/editor\/timeline(?=["'])/g, ".."],
];

fs.mkdirSync(CORE_TESTS, { recursive: true });

for (const name of FILES) {
  const src = path.join(WEB_TESTS, name);
  if (!fs.existsSync(src)) {
    console.warn("skip missing", name);
    continue;
  }
  let code = fs.readFileSync(src, "utf8");
  for (const [re, to] of REPLACEMENTS) {
    code = code.replace(re, to);
  }

  // Strip store-integration suites that depend on createEditorStore (web-only).
  if (name === "command-runner.test.ts") {
    const marker = 'describe("Store Integration & Factory Isolation"';
    const idx = code.indexOf(marker);
    if (idx >= 0) code = code.slice(0, idx).trimEnd() + "\n";
    code = code.replace(
      /import \{ createEditorStore \} from ["']@\/lib\/editor\/store\/create-editor-store["'];\n?/g,
      "",
    );
  }
  if (name === "history-seam.test.ts") {
    const marker = 'describe("Store Undo/Redo Integration';
    const idx = code.indexOf(marker);
    if (idx >= 0) code = code.slice(0, idx).trimEnd() + "\n";
    code = code.replace(
      /import \{ createEditorStore \} from ["']@\/lib\/editor\/store\/create-editor-store["'];\n?/g,
      "",
    );
    code = code.replace(
      /import \{ selectedClipIdsFrom \} from ["'][^"']+["'];\n?/g,
      "",
    );
  }

  const dst = path.join(CORE_TESTS, name);
  fs.writeFileSync(dst, code);
  console.log("ported", name);
}
