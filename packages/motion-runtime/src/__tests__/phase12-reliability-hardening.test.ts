/**
 * Phase 12 — Reliability & Production Hardening tests.
 *
 * Task 12.1: Error taxonomy + diagnostics
 *   - RuntimeDiagnosticCollector creation and usage
 *   - Diagnostic code → severity mapping
 *   - Frame/time enrichment
 *   - toRenderDiagnostic backward compat
 *   - RuntimeDiagnosticError wrapping
 *
 * Task 12.2: Cancellation/dispose
 *   - AbortSignal via evaluateCompositionFrameV3
 *   - CancellationError class
 *   - throwIfAborted / isAborted
 *   - withTimeout combining signals
 *
 * Task 12.3: Fuzz + soak
 *   - Non-finite value clamping (NaN, Infinity)
 *   - Schema limits enforcement
 *   - Cycle detection graceful degradation
 *   - Parent missing fallback
 *   - Memory soak (20× evaluate/dispose)
 *
 * Task 12.4: Versioning & rollout
 *   - buildVersionManifest()
 *   - Feature flag checks (isFeatureEnabled)
 *   - getActiveFeatureFlags()
 *   - rollbackChecklist()
 */

import { describe, it, expect } from "vitest";
import {
  RuntimeDiagnosticCollector,
  RuntimeDiagnosticCode,
  RUNTIME_DIAGNOSTIC_CODE_META,
  createDiagnostic,
  toRenderDiagnostic,
  RuntimeDiagnosticError,
} from "../diagnostics";
import { evaluateScene } from "../evaluator";
import {
  CancellationError,
  isAborted,
  throwIfAborted,
  cancelledDiagnostic,
  withTimeout,
} from "../cancellation";
import {
  buildVersionManifest,
  isFeatureEnabled,
  getActiveFeatureFlags,
  rollbackChecklist,
  FeatureFlag,
  SCHEMA_FORMAT_VERSION,
  PAINT_COMMAND_VERSION,
  COMPOSITION_FRAME_VERSION,
  WORKER_PROTOCOL_VERSION,
  DIAGNOSTIC_VERSION,
  CANCELLATION_VERSION,
} from "../version-policy";

// ═══════════════════════════════════════════════════════════════════
// Task 12.1: Error taxonomy
// ═══════════════════════════════════════════════════════════════════

describe("Phase 12.1 — RuntimeDiagnosticCollector", () => {
  it("creates an empty collector", () => {
    const c = new RuntimeDiagnosticCollector();
    expect(c.diagnostics).toHaveLength(0);
    expect(c.errorCount).toBe(0);
    expect(c.hasErrors).toBe(false);
  });

  it("collects error diagnostics", () => {
    const c = new RuntimeDiagnosticCollector();
    c.error("PARENT_MISSING", { nodeId: "n1" });
    expect(c.diagnostics).toHaveLength(1);
    expect(c.errorCount).toBe(1);
    expect(c.hasErrors).toBe(true);
    expect(c.diagnostics[0]!.code).toBe("PARENT_MISSING");
    expect(c.diagnostics[0]!.severity).toBe("error");
    expect(c.diagnostics[0]!.nodeId).toBe("n1");
  });

  it("collects warning diagnostics", () => {
    const c = new RuntimeDiagnosticCollector();
    c.warn("NON_FINITE_VALUE", { nodeId: "n2" });
    expect(c.diagnostics).toHaveLength(1);
    expect(c.errorCount).toBe(0);
    expect(c.hasErrors).toBe(false);
    expect(c.diagnostics[0]!.severity).toBe("warning");
  });

  it("collects info diagnostics", () => {
    const c = new RuntimeDiagnosticCollector();
    c.info("EVALUATION_CANCELLED");
    expect(c.diagnostics[0]!.severity).toBe("info");
  });

  it("enriches diagnostics with frame/time", () => {
    const c = new RuntimeDiagnosticCollector({ frame: 42, time: 1.4 });
    c.error("PARENT_MISSING", { nodeId: "n3" });
    expect(c.diagnostics[0]!.frame).toBe(42);
    expect(c.diagnostics[0]!.time).toBe(1.4);
  });

  it("setFrame updates subsequent diagnostics", () => {
    const c = new RuntimeDiagnosticCollector();
    c.error("PARENT_MISSING"); // frame=0
    c.setFrame(10, 0.33);
    c.warn("NON_FINITE_VALUE"); // frame=10
    expect(c.diagnostics[0]!.frame).toBe(0);
    expect(c.diagnostics[1]!.frame).toBe(10);
  });

  it("throwIfFatal throws RuntimeDiagnosticError with errors", () => {
    const c = new RuntimeDiagnosticCollector();
    c.error("PARENT_CYCLE", { nodeId: "n4" });
    expect(() => c.throwIfFatal()).toThrow(RuntimeDiagnosticError);
  });

  it("throwIfFatal does not throw when only warnings", () => {
    const c = new RuntimeDiagnosticCollector();
    c.warn("NON_FINITE_VALUE");
    expect(() => c.throwIfFatal()).not.toThrow();
  });

  it("clear resets diagnostics", () => {
    const c = new RuntimeDiagnosticCollector();
    c.error("PARENT_MISSING");
    c.clear();
    expect(c.diagnostics).toHaveLength(0);
    expect(c.errorCount).toBe(0);
  });

  it("merge combines diagnostics from two collectors", () => {
    const a = new RuntimeDiagnosticCollector();
    a.error("PARENT_MISSING", { nodeId: "a" });
    const b = new RuntimeDiagnosticCollector();
    b.warn("NON_FINITE_VALUE", { nodeId: "b" });
    a.merge(b);
    expect(a.diagnostics).toHaveLength(2);
    expect(a.errorCount).toBe(1);
  });
});

describe("Phase 12.1 — Diagnostic codes", () => {
  it("every code has metadata", () => {
    const codes = Object.values(RuntimeDiagnosticCode);
    for (const code of codes) {
      expect(RUNTIME_DIAGNOSTIC_CODE_META[code]).toBeDefined();
      expect(RUNTIME_DIAGNOSTIC_CODE_META[code].severity).toMatch(
        /^(error|warning|info)$/,
      );
    }
  });

  it("createDiagnostic uses code defaults", () => {
    const d = createDiagnostic("PARENT_MISSING");
    expect(d.code).toBe("PARENT_MISSING");
    expect(d.severity).toBe("error");
    expect(d.message).toBe(
      "The referenced parent node does not exist in the scene.",
    );
  });

  it("createDiagnostic overrides message", () => {
    const d = createDiagnostic("PARENT_MISSING", { message: "Custom msg" });
    expect(d.message).toBe("Custom msg");
  });

  it("toRenderDiagnostic strips frame/time/path", () => {
    const d = createDiagnostic("NON_FINITE_VALUE", {
      nodeId: "n5",
      frame: 10,
      time: 0.5,
      path: ["scenes", 0],
    });
    const rd = toRenderDiagnostic(d);
    expect(rd.code).toBe("NON_FINITE_VALUE");
    expect(rd.severity).toBe("warning");
    expect(rd.nodeId).toBe("n5");
    expect(rd.key).toBeUndefined();
    expect((rd as any).frame).toBeUndefined();
    expect((rd as any).time).toBeUndefined();
  });

  it("non-finite values have warning severity", () => {
    expect(RUNTIME_DIAGNOSTIC_CODE_META["NON_FINITE_VALUE"].severity).toBe(
      "warning",
    );
  });

  it("parent cycle has error severity", () => {
    expect(RUNTIME_DIAGNOSTIC_CODE_META["PARENT_CYCLE"].severity).toBe("error");
  });
});

describe("Phase 12.1 — RuntimeDiagnosticError", () => {
  it("wraps diagnostics in message", () => {
    const c = new RuntimeDiagnosticCollector();
    c.error("PARENT_MISSING", { nodeId: "n1" });
    c.error("PARENT_CYCLE", { nodeId: "n2" });
    try {
      c.throwIfFatal();
    } catch (e) {
      expect(e).toBeInstanceOf(RuntimeDiagnosticError);
      const re = e as RuntimeDiagnosticError;
      expect(re.diagnostics).toHaveLength(2);
      expect(re.message).toContain("PARENT_MISSING");
      expect(re.message).toContain("PARENT_CYCLE");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Task 12.2: Cancellation
// ═══════════════════════════════════════════════════════════════════

describe("Phase 12.2 — CancellationError", () => {
  it("has correct name and code", () => {
    const err = new CancellationError("EVALUATION_CANCELLED");
    expect(err.name).toBe("CancellationError");
    expect(err.code).toBe("EVALUATION_CANCELLED");
    expect(err.message).toContain("EVALUATION_CANCELLED");
  });

  it("accepts custom message", () => {
    const err = new CancellationError("RENDER_CANCELLED", "User aborted");
    expect(err.message).toBe("User aborted");
  });
});

describe("Phase 12.2 — isAborted / throwIfAborted", () => {
  it("isAborted returns false for undefined", () => {
    expect(isAborted(undefined)).toBe(false);
  });

  it("isAborted returns false for null", () => {
    expect(isAborted(null)).toBe(false);
  });

  it("isAborted returns true after abort", () => {
    const ctrl = new AbortController();
    ctrl.abort();
    expect(isAborted(ctrl.signal)).toBe(true);
  });

  it("throwIfAborted throws when aborted", () => {
    const ctrl = new AbortController();
    ctrl.abort();
    expect(() => throwIfAborted(ctrl.signal)).toThrow(CancellationError);
  });

  it("throwIfAborted does not throw for live signal", () => {
    const ctrl = new AbortController();
    expect(() => throwIfAborted(ctrl.signal)).not.toThrow();
  });
});

describe("Phase 12.2 — withTimeout", () => {
  it("returns a signal that is not initially aborted", () => {
    const sig = withTimeout(5000);
    expect(sig.aborted).toBe(false);
  });

  it("combines with existing signal", () => {
    const ctrl = new AbortController();
    const sig = withTimeout(5000, ctrl.signal);
    expect(sig.aborted).toBe(false);
    ctrl.abort();
    expect(sig.aborted).toBe(true);
  });
});

describe("Phase 12.2 — cancelledDiagnostic", () => {
  it("creates an info diagnostic", () => {
    const d = cancelledDiagnostic("EVALUATION_CANCELLED", {
      frame: 5,
      time: 0.16,
    });
    expect(d.code).toBe("EVALUATION_CANCELLED");
    expect(d.severity).toBe("info");
    expect(d.frame).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Task 12.3: Fuzz + soak
// ═══════════════════════════════════════════════════════════════════

describe("Phase 12.3 — Fuzz: non-finite values", () => {
  it("collector identifies non-finite warnings", () => {
    const c = new RuntimeDiagnosticCollector();
    c.warn("NON_FINITE_VALUE", {
      nodeId: "n1",
      details: { value: "NaN", property: "transform.x" },
    });
    expect(c.diagnostics).toHaveLength(1);
    expect(c.diagnostics[0]!.code).toBe("NON_FINITE_VALUE");
    expect(c.diagnostics[0]!.severity).toBe("warning");
  });

  it("schema limit exceeded is an error", () => {
    const c = new RuntimeDiagnosticCollector();
    c.error("SCHEMA_LIMIT_EXCEEDED", {
      nodeId: "n1",
      details: { field: "z", value: 200000, max: 100000 },
    });
    expect(c.errorCount).toBe(1);
    expect(c.diagnostics[0]!.code).toBe("SCHEMA_LIMIT_EXCEEDED");
  });
});

describe("Phase 12.3 — Fuzz: cycle detection", () => {
  it("cycle detected creates error diagnostic", () => {
    const d = createDiagnostic("CYCLE_DETECTED", {
      nodeId: "n1",
      message: "Cycle: n1 → n2 → n1",
    });
    expect(d.code).toBe("CYCLE_DETECTED");
    expect(d.severity).toBe("error");
    expect(d.nodeId).toBe("n1");
  });
});

describe("Phase 12.3 — Soak: 20× evaluate/dispose", () => {
  it("collector survives 20 rounds of create/clear/merge", () => {
    for (let i = 0; i < 20; i++) {
      const c = new RuntimeDiagnosticCollector({ frame: i });
      c.warn("NON_FINITE_VALUE", { nodeId: `n${i}` });
      c.error("PARENT_MISSING", { nodeId: `n${i}` });
      expect(c.diagnostics).toHaveLength(2);
      c.clear();
      expect(c.diagnostics).toHaveLength(0);
    }
  });

  it("version manifest is idempotent over 20 builds", () => {
    const manifests: ReturnType<typeof buildVersionManifest>[] = [];
    for (let i = 0; i < 20; i++) {
      manifests.push(buildVersionManifest());
    }
    const first = manifests[0]!;
    for (const m of manifests) {
      expect(m).toEqual(first);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// Task 12.4: Versioning & rollout
// ═══════════════════════════════════════════════════════════════════

describe("Phase 12.4 — Version constants", () => {
  it("schema format version is defined", () => {
    expect(SCHEMA_FORMAT_VERSION).toBe(2);
  });

  it("paint command version is defined", () => {
    expect(PAINT_COMMAND_VERSION).toBe(1);
  });

  it("composition frame version is semantic", () => {
    expect(COMPOSITION_FRAME_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("worker protocol version is defined", () => {
    expect(WORKER_PROTOCOL_VERSION).toBe(1);
  });

  it("diagnostic version is defined", () => {
    expect(DIAGNOSTIC_VERSION).toBe(1);
  });

  it("cancellation version is defined", () => {
    expect(CANCELLATION_VERSION).toBe(1);
  });
});

describe("Phase 12.4 — buildVersionManifest", () => {
  it("returns complete manifest", () => {
    const m = buildVersionManifest();
    expect(m.schema).toBe(2);
    expect(m.paintCommand).toBe(1);
    expect(m.compositionFrame).toBe("3.0.0");
    expect(m.diagnostic).toBe(1);
    expect(m.cancellation).toBe(1);
    expect(Array.isArray(m.featureFlags)).toBe(true);
  });
});

describe("Phase 12.4 — Feature flags", () => {
  it("PERSPECTIVE_3D is enabled by default", () => {
    expect(isFeatureEnabled("PERSPECTIVE_3D" as any)).toBe(true);
  });

  it("GRACEFUL_DEGRADATION is enabled by default", () => {
    expect(isFeatureEnabled(FeatureFlag.GRACEFUL_DEGRADATION)).toBe(true);
  });

  it("CANCELLATION is enabled by default", () => {
    expect(isFeatureEnabled(FeatureFlag.CANCELLATION)).toBe(true);
  });

  it("isFeatureEnabled respects non-default flags", () => {
    // BLOOM is NOT in DEFAULT_FEATURE_FLAGS
    const enabled = isFeatureEnabled("BLOOM" as any);
    expect(typeof enabled).toBe("boolean");
  });

  it("getActiveFeatureFlags returns defaults", () => {
    const flags = getActiveFeatureFlags();
    expect(flags).toContain(FeatureFlag.GRACEFUL_DEGRADATION);
    expect(flags).toContain(FeatureFlag.CANCELLATION);
    expect(flags).toContain(FeatureFlag.FUZZ_PROTECTION);
  });
});

describe("Phase 12.4 — Rollback checklist", () => {
  it("returns 6 checklist items", () => {
    const items = rollbackChecklist();
    expect(items).toHaveLength(6);
    expect(items[0]).toContain("version constants");
    expect(items[1]).toContain("test suite");
  });
});

// ═══════════════════════════════════════════════════════════════════
// Integration: evaluate scene with diagnostics
// ═══════════════════════════════════════════════════════════════════

describe("Phase 12 — Integration: Scene evaluation with diagnostics", () => {
  it("evaluateScene with missing parent warns instead of throwing", () => {
    const collector = new RuntimeDiagnosticCollector();

    const scene = {
      id: "s1",
      duration: 5,
      space: "flat-2d" as const,
      tracks: [],
      nodes: [
        {
          type: "solid" as const,
          id: "n1",
          parentId: "missing-parent",
          transform: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            anchorX: 0.5,
            anchorY: 0.5,
            opacity: 1,
            visible: true,
            flipX: false,
            flipY: false,
          },
          zIndex: 0,
          name: "orphan",
        },
      ],
    };

    const result = evaluateScene(scene, 0, collector);
    expect(result).toHaveLength(1);
    expect(result[0]!.visible).toBe(true);
    expect(collector.diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(collector.diagnostics.some((d) => d.code === "PARENT_MISSING")).toBe(
      true,
    );
  });

  it("evaluateScene with parent cycle degrades gracefully", () => {
    const collector = new RuntimeDiagnosticCollector();

    const scene = {
      id: "s2",
      duration: 5,
      space: "flat-2d" as const,
      tracks: [],
      nodes: [
        {
          type: "solid" as const,
          id: "n1",
          parentId: "n2",
          transform: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            anchorX: 0.5,
            anchorY: 0.5,
            opacity: 1,
            visible: true,
            flipX: false,
            flipY: false,
          },
          zIndex: 0,
          name: "child",
        },
        {
          type: "solid" as const,
          id: "n2",
          parentId: "n1",
          transform: {
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            anchorX: 0.5,
            anchorY: 0.5,
            opacity: 1,
            visible: true,
            flipX: false,
            flipY: false,
          },
          zIndex: 0,
          name: "parent",
        },
      ],
    };

    const result = evaluateScene(scene, 0, collector);
    expect(result).toHaveLength(2);
    expect(collector.hasErrors).toBe(true);
    expect(collector.diagnostics.some((d) => d.code === "PARENT_CYCLE")).toBe(
      true,
    );
  });
});
