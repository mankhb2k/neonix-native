import { describe, expect, it } from "vitest";
import { lineBreakTokens } from "./line-break";

describe("lineBreakTokens", () => {
  it("matches the old ASCII-whitespace tokenizer shape for plain Latin text", () => {
    const tokens = lineBreakTokens("hello world foo");
    expect(tokens.map((token) => token.text)).toEqual(["hello ", "world ", "foo"]);
    expect(tokens.map((token) => token.index)).toEqual([0, 6, 12]);
  });

  it("attaches a run of multiple spaces to the preceding word, like \\S+\\s+", () => {
    const tokens = lineBreakTokens("hello    world");
    expect(tokens.map((token) => token.text)).toEqual(["hello    ", "world"]);
  });

  // Regression: the old `/\S+(?:\s+|$)/g` tokenizer requires an ASCII space
  // to ever produce a break, so a run of CJK ideographs (which never use
  // spaces between words) was always exactly one unbreakable "word" and
  // could never wrap. UAX #14 break tables allow a break between almost
  // every CJK ideograph pair, so this must now produce one token per
  // character instead of one token for the whole string.
  it("breaks between CJK ideographs even with no spaces present", () => {
    const tokens = lineBreakTokens("你好世界这是中文");
    expect(tokens.map((token) => token.text)).toEqual(["你", "好", "世", "界", "这", "是", "中", "文"]);
  });

  it("breaks correctly across mixed Latin and CJK text", () => {
    const tokens = lineBreakTokens("hello 你好 world");
    expect(tokens.map((token) => token.text)).toEqual(["hello ", "你", "好 ", "world"]);
  });

  // Known, honest limitation: the rule-based UAX #14 tables this pure-JS
  // library ships do not include the dictionary/ML segmentation data Thai,
  // Lao, Khmer and Burmese need (those scripts don't use spaces either).
  // Only ICU4X's much larger LSTM/dictionary payload solves this; tracked
  // as a separate follow-up rather than silently claimed as fixed here.
  it("does not segment Thai (no spaces, needs dictionary data this library doesn't ship)", () => {
    const tokens = lineBreakTokens("สวัสดีชาวโลก");
    expect(tokens).toHaveLength(1);
  });

  it("returns no tokens for an empty string", () => {
    expect(lineBreakTokens("")).toEqual([]);
  });
});
