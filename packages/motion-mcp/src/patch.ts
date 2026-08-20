import { z } from "zod";
import {
  MotionProtocolV2Schema,
  V2CompositionSchema,
  V2IdSchema,
  V2LayerSchema,
  type MotionProtocolV2,
} from "@motionvideo/motion-protocol/v2";

const FiniteNumberSchema = z.number().finite();
export const V2PatchSetCompositionSchema = z.object({
  op: z.literal("setComposition"),
  changes: V2CompositionSchema.partial(),
}).strict();
export const V2PatchAddLayerSchema = z.object({
  op: z.literal("addLayer"),
  layer: V2LayerSchema,
  insertAt: z.number().int().nonnegative().optional(),
}).strict();
export const V2PatchUpdateLayerSchema = z.object({
  op: z.literal("updateLayer"),
  layerId: V2IdSchema,
  layer: V2LayerSchema,
}).strict();
export const V2PatchRemoveLayerSchema = z.object({
  op: z.literal("removeLayer"),
  layerId: V2IdSchema,
}).strict();
export const V2PatchTrimLayerSchema = z.object({
  op: z.literal("trimLayer"),
  layerId: V2IdSchema,
  start: FiniteNumberSchema.nonnegative().optional(),
  duration: FiniteNumberSchema.positive().optional(),
}).strict();
export const V2PatchSetValueSchema = z.object({
  op: z.literal("setValue"),
  path: z.string().min(1).max(256),
  value: z.unknown(),
}).strict();

export const V2PatchOpSchema = z.discriminatedUnion("op", [
  V2PatchSetCompositionSchema,
  V2PatchAddLayerSchema,
  V2PatchUpdateLayerSchema,
  V2PatchRemoveLayerSchema,
  V2PatchTrimLayerSchema,
  V2PatchSetValueSchema,
]);
export type V2PatchOp = z.infer<typeof V2PatchOpSchema>;

export const MotionProtocolV2PatchSchema = z.object({
  format: z.literal("motion-protocol-patch"),
  formatVersion: z.literal(2),
  baseRevision: FiniteNumberSchema.int().nonnegative(),
  operations: z.array(V2PatchOpSchema).min(1).max(1000),
}).strict();
export type MotionProtocolV2Patch = z.infer<typeof MotionProtocolV2PatchSchema>;

export type V2PatchDiagnostic = { path: string; message: string; severity: "error" | "warning" };
export type V2PatchResult = { project: MotionProtocolV2 | null; diagnostics: V2PatchDiagnostic[] };

function clone(project: MotionProtocolV2): MotionProtocolV2 {
  return JSON.parse(JSON.stringify(project)) as MotionProtocolV2;
}

function setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor = obj;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    if (cursor[part] === undefined || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  const last = parts[parts.length - 1];
  if (last) cursor[last] = value;
}

function diagnostic(path: string, message: string, severity: "error" | "warning" = "error"): V2PatchDiagnostic {
  return { path, message, severity };
}

export function applyMotionProtocolV2Patch(project: MotionProtocolV2, patchInput: unknown): V2PatchResult {
  const parsedPatch = MotionProtocolV2PatchSchema.safeParse(patchInput);
  if (!parsedPatch.success) {
    return {
      project: null,
      diagnostics: parsedPatch.error.issues.map((issue) => diagnostic(issue.path.join(".") || "patch", issue.message)),
    };
  }

  const next = clone(project);
  const diagnostics: V2PatchDiagnostic[] = [];
  for (let index = 0; index < parsedPatch.data.operations.length; index += 1) {
    const operation = parsedPatch.data.operations[index]!;
    const prefix = `operations[${index}]`;
    switch (operation.op) {
      case "setComposition":
        next.composition = { ...next.composition, ...operation.changes };
        break;
      case "addLayer":
        if (next.layers.some((layer) => layer.id === operation.layer.id)) {
          diagnostics.push(diagnostic(`${prefix}.layer.id`, `Layer already exists: ${operation.layer.id}`));
          break;
        }
        next.layers.splice(operation.insertAt ?? next.layers.length, 0, operation.layer);
        break;
      case "updateLayer": {
        const layerIndex = next.layers.findIndex((layer) => layer.id === operation.layerId);
        if (layerIndex < 0) {
          diagnostics.push(diagnostic(`${prefix}.layerId`, `Unknown layer: ${operation.layerId}`));
          break;
        }
        next.layers[layerIndex] = operation.layer;
        break;
      }
      case "removeLayer": {
        const layerIndex = next.layers.findIndex((layer) => layer.id === operation.layerId);
        if (layerIndex < 0) {
          diagnostics.push(diagnostic(`${prefix}.layerId`, `Unknown layer: ${operation.layerId}`, "warning"));
          break;
        }
        next.layers.splice(layerIndex, 1);
        break;
      }
      case "trimLayer": {
        const layer = next.layers.find((candidate) => candidate.id === operation.layerId);
        if (!layer) {
          diagnostics.push(diagnostic(`${prefix}.layerId`, `Unknown layer: ${operation.layerId}`));
          break;
        }
        layer.timing = {
          start: operation.start ?? layer.timing.start,
          duration: operation.duration ?? layer.timing.duration,
        };
        break;
      }
      case "setValue":
        setValueAtPath(next as unknown as Record<string, unknown>, operation.path, operation.value);
        break;
    }
  }

  const validated = MotionProtocolV2Schema.safeParse(next);
  if (!validated.success) {
    diagnostics.push(...validated.error.issues.map((issue) => diagnostic(`(${issue.path.join(".")})`, `Post-patch validation: ${issue.message}`)));
    return { project: null, diagnostics };
  }
  return { project: validated.data, diagnostics };
}
