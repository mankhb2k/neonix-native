import bidiFactory from "bidi-js";
import type { EmbeddingLevels } from "bidi-js";

const bidi = bidiFactory();

export type BidiDirection = "ltr" | "rtl";
export type BidiParagraph = { start: number; end: number; level: number };
export type ResolvedBidi = { levels: Uint8Array; paragraphs: readonly BidiParagraph[] };
export type BidiRun = { start: number; end: number; level: number; direction: BidiDirection };

function directionForLevel(level: number): BidiDirection {
  return level % 2 === 1 ? "rtl" : "ltr";
}

/**
 * Resolves UAX #9 embedding levels for a full logical paragraph (soft-wrapped
 * lines do not change this - bidi resolution runs on the *unwrapped* text).
 * `baseDirection` matches CSS `direction`; omit it (or pass "auto") to let
 * the algorithm pick each paragraph's base direction from its first
 * strong character, same as the CSS Writing Modes `unicode-bidi: normal`
 * default.
 */
export function resolveBidi(text: string, baseDirection?: BidiDirection | "auto"): ResolvedBidi {
  const result: EmbeddingLevels = bidi.getEmbeddingLevels(text, baseDirection);
  return { levels: result.levels, paragraphs: result.paragraphs };
}

/**
 * Splits [start, end) into maximal runs of constant embedding level, in
 * logical (source) order - the order each run's text must be fed to
 * HarfBuzz for correct shaping. A run's own glyph order for an RTL run is
 * HarfBuzz's job (via `buffer.setDirection`); this only tells you where one
 * direction run ends and the next begins within a line.
 */
export function bidiRunsInRange(resolved: ResolvedBidi, start: number, end: number): BidiRun[] {
  const runs: BidiRun[] = [];
  let runStart = start;
  for (let index = start; index < end; index++) {
    const level = resolved.levels[index]!;
    const nextLevel = index + 1 < end ? resolved.levels[index + 1]! : null;
    if (nextLevel === null || nextLevel !== level) {
      runs.push({ start: runStart, end: index + 1, level, direction: directionForLevel(level) });
      runStart = index + 1;
    }
  }
  return runs;
}

/**
 * Reorders a line's logical-order runs (from `bidiRunsInRange`) into the
 * left-to-right visual order they must be laid out on screen - UAX #9 rule
 * L2: from the highest level down to the lowest odd level, reverse every
 * maximal contiguous sequence of runs whose level is at least that value.
 * Each run keeps its own internal glyph order (HarfBuzz already reverses an
 * RTL run's glyphs during shaping); this only reorders entire runs.
 */
export function reorderRunsForDisplay(runs: readonly BidiRun[]): BidiRun[] {
  if (runs.length <= 1) return [...runs];
  let ordered = [...runs];
  let maxLevel = 0;
  let minOddLevel = Infinity;
  for (const run of runs) {
    if (run.level > maxLevel) maxLevel = run.level;
    if (run.level % 2 === 1 && run.level < minOddLevel) minOddLevel = run.level;
  }
  if (minOddLevel === Infinity) return ordered;
  for (let level = maxLevel; level >= minOddLevel; level--) {
    let i = 0;
    while (i < ordered.length) {
      if (ordered[i]!.level >= level) {
        let j = i;
        while (j < ordered.length && ordered[j]!.level >= level) j++;
        const reversed = ordered.slice(i, j).reverse();
        ordered = [...ordered.slice(0, i), ...reversed, ...ordered.slice(j)];
        i = j;
      } else {
        i++;
      }
    }
  }
  return ordered;
}

/** True if any character in [start, end) resolves to an odd (RTL) embedding level - a cheap way to skip all bidi handling for pure-LTR text. */
export function hasBidiContent(resolved: ResolvedBidi, start: number, end: number): boolean {
  for (let index = start; index < end; index++) {
    if (resolved.levels[index]! % 2 === 1) return true;
  }
  return false;
}
