/**
 * Paint diff engine — frame-to-frame fingerprint comparison for the Pixi painter.
 *
 * §Phase 8 Task 8.1 in core-engine-tasks.md
 *
 * Computes and compares fingerprints between consecutive frames so the
 * painter can skip Graphics.clear(), avoid re-setting TextStyle properties,
 * and avoid re-creating Filters when nothing changed.
 */

import type { PaintCommand, PaintDrawCommand } from "@motionvideo/motion-runtime";
import { computePaintItemFingerprint } from "@motionvideo/motion-runtime";

// ── Types ─────────────────────────────────────────────────────────────

export type PaintDiffResult = "changed" | "unchanged" | "new" | "removed";

export type PaintDiffStats = {
  /** Total drawable items processed this frame. */
  totalItems: number;
  /** Items that changed since last frame. */
  changedItems: number;
  /** Items unchanged — painter can skip updates. */
  unchangedItems: number;
  /** Items new this frame (no previous fingerprint). */
  newItems: number;
  /** Items from previous frame no longer present. */
  removedItems: number;
  /** Total Graphics.clear() calls skipped. */
  clearsSkipped: number;
  /** Total filter recreation calls skipped. */
  filterResetsSkipped: number;
  /** Total TextStyle updates skipped. */
  styleUpdatesSkipped: number;
};

export type PaintFrameDiff = {
  /** For each key, what changed. */
  byKey: Map<string, PaintDiffResult>;
  /** Aggregated stats. */
  stats: PaintDiffStats;
  /** The fingerprints from this frame (stored for next frame). */
  fingerprints: Map<string, string>;
};

// ── Dirty diff engine ─────────────────────────────────────────────────

export type PaintDiffEngine = {
  /**
   * Compute the diff between the current paint buffer and the previous frame.
   * Call this once per frame, before painting.
   */
  diffFrame(
    commands: PaintCommand[],
  ): PaintFrameDiff;

  /**
   * Check if a single drawable changed vs last frame.
   * Returns true if the fingerprint differs or is new.
   */
  isDirty(key: string, fingerprint: string): boolean;

  /**
   * Get the last fingerprint for a key (null if new).
   */
  getLastFingerprint(key: string): string | null;

  /**
   * Get stats from the last diff.
   */
  getStats(): PaintDiffStats;

  /** Reset state (on dispose, project change). */
  reset(): void;
};

export function createPaintDiffEngine(): PaintDiffEngine {
  let lastFingerprints = new Map<string, string>();
  let lastStats: PaintDiffStats = {
    totalItems: 0,
    changedItems: 0,
    unchangedItems: 0,
    newItems: 0,
    removedItems: 0,
    clearsSkipped: 0,
    filterResetsSkipped: 0,
    styleUpdatesSkipped: 0,
  };

  function diffFrame(commands: PaintCommand[]): PaintFrameDiff {
    const byKey = new Map<string, PaintDiffResult>();
    const thisFingerprints = new Map<string, string>();
    const seen = new Set<string>();

    let total = 0;
    let changed = 0;
    let unchanged = 0;
    let addedNew = 0;
    let clearsSkipped = 0;
    let filterResetsSkipped = 0;
    let styleUpdatesSkipped = 0;

    for (const cmd of commands) {
      // Only draw commands have fingerprints
      if (!isDrawCommand(cmd)) continue;

      total++;
      seen.add(cmd.key);

      // Compute this frame's fingerprint
      const fingerprint = computePaintItemFingerprint(cmd, {
        matrix: {
          a: (cmd as any).matrix?.a ?? 1,
          b: (cmd as any).matrix?.b ?? 0,
          c: (cmd as any).matrix?.c ?? 0,
          d: (cmd as any).matrix?.d ?? 1,
          e: (cmd as any).matrix?.e ?? 0,
          f: (cmd as any).matrix?.f ?? 0,
        },
        alpha: (cmd as any).alpha ?? 1,
        visible: (cmd as any).visible ?? true,
        zIndex: (cmd as any).zIndex ?? 0,
        blendMode: (cmd as any).blendMode,
      });

      thisFingerprints.set(cmd.key, fingerprint);

      const lastFp = lastFingerprints.get(cmd.key);
      if (!lastFp) {
        byKey.set(cmd.key, "new");
        addedNew++;
      } else if (lastFp === fingerprint) {
        byKey.set(cmd.key, "unchanged");
        unchanged++;
        // Estimate skipped work
        if (cmd.op === "drawShape" || cmd.op === "drawSolid" || cmd.op === "drawPath") {
          clearsSkipped++;
        }
        if (cmd.op === "drawText") {
          styleUpdatesSkipped++;
        }
        if (hasEffects(cmd)) {
          filterResetsSkipped++;
        }
      } else {
        byKey.set(cmd.key, "changed");
        changed++;
      }
    }

    // Detect removed items
    let removed = 0;
    for (const key of lastFingerprints.keys()) {
      if (!seen.has(key)) {
        byKey.set(key, "removed");
        removed++;
      }
    }

    lastStats = {
      totalItems: total,
      changedItems: changed,
      unchangedItems: unchanged,
      newItems: addedNew,
      removedItems: removed,
      clearsSkipped,
      filterResetsSkipped,
      styleUpdatesSkipped,
    };

    lastFingerprints = thisFingerprints;

    return {
      byKey,
      stats: lastStats,
      fingerprints: thisFingerprints,
    };
  }

  function isDirty(key: string, fingerprint: string): boolean {
    const last = lastFingerprints.get(key);
    return last !== fingerprint;
  }

  function getLastFingerprint(key: string): string | null {
    return lastFingerprints.get(key) ?? null;
  }

  function getStats(): PaintDiffStats {
    return { ...lastStats };
  }

  function reset(): void {
    lastFingerprints = new Map();
    lastStats = {
      totalItems: 0,
      changedItems: 0,
      unchangedItems: 0,
      newItems: 0,
      removedItems: 0,
      clearsSkipped: 0,
      filterResetsSkipped: 0,
      styleUpdatesSkipped: 0,
    };
  }

  return { diffFrame, isDirty, getLastFingerprint, getStats, reset };
}

// ── Helpers ───────────────────────────────────────────────────────────

function isDrawCommand(
  cmd: PaintCommand,
): cmd is PaintDrawCommand & { key: string } {
  return (
    "key" in cmd &&
    typeof cmd.key === "string" &&
    [
      "drawText",
      "drawShape",
      "drawSolid",
      "drawImage",
      "drawVideo",
      "drawPath",
    ].includes(cmd.op)
  );
}

function hasEffects(cmd: PaintCommand): boolean {
  return "effects" in cmd && Array.isArray(cmd.effects) && cmd.effects.length > 0;
}
