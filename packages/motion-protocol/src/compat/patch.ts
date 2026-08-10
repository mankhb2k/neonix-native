import { z } from "zod";
import { MOTION_V2_LIMITS } from "../capabilities";
import {
  FiniteNumberSchema,
  IdSchema,
  MOTION_PATCH_FORMAT_VERSION,
  PropertyPathSchema,
} from "../runtime/common";
import { parseMotionProjectV2 } from "./parse-v2";
import type { MotionProjectV2 } from "./project";
import type { ReferenceIssue } from "./references/types";
import { MotionV2ReferenceError } from "./references/types";
import { JsonValueSchema } from "../runtime/values";

const PatchTargetSchema = z.union([
  z.object({ variableId: IdSchema }).strict(),
  z
    .object({
      sceneId: IdSchema,
      nodeId: IdSchema,
      property: PropertyPathSchema,
    })
    .strict(),
]);

export const MotionPatchSchema = z
  .object({
    format: z.literal("motion-patch"),
    formatVersion: z.literal(MOTION_PATCH_FORMAT_VERSION),
    baseRevision: FiniteNumberSchema.int().nonnegative(),
    operations: z
      .array(
        z
          .object({
            op: z.literal("set"),
            target: PatchTargetSchema,
            value: JsonValueSchema,
          })
          .strict(),
      )
      .max(MOTION_V2_LIMITS.patchOperations),
  })
  .strict();

export type MotionPatch = z.infer<typeof MotionPatchSchema>;

function setRecordPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    const current = cursor[part];
    if (
      current === null ||
      typeof current !== "object" ||
      Array.isArray(current)
    )
      cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  const last = parts.at(-1);
  if (last) cursor[last] = value;
}

/** Apply a public-surface patch: project variables or Component Instance `payload.props.*` only. */
export function applyMotionPatch(
  project: MotionProjectV2,
  patchInput: unknown,
): MotionProjectV2 {
  const patch = MotionPatchSchema.parse(patchInput);
  const next = JSON.parse(JSON.stringify(project)) as MotionProjectV2;
  const issues: ReferenceIssue[] = [];
  for (let index = 0; index < patch.operations.length; index += 1) {
    const operation = patch.operations[index]!;
    const path = `operations.${index}`;
    const target = operation.target;
    if ("variableId" in target) {
      const variableId = target.variableId;
      const variable = next.variables.find(
        (candidate) => candidate.id === variableId,
      );
      if (!variable) {
        issues.push({
          path: `${path}.target.variableId`,
          message: `Unknown variable: ${variableId}`,
        });
        continue;
      }
      (variable as { value: unknown }).value = operation.value;
      continue;
    }
    const { sceneId, nodeId, property } = target;
    if (!property.startsWith("payload.props.")) {
      issues.push({
        path: `${path}.target.property`,
        message:
          "Patch may only set public payload.props.* or project variables",
      });
      continue;
    }
    const scene = next.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) {
      issues.push({
        path: `${path}.target.sceneId`,
        message: `Unknown scene: ${sceneId}`,
      });
      continue;
    }
    const node = scene.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
      issues.push({
        path: `${path}.target.nodeId`,
        message: `Unknown node: ${nodeId}`,
      });
      continue;
    }
    if (node.type !== "component") {
      issues.push({
        path: `${path}.target.nodeId`,
        message: `Patch node target must be a component instance: ${nodeId}`,
      });
      continue;
    }
    setRecordPath(
      node as unknown as Record<string, unknown>,
      property,
      operation.value,
    );
  }
  if (issues.length > 0) throw new MotionV2ReferenceError(issues);
  return parseMotionProjectV2(next);
}
