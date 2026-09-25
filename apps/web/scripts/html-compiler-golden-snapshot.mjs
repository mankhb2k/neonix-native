// Safety net for internal html-compiler refactors (pipeline/compile.ts and
// friends): captures full compiled output (status, diagnostics, Protocol V2
// JSON) for every fixture in the docs/playground catalog, as a golden
// baseline to diff a refactor's output against with html-compiler-golden-diff.mjs.
//
// Usage: run this BEFORE a refactor, then html-compiler-golden-diff.mjs AFTER
// each step. Zero diff across every fixture is the bar for "no behavior
// change", independent of and in addition to the existing unit test suite.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileDocument } from "../../../packages/html-compiler/src/index.ts";
import {
  HTML_COMPILER_PREVIEW_CASES,
  HTML_COMPILER_PREVIEW_FONT_ASSETS,
  HTML_COMPILER_PREVIEW_MEDIA_ASSETS,
} from "../lib/docs/html-compiler-preview.ts";

const publicRoot = resolve(import.meta.dirname, "../public");
const outDir = resolve(import.meta.dirname, ".html-compiler-golden");
mkdirSync(outDir, { recursive: true });

const results = [];
let errors = 0;
for (const fixture of HTML_COMPILER_PREVIEW_CASES) {
  const html = readFileSync(join(publicRoot, fixture.fixtureUrl.replace(/^\//, "")), "utf8");
  let compiled;
  try {
    compiled = compileDocument({ html }, { fontAssets: HTML_COMPILER_PREVIEW_FONT_ASSETS, mediaAssets: HTML_COMPILER_PREVIEW_MEDIA_ASSETS });
  } catch (error) {
    errors += 1;
    console.error("THROW", fixture.id, error instanceof Error ? error.message : String(error));
    continue;
  }
  results.push({ id: fixture.id, status: compiled.status, diagnostics: compiled.diagnostics, protocol: compiled.protocol });
}
writeFileSync(join(outDir, "snapshot.json"), JSON.stringify(results, null, 0));
console.log(`compiled ${results.length}/${HTML_COMPILER_PREVIEW_CASES.length} fixtures, ${errors} threw`);
console.log("statuses:", Object.fromEntries(Object.entries(
  results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {}),
)));
