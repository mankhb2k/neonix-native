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

describe("layoutSnapshot (Phase 3 snapshot mode)", () => {
  const stamped = stampNodeIds(SAMPLE);
  const innerProbeId = /<div id="inner"[^>]*data-neonix-probe-id="([^"]+)"/.exec(stamped)![1]!;

  it("overrides a node's geometry with the snapshot box, converted to the same parent-relative transform native layers use", () => {
    // #outer stays native (position:absolute; left:10px; top:10px; padding:8px
    // -> content origin (18,18)); only #inner is snapshotted, to an absolute
    // box far from where native flow would have put it, so a pass-through
    // bug (snapshot ignored) and a coordinate-space bug (absolute used
    // as-is, not converted to #outer-relative) would both fail this.
    const snapshot = { [innerProbeId]: { x: 100, y: 200, width: 60, height: 30, padding: [0, 0, 0, 0] as const, border: [0, 0, 0, 0] as const } };
    const result = compileDocument({ html: stamped }, { layoutSnapshot: snapshot });
    expect(result.status).toBe("success");
    const inner = result.protocol!.layers.find((layer) => layer.frame.width === 60 && layer.frame.height === 30);
    expect(inner).toBeDefined();
    // #outer's native absolute origin is (10,10) (unaffected - not snapshotted).
    expect(inner!.transform.translate).toMatchObject({ x: 90, y: 190 });
  });

  it("falls back to native computation when the snapshot doesn't cover a node's id (a miss is always safe, never wrong)", () => {
    const withoutSnapshot = compileDocument({ html: stamped });
    const withUnrelatedSnapshot = compileDocument({ html: stamped }, { layoutSnapshot: { "not-a-real-id": { x: 1, y: 1, width: 1, height: 1, padding: [0, 0, 0, 0], border: [0, 0, 0, 0] } } });
    expect(withUnrelatedSnapshot.protocol?.layers).toEqual(withoutSnapshot.protocol?.layers);
  });

  it("layoutSnapshotStrict: a miss is a hard compile error instead of a silent native fallback", () => {
    const unrelatedSnapshot = { "not-a-real-id": { x: 1, y: 1, width: 1, height: 1, padding: [0, 0, 0, 0] as const, border: [0, 0, 0, 0] as const } };
    const result = compileDocument({ html: stamped }, { layoutSnapshot: unrelatedSnapshot, layoutSnapshotStrict: true });
    expect(result.status).toBe("error");
    expect(result.diagnostics[0]?.code).toBe("layout-snapshot-strict-miss");
  });

  it("layoutSnapshotStrict: full coverage compiles cleanly with no error", () => {
    // Every stamped id in this fixture must have a snapshot entry, or strict
    // mode fails the compile - so this also proves stampNodeIds' ids are
    // exactly what resolveNodeBox looks up, for every node the layout pass
    // visits.
    const allIds = [...stamped.matchAll(new RegExp(`${LAYOUT_PROBE_ID_ATTRIBUTE}="([^"]+)"`, "g"))].map((m) => m[1]!);
    const fullSnapshot = Object.fromEntries(allIds.map((id) => [id, { x: 0, y: 0, width: 100, height: 100, padding: [0, 0, 0, 0] as const, border: [0, 0, 0, 0] as const }]));
    const result = compileDocument({ html: stamped }, { layoutSnapshot: fullSnapshot, layoutSnapshotStrict: true });
    expect(result.status).toBe("success");
  });
});
