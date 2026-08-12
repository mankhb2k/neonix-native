/**
 * V3 Project Normalizer — migration layer for legacy data.
 *
 * Handles automatic conversion of old v3 data shapes that predate the
 * component ownership contract:
 *
 *  1. Old component bindings (`nodeId` + `property`) → `targetId`
 *  2. Old `variants` as `z.record(JsonValue)` → `z.array(ComponentVariantV3)`
 *
 * The normalizer is designed to be called before `parseMotionProjectV3()`
 * on persisted / imported data. It produces the canonical shape expected
 * by the strict Zod schemas.
 *
 * All mutations are defensive — the input object is not modified.
 */

// ── Types for legacy shapes ────────────────────────────────────────────

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type LegacyComponentBinding = {
  kind: "component";
  componentId: string;
  nodeId: string;
  property: string;
};

type LegacyVariantsRecord = Record<string, JsonValue>;

type LegacyComponent = {
  id: string;
  nodes?: Array<{ id: string }>;
  publicTargets?: Array<{
    id: string;
    nodeId: string;
    property: string;
    name?: string;
  }>;
  variants?:
    | LegacyVariantsRecord
    | Array<{
        id: string;
        name: string;
        params?: Record<string, JsonValue>;
      }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

type LegacyProject = {
  components?: LegacyComponent[];
  bindings?: Array<{
    id: string;
    target: { kind: string } & Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>;
  scenes?: Array<{
    id: string;
    nodes?: Array<Record<string, unknown>>;
    clips?: Array<Record<string, unknown>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }>;
  timeline?: {
    visualTracks?: Array<{
      id: string;
      clips?: Array<{
        id: string;
        source?: Record<string, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
      }>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [key: string]: any;
    }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

// ── Normalization ──────────────────────────────────────────────────────

export interface NormalizeIssue {
  path: string;
  message: string;
  severity: "warn" | "info";
}

export interface NormalizeResult {
  project: LegacyProject;
  issues: NormalizeIssue[];
}

export interface NormalizeOptions {
  /**
   * Legacy compatibility escape hatch. When false, normalization will not
   * create a new public API surface from old nodeId/property bindings.
   */
  allowAutoPublicTargets?: boolean;
  /**
   * Opt-in migration for legacy component visual clips.
   *
   * When true, each visual clip whose `source.kind === "component"` is
   * rewritten into a scene-only clip: a new scene is synthesized containing
   * a single `type: "component"` node, the clip's `instanceTransform` is
   * folded into the node transform, and `instanceTransformTracks` become
   * scene-local motion clips targeting that node.
   *
   * When false (default), component visual clips are left untouched and will
   * fail strict parsing (visual tracks are scene-only in the current model).
   */
  migrateComponentClipsToScenes?: boolean;
}

/**
 * Normalize a potentially-legacy v3 project shape into the canonical
 * format expected by `MotionProjectV3Schema.parse()`.
 *
 * This is a pure function — the input is not mutated.
 */
export function normalizeMotionProjectV3(
  project: LegacyProject,
  options: NormalizeOptions = {},
): NormalizeResult {
  const issues: NormalizeIssue[] = [];
  // Deep-clone via JSON round-trip to avoid mutating the input.
  const normalized: LegacyProject = JSON.parse(JSON.stringify(project));

  normalizeComponentVariants(normalized, issues);
  normalizeComponentBindings(normalized, issues, options);

  if (options.migrateComponentClipsToScenes) {
    migrateComponentClipsToScenes(normalized, issues);
  }

  return { project: normalized, issues };
}

// ── Variant normalization ──────────────────────────────────────────────

function normalizeComponentVariants(
  project: LegacyProject,
  issues: NormalizeIssue[],
): void {
  if (!project.components) return;

  for (const component of project.components) {
    if (!component.variants) continue;

    // Already in array form — skip
    if (Array.isArray(component.variants)) continue;

    // Legacy: z.record(JsonValue) → convert to array
    const record = component.variants as LegacyVariantsRecord;
    const entries = Object.entries(record);
    if (entries.length === 0) {
      component.variants = [];
      continue;
    }

    const normalized = entries.map(([key, value]) => ({
      id: key,
      name: key,
      params:
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, JsonValue>)
          : { value },
    }));

    issues.push({
      path: `components.${component.id}.variants`,
      message: `Migrated ${entries.length} legacy record-style variants to typed variant array`,
      severity: "info",
    });

    component.variants = normalized;
  }
}

// ── Binding normalization ──────────────────────────────────────────────

function normalizeComponentBindings(
  project: LegacyProject,
  issues: NormalizeIssue[],
  options: NormalizeOptions,
): void {
  if (!project.bindings || !project.components) return;

  const componentById = new Map(project.components.map((c) => [c.id, c]));

  for (const binding of project.bindings) {
    const target = binding.target as { kind: string } & Record<string, unknown>;
    if (target.kind !== "component") continue;

    // Already using targetId — skip
    if ("targetId" in target && typeof target.targetId === "string") continue;

    // Legacy: nodeId + property → need to resolve to targetId
    const legacy = target as unknown as LegacyComponentBinding;
    if (!legacy.nodeId || !legacy.property) continue;

    const component = componentById.get(legacy.componentId);
    if (!component) {
      issues.push({
        path: `bindings.${binding.id}`,
        message: `Cannot migrate binding "${binding.id}": component "${legacy.componentId}" not found`,
        severity: "warn",
      });
      continue;
    }

    // Try to find matching publicTarget
    const publicTargets = component.publicTargets ?? [];
    const match = publicTargets.find(
      (pt) => pt.nodeId === legacy.nodeId && pt.property === legacy.property,
    );

    if (match) {
      // Found existing publicTarget — use its id
      delete (target as Record<string, unknown>).nodeId;
      delete (target as Record<string, unknown>).property;
      target.targetId = match.id;
      issues.push({
        path: `bindings.${binding.id}`,
        message: `Migrated binding "${binding.id}" from nodeId/property to targetId "${match.id}"`,
        severity: "info",
      });
    } else if (options.allowAutoPublicTargets) {
      // Compatibility mode only: explicit opt-in is required because this
      // expands the component owner's public surface.
      const generatedId = `auto-${legacy.nodeId}-${legacy.property.replace(/\./g, "-")}`;
      if (!component.publicTargets) {
        component.publicTargets = [];
      }
      component.publicTargets.push({
        id: generatedId,
        nodeId: legacy.nodeId,
        property: legacy.property,
        name: `${legacy.nodeId}.${legacy.property}`,
      });

      delete (target as Record<string, unknown>).nodeId;
      delete (target as Record<string, unknown>).property;
      target.targetId = generatedId;

      issues.push({
        path: `bindings.${binding.id}`,
        message: `Migrated binding "${binding.id}": auto-generated publicTarget "${generatedId}" for nodeId="${legacy.nodeId}" property="${legacy.property}"`,
        severity: "warn",
      });
    } else {
      issues.push({
        path: `bindings.${binding.id}`,
        message: `Cannot migrate binding "${binding.id}": component "${legacy.componentId}" does not expose nodeId="${legacy.nodeId}" property="${legacy.property}" as a publicTarget`,
        severity: "warn",
      });
    }
  }
}

// ── Component clip migration ──────────────────────────────────────────

const COMPONENT_NODE_DEFAULT_TRANSFORM: Record<string, unknown> = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  anchorX: 0.5,
  anchorY: 0.5,
  opacity: 1,
  visible: true,
  flipX: false,
  flipY: false,
};

function migrateComponentClipsToScenes(
  project: LegacyProject,
  issues: NormalizeIssue[],
): void {
  const timeline = project.timeline;
  if (!timeline || !Array.isArray(timeline.visualTracks)) return;

  if (!Array.isArray(project.scenes)) project.scenes = [];

  for (const track of timeline.visualTracks) {
    if (!track || !Array.isArray(track.clips)) continue;

    for (const clip of track.clips) {
      const source = clip.source;
      if (!source || source.kind !== "component") continue;

      const componentId = source.componentId;
      if (typeof componentId !== "string" || componentId.length === 0) {
        issues.push({
          path: `timeline.visualTracks.${track.id}.clips.${clip.id}`,
          message: `Cannot migrate component clip "${clip.id}": missing componentId`,
          severity: "warn",
        });
        continue;
      }

      // Deterministic, collision-free-enough ids derived from the component.
      const sceneId = `${componentId}-scene`;
      const nodeId = `${componentId}-instance`;
      const clipDuration =
        typeof clip.duration === "number" ? clip.duration : 1;

      // Fold legacy instanceTransform into the node transform.
      const instanceTransform = clip.instanceTransform as
        | Record<string, unknown>
        | undefined;
      const transform = {
        ...COMPONENT_NODE_DEFAULT_TRANSFORM,
        ...(instanceTransform ?? {}),
      };

      // Convert instanceTransformTracks → scene-local motion clips.
      const instanceTracks = clip.instanceTransformTracks as
        | Array<Record<string, unknown>>
        | undefined;
      const sceneClips: Array<Record<string, unknown>> = [];
      if (Array.isArray(instanceTracks) && instanceTracks.length > 0) {
        sceneClips.push({
          id: `${nodeId}__motion`,
          targetId: nodeId,
          schedule: { kind: "absolute", at: 0 },
          duration: clipDuration,
          source: {
            kind: "tracks",
            tracks: instanceTracks.map((t) => ({
              targetId: nodeId,
              property: t.property,
              ...(t.valueKind !== undefined ? { valueKind: t.valueKind } : {}),
              ...(t.preBehavior !== undefined
                ? { preBehavior: t.preBehavior }
                : {}),
              ...(t.postBehavior !== undefined
                ? { postBehavior: t.postBehavior }
                : {}),
              keys: t.keys,
            })),
          },
        });
      }

      project.scenes!.push({
        id: sceneId,
        name: componentId,
        duration: clipDuration,
        nodes: [
          {
            id: nodeId,
            type: "component",
            parentId: null,
            transform,
            payload: { componentId },
          },
        ],
        clips: sceneClips,
      });

      // Rewrite the visual clip to a scene source.
      clip.source = { kind: "scene", sceneId };
      delete clip.instanceTransform;
      delete clip.instanceTransformTracks;

      issues.push({
        path: `timeline.visualTracks.${track.id}.clips.${clip.id}`,
        message: `Migrated component visual clip "${clip.id}" to scene "${sceneId}" with component node "${nodeId}"`,
        severity: "info",
      });
    }
  }
}

/**
 * Check whether a project needs normalization.
 * Returns true if any legacy shapes are detected.
 */
export function needsNormalization(project: LegacyProject): boolean {
  // Check for legacy record-style variants
  if (
    project.components?.some((c) => c.variants && !Array.isArray(c.variants))
  ) {
    return true;
  }

  // Check for legacy component bindings (nodeId/property without targetId)
  if (
    project.bindings?.some((b) => {
      const t = b.target as Record<string, unknown>;
      return t.kind === "component" && !("targetId" in t);
    })
  ) {
    return true;
  }

  // Check for legacy component visual clips
  if (
    project.timeline?.visualTracks?.some((track) =>
      track.clips?.some((clip) => clip.source?.kind === "component"),
    )
  ) {
    return true;
  }

  return false;
}
