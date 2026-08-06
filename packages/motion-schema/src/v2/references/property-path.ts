import type { z } from "zod";
import {
  motionEffectPropertyCapability,
  motionPropertyCapability,
  motionPropertyValueError,
  motionVariableTypeMatchesValueKind,
} from "../../capabilities";
import type { MotionNode } from "../nodes";
import { VariableV2Schema } from "../variables";
import type { ReferenceIssue } from "./types";

export function validatePropertyPath(
  node: MotionNode,
  property: string,
  usage: "track" | "binding",
  path: string,
): ReferenceIssue[] {
  const progressMatch = /^modifiers\.([^.]+)\.progress$/.exec(property);
  if (progressMatch && !node.modifiers?.some((modifier) => modifier.id === progressMatch[1] && (modifier.type === "motion-path" || modifier.type === "path-morph"))) {
    return [{ path, message: `Unknown progress modifier: ${progressMatch[1]}` }];
  }
  const trimMatch = /^modifiers\.([^.]+)\.(start|end|offset)$/.exec(property);
  if (trimMatch && !node.modifiers?.some((modifier) => modifier.id === trimMatch[1] && modifier.type === "trim-path")) {
    return [{ path, message: `Unknown trim-path modifier: ${trimMatch[1]}` }];
  }
  const amountMatch = /^modifiers\.([^.]+)\.amount$/.exec(property);
  if (amountMatch && !node.modifiers?.some((modifier) => modifier.id === amountMatch[1] && modifier.type === "path-bend")) {
    return [{ path, message: `Unknown path-bend modifier: ${amountMatch[1]}` }];
  }
  const weightMatch = /^modifiers\.([^.]+)\.weight$/.exec(property);
  if (weightMatch && !node.modifiers?.some((modifier) => modifier.id === weightMatch[1] && modifier.type === "constraint")) {
    return [{ path, message: `Unknown constraint modifier: ${weightMatch[1]}` }];
  }
  const effectMatch = /^effects\.([^.]+)\.([^.]+)$/.exec(property);
  if (effectMatch) {
    const effect = node.effects?.find((candidate) => candidate.id === effectMatch[1]);
    if (!effect) return [{ path, message: `Unknown effect: ${effectMatch[1]}` }];
    if (!motionEffectPropertyCapability(effect.type, effectMatch[2]!)) {
      return [{ path, message: `Unsupported property for ${effect.type} effect: ${effectMatch[2]}` }];
    }
  }
  const capability = motionPropertyCapability(node.type, property);
  if (!capability) return [{ path, message: `Unsupported property for ${node.type}: ${property}` }];
  if (usage === "track" && !capability.animatable) return [{ path, message: `Property is not animatable: ${property}` }];
  if (usage === "track" && capability.runtimeSupport !== "evaluated") return [{ path, message: `Property is not supported by runtime evaluator: ${property}` }];
  if (usage === "binding" && !capability.bindable) return [{ path, message: `Property is not bindable: ${property}` }];
  return [];
}

export function validateVariableCapabilityValue(
  variable: z.infer<typeof VariableV2Schema>,
  capability: NonNullable<ReturnType<typeof motionPropertyCapability>>,
  property: string,
  map?: { scale?: number; offset?: number },
): string | undefined {
  if (!motionVariableTypeMatchesValueKind(capability.valueKind, variable.type)) {
    return `Expected ${capability.valueKind} value for ${property}, got variable type ${variable.type}`;
  }
  let value: unknown = variable.value;
  if (typeof value === "number" && map) value = value * (map.scale ?? 1) + (map.offset ?? 0);
  return motionPropertyValueError(capability, value, property);
}
