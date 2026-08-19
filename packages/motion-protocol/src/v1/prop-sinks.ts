/**
 * Owner sink allowlist — prop public nối vào leaf nội bộ.
 * Project binding không dùng các path này; chỉ owner propBindings.
 *
 * Color sinks are per layer type:
 * text/solid → payload.color
 * shape/path → style.fill / style.stroke
 * svg → style.fill only
 */

const NUMBER_LEAVES = new Set([
  "frame.width",
  "frame.height",
  "transform.translate.x",
  "transform.translate.y",
  "transform.scale.x",
  "transform.scale.y",
  "transform.rotate.z",
  "transform.skew.x",
  "transform.skew.y",
  "transform.depth",
  "transform.origin.x",
  "transform.origin.y",
  "opacity",
  "payload.cornerRadius",
]);

const BOOLEAN_LEAVES = new Set<string>();

const STRING_LEAVES = new Set(["payload.text"]);

const ASSET_LEAVES = new Set(["payload.assetId", "payload.fontAssetId"]);

const CHOICE_LEAVES = new Set<string>();

const EFFECT_NUMBER =
  /^effects\.[^.]+\.(radius|blur|offset\.x|offset\.y|opacity|brightness|contrast|saturation|hue-rotate|amount|scale)$/;
const EFFECT_COLOR = /^effects\.[^.]+\.color$/;

function isColorOwnerSink(property: string, layerType: string): boolean {
  if (EFFECT_COLOR.test(property)) return true;
  switch (layerType) {
    case "text":
    case "solid":
      return property === "payload.color";
    case "shape":
    case "path":
      return property === "style.fill" || property === "style.stroke";
    case "svg":
      return property === "style.fill";
    default:
      return false;
  }
}

export function isOwnerPropSink(
  kind: string,
  property: string,
  layerType: string,
): boolean {
  switch (kind) {
    case "number":
      return NUMBER_LEAVES.has(property) || EFFECT_NUMBER.test(property);
    case "boolean":
      return BOOLEAN_LEAVES.has(property);
    case "string":
      return STRING_LEAVES.has(property);
    case "color":
      return isColorOwnerSink(property, layerType);
    case "asset":
      return ASSET_LEAVES.has(property);
    case "choice":
      return CHOICE_LEAVES.has(property);
    default:
      return false;
  }
}

export function variableTypeMatchesPropKind(
  variableType: string,
  propKind: string,
): boolean {
  return variableType === propKind;
}
