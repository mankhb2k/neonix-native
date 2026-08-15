import { MOTION_PROTOCOL_LIMITS } from "@motionvideo/motion-protocol";

export type QuickRef = {
  path: string;
  type: string;
  defaultValue: string;
  animatable: string;
  appliesTo: string;
  doesNotApplyTo: string;
  range: string;
};

export const ATOM_FRAME: QuickRef = {
  path: "frame",
  type: "{ width, height }",
  defaultValue: "required for sized leaves; optional on group",
  animatable: "width/height: yes (compiled tracks)",
  appliesTo: "text, image, svg, video, shape, path, solid, component; optional group/bone/adjustment",
  doesNotApplyTo: "audio, camera",
  range: `0..${MOTION_PROTOCOL_LIMITS.layerDimension}`,
};

export const ATOM_TRANSLATE: QuickRef = {
  path: "transform.translate",
  type: "{ x, y }",
  defaultValue: "{ x: 0, y: 0 }",
  animatable: "yes",
  appliesTo: "visual layers",
  doesNotApplyTo: "audio (no transform)",
  range: "finite numbers (px)",
};

export const ATOM_DEPTH: QuickRef = {
  path: "transform.depth",
  type: "number",
  defaultValue: "0",
  animatable: "yes",
  appliesTo: "visual layers",
  doesNotApplyTo: "audio",
  range: `${-MOTION_PROTOCOL_LIMITS.zPositionRange}..${MOTION_PROTOCOL_LIMITS.zPositionRange}`,
};

export const ATOM_OPACITY: QuickRef = {
  path: "appearance.opacity",
  type: "integer percent",
  defaultValue: "100",
  animatable: "yes",
  appliesTo: "visual + audio appearance",
  doesNotApplyTo: "—",
  range: `0..${MOTION_PROTOCOL_LIMITS.percent} (integer)`,
};

export const ATOM_VISIBLE: QuickRef = {
  path: "appearance.visible",
  type: "boolean",
  defaultValue: "true",
  animatable: "yes (boolean keys)",
  appliesTo: "layers with appearance",
  doesNotApplyTo: "—",
  range: "true | false",
};
