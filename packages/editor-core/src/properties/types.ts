/**
 * Property registry types — compile-time seam for inspector (REFACTOR §7).
 */

import type { MotionProject } from "@motionvideo/motion-protocol";
import type { EditorSelection } from "../selection/editor-selection";
import type { TimelineClip, TimelineLane } from "../timeline/model/timeline-types";
import type { DocumentPropertyCommand } from "./property-commands";

export type MixedValue = { mixed: true };

export function isMixedValue(value: unknown): value is MixedValue {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as MixedValue).mixed === true
  );
}

export type PropertyEditorKind =
  | "number"
  | "boolean"
  | "string"
  | "color"
  | "enum"
  | "vector";

export type Vector2 = { x: number; y: number };

export type ValidationResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

export type NodeTarget = {
  sceneId: string;
  layerId: string;
};

export type PropertyContext = {
  project: MotionProject;
  clips: TimelineClip[];
  lanes: TimelineLane[];
  selection: EditorSelection;
  /** Resolved editable node targets for the current selection. */
  targets: NodeTarget[];
};

export type PropertyDefinition<T = unknown> = {
  id: string;
  label: string;
  group: string;
  editor: PropertyEditorKind;
  /** Enum editor options (editor === "enum"). */
  options?: readonly { value: string; label: string }[];
  isVisible(context: PropertyContext): boolean;
  read(context: PropertyContext): T | MixedValue;
  createCommand(value: T, context: PropertyContext): DocumentPropertyCommand;
  validate?(value: T, context: PropertyContext): ValidationResult;
};
