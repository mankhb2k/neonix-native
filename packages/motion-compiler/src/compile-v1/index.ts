/**
 * Phase 6 — Compiler V1 entry point.
 *
 * `compileMotionProjectV1()` compiles a `MotionProjectV1` authoring project
 * directly into the runtime IR (`MotionRuntimeProject`) — no intermediate
 * project shape is built:
 *
 *   composition            → runtime metadata (aspectRatio derived from
 *                            dimensions, fps, background as brand color)
 *   timeline.visualTracks  → visual plan (one scene instance per visual
 *                            clip, sorted by unique track `order`)
 *   scene clips            → runtime tracks (compiled directly)
 *   variables / bindings   → resolved inline before scene compilation
 *   component layers        → sealed wrapper-group expansion in the scene
 *                            graph (not a timeline clip source)
 *   caption tracks         → copied through
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
import { compileSceneToRuntime } from "../compile-scene";
import { clone, deriveAspectRatio, toRuntimeProperty } from "./helpers";
import { prepareRuntimeAsset, prepareRuntimeAudioTrack } from "./prepare";
import { resolvePropTargets } from "./components";
import { buildVisualPlan } from "./visual-plan";
import { validateV1Semantics } from "./semantics";

export { detectScheduleCycles } from "./semantics";

export type CompileV1Profile = "embedded-components" | "flattened-components";

export type CompileV1Options = {
  /**
   * Component compile strategy.
   * - `embedded-components` (default): component definitions are expanded
   *   into runtime scenes at compile time.
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
 * Compiles scenes directly from `timeline.visualTracks` — no intermediate
 * project shape is built. Scene ordering is driven by visual track clip
 * order; component clips synthesize runtime scenes from embedded definitions.
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

  // Build the visual plan from timeline.visualTracks.
  const { tracks, sceneOverrides, componentInstances } = buildVisualPlan(
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

    // Component instances tracked during buildVisualPlan: componentLayerId →
    // { componentId, runtimeSceneId }. Used to validate component bindings.
    // Component/componentLayer bindings are prop sources applied during
    // expand — they do not write onto expanded internals here.
    const components = new Map(
      normalized.components.map((c) => [c.id, c] as const),
    );

    const runtimeBindings: Array<{
      id: string;
      source: { variableId: string };
      target: { sceneId: string; layerId: string; property: string };
    }> = [];
    for (const binding of normalized.bindings) {
      const target = binding.target;
      if (target.kind === "scene") {
        runtimeBindings.push({
          id: binding.id,
          source: { variableId: binding.source.variableId },
          target: {
            sceneId: target.sceneId,
            layerId: target.layerId,
            property: toRuntimeProperty(target.property),
          },
        });
        continue;
      }
      if (target.kind === "componentLayer") {
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
      // Global component binding — scene-level instances only.
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

    // Compile each scene from the visual plan (flat across all tracks).
    const allEntries = tracks.flatMap((t) => t.entries);
    const compiledScenes = allEntries.map((entry) => {
      const scene = sceneOverrides.get(entry.sceneId);
      if (!scene) {
        collector.error(
          "CMP_CLIP_TARGET_MISSING",
          `Scene "${entry.sceneId}" in visual plan but missing from overrides`,
          {
            path: ["timeline", "visualTracks"],
            details: { sceneId: entry.sceneId },
          },
        );
        throw new Error(`Missing scene: ${entry.sceneId}`);
      }
      const variables = new Map(projectVariables);

      const sceneBindings = runtimeBindings.filter(
        (b) => b.target.sceneId === entry.sceneId,
      );
      // kind: scene only — writes authoring scene layers (text/shape), never
      // component internals. Component props were resolved before expand.
      for (const binding of sceneBindings) {
        const layers = (scene.layers ?? []) as Array<Record<string, unknown>>;
        const target = layers.find(
          (n: Record<string, unknown>) => n.id === binding.target.layerId,
        );
        if (target && variables.has(binding.source.variableId)) {
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
          cursor[last] = variables.get(binding.source.variableId);
        }
      }

      return compileSceneToRuntime({
        id: scene.id as string,
        duration: scene.duration as number,
        layers: (scene.layers ?? []) as Parameters<
          typeof compileSceneToRuntime
        >[0]["layers"],
        clips: (scene.clips ?? []) as Parameters<
          typeof compileSceneToRuntime
        >[0]["clips"],
        variables,
        markers: scene.markers as Array<{ id: string; t: number }> | undefined,
        space: scene.space as
          | Parameters<typeof compileSceneToRuntime>[0]["space"]
          | undefined,
        motionBlur: scene.motionBlur as
          | Parameters<typeof compileSceneToRuntime>[0]["motionBlur"]
          | undefined,
        drivers: scene.drivers as
          | Parameters<typeof compileSceneToRuntime>[0]["drivers"]
          | undefined,
        activeCameraLayerId: scene.activeCameraLayerId as string | undefined,
        sourceRef: scene.sourceRef as
          | NonNullable<
              Parameters<typeof compileSceneToRuntime>[0]["sourceRef"]
            >
          | undefined,
      });
    });

    // Build visualTracks runtime model — one runtime track per V1 track.
    const visualTracks = tracks.map((planTrack) => {
      const clips = planTrack.entries.map((entry) => {
        const scene = sceneOverrides.get(entry.sceneId)!;
        const duration = scene.duration as number;
        const clip: Record<string, unknown> = {
          id: entry.clipId,
          source: { kind: "scene" as const, sceneId: entry.sceneId },
          start: entry.start,
          duration,
        };
        if (entry.trimStart !== undefined) clip.trimStart = entry.trimStart;
        if (entry.playbackRate !== undefined)
          clip.playbackRate = entry.playbackRate;
        if (entry.loop !== false) clip.loop = entry.loop;
        if (entry.opacity !== 1) clip.opacity = entry.opacity;
        return clip;
      });
      return {
        id: planTrack.trackId,
        order: planTrack.order,
        ...(planTrack.muted !== undefined && planTrack.muted !== false
          ? { muted: planTrack.muted }
          : {}),
        clips,
      };
    });

    const sourceRefIndex: Record<string, string> = {};
    for (const scene of compiledScenes) {
      const srcRef = scene.sourceRef;
      if (!srcRef) continue;
      sourceRefIndex[scene.id] = srcRef.sourceModule
        ? `${srcRef.projectPath.join(":")}#${srcRef.sourceModule}`
        : srcRef.projectPath.join(":");
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
      timeline: {
        duration: normalized.timeline.duration,
        audioTracks: normalized.timeline.audioTracks.map(
          prepareRuntimeAudioTrack,
        ),
        captionTracks: clone(normalized.timeline.captionTracks),
        visualTracks,
      },
      sourceRef: { scenes: sourceRefIndex },
      scenes: compiledScenes,
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
      } else if (msg.includes("Unknown scene marker")) {
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
