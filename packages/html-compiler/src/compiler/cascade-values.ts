import { fail } from "./errors";
import { isPaintToken } from "./values";
import { splitTopLevel } from "./utils";

export { isPaintToken };

function expandAnimation(value: string): Array<[string, string]> {
  const entries = splitTopLevel(value, ",").map((entry) => {
    const tokens = splitTopLevel(entry, " ");
    let name = "none";
    let duration = "0s";
    let delay = "0s";
    let timing = "ease";
    let iterations = "1";
    let direction = "normal";
    let fill = "none";
    let state = "running";
    let timeCount = 0;
    let nameCount = 0;
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (/^-?(?:\d+\.?\d*|\.\d+)(?:ms|s)$/i.test(token)) {
        if (timeCount === 0) duration = token;
        else if (timeCount === 1) delay = token;
        else fail("css-animation-shorthand-invalid", `animation accepts at most two time values: ${entry}`);
        timeCount += 1;
      } else if (["linear", "ease", "ease-in", "ease-out", "ease-in-out", "step-start", "step-end"].includes(lower) || /^(?:steps|cubic-bezier)\(/i.test(token)) {
        timing = token;
      } else if (lower === "infinite" || /^(?:\d+\.?\d*|\.\d+)$/.test(token)) {
        iterations = token;
      } else if (["normal", "reverse", "alternate", "alternate-reverse"].includes(lower)) {
        direction = lower;
      } else if (["forwards", "backwards", "both"].includes(lower)) {
        fill = lower;
      } else if (["running", "paused"].includes(lower)) {
        state = lower;
      } else {
        if (nameCount > 0) fail("css-animation-shorthand-invalid", `animation has more than one name: ${entry}`);
        name = token;
        nameCount += 1;
      }
    }
    return { name, duration, delay, timing, iterations, direction, fill, state };
  });
  const values = (key: keyof (typeof entries)[number]) => entries.map((entry) => entry[key]).join(", ");
  return [
    ["animation", value],
    ["animation-name", values("name")],
    ["animation-duration", values("duration")],
    ["animation-delay", values("delay")],
    ["animation-timing-function", values("timing")],
    ["animation-iteration-count", values("iterations")],
    ["animation-direction", values("direction")],
    ["animation-fill-mode", values("fill")],
    ["animation-play-state", values("state")],
  ];
}

const BACKGROUND_REPEATS = new Set(["repeat", "repeat-x", "repeat-y", "no-repeat"]);
const BACKGROUND_BOXES = new Set(["border-box", "padding-box", "content-box"]);

function isBackgroundImageToken(value: string): boolean {
  return /^(?:none|url\(|image\(|cross-fade\(|(?:repeating-)?(?:linear|radial|conic)-gradient\()/i.test(value);
}

function isBackgroundColorToken(value: string): boolean {
  return isPaintToken(value) || /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i.test(value);
}

function expandBackground(value: string): Array<[string, string]> {
  const keyword = value.trim().toLowerCase();
  if (/\bvar\(/i.test(value)) return [["background", value]];
  if (["initial", "inherit", "unset"].includes(keyword)) {
    return [
      ["background", value],
      ["background-color", value],
      ["background-image", value],
      ["background-position", value],
      ["background-size", value],
      ["background-repeat", value],
      ["background-origin", value],
      ["background-clip", value],
    ];
  }

  // Keep the existing paint-only path for simple colors and gradients. It
  // avoids manufacturing default background longhands when there are no
  // other shorthand components to reset (important for background-clip:text).
  if (isPaintToken(value.trim())) return [["background", value], ["background-color", value]];
  if (/^(?:repeating-)?(?:linear|radial|conic)-gradient\([\s\S]*\)$/i.test(value.trim())) return [["background", value]];

  const layers = splitTopLevel(value, ",");
  if (layers.length === 0) fail("css-background-shorthand-invalid", "background requires at least one layer");

  const images: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];
  const repeats: string[] = [];
  const origins: string[] = [];
  const clips: string[] = [];
  let color: string | undefined;
  let hasUrlImage = false;

  layers.forEach((layer, layerIndex) => {
    const slash = splitTopLevel(layer, "/");
    if (slash.length > 2) fail("css-background-shorthand-invalid", `background layer has more than one size separator: ${layer}`);
    const tokens = splitTopLevel(slash[0]!, " ");
    const trailingTokens = slash[1] === undefined ? [] : splitTopLevel(slash[1]!, " ");
    const sizeTokens: string[] = [];
    if (trailingTokens.length > 0) {
      sizeTokens.push(trailingTokens[0]!);
      const second = trailingTokens[1];
      if (second !== undefined && /^(?:auto|cover|contain|[-+]?(?:\d+\.?\d*|\.\d+)(?:%|px|em|rem|vw|vh)|calc\()/i.test(second)) sizeTokens.push(second);
      if (sizeTokens.length > 2) fail("css-background-shorthand-invalid", `background-size accepts at most two values: ${slash[1]}`);
    }
    const trailing = trailingTokens.slice(sizeTokens.length);

    let image: string | undefined;
    let repeat: string | undefined;
    const boxes: string[] = [];
    const position: string[] = [];
    for (const token of [...tokens, ...trailing]) {
      const lower = token.toLowerCase();
      if (isBackgroundImageToken(token)) {
        if (image !== undefined) fail("css-background-shorthand-invalid", `background layer has more than one image: ${layer}`);
        image = token;
        if (/^(?:url\(|image\(|cross-fade\()/i.test(token)) hasUrlImage = true;
      } else if (BACKGROUND_REPEATS.has(lower)) {
        if (repeat !== undefined) fail("css-background-shorthand-invalid", `background layer has more than one repeat value: ${layer}`);
        repeat = lower;
      } else if (BACKGROUND_BOXES.has(lower)) {
        if (boxes.length >= 2) fail("css-background-shorthand-invalid", `background layer has more than two box values: ${layer}`);
        boxes.push(lower);
      } else if (isBackgroundColorToken(token) && lower !== "none") {
        if (layerIndex !== layers.length - 1) fail("css-background-shorthand-invalid", "background color is only allowed on the final layer");
        if (color !== undefined) fail("css-background-shorthand-invalid", `background has more than one color: ${layer}`);
        color = token;
      } else {
        position.push(token);
      }
    }

    const hasImage = image !== undefined && image.toLowerCase() !== "none";
    if (hasImage) {
      images.push(image!);
      positions.push(position.length === 0 ? "0% 0%" : position.join(" "));
      sizes.push(sizeTokens.length === 0 ? "auto" : sizeTokens.join(" "));
      repeats.push(repeat ?? "repeat");
      origins.push(boxes[0] ?? "padding-box");
      clips.push(boxes[1] ?? boxes[0] ?? "border-box");
    } else if (position.length > 0 || sizeTokens.length > 0 || repeat !== undefined || boxes.length > 0) {
      // A `none` image is valid, but it must not create a renderer-visible
      // image layer. Its other components are still reset by the shorthand.
      if (layerIndex !== layers.length - 1) fail("css-background-shorthand-invalid", `background layer has no image source: ${layer}`);
    }
  });

  const normalizedPaint = images.filter((image) => /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(image));
  const normalizedBackground = hasUrlImage
    ? (color ?? "transparent")
    : [...normalizedPaint, ...(color === undefined ? [] : [color])].join(", ") || "transparent";

  return [
    ["background", normalizedBackground],
    ["background-color", color ?? "transparent"],
    ["background-image", images.length === 0 || hasUrlImage ? (images.length === 0 ? "none" : images.join(", ")) : "none"],
    ["background-position", positions.length === 0 ? "0% 0%" : positions.join(", ")],
    ["background-size", sizes.length === 0 ? "auto" : sizes.join(", ")],
    ["background-repeat", repeats.length === 0 ? "repeat" : repeats.join(", ")],
    ["background-origin", origins.length === 0 ? "padding-box" : origins.join(", ")],
    ["background-clip", clips.length === 0 ? "border-box" : clips.join(", ")],
  ];
}

export function expandShorthand(property: string, value: string): Array<[string, string]> {
  if (property === "animation") return expandAnimation(value);
  if (property === "background") return expandBackground(value);
  if (property === "gap") {
    const values = splitTopLevel(value, " ");
    if (values.length < 1 || values.length > 2) fail("css-gap-shorthand-invalid", "gap expects one or two values");
    return [[property, value], ["row-gap", values[0]!], ["column-gap", values[1] ?? values[0]!]];
  }
  if (property === "border" || ["top", "right", "bottom", "left"].some((side) => property === `border-${side}`)) {
    const tokens = splitTopLevel(value, " ");
    let width: string | undefined;
    let style: string | undefined;
    let color: string | undefined;
    for (const token of tokens) {
      if (["solid", "none", "dashed", "dotted", "double", "groove", "ridge", "inset", "outset"].includes(token.toLowerCase())) style = token.toLowerCase();
      else if (isPaintToken(token)) color = token;
      else if (width === undefined) width = token;
      else return [[property, value]];
    }
    const prefix = property === "border" ? "border" : property;
    return [[property, value], ...(width === undefined ? [] : [[property === "border" ? "border-width" : `${prefix}-width`, width] as [string, string]]), ...(style === undefined ? [] : [[property === "border" ? "border-style" : `${prefix}-style`, style] as [string, string]]), ...(color === undefined ? [] : [[property === "border" ? "border-color" : `${prefix}-color`, color] as [string, string]])];
  }
  if (property === "outline") {
    const tokens = splitTopLevel(value, " ");
    let width: string | undefined;
    let style: string | undefined;
    let color: string | undefined;
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (["solid", "none"].includes(lower)) style = lower;
      else if (isPaintToken(token)) color = token;
      else if (width === undefined) width = token;
      else return [[property, value]];
    }
    return [[property, value], ...(width === undefined ? [] : [["outline-width", width] as [string, string]]), ...(style === undefined ? [] : [["outline-style", style] as [string, string]]), ...(color === undefined ? [] : [["outline-color", color] as [string, string]])];
  }
  if (property === "flex") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "none") return [[property, value], ["flex-grow", "0"], ["flex-shrink", "0"], ["flex-basis", "auto"]];
    if (normalized === "auto") return [[property, value], ["flex-grow", "1"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
    if (normalized === "initial") return [[property, value], ["flex-grow", "0"], ["flex-shrink", "1"], ["flex-basis", "auto"]];
    const tokens = splitTopLevel(value, " ");
    if (tokens.length < 1 || tokens.length > 3) fail("css-flex-shorthand-invalid", "flex expects one to three values");
    const first = tokens[0]!;
    const second = tokens[1];
    const third = tokens[2];
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(first)) return [[property, value]];
    if (tokens.length === 1) return [[property, value], ["flex-grow", first], ["flex-shrink", "1"], ["flex-basis", "0px"]];
    if (tokens.length === 2 && second && /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(second)) return [[property, value], ["flex-grow", first], ["flex-shrink", second], ["flex-basis", "0px"]];
    return [[property, value], ["flex-grow", first], ["flex-shrink", third ? second! : "1"], ["flex-basis", third ?? second!]];
  }
  if (property === "place-items") {
    const tokens = splitTopLevel(value, " ");
    if (tokens.length < 1 || tokens.length > 2) fail("css-place-items-invalid", "place-items expects one or two values");
    return [[property, value], ["align-items", tokens[0]!], ["justify-items", tokens[1] ?? tokens[0]!]];
  }
  if (property === "grid-column" || property === "grid-row") {
    const [start, end] = splitTopLevel(value, "/");
    if (!start || !end) fail("css-grid-placement-invalid", `${property} expects start / end`);
    const prefix = property === "grid-column" ? "grid-column" : "grid-row";
    return [[property, value], [`${prefix}-start`, start], [`${prefix}-end`, end]];
  }
  if (property !== "margin" && property !== "padding" && property !== "inset") return [[property, value]];
  const values = splitTopLevel(value, " ");
  if (values.length < 1 || values.length > 4) fail("css-shorthand-invalid", `${property} expects one to four values`);
  const expanded = values.length === 1 ? [values[0], values[0], values[0], values[0]] : values.length === 2 ? [values[0], values[1], values[0], values[1]] : values.length === 3 ? [values[0], values[1], values[2], values[1]] : values;
  const sides = property === "inset" ? ["top", "right", "bottom", "left"] : ["top", "right", "bottom", "left"].map((side) => `${property}-${side}`);
  return [[property, value], [sides[0]!, expanded[0]!], [sides[1]!, expanded[1]!], [sides[2]!, expanded[2]!], [sides[3]!, expanded[3]!]];
}
