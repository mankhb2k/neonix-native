/**
 * V1 parse / serialize API.
 *
 * `parseMotionProjectV1` is the **canonical** production entry: text-payload
 * normalizer, then schema + reference validation. Strict V1 only — no
 * timeline component-source migration. `serializeMotionProjectV1` emits
 * canonical (alphabetically sorted) keys so two identical projects always
 * serialize byte-identically.
 */
import { MotionProjectV1Schema, type MotionProjectV1 } from "./project";
import { normalizeMotionProjectInput } from "./normalize-input";
import { validateMotionProjectV1References } from "./references";
import { MotionV1ReferenceError } from "./references/types";

export function parseMotionProjectV1(input: unknown): MotionProjectV1 {
  const project = MotionProjectV1Schema.parse(
    normalizeMotionProjectInput(input),
  );
  const issues = validateMotionProjectV1References(project);
  if (issues.length > 0) throw new MotionV1ReferenceError(issues);
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

export function serializeMotionProjectV1(project: MotionProjectV1): string {
  return `${JSON.stringify(canonicalizeKeys(project), null, 2)}\n`;
}
