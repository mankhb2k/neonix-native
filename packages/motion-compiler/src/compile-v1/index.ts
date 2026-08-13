/**
 * Phase 6 — Compiler V1 entry point.
 *
 * `compileMotionProjectV1()` compiles a `MotionProjectV1` authoring project
 * directly into the runtime IR (`MotionRuntimeProject`) — no intermediate
 * project shape is built:
 *
 *   composition            → runtime metadata (aspectRatio derived from
 *                            dimensions, fps, background as brand color)
 *   project.layers         → runtime `layers` (flat parentLayerId graph)
 *   root audio layers      → runtime audio layers on the same `layers` list
 *   variables / bindings   → resolved inline before layer compilation
 *   component layers        → sealed wrapper-group expansion in the layer
 *                            graph
 *
 * Semantic problems are reported with the `CMP_*` diagnostic family so
 * callers can surface structured errors instead of string exceptions.
 *
 * Note on options: `textMeasurementProvider` / `assetMetadataProvider`
 * are reserved for the runtime evaluator — the compiler uses built-in
 * text measurement, so these are accepted but not consumed.
 */

import { createHash } from "node:crypto";
import {
  canonicalJson,
  computeRuntimeHash,
  computeProjectHash,
  MotionRuntimeProjectSchema,
  MOTION_RUNTIME_VERSION,
  buildCapabilityFingerprint,
  preflightProjectCapabilities,
  canonicalizeTimelineDurationV1,
  CAPABILITY_MANIFEST_VERSION_V1,
  type MotionRuntimeProject,
  V1,
} from "@motionvideo/motion-protocol";
import {
  DiagnosticCollector,
  compileSuccess,
  compileFailure,
  type CompileResult,
} from "../compile-result";
import { compileLayerGraphToRuntime } from "../compile-layer-graph";
import { clone, deriveAspectRatio, toRuntimeProperty } from "./helpers";
import { prepareRuntimeAsset, prepareRuntimeAudioLayer } from "./prepare";
import { resolvePropTargets } from "./components";
import { buildLayerPlan } from "./layer-plan";
import { validateV1Semantics } from "./semantics";

export { detectScheduleCycles } from "./semantics";

export type CompileV1Profile = "embedded-components" | "flattened-components";

export type CompileV1Options = {
  /**
   * Component compile strategy.
   * - `embedded-components` (default): component definitions are expanded
   *   into the runtime layer graph at compile time.
   * - `flattened-components`: reserved — flattens component assets into
   *   the runtime asset list (Phase 7).
   */
  profile?: CompileV1Profile;
  /** Reserved for Phase 7 — text measurement override. */
  textMeasurementProvider?: unknown;
  /** Reserved for Phase 7 — asset metadata (duration/dimensions) resolver. */
  assetMetadataProvider?: (
    assetId: string,
  ) => { duration?: number; width?: number; height?: number } | undefined;
};

/**
 * Compiler version for v1 compilation. Separate from the legacy
 * `COMPILER_VERSION` so cache keys never collide across pipelines.
 */
export const COMPILER_VERSION_V1 = "3.0.0-phase11";

/**
 * Compile a `MotionProjectV1` into the runtime IR with structured
 * diagnostics.
 *
 * Compiles `project.layers` into one runtime layer graph.
 * Root audio layers become runtime audio layers. Animation tracks live on
 * `project.tracks`.
 *
 * Returns `{ ok: true, project }` on success or `{ ok: false, diagnostics }`
 * when the project fails semantic validation (CMP_* codes) or the runtime
 * IR cannot be produced.
 */
export function compileMotionProjectV1(
  project: V1.MotionProjectV1,
  options: CompileV1Options = {},
): CompileResult<MotionRuntimeProject> {
  void options;
  const collector = new DiagnosticCollector();

  // Materialize defaults + reject structurally invalid v1 projects.
  const parsed = V1.MotionProjectV1Schema.safeParse(project);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      collector.error("RUNTIME_VALIDATION_ERROR", issue.message, {
        path: issue.path,
        details: { zodCode: issue.code },
      });
    }
    return compileFailure([...collector.diagnostics]);
  }
  let normalized = parsed.data;

  // ── Timeline duration derivation ─────────────────────────────────
  // Authoring input may omit `timeline.duration`. Derive it from the last
  // timeline content end before semantic validation and runtime emit so the
  // emitted runtime IR always carries an explicit duration.
  const durationCanonical = canonicalizeTimelineDurationV1(normalized);
  for (const issue of durationCanonical.issues) {
    collector.warn("CMP_TIMELINE_DURATION_DERIVED", issue.message, {
      path: [issue.path],
    });
  }
  normalized = durationCanonical.project;

  // ── Capability preflight (Phase 11) ──────────────────────────────
  const capabilityCheck = preflightProjectCapabilities(normalized);
  for (const capId of capabilityCheck.undeclared) {
    collector.warn(
      "CAP_UNDECLARED_CAPABILITY",
      `Project uses capability "${capId}" but it is not declared in capabilities.required`,
      {
        path: ["capabilities", "required"],
        details: { capabilityId: capId },
      },
    );
  }
  for (const capId of capabilityCheck.experimentalInUse) {
    collector.error(
      "CAP_EXPERIMENTAL_IN_USE",
      `Project uses experimental capability "${capId}". Opt in via capabilities.experimental or a feature flag.`,
      {
        path: ["capabilities", "experimental"],
        details: { capabilityId: capId },
      },
    );
  }
  if (collector.hasErrors) {
    return compileFailure([...collector.diagnostics]);
  }

  // Semantic validation → CMP_* diagnostics.
  validateV1Semantics(normalized, collector);
  if (collector.hasErrors) {
    return compileFailure([...collector.diagnostics]);
  }

  // Build the visual plan from project.layers.
  const { graph, componentInstances, audioLayers } = buildLayerPlan(
    normalized,
    collector,
  );
  if (collector.hasErrors) {
    return compileFailure([...collector.diagnostics]);
  }

  const warnings = [...collector.diagnostics].filter(
    (diagnostic) => diagnostic.severity !== "error",
  );

  try {
    // ── Build runtime shapes directly from V1 project ──

    const comp = normalized.composition;
    const brand: Record<string, unknown> = {
      name: normalized.metadata.name ?? "Default",
    };
    if (comp.background !== "#ffffff") {
      brand.primaryColor = comp.background;
    }
    const metadata: Record<string, unknown> = {
      id: normalized.metadata.id,
      name: normalized.metadata.name,
      aspectRatio: deriveAspectRatio(comp.width, comp.height),
      fps: comp.fps,
      locale: "vi-VN",
      brand,
    };
    if (normalized.metadata.industry)
      metadata.industry = normalized.metadata.industry;
    if (normalized.metadata.description)
      metadata.description = normalized.metadata.description;
    if (normalized.metadata.createdAt)
      metadata.createdAt = normalized.metadata.createdAt;
    if (normalized.metadata.updatedAt)
      metadata.updatedAt = normalized.metadata.updatedAt;
    if (comp.safeArea) {
      metadata.safeArea = { platform: "generic", ...comp.safeArea };
    }

    const composition: Record<string, unknown> = {
      width: comp.width,
      height: comp.height,
      fps: comp.fps,
      background: comp.background,
      colorSpace: comp.colorSpace,
      audioSampleRate: comp.audioSampleRate,
      ...(comp.safeArea
        ? { safeArea: { platform: "generic", ...comp.safeArea } }
        : {}),
    };

    const runtimeAssets = normalized.assets.map(prepareRuntimeAsset);

    // Project variables for binding injection
    const projectVariables = new Map<string, unknown>(
      normalized.variables.map((v) => [v.id, clone(v.value)] as const),
    );

    // Component instances tracked during buildLayerPlan: componentLayerId →
    // { componentId, runtimeGraphId }. Used to validate component bindings.
    // Component/componentLayer bindings are prop sources applied during
    // expand — they do not write onto expanded internals here.
    const components = new Map(
      normalized.components.map((c) => [c.id, c] as const),
    );

    const runtimeBindings: Array<{
      id: string;
      source: { variableId: string };
      target: { graphId: string; layerId: string; property: string };
    }> = [];
    for (const binding of normalized.bindings) {
      const target = binding.target;
      if (target.type === "layer") {
        runtimeBindings.push({
          id: binding.id,
          source: { variableId: binding.source.variableId },
          target: {
            graphId: "root",
            layerId: target.layerId,
            property: toRuntimeProperty(target.property),
          },
        });
        continue;
      }
      if (target.type === "componentLayer") {
        const instance = componentInstances.get(target.layerId);
        if (!instance) {
          collector.warn(
            "CMP_UNRESOLVED_COMPONENT",
            `Binding "${binding.id}" targets component layer "${target.layerId}" but no component instance exists at that layer`,
            {
              path: ["bindings", binding.id],
              details: { bindingId: binding.id, layerId: target.layerId },
            },
          );
          continue;
        }
        const component = components.get(instance.componentId);
        const leaves = component
          ? resolvePropTargets(
              components,
              component,
              target.propId,
              instance.componentLayerId,
            )
          : [];
        if (leaves.length === 0) {
          collector.error(
            "CMP_PRIVATE_COMPONENT_ACCESS",
            `Binding "${binding.id}" targets component layer "${target.layerId}" prop "${target.propId}" which has no layerProperty binding`,
            {
              path: ["bindings", binding.id],
              details: {
                bindingId: binding.id,
                componentId: instance.componentId,
                propId: target.propId,
              },
            },
          );
          continue;
        }
        continue;
      }
      // Global component binding — project-tree instances only.
      // Nested instances are not registered in componentInstances; they
      // receive values only via parent childProp forwards.
      const instances = [...componentInstances.values()].filter(
        (instance) => instance.componentId === target.componentId,
      );
      if (instances.length === 0) {
        collector.warn(
          "CMP_UNRESOLVED_COMPONENT",
          `Binding "${binding.id}" targets component "${target.componentId}" but no component layer instantiates it`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              componentId: target.componentId,
            },
          },
        );
        continue;
      }
      const component = components.get(target.componentId);
      const instanceLeaves = instances.map((instance) =>
        component
          ? resolvePropTargets(
              components,
              component,
              target.propId,
              instance.componentLayerId,
            )
          : [],
      );
      if (instanceLeaves.every((leaves) => leaves.length === 0)) {
        collector.error(
          "CMP_PRIVATE_COMPONENT_ACCESS",
          `Binding "${binding.id}" targets component "${target.componentId}" prop "${target.propId}" which has no layerProperty binding`,
          {
            path: ["bindings", binding.id],
            details: {
              bindingId: binding.id,
              componentId: target.componentId,
              propId: target.propId,
            },
          },
        );
        continue;
      }
      continue;
    }

    // Fail early if binding resolution produced errors.
    if (collector.hasErrors) {
      return compileFailure([...collector.diagnostics]);
    }

    for (const binding of runtimeBindings) {
      const layers = (graph.layers ?? []) as Array<Record<string, unknown>>;
      const target = layers.find(
        (n: Record<string, unknown>) => n.id === binding.target.layerId,
      );
      if (target && projectVariables.has(binding.source.variableId)) {
        const parts = binding.target.property.split(".");
        let cursor: Record<string, unknown> = target;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i]!;
          if (!cursor[part] || typeof cursor[part] !== "object") {
            cursor[part] = {};
          }
          cursor = cursor[part] as Record<string, unknown>;
        }
        const last = parts[parts.length - 1]!;
        cursor[last] = projectVariables.get(binding.source.variableId);
      }
    }

    const duration = normalized.timeline.duration ?? 0;
    const compiledGraph =
      duration > 0
        ? compileLayerGraphToRuntime({
            id: graph.id as string,
            duration: graph.duration as number,
            layers: (graph.layers ?? []) as Parameters<
              typeof compileLayerGraphToRuntime
            >[0]["layers"],
            clips: (graph.clips ?? []) as Parameters<
              typeof compileLayerGraphToRuntime
            >[0]["clips"],
            variables: projectVariables,
          })
        : null;
    const visualLayers = compiledGraph?.layers ?? [];
    const tracks = compiledGraph?.tracks ?? [];
    const audioRuntimeLayers = audioLayers
      .slice()
      .sort((a, b) => a.zIndex - b.zIndex)
      .map(prepareRuntimeAudioLayer);

    const sourceRefIndex: Record<string, string> = {};
    for (const layer of [...visualLayers, ...audioRuntimeLayers]) {
      const id = (layer as { id: string }).id;
      sourceRefIndex[id] = `layers:${id}`;
    }

    const ir = {
      format: "motion-runtime" as const,
      formatVersion: 1 as const,
      runtimeVersion: MOTION_RUNTIME_VERSION,
      metadata,
      assets: runtimeAssets,
      composition,
      compilerVersion: COMPILER_VERSION_V1,
      capabilityFingerprint: buildCapabilityFingerprint(
        CAPABILITY_MANIFEST_VERSION_V1,
      ),
      ...(compiledGraph?.space ? { space: compiledGraph.space } : {}),
      ...(compiledGraph?.motionBlur
        ? { motionBlur: compiledGraph.motionBlur }
        : {}),
      ...(compiledGraph?.drivers && compiledGraph.drivers.length > 0
        ? { drivers: compiledGraph.drivers }
        : {}),
      ...(compiledGraph?.activeCameraLayerId
        ? { activeCameraLayerId: compiledGraph.activeCameraLayerId }
        : {}),
      layers: [...visualLayers, ...audioRuntimeLayers],
      tracks,
      timeline: {
        duration,
      },
      ...(Object.keys(sourceRefIndex).length > 0
        ? { sourceRef: { layers: sourceRefIndex } }
        : {}),
    };

    const validated = MotionRuntimeProjectSchema.parse({
      ...ir,
      runtimeHash: computeRuntimeHash(ir as unknown as Record<string, unknown>),
    });

    return compileSuccess(validated, warnings);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "issues" in err) {
      const zodErr = err as {
        issues: Array<{
          path: (string | number)[];
          message: string;
          code: string;
        }>;
      };
      for (const issue of zodErr.issues) {
        collector.error("RUNTIME_VALIDATION_ERROR", issue.message, {
          path: issue.path,
          details: { zodCode: issue.code },
        });
      }
    } else if (err instanceof Error) {
      const msg = err.message;
      if (msg.includes("Unknown variable reference")) {
        collector.error("UNKNOWN_VARIABLE", msg);
      } else if (msg.includes("Unknown clip target")) {
        collector.error("UNKNOWN_CLIP_TARGET", msg);
      } else if (msg.includes("Unknown timeline marker")) {
        collector.error("UNKNOWN_MARKER", msg);
      } else {
        collector.error("COMPILE_ERROR", msg);
      }
    }
    return compileFailure([...collector.diagnostics]);
  }
}

/**
 * Deterministic cache key for a v1 compile.
 *
 * Key = projectHash | compilerVersion | protocolVersion | capabilities |
 *       componentDependencyHashes.
 *
 * Phase 12: Uses computeProjectHash (strips provenance/extensions/timestamps)
 * and MOTION_PROJECT_V1_FORMAT_VERSION instead of hardcoded "1".
 */
export function buildCompileCacheKeyV1(
  project: V1.MotionProjectV1,
  options: CompileV1Options = {},
): string {
  const parsed = V1.MotionProjectV1Schema.safeParse(project);
  const normalized = parsed.success ? parsed.data : project;

  const projectHash = computeProjectHash(
    normalized as unknown as Record<string, unknown>,
  ).slice(0, 16);

  const capabilitiesHash = createHash("sha256")
    .update(
      canonicalJson({
        required: normalized.capabilities.required ?? [],
        optional: normalized.capabilities.optional ?? [],
        experimental: normalized.capabilities.experimental ?? [],
      }),
    )
    .digest("hex")
    .slice(0, 8);

  const componentDeps = normalized.dependencies.components
    .map((dep) => `${dep.componentId}@${dep.version}:${dep.integrity ?? ""}`)
    .sort()
    .join(",");
  const componentHash = createHash("sha256")
    .update(componentDeps)
    .digest("hex")
    .slice(0, 8);

  const profile = options.profile ?? "embedded-components";
  return [
    `proj:${projectHash}`,
    `compiler:${COMPILER_VERSION_V1}`,
    `protocol:${V1.MOTION_PROJECT_V1_FORMAT_VERSION}`,
    `caps:${capabilitiesHash}`,
    `deps:${componentHash}`,
    `profile:${profile}`,
  ].join("|");
}
