/// <reference path="./linebreak.d.ts" />
import LineBreaker from "linebreak";

export type LineBreakToken = { text: string; index: number };

/**
 * Splits text into greedy-wrap candidate tokens at legal UAX #14 line-break
 * opportunities (each token runs up to and including any attached trailing
 * whitespace), replacing an ASCII-whitespace-only regex tokenizer. CJK/Thai
 * scripts have no spaces at all, so a `\S+\s+` split never breaks them; real
 * break-opportunity data does. Pure rule-based (no dictionary/ML payload),
 * so it still won't segment Thai/Lao/Khmer/Burmese without spaces - only
 * ICU4X's heavier LSTM/dictionary data does that, at a much larger bundle
 * cost. CJK ideographs already break correctly with the rule-based tables.
 */
export function lineBreakTokens(text: string): LineBreakToken[] {
  if (!text) return [];
  const breaker = new LineBreaker(text);
  const tokens: LineBreakToken[] = [];
  let start = 0;
  let next = breaker.nextBreak();
  while (next) {
    tokens.push({ text: text.slice(start, next.position), index: start });
    start = next.position;
    next = breaker.nextBreak();
  }
  return tokens;
}
