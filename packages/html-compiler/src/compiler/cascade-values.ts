import { fail } from "./errors";
import { isPaintToken } from "./values";
import { splitTopLevel } from "./utils";

export { isPaintToken };

export function expandShorthand(property: string, value: string): Array<[string, string]> {
  if (property === "background" && !value.includes(",") && !/^\w+-gradient\(/i.test(value.trim()) && isPaintToken(value.trim())) return [[property, value], ["background-color", value]];
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
