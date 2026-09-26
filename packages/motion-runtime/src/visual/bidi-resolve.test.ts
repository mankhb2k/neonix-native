import { describe, expect, it } from "vitest";
import { bidiRunsInRange, hasBidiContent, reorderRunsForDisplay, resolveBidi } from "./bidi-resolve";

describe("resolveBidi + bidiRunsInRange", () => {
  it("keeps a pure-LTR paragraph as a single ltr run", () => {
    const resolved = resolveBidi("Hello world", "ltr");
    const runs = bidiRunsInRange(resolved, 0, "Hello world".length);
    expect(runs).toEqual([{ start: 0, end: 11, level: 0, direction: "ltr" }]);
    expect(hasBidiContent(resolved, 0, 11)).toBe(false);
  });

  it("splits an embedded Arabic word inside an LTR paragraph into 3 runs", () => {
    const text = "Hello مرحبا World"; // "Hello مرحبا World"
    const resolved = resolveBidi(text, "ltr");
    const runs = bidiRunsInRange(resolved, 0, text.length);
    expect(runs).toEqual([
      { start: 0, end: 6, level: 0, direction: "ltr" },
      { start: 6, end: 11, level: 1, direction: "rtl" },
      { start: 11, end: 17, level: 0, direction: "ltr" },
    ]);
    expect(hasBidiContent(resolved, 0, text.length)).toBe(true);
  });

  it("auto-detects an RTL base direction from a pure Hebrew paragraph", () => {
    const text = "שלום"; // "שלום"
    const resolved = resolveBidi(text, "auto");
    expect(resolved.paragraphs[0]!.level).toBe(1);
    const runs = bidiRunsInRange(resolved, 0, text.length);
    expect(runs).toEqual([{ start: 0, end: 4, level: 1, direction: "rtl" }]);
  });

  it("resolves a nested LTR number embedded in an RTL paragraph to level 2", () => {
    const text = "السعر 100 دولار"; // "السعر 100 دولار"
    const resolved = resolveBidi(text, "auto");
    const runs = bidiRunsInRange(resolved, 0, text.length);
    expect(runs.map((run) => run.level)).toEqual([1, 2, 1]);
    expect(runs[1]).toMatchObject({ direction: "ltr" }); // even level 2 is LTR
  });
});

describe("reorderRunsForDisplay", () => {
  it("leaves a single run unchanged", () => {
    const runs = bidiRunsInRange(resolveBidi("Hello world", "ltr"), 0, 11);
    expect(reorderRunsForDisplay(runs)).toEqual(runs);
  });

  it("keeps run order for a simple embedded RTL word (only 3 runs, already in visual order)", () => {
    const text = "Hello مرحبا World";
    const resolved = resolveBidi(text, "ltr");
    const runs = bidiRunsInRange(resolved, 0, text.length);
    const visual = reorderRunsForDisplay(runs);
    // A single embedded RTL run inside an LTR paragraph doesn't move -
    // only its own glyphs get reversed internally by HarfBuzz.
    expect(visual).toEqual(runs);
  });

  // Cross-validates the run-level L2 reordering against bidi-js's own
  // character-level `getReorderedString` for a paragraph with a nested
  // embedding (RTL paragraph containing an LTR number): the run each
  // visual-order slot maps to must match where that run's text actually
  // lands in bidi-js's independently-computed reordered string.
  it("matches bidi-js's own reordered string for a nested LTR-in-RTL run sequence", async () => {
    const bidiFactory = (await import("bidi-js")).default;
    const bidi = bidiFactory();
    const text = "السعر 100 دولار"; // "السعر 100 دولار"
    const resolved = resolveBidi(text, "auto");
    const runs = bidiRunsInRange(resolved, 0, text.length);
    const visual = reorderRunsForDisplay(runs);

    // bidi-js reverses characters within RTL runs too (for its flat-string
    // representation); slice each visual run's own logical text and, for
    // RTL runs, reverse it by codepoint the same way, then concatenate -
    // this must equal bidi-js's reordered string built from the raw text.
    const reversedByCodepoint = (value: string) => [...value].reverse().join("");
    const rebuilt = visual
      .map((run) => {
        const slice = text.slice(run.start, run.end);
        return run.direction === "rtl" ? reversedByCodepoint(slice) : slice;
      })
      .join("");
    const embeddingLevels = bidi.getEmbeddingLevels(text, "auto");
    expect(rebuilt).toBe(bidi.getReorderedString(text, embeddingLevels));
  });
});
