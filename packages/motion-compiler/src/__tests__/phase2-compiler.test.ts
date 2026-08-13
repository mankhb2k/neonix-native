/**
 * Phase 2 tests for motion-compiler: structured diagnostics + compile cache.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  DiagnosticCollector,
  CompileDiagnosticError,
  compileSuccess,
  compileFailure,
} from "../compile-result";
import {
  CompileCache,
  COMPILER_VERSION,
  buildCompileCacheKey,
} from "../compile-cache";

// ── Structured diagnostics ────────────────────────────────────────────

describe("DiagnosticCollector", () => {
  let collector: DiagnosticCollector;

  beforeEach(() => {
    collector = new DiagnosticCollector();
  });

  it("initially has no diagnostics", () => {
    expect(collector.diagnostics).toHaveLength(0);
    expect(collector.hasErrors).toBe(false);
    expect(collector.errorCount).toBe(0);
  });

  it("collects errors and warnings separately", () => {
    collector.error("UNKNOWN_VARIABLE", "Missing var: $foo", {
      path: ["variables", 0],
    });
    collector.warn("TEXT_OVERFLOW", "Text may overflow", {
      path: ["scenes", 0, "layers", 1],
    });

    expect(collector.hasErrors).toBe(true);
    expect(collector.errorCount).toBe(1);
    expect(collector.diagnostics).toHaveLength(2);
    expect(collector.diagnostics[0]!.severity).toBe("error");
    expect(collector.diagnostics[1]!.severity).toBe("warning");
  });

  it("clear resets everything", () => {
    collector.error("UNKNOWN_VARIABLE", "Missing var");
    collector.clear();
    expect(collector.diagnostics).toHaveLength(0);
    expect(collector.hasErrors).toBe(false);
  });

  it("merge combines diagnostics", () => {
    const other = new DiagnosticCollector();
    collector.error("UNKNOWN_VARIABLE", "A");
    other.error("UNKNOWN_CLIP_TARGET", "B");

    collector.merge(other);
    expect(collector.diagnostics).toHaveLength(2);
    expect(collector.errorCount).toBe(2);
  });

  it("throwIfFatal throws CompileDiagnosticError", () => {
    collector.error("UNKNOWN_VARIABLE", "Missing var");
    expect(() => collector.throwIfFatal()).toThrow(CompileDiagnosticError);
  });

  it("throwIfFatal does not throw for warnings only", () => {
    collector.warn("TEXT_OVERFLOW", "Preview");
    expect(() => collector.throwIfFatal()).not.toThrow();
  });

  it("info does not count as error", () => {
    collector.info("TEXT_OVERFLOW", "Info only");
    expect(collector.hasErrors).toBe(false);
    expect(collector.diagnostics).toHaveLength(1);
  });
});

describe("CompileDiagnosticError", () => {
  it("formats all errors in message", () => {
    const collector = new DiagnosticCollector();
    collector.error("UNKNOWN_VARIABLE", "Missing $x");
    collector.error("UNKNOWN_CLIP_TARGET", "Bad clip");

    const err = new CompileDiagnosticError([...collector.diagnostics]);
    expect(err.message).toContain("UNKNOWN_VARIABLE");
    expect(err.message).toContain("UNKNOWN_CLIP_TARGET");
    expect(err.name).toBe("CompileDiagnosticError");
  });
});

describe("compileSuccess / compileFailure", () => {
  it("compileSuccess wraps project with ok:true", () => {
    const result = compileSuccess({ id: "test" }, []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project).toEqual({ id: "test" });
    }
  });

  it("compileFailure has ok:false", () => {
    const collector = new DiagnosticCollector();
    collector.error("UNKNOWN_VARIABLE", "Bad");
    const result = compileFailure([...collector.diagnostics]);
    expect(result.ok).toBe(false);
  });
});

// ── Compile cache ─────────────────────────────────────────────────────

describe("CompileCache", () => {
  let cache: CompileCache;

  beforeEach(() => {
    cache = new CompileCache({ maxSize: 10 });
  });

  it("starts empty", () => {
    expect(cache.size).toBe(0);
    expect(cache.maxSize).toBe(10);
  });

  it("get returns undefined for missing key", () => {
    expect(cache.get("missing")).toBeUndefined();
  });

  it("set and get round-trips", () => {
    const result = compileSuccess({ id: "p" } as any);
    cache.set("key-1", result);
    expect(cache.size).toBe(1);

    const retrieved = cache.get("key-1");
    expect(retrieved).toBeDefined();
    if (retrieved && retrieved.ok) {
      expect(retrieved.project).toEqual({ id: "p" });
    }
  });

  it("invalidate removes entry", () => {
    const result = compileSuccess({ id: "p" } as any);
    cache.set("key-1", result);
    expect(cache.invalidate("key-1")).toBe(true);
    expect(cache.get("key-1")).toBeUndefined();
  });

  it("clear empties the cache", () => {
    const result = compileSuccess({ id: "p" } as any);
    cache.set("a", result);
    cache.set("b", result);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it("respects maxSize (FIFO eviction)", () => {
    const small = new CompileCache({ maxSize: 2 });
    const result = compileSuccess({ id: "p" } as any);
    small.set("a", result);
    small.set("b", result);
    small.set("c", result);

    expect(small.get("a")).toBeUndefined();
    expect(small.get("b")).toBeDefined();
    expect(small.get("c")).toBeDefined();
    expect(small.size).toBe(2);
  });

  it("stats returns hit count and age", () => {
    const result = compileSuccess({ id: "p" } as any);
    cache.set("key-1", result);
    cache.get("key-1");
    cache.get("key-1");

    const stats = cache.stats();
    expect(stats.size).toBe(1);
    expect(stats.entries[0]!.hitCount).toBe(2);
    expect(stats.entries[0]!.ageMs).toBeGreaterThanOrEqual(0);
  });
});

describe("buildCompileCacheKey", () => {
  it("includes revision, compiler version, and deps hash", () => {
    const key = buildCompileCacheKey(5, []);
    expect(key).toContain("rev:5");
    expect(key).toContain(`compiler:${COMPILER_VERSION}`);
    expect(key).toContain("deps:");
  });

  it("changes when revision changes", () => {
    const k1 = buildCompileCacheKey(1, []);
    const k2 = buildCompileCacheKey(2, []);
    expect(k1).not.toBe(k2);
  });

  it("changes when test salt changes", () => {
    const k1 = buildCompileCacheKey(1, [], "salt-a");
    const k2 = buildCompileCacheKey(1, [], "salt-b");
    expect(k1).not.toBe(k2);
  });
});
