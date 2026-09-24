import "server-only";

import type { HtmlCompilerDiagnostic } from "@motionvideo/html-compiler";

/**
 * Every compile error is a real CSS/HTML pattern this compiler doesn't
 * support yet, or a real authoring conflict (e.g.
 * css-animation-transform-conflict) — logging just the code and message
 * (never the source HTML/CSS itself) builds a frequency signal for which
 * gaps actually matter to real authors and agents, instead of guessing from
 * a general CSS feature survey. Shared by every place that calls
 * compileDocument: html-project-repository's compileHtml (validate_html,
 * compile_html, the /api/v1/documents routes, render preview) and
 * projects/repository's createProjectHtml.
 */
export function logCompileDiagnostics(diagnostics: readonly HtmlCompilerDiagnostic[]): void {
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity !== "error") continue;
    console.error("[html-compile-diagnostic]", JSON.stringify({ code: diagnostic.code, message: diagnostic.message }));
  }
}
