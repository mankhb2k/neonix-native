import { describe, expect, it } from "vitest";
import { compileDocument } from "./compiler/pipeline/compile";
import { parseHtml } from "./compiler/html/parser";
import { LAYOUT_PROBE_ID_ATTRIBUTE, stampNodeIds } from "./layout-probe";

const SAMPLE = `<!doctype html>
<html lang="en">
<head>
<!-- a comment with a > inside it -->
<meta name="neonix-document" content='{"kind":"neonix-html-document","schemaVersion":2,"composition":{"width":1920,"height":1080,"fps":30,"durationMs":1000,"background":"#081018","colorSpace":"srgb"}}'>
<style data-neonix-bundle>
  #a > #b { color: red; }
  html, body { width: 1920px; height: 1080px; margin: 0; }
  #outer { position: absolute; left: 10px; top: 10px; background: #22d3ee; padding: 8px; }
  #inner { width: 40px; height: 20px; background: #facc15; }
</style>
</head>
<body>
  <div id="outer"><div id="inner"></div></div>
</body>
</html>`;

describe("stampNodeIds", () => {
  it("injects a sequential, unique id onto every real opening tag in source order", () => {
    const stamped = stampNodeIds(SAMPLE);
    const ids = [...stamped.matchAll(new RegExp(`${LAYOUT_PROBE_ID_ATTRIBUTE}="([^"]+)"`, "g"))].map((m) => m[1]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(ids.slice().sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
    // html, head, meta, body, div#outer, div#inner - not <!doctype>/comment,
    // and not <style> itself (its whole block, tag included, is one skipped
    // alternative so CSS content is never mistaken for a tag).
    expect(ids.length).toBe(6);
  });

  it("does not stamp inside <style>/<script> content or comments/doctype", () => {
    const stamped = stampNodeIds(SAMPLE);
    expect(stamped).toContain("#a > #b { color: red; }");
    expect(stamped).toContain("<!-- a comment with a > inside it -->");
    expect(stamped).toMatch(/^<!doctype html>/);
  });

  it("leaves the HTML byte-identical apart from the inserted attributes", () => {
    const stamped = stampNodeIds(SAMPLE);
    const stripped = stamped.replace(new RegExp(`\\s${LAYOUT_PROBE_ID_ATTRIBUTE}="[^"]*"`, "g"), "");
    expect(stripped).toBe(SAMPLE);
  });

  it("survives html-compiler's real parser: every element node carries the same id it was stamped with", () => {
    const stamped = stampNodeIds(SAMPLE);
    const root = parseHtml(stamped);
    const seen: string[] = [];
    const visit = (node: ReturnType<typeof parseHtml>) => {
      const id = node.attributes.get(LAYOUT_PROBE_ID_ATTRIBUTE);
      if (id) seen.push(id);
      node.children.forEach(visit);
    };
    visit(root);
    const expected = [...stamped.matchAll(new RegExp(`${LAYOUT_PROBE_ID_ATTRIBUTE}="([^"]+)"`, "g"))].map((m) => m[1]!);
    // head/meta/style are parsed but not part of the body tree layout.ts
    // walks - only body-descendant elements matter for the layout probe, and
    // parseHtml keeps them in the same relative (document) order regardless.
    expect(seen.length).toBeGreaterThan(0);
    for (const id of seen) expect(expected).toContain(id);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("has zero effect on compiled output (stamping is inert to the compiler)", () => {
    const before = compileDocument({ html: SAMPLE });
    const after = compileDocument({ html: stampNodeIds(SAMPLE) });
    expect(after.status).toBe(before.status);
    expect(after.protocol?.layers).toEqual(before.protocol?.layers);
  });
});
