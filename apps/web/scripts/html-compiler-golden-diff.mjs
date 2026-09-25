// Companion to html-compiler-golden-snapshot.mjs: recompiles every fixture
// against the CURRENT working tree and diffs against the saved baseline.
// Run html-compiler-golden-snapshot.mjs once before starting a refactor step,
// make the code change, then run this after - "0 mismatches" is the bar.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileDocument } from "../../../packages/html-compiler/src/index.ts";
import {
  HTML_COMPILER_PREVIEW_CASES,
  HTML_COMPILER_PREVIEW_FONT_ASSETS,
  HTML_COMPILER_PREVIEW_MEDIA_ASSETS,
} from "../lib/docs/html-compiler-preview.ts";

const publicRoot = resolve(import.meta.dirname, "../public");
const before = JSON.parse(readFileSync(resolve(import.meta.dirname, ".html-compiler-golden/snapshot.json"), "utf8"));
const beforeById = new Map(before.map((r) => [r.id, r]));

let mismatches = 0;
for (const fixture of HTML_COMPILER_PREVIEW_CASES) {
  const html = readFileSync(join(publicRoot, fixture.fixtureUrl.replace(/^\//, "")), "utf8");
  let compiled;
  try {
    compiled = compileDocument({ html }, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS });
  } catch (error) {
    console.log("THROW (was not throwing before)", fixture.id, error instanceof Error ? error.message : String(error));
    mismatches++;
    continue;
  }
  const prior = beforeById.get(fixture.id);
  const after = { id: fixture.id, status: compiled.status, diagnostics: compiled.diagnostics, protocol: compiled.protocol };
  if (!prior) { console.log("NEW FIXTURE (not in baseline):", fixture.id); mismatches++; continue; }
  if (JSON.stringify(prior) !== JSON.stringify(after)) {
    console.log("DIFF:", fixture.id);
    mismatches++;
  }
}
console.log(mismatches === 0 ? `ALL ${HTML_COMPILER_PREVIEW_CASES.length} FIXTURES MATCH — zero output change` : `${mismatches} mismatches found`);
