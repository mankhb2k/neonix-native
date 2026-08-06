import type { MotionComponentV2 } from "./component";
import { MotionComponentV2Schema } from "./component";
import type { MotionProjectV2 } from "./project";
import { MotionProjectV2Schema } from "./project";
import { validateMotionComponentV2References } from "./references/component";
import { validateMotionProjectV2References } from "./references/project";
import { MotionV2ReferenceError } from "./references/types";

export function parseMotionComponentV2(input: unknown): MotionComponentV2 {
  const component = MotionComponentV2Schema.parse(input);
  const issues = validateMotionComponentV2References(component);
  if (issues.length > 0) throw new MotionV2ReferenceError(issues);
  return component;
}

export function parseMotionProjectV2(input: unknown): MotionProjectV2 {
  const project = MotionProjectV2Schema.parse(input);
  const issues = validateMotionProjectV2References(project);
  if (issues.length > 0) throw new MotionV2ReferenceError(issues);
  return project;
}

export function serializeMotionProjectV2(project: MotionProjectV2): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}
