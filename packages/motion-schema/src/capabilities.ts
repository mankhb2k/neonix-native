export const MOTION_V2_LIMITS = Object.freeze({
  idLength: 128,
  scenesPerProject: 100,
  nodesPerScene: 2_000,
  nodesPerComponent: 2_000,
  clipsPerScene: 2_000,
  clipsPerComponent: 2_000,
  tracksPerClip: 2_000,
  keysPerTrack: 10_000,
  hierarchyDepth: 64,
  listItems: 1_000,
  assetDimension: 32_768,
  mediaDurationSeconds: 86_400,
  frameRate: 240,
  sampleRate: 384_000,
  audioChannels: 16,
});

export type MotionPropertyValueKind = "number" | "boolean" | "string" | "color" | "asset" | "json";

export type MotionPropertyCapability = {
  valueKind: MotionPropertyValueKind;
  animatable: boolean;
  bindable: boolean;
};

const TRANSFORM_PROPERTIES: Readonly<Record<string, MotionPropertyCapability>> = Object.freeze({
  "transform.x": { valueKind: "number", animatable: true, bindable: true },
  "transform.y": { valueKind: "number", animatable: true, bindable: true },
  "transform.width": { valueKind: "number", animatable: true, bindable: true },
  "transform.height": { valueKind: "number", animatable: true, bindable: true },
  "transform.rotation": { valueKind: "number", animatable: true, bindable: true },
  "transform.scaleX": { valueKind: "number", animatable: true, bindable: true },
  "transform.scaleY": { valueKind: "number", animatable: true, bindable: true },
  "transform.anchorX": { valueKind: "number", animatable: true, bindable: true },
  "transform.anchorY": { valueKind: "number", animatable: true, bindable: true },
  "transform.opacity": { valueKind: "number", animatable: true, bindable: true },
  "transform.visible": { valueKind: "boolean", animatable: true, bindable: true },
  "transform.flipX": { valueKind: "boolean", animatable: true, bindable: true },
  "transform.flipY": { valueKind: "boolean", animatable: true, bindable: true },
});

const NODE_PROPERTIES: Readonly<Record<string, Readonly<Record<string, MotionPropertyCapability>>>> = Object.freeze({
  text: {
    "payload.text": { valueKind: "string", animatable: true, bindable: true },
    "payload.fontSize": { valueKind: "number", animatable: true, bindable: true },
    "payload.counterProgress": { valueKind: "number", animatable: true, bindable: false },
    "style.fill": { valueKind: "color", animatable: true, bindable: true },
  },
  shape: {
    "style.fill": { valueKind: "color", animatable: true, bindable: true },
    "style.cornerRadius": { valueKind: "number", animatable: true, bindable: true },
  },
  svg: {
    "payload.assetId": { valueKind: "asset", animatable: true, bindable: true },
    "style.fill": { valueKind: "color", animatable: true, bindable: true },
  },
  image: {
    "payload.assetId": { valueKind: "asset", animatable: true, bindable: true },
  },
  video: {
    "payload.assetId": { valueKind: "asset", animatable: true, bindable: true },
    "payload.trimStart": { valueKind: "number", animatable: false, bindable: true },
    "payload.muted": { valueKind: "boolean", animatable: false, bindable: true },
  },
  camera: {
    "payload.zoom": { valueKind: "number", animatable: true, bindable: true },
  },
  bone: {
    "payload.length": { valueKind: "number", animatable: false, bindable: true },
  },
});

export function motionPropertyCapability(nodeType: string, property: string): MotionPropertyCapability | undefined {
  const transform = TRANSFORM_PROPERTIES[property];
  if (transform) return transform;
  if (nodeType === "component" && property.startsWith("payload.props.") && property.length > "payload.props.".length) {
    return { valueKind: "json", animatable: false, bindable: true };
  }
  return NODE_PROPERTIES[nodeType]?.[property];
}

export function motionLiteralMatchesValueKind(kind: MotionPropertyValueKind, value: unknown): boolean {
  if (kind === "json") return true;
  if (kind === "number") return typeof value === "number" && Number.isFinite(value);
  if (kind === "boolean") return typeof value === "boolean";
  return typeof value === "string";
}

export function motionVariableTypeMatchesValueKind(kind: MotionPropertyValueKind, variableType: string): boolean {
  if (kind === "json") return true;
  if (kind === "asset") return variableType === "image";
  if (kind === "color") return variableType === "color";
  return kind === variableType;
}
