/**
 * Owner sink allowlist — prop public nối vào leaf nội bộ.
 * Project binding không dùng các path này; chỉ owner propBindings.
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
  "appearance.opacity",
  "layout.gap",
  "layoutItem.minWidth",
  "layoutItem.maxWidth",
  "layoutItem.minHeight",
  "layoutItem.maxHeight",
]);

const BOOLEAN_LEAVES = new Set(["appearance.visible"]);

const STRING_LEAVES = new Set(["payload.content.text"]);

const COLOR_LEAVES = new Set([
  "payload.color",
  "style.fill",
  "style.stroke",
]);

const ASSET_LEAVES = new Set(["payload.assetId"]);

const CHOICE_LEAVES = new Set([
  "layout.mode",
  "layout.justify",
  "layout.align",
  "layoutItem.width",
  "layoutItem.height",
  "layoutItem.alignSelf",
]);

const EFFECT_NUMBER =
  /^effects\.[^.]+\.(radius|blur|offset\.x|offset\.y|opacity|brightness|contrast|saturation|hue-rotate)$/;
const EFFECT_COLOR = /^effects\.[^.]+\.color$/;

export function isOwnerPropSink(kind: string, property: string): boolean {
  switch (kind) {
    case "number":
      return NUMBER_LEAVES.has(property) || EFFECT_NUMBER.test(property);
    case "boolean":
      return BOOLEAN_LEAVES.has(property);
    case "string":
      return STRING_LEAVES.has(property);
    case "color":
      return COLOR_LEAVES.has(property) || EFFECT_COLOR.test(property);
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
