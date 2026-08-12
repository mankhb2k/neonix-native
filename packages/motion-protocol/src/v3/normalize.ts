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

import type { JsonValue } from "../values";

// ── Types for legacy shapes ────────────────────────────────────────────

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

/**
 * Normalize a potentially-legacy v3 project shape into the canonical
 * format expected by `MotionProjectV3Schema.parse()`.
 *
 * This is a pure function — the input is not mutated.
 */
export function normalizeMotionProjectV3(
  project: LegacyProject,
): NormalizeResult {
  const issues: NormalizeIssue[] = [];
  // Deep-clone via JSON round-trip to avoid mutating the input.
  const normalized: LegacyProject = JSON.parse(JSON.stringify(project));

  normalizeComponentVariants(normalized, issues);
  normalizeComponentBindings(normalized, issues);

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
    } else {
      // Auto-generate a publicTarget entry
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

  return false;
}
