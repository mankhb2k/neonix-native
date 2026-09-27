import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { compileDocument } from "@motionvideo/html-compiler";
import { HTML_COMPILER_PREVIEW_FONT_ASSETS, HTML_COMPILER_PREVIEW_MEDIA_ASSETS } from "./lib/docs/html-compiler-preview.ts";
import { HTML_PLAYGROUND_CASES } from "./lib/playground/html-playground-cases.ts";
let ok = 0; const failures: string[] = [];
const targets = new Set(["ring-filter-hue-blur-static","ring-rotation-symmetric-control","ring-behind-backdrop-card","card-own-shadow-in-backdrop"]);
for (const fixture of HTML_PLAYGROUND_CASES) {
  const rel = fixture.url.replace(/^\//, "");
  const path = join("public", rel);
  if (!existsSync(path)) { failures.push(`${fixture.id}: MISSING FILE ${rel}`); continue; }
  if (!targets.has(fixture.id)) { ok++; continue; }
  const html = readFileSync(path, "utf8");
  const r = compileDocument({ html }, { composition: { id: fixture.id }, fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS });
  if (!r.protocol) { failures.push(`${fixture.id}: ${r.diagnostics.map((d) => d.code + " " + d.message.slice(0,150)).join("; ")}`); continue; }
  console.log(fixture.id, "layers:", r.protocol.layers.length, "comp:", r.protocol.composition.width + "x" + r.protocol.composition.height);
  ok++;
}
console.log({ ok, total: HTML_PLAYGROUND_CASES.length });
console.log(failures.join("\n"));
