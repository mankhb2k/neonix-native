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
  defaultValue: "required on every visual layer",
  animatable: "width/height: yes (propertyAnimations)",
  appliesTo: "group, component, text, image, svg, video, shape, path, solid, bone, adjustment",
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

export const ATOM_SCALE: QuickRef = {
  path: "transform.scale",
  type: "{ x, y }",
  defaultValue: "{ x: 1, y: 1 }",
  animatable: "yes",
  appliesTo: "visual layers",
  doesNotApplyTo: "audio (no transform)",
  range: "finite; negative flips the axis",
};

export const ATOM_ROTATE: QuickRef = {
  path: "transform.rotate.z",
  type: "number (degrees)",
  defaultValue: "0",
  animatable: "yes",
  appliesTo: "visual layers",
  doesNotApplyTo: "audio",
  range: `±${MOTION_PROTOCOL_LIMITS.rotation3DAngle}`,
};

export const ATOM_SKEW: QuickRef = {
  path: "transform.skew",
  type: "{ x, y } degrees",
  defaultValue: "{ x: 0, y: 0 }",
  animatable: "yes",
  appliesTo: "visual layers",
  doesNotApplyTo: "audio",
  range: `±${MOTION_PROTOCOL_LIMITS.rotation3DAngle}`,
};

export const ATOM_ORIGIN: QuickRef = {
  path: "transform.origin",
  type: "{ x, y } normalized",
  defaultValue: "{ x: 0.5, y: 0.5 }",
  animatable: "yes",
  appliesTo: "visual layers",
  doesNotApplyTo: "audio",
  range: "0..1; AI prefers 0 | 0.5 | 1",
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
  appliesTo: "visual layers",
  doesNotApplyTo: "audio",
  range: `0..${MOTION_PROTOCOL_LIMITS.percent} (integer)`,
};

export const ATOM_VISIBLE: QuickRef = {
  path: "appearance.visible",
  type: "boolean",
  defaultValue: "true",
  animatable: "yes (boolean keys)",
  appliesTo: "visual layers",
  doesNotApplyTo: "audio",
  range: "true | false",
};
