import { fail } from "./errors";
import { isPaintToken } from "./values";
import { splitTopLevel } from "./utils";

export { isPaintToken };

export function expandShorthand(property: string, value: string): Array<[string, string]> {
  if (property === "background" && !value.includes(",") && !/^\w+-gradient\(/i.test(value.trim()) && isPaintToken(value.trim())) return [[property, value], ["background-color", value]];
  if (property === "border") {
    const tokens = value.split(/\s+/).filter(Boolean);
    let width: string | undefined;
    let style: string | undefined;
    let color: string | undefined;
    for (const token of tokens) {
      if (["solid", "none"].includes(token.toLowerCase())) style = token.toLowerCase();
      else if (isPaintToken(token)) color = token;
      else if (width === undefined) width = token;
      else return [[property, value]];
    }
    return [[property, value], ...(width === undefined ? [] : [["border-width", width] as [string, string]]), ...(style === undefined ? [] : [["border-style", style] as [string, string]]), ...(color === undefined ? [] : [["border-color", color] as [string, string]])];
  }
  if (property !== "margin" && property !== "padding") return [[property, value]];
  const values = splitTopLevel(value, " ");
  if (values.length < 1 || values.length > 4) fail("css-shorthand-invalid", `${property} expects one to four values`);
  const expanded = values.length === 1 ? [values[0], values[0], values[0], values[0]] : values.length === 2 ? [values[0], values[1], values[0], values[1]] : values.length === 3 ? [values[0], values[1], values[2], values[1]] : values;
  return [[property, value], [`${property}-top`, expanded[0]!], [`${property}-right`, expanded[1]!], [`${property}-bottom`, expanded[2]!], [`${property}-left`, expanded[3]!]];
}

