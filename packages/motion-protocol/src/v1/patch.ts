/**
 * V1 Native Patch Contract — safe editor surface for AI agents and MCP tools.
 *
 * Design principles:
 *  1. Every operation maps to a V1-first path (`project.layers`).
 *  2. Diagnostics are structured (path + message + severity), never raw throws.
 *  3. Patch output is always re-validated with `MotionProjectV1Schema`.
 *  4. Idempotent by design — applying the same patch twice yields the same
 *     result (or a no-op diagnostic).
 */

import { z } from "zod";
import type { MotionProjectV1 } from "./project";
import { MotionProjectV1Schema } from "./project";
import { IdSchema, FiniteNumberSchema } from "./common";
import { CompositionSettingsSchema } from "./composition";
import { DesignTokensSchema } from "./variables";
import { LayerV1Schema, flattenLayerTree, type LayerV1 } from "./layers";
import { AssetV1Schema } from "./assets";
import { ProjectVariableV1Schema } from "./variables";
import { ProjectBindingV1Schema } from "./variables";

export const MOTION_PROJECT_V1_PATCH_FORMAT_VERSION = 1 as const;

export interface V1PatchDiagnostic {
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface V1PatchResult {
  project: MotionProjectV1 | null;
  diagnostics: V1PatchDiagnostic[];
}

function diagnostic(
  path: string,
  message: string,
  severity: "error" | "warning" = "error",
): V1PatchDiagnostic {
  return { path, message, severity };
}

export const V1PatchSetCompositionSchema = z
  .object({
    op: z.literal("setComposition"),
    changes: CompositionSettingsSchema.partial(),
  })
  .strict();

export const V1PatchSetTokensSchema = z
  .object({
    op: z.literal("setTokens"),
    changes: DesignTokensSchema.partial(),
  })
  .strict();

export const V1PatchAddLayerSchema = z
  .object({
    op: z.literal("addLayer"),
    layer: LayerV1Schema,
    insertAt: z.number().int().nonnegative().optional(),
  })
  .strict();

export const V1PatchUpdateLayerSchema = z
  .object({
    op: z.literal("updateLayer"),
    layerId: IdSchema,
    layer: LayerV1Schema,
  })
  .strict();

export const V1PatchRemoveLayerSchema = z
  .object({
    op: z.literal("removeLayer"),
    layerId: IdSchema,
  })
  .strict();

export const V1PatchTrimLayerSchema = z
  .object({
    op: z.literal("trimLayer"),
    layerId: IdSchema,
    start: FiniteNumberSchema.nonnegative().optional(),
    duration: FiniteNumberSchema.positive().optional(),
  })
  .strict();

export const V1PatchAssetSchema = z
  .object({
    op: z.enum(["addAsset", "updateAsset"]),
    asset: AssetV1Schema,
  })
  .strict();

export const V1PatchVariableSchema = z
  .object({
    op: z.enum(["addVariable", "updateVariable"]),
    variable: ProjectVariableV1Schema,
  })
  .strict();

export const V1PatchBindingSchema = z
  .object({
    op: z.enum(["addBinding", "updateBinding"]),
    binding: ProjectBindingV1Schema,
  })
  .strict();

export const V1PatchSetValueSchema = z
  .object({
    op: z.literal("setValue"),
    path: z.string().min(1).max(256),
    value: z.unknown(),
  })
  .strict();

export const V1PatchOpSchema = z.discriminatedUnion("op", [
  V1PatchSetCompositionSchema,
  V1PatchSetTokensSchema,
  V1PatchAddLayerSchema,
  V1PatchUpdateLayerSchema,
  V1PatchRemoveLayerSchema,
  V1PatchTrimLayerSchema,
  V1PatchAssetSchema,
  V1PatchVariableSchema,
  V1PatchBindingSchema,
  V1PatchSetValueSchema,
]);

export type V1PatchOp = z.infer<typeof V1PatchOpSchema>;

export const MotionProjectV1PatchSchema = z
  .object({
    format: z.literal("motion-project-patch"),
    formatVersion: z.literal(MOTION_PROJECT_V1_PATCH_FORMAT_VERSION),
    baseRevision: FiniteNumberSchema.int().nonnegative(),
    operations: z.array(V1PatchOpSchema).min(1).max(1000),
  })
  .strict();

export type MotionProjectV1Patch = z.infer<typeof MotionProjectV1PatchSchema>;

function clone(project: MotionProjectV1): MotionProjectV1 {
  return JSON.parse(JSON.stringify(project)) as MotionProjectV1;
}

function layerIds(layers: LayerV1[]): Set<string> {
  return new Set(flattenLayerTree(layers).map((layer) => layer.id));
}

function insertIntoGroup(
  nodes: LayerV1[],
  parentId: string,
  child: LayerV1,
  insertAt?: number,
): LayerV1[] | null {
  return nodes.map((node) => {
    if (node.id === parentId) {
      if (node.type !== "group") return node;
      const children = [...node.children];
      children.splice(insertAt ?? children.length, 0, child);
      return { ...node, children };
    }
    if (node.type === "group") {
      return {
        ...node,
        children: insertIntoGroup(node.children, parentId, child, insertAt) ?? node.children,
      };
    }
    return node;
  });
}

function replaceLayer(
  nodes: LayerV1[],
  layerId: string,
  nextLayer: LayerV1,
): LayerV1[] {
  return nodes.map((node) => {
    if (node.id === layerId) return nextLayer;
    if (node.type === "group") {
      return { ...node, children: replaceLayer(node.children, layerId, nextLayer) };
    }
    return node;
  });
}

function removeLayer(nodes: LayerV1[], layerId: string): LayerV1[] {
  return nodes
    .filter((node) => node.id !== layerId)
    .map((node) =>
      node.type === "group"
        ? { ...node, children: removeLayer(node.children, layerId) }
        : node,
    );
}

function trimLayer(
  nodes: LayerV1[],
  layerId: string,
  start?: number,
  duration?: number,
): LayerV1[] {
  return nodes.map((node) => {
    if (node.id === layerId) {
      const timing = node.timing
        ? {
            start: start ?? node.timing.start,
            duration: duration ?? node.timing.duration,
          }
        : start !== undefined && duration !== undefined
          ? { start, duration }
          : node.timing;
      return { ...node, timing } as LayerV1;
    }
    if (node.type === "group") {
      return {
        ...node,
        children: trimLayer(node.children, layerId, start, duration),
      };
    }
    return node;
  });
}

export function applyMotionProjectV1Patch(
  project: MotionProjectV1,
  patchInput: unknown,
): V1PatchResult {
  const patchResult = MotionProjectV1PatchSchema.safeParse(patchInput);
  if (!patchResult.success) {
    return {
      project: null,
      diagnostics: patchResult.error.issues.map((issue) => ({
        path: issue.path.join(".") || "patch",
        message: issue.message,
        severity: "error" as const,
      })),
    };
  }

  const patch = patchResult.data;
  const diagnostics: V1PatchDiagnostic[] = [];
  let next = clone(project);

  for (let i = 0; i < patch.operations.length; i++) {
    const op = patch.operations[i]!;
    const opPrefix = `operations[${i}]`;

    switch (op.op) {
      case "setComposition": {
        next = {
          ...next,
          composition: { ...next.composition, ...op.changes },
        };
        break;
      }

      case "setTokens": {
        next = {
          ...next,
          tokens: { ...next.tokens, ...op.changes },
        };
        break;
      }

      case "addLayer": {
        if (layerIds(next.layers).has(op.layer.id)) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.layer.id`,
              `Layer already exists: ${op.layer.id}`,
            ),
          );
          break;
        }
        if (op.layer.parentLayerId === null) {
          const layers = [...next.layers];
          layers.splice(op.insertAt ?? layers.length, 0, op.layer);
          next = { ...next, layers };
          break;
        }
        const parent = flattenLayerTree(next.layers).find(
          (layer) => layer.id === op.layer.parentLayerId,
        );
        if (!parent || parent.type !== "group") {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.layer.parentLayerId`,
              `Unknown group parent: ${op.layer.parentLayerId}`,
            ),
          );
          break;
        }
        next = {
          ...next,
          layers: insertIntoGroup(
            next.layers,
            op.layer.parentLayerId,
            op.layer,
            op.insertAt,
          )!,
        };
        break;
      }

      case "updateLayer": {
        if (!layerIds(next.layers).has(op.layerId)) {
          diagnostics.push(
            diagnostic(`${opPrefix}.layerId`, `Unknown layer: ${op.layerId}`),
          );
          break;
        }
        next = {
          ...next,
          layers: replaceLayer(next.layers, op.layerId, op.layer),
        };
        break;
      }

      case "removeLayer": {
        if (!layerIds(next.layers).has(op.layerId)) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.layerId`,
              `Unknown layer: ${op.layerId}`,
              "warning",
            ),
          );
          break;
        }
        next = {
          ...next,
          layers: removeLayer(next.layers, op.layerId),
          bindings: next.bindings.filter((binding) => {
            const target = binding.target;
            if (target.type === "layer" || target.type === "componentLayer") {
              return target.layerId !== op.layerId;
            }
            return true;
          }),
        };
        break;
      }

      case "trimLayer": {
        if (!layerIds(next.layers).has(op.layerId)) {
          diagnostics.push(
            diagnostic(`${opPrefix}.layerId`, `Unknown layer: ${op.layerId}`),
          );
          break;
        }
        next = {
          ...next,
          layers: trimLayer(next.layers, op.layerId, op.start, op.duration),
        };
        break;
      }

      case "addAsset":
      case "updateAsset": {
        const existingIdx = next.assets.findIndex((a) => a.id === op.asset.id);
        if (existingIdx >= 0) {
          if (op.op === "addAsset") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.asset.id`,
                `Asset already exists: ${op.asset.id}`,
              ),
            );
            break;
          }
          const updAssets = [...next.assets];
          updAssets[existingIdx] = op.asset;
          next = { ...next, assets: updAssets };
        } else {
          if (op.op === "updateAsset") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.asset.id`,
                `Asset not found: ${op.asset.id}`,
              ),
            );
            break;
          }
          next = { ...next, assets: [...next.assets, op.asset] };
        }
        break;
      }

      case "addVariable":
      case "updateVariable": {
        const varIdx = next.variables.findIndex((v) => v.id === op.variable.id);
        if (varIdx >= 0) {
          if (op.op === "addVariable") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.variable.id`,
                `Variable already exists: ${op.variable.id}`,
              ),
            );
            break;
          }
          const updVars = [...next.variables];
          updVars[varIdx] = op.variable;
          next = { ...next, variables: updVars };
        } else {
          if (op.op === "updateVariable") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.variable.id`,
                `Variable not found: ${op.variable.id}`,
              ),
            );
            break;
          }
          next = {
            ...next,
            variables: [...next.variables, op.variable],
          };
        }
        break;
      }

      case "addBinding":
      case "updateBinding": {
        const bindIdx = next.bindings.findIndex((b) => b.id === op.binding.id);
        if (bindIdx >= 0) {
          if (op.op === "addBinding") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.binding.id`,
                `Binding already exists: ${op.binding.id}`,
              ),
            );
            break;
          }
          const updBindings = [...next.bindings];
          updBindings[bindIdx] = op.binding;
          next = { ...next, bindings: updBindings };
        } else {
          if (op.op === "updateBinding") {
            diagnostics.push(
              diagnostic(
                `${opPrefix}.binding.id`,
                `Binding not found: ${op.binding.id}`,
              ),
            );
            break;
          }
          next = {
            ...next,
            bindings: [...next.bindings, op.binding],
          };
        }
        break;
      }

      case "setValue": {
        try {
          setValueAtPath(
            next as unknown as Record<string, unknown>,
            op.path,
            op.value,
          );
        } catch (err) {
          diagnostics.push(
            diagnostic(
              `${opPrefix}.path`,
              `Failed to set value at "${op.path}": ${String(err)}`,
            ),
          );
        }
        break;
      }
    }
  }

  const validation = MotionProjectV1Schema.safeParse(next);
  if (!validation.success) {
    diagnostics.push(
      ...validation.error.issues.map((issue) => ({
        path: `(${issue.path.join(".")})`,
        message: `Post-patch validation: ${issue.message}`,
        severity: "error" as const,
      })),
    );
    return { project: null, diagnostics };
  }

  return { project: validation.data as MotionProjectV1, diagnostics };
}

function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (cursor[part] === undefined || cursor[part] === null) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (last !== undefined) cursor[last] = value;
}
