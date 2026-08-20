/**
 * Compile cache — memoizes compiled projects by compound key.
 *
 * Key = projectRevision + compilerVersion + componentDeps hash.
 * Invalidated on compiler version bump or component dependency change.
 *
 * Architecture: in-memory Map for now. Swap for LRU/persistent cache
 * in Phase 8 without changing the public API.
 */

import type { MotionRuntimeProject } from "@motionvideo/motion-protocol/runtime";
import { sha256Hex } from "@motionvideo/render-contracts";
import type { CompileResult } from "./compile-result";
import type { ComponentInput } from "./types";

// ── Cache key ─────────────────────────────────────────────────────────

/**
 * Physical compiler version — bump when compilation logic changes
 * in a way that could produce different output from same input.
 * This is NOT the schema formatVersion; it's a
 * compiler-specific version for cache invalidation.
 */
export const COMPILER_VERSION = "3.0.0-phase12";

/**
 * Compute a deterministic hash of component dependencies.
 * Even if projectRevision is unchanged, if a component package
 * changes, we must recompile.
 */
export function hashComponentDeps(components: ComponentInput[]): string {
  if (components.length === 0) return "no-deps";
  const normalized = components
    .map((c) => `${c.componentId}@${c.componentVersion}`)
    .sort()
    .join(",");
  return sha256Hex(normalized).slice(0, 12);
}

/**
 * Build a compound cache key from project revision + compiler version + component hash.
 */
export function buildCompileCacheKey(
  projectRevision: number,
  componentDeps: ComponentInput[],
  testSalt?: string,
): string {
  const depsHash = hashComponentDeps(componentDeps);
  const salt = testSalt ?? "";
  return `rev:${projectRevision}|compiler:${COMPILER_VERSION}|deps:${depsHash}|salt:${salt}`;
}

// ── Cache ─────────────────────────────────────────────────────────────

export type CacheEntry = {
  result: CompileResult<MotionRuntimeProject>;
  createdAt: number;
  hitCount: number;
};

/**
 * In-memory compile cache.
 *
 * Usage:
 *   const cache = new CompileCache({ maxSize: 50 });
 *   const cached = cache.get(key);
 *   if (cached) return cached;
 *   const result = compileMotionProjectV1(project, options);
 *   cache.set(key, result);
 */
export class CompileCache {
  private _store = new Map<string, CacheEntry>();
  private _maxSize: number;

  constructor(opts?: { maxSize?: number }) {
    this._maxSize = opts?.maxSize ?? 50;
  }

  /** Number of cached entries */
  get size(): number {
    return this._store.size;
  }

  /** The max number of entries before eviction */
  get maxSize(): number {
    return this._maxSize;
  }

  /** Look up a cached compilation result */
  get(key: string): CompileResult<MotionRuntimeProject> | undefined {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    entry.hitCount++;
    return entry.result;
  }

  /** Store a compilation result */
  set(key: string, result: CompileResult<MotionRuntimeProject>): void {
    // Evict oldest entry if at capacity (simple FIFO)
    if (this._store.size >= this._maxSize) {
      const first = this._store.keys().next().value;
      if (first !== undefined) this._store.delete(first);
    }
    this._store.set(key, {
      result,
      createdAt: Date.now(),
      hitCount: 0,
    });
  }

  /** Invalidate a specific key */
  invalidate(key: string): boolean {
    return this._store.delete(key);
  }

  /** Clear all entries */
  clear(): void {
    this._store.clear();
  }

  /** Get cache stats */
  stats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; hitCount: number; ageMs: number }>;
  } {
    const now = Date.now();
    return {
      size: this._store.size,
      maxSize: this._maxSize,
      entries: [...this._store.entries()].map(([key, entry]) => ({
        key,
        hitCount: entry.hitCount,
        ageMs: now - entry.createdAt,
      })),
    };
  }
}
