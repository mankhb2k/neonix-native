import type { HtmlCssSource } from "@motionvideo/html-compiler";

type PreviewCaseWithSource = {
  source: HtmlCssSource;
  html?: string;
};

/** Convert a legacy fixture source into the canonical single HTML document. */
export function htmlCompilerDocumentFromSource(source: HtmlCssSource): string {
  const metadata = JSON.stringify({
    kind: "neonix-html-document",
    schemaVersion: 2,
    composition: source.composition,
  });
  const meta = `<meta name="neonix-document" content='${metadata}'>`;
  const css = source.css.replace(/<\/style/gi, "<\\/style");
  const style = `<style data-neonix-bundle>\n${css}\n</style>`;
  const legacyHtml = source.html.replace(/<script\b(?=[^>]*\bid\s*=\s*["']neonix-manifest["'])(?=[^>]*\btype\s*=\s*["']application\/json["'])[^>]*>[\s\S]*?<\/script>/gi, "");
  const headResources = `${meta}\n${style}`;
  if (/<head(?:\s|>)/i.test(legacyHtml)) return legacyHtml.replace(/<head([^>]*)>/i, `<head$1>${headResources}`);
  if (/<html(?:\s|>)/i.test(legacyHtml)) return legacyHtml.replace(/<html([^>]*)>/i, `<html$1><head>${headResources}</head>`);
  return `<!doctype html><html><head>${headResources}</head><body>${legacyHtml}</body></html>`;
}

export function finalizeHtmlCompilerPreviewCase<T extends PreviewCaseWithSource>(item: T): T & { html: string } {
  return { ...item, html: htmlCompilerDocumentFromSource(item.source) };
}

/** Finalize an array in place so existing fixture imports retain identity. */
export function finalizeHtmlCompilerPreviewCases<T extends PreviewCaseWithSource>(items: T[]): asserts items is Array<T & { html: string }> {
  for (const item of items) item.html = htmlCompilerDocumentFromSource(item.source);
}

export function htmlCompilerPreviewHtml(item: PreviewCaseWithSource): string {
  return item.html ?? htmlCompilerDocumentFromSource(item.source);
}
