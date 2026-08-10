/**
 * V3 parse / serialize API.
 *
 * `parseMotionProjectV3` runs the shared legacy text-payload normalizer
 * (same one used by v2) then schema + reference validation.
 * `serializeMotionProjectV3` emits canonical (alphabetically sorted) keys
 * so two identical projects always serialize byte-identically.
 */
import { MotionProjectV3Schema, type MotionProjectV3 } from "./index";
import { normalizeLegacyMotionInput } from "../v2/parse";
import { validateMotionProjectV3References } from "./references";
import { MotionV3ReferenceError } from "./references/types";

export function parseMotionProjectV3(input: unknown): MotionProjectV3 {
  const project = MotionProjectV3Schema.parse(normalizeLegacyMotionInput(input));
  const issues = validateMotionProjectV3References(project);
  if (issues.length > 0) throw new MotionV3ReferenceError(issues);
  return project;
}

/** Recursively sort object keys alphabetically (arrays keep order). */
export function canonicalizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeKeys);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      next[key] = canonicalizeKeys(record[key]);
    }
    return next;
  }
  return value;
}

export function serializeMotionProjectV3(project: MotionProjectV3): string {
  return `${JSON.stringify(canonicalizeKeys(project), null, 2)}\n`;
}
