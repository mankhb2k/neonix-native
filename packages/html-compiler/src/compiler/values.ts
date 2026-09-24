import { fail } from "./errors";
import { splitTopLevel } from "./utils";
import type { Style } from "./model";

export function isPaintToken(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}(?:[0-9a-f]{2})?)$/i.test(value)
    || ["transparent", "currentcolor", "none"].includes(value.toLowerCase())
    // Only hex reaches parseColor() successfully today (plus rgba(), handled
    // below) — but misrouting an unrecognized function like hsl(...) here
    // still gets a clear "unsupported color" error out of parseColor(),
    // instead of this token being swallowed as a length/style/width token by
    // whichever shorthand tokenizer called isPaintToken (box-shadow spread,
    // border/outline color, filter: drop-shadow()'s color, all hit this).
    || /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i.test(value);
}

export type CssViewport = {
  width: number;
  height: number;
};

export type Num = { value: number; unit: "px" | "%" | "number" | "angle" };

export function calcExpression(expression: string, property: string, relative: number, fontSize: number, rootFontSize: number, viewport: CssViewport): Num {
  const text = expression.trim();
  if (text.toLowerCase() === "auto") return { value: Number.NaN, unit: "px" };
  let cursor = 0;
  const failValue = (message: string): never => fail("css-value-invalid", `${property} ${message}: ${expression}`);
  const skipWhitespace = () => { while (/\s/.test(text[cursor] ?? "")) cursor += 1; };
  const parseExpression = (): Num => {
    let result = parseProduct();
    while (true) {
      skipWhitespace(); const operator = text[cursor];
      if (operator !== "+" && operator !== "-") return result;
      cursor += 1; const rhs = parseProduct();
      if (result.unit !== rhs.unit && !(result.unit === "px" && rhs.unit === "number") && !(result.unit === "number" && rhs.unit === "px")) fail("css-calc-incompatible", `Incompatible calc units in ${expression}`);
      result = { value: operator === "+" ? result.value + rhs.value : result.value - rhs.value, unit: result.unit === "px" || rhs.unit === "px" ? "px" : "number" };
    }
  };
  const parseProduct = (): Num => {
    let result = parsePrimary();
    while (true) {
      skipWhitespace(); const operator = text[cursor];
      if (operator !== "*" && operator !== "/") return result;
      cursor += 1; const rhs = parsePrimary();
      if (operator === "*") {
        if (result.unit !== "number" && rhs.unit !== "number") fail("css-calc-incompatible", `Multiplication requires a number in ${expression}`);
        result = { value: result.value * rhs.value, unit: result.unit === "number" ? rhs.unit : result.unit };
      } else {
        if (rhs.unit !== "number" || rhs.value === 0) fail("css-calc-incompatible", `Division requires a non-zero number in ${expression}`);
        result = { value: result.value / rhs.value, unit: result.unit };
      }
    }
  };
  const sameUnit = (left: Num, right: Num): boolean => left.unit === right.unit || (left.unit === "px" && right.unit === "number") || (left.unit === "number" && right.unit === "px");
  const requireUnit = (value: Num, unit: Num["unit"], name: string): Num => {
    if (value.unit !== unit) failValue(`${name} requires ${unit} values`);
    return value;
  };
  const parsePrimary = (): Num => {
    skipWhitespace();
    if (text[cursor] === "+" || text[cursor] === "-") {
      const sign = text[cursor] === "-" ? -1 : 1; cursor += 1; const value = parsePrimary(); return { ...value, value: value.value * sign };
    }
    if (text[cursor] === "(") {
      cursor += 1; const value = parseExpression(); skipWhitespace(); if (text[cursor] !== ")") failValue("has an unclosed parenthesis"); cursor += 1; return value;
    }
    const functionMatch = text.slice(cursor).match(/^([A-Za-z-]+)\(/);
    if (functionMatch) {
      const name = functionMatch[1]!.toLowerCase(); cursor += functionMatch[0]!.length;
      const supportedFunctions = [
        "calc", "min", "max", "clamp", "abs", "sign", "floor", "ceil", "round", "mod", "rem",
        "sin", "cos", "tan", "asin", "acos", "atan", "atan2", "sqrt", "pow", "hypot",
      ];
      if (!supportedFunctions.includes(name)) failValue(`does not support ${name}()`);
      if (name === "round") {
        skipWhitespace();
        const strategy = text.slice(cursor).match(/^(nearest|up|down|to-zero)\s*,/i)?.[1]?.toLowerCase();
        if (strategy) {
          cursor += strategy.length;
          skipWhitespace();
          if (text[cursor] !== ",") failValue("has an invalid round() strategy");
          cursor += 1;
        }
        const value = parseExpression();
        skipWhitespace();
        let interval: Num = { value: 1, unit: "number" };
        if (text[cursor] === ",") {
          cursor += 1;
          interval = parseExpression();
        }
        skipWhitespace();
        if (text[cursor] !== ")") failValue("has an invalid round() expression");
        cursor += 1;
        if (interval.value === 0 || !sameUnit(value, interval)) fail("css-calc-incompatible", `round() requires compatible non-zero interval units in ${expression}`);
        const step = interval.value;
        const quotient = value.value / step;
        const rounded = strategy === "up" ? Math.ceil(quotient) : strategy === "down" ? Math.floor(quotient) : strategy === "to-zero" ? (quotient < 0 ? Math.ceil(quotient) : Math.floor(quotient)) : Math.round(quotient);
        return { ...value, value: rounded * step };
      }
      const values: Num[] = [];
      skipWhitespace();
      if (name === "calc") { values.push(parseExpression()); skipWhitespace(); if (text[cursor] !== ")") failValue("has an invalid calc() expression"); cursor += 1; return values[0]!; }
      while (true) {
        values.push(parseExpression()); skipWhitespace();
        if (text[cursor] === ",") { cursor += 1; continue; }
        if (text[cursor] !== ")") failValue(`has an invalid ${name}() expression`); cursor += 1; break;
      }
      if ((name === "min" || name === "max") && values.length < 1) failValue(`${name}() needs at least one value`);
      if (name === "clamp" && values.length !== 3) failValue("clamp() needs three values");
      if (["min", "max", "clamp"].includes(name) && values.some((value) => !sameUnit(value, values[0]!))) fail("css-calc-incompatible", `Incompatible units in ${expression}`);
      if (["abs", "floor", "ceil", "sign"].includes(name)) {
        if (values.length !== 1) failValue(`${name}() needs one value`);
        const value = values[0]!;
        return { ...value, value: name === "abs" ? Math.abs(value.value) : name === "floor" ? Math.floor(value.value) : name === "ceil" ? Math.ceil(value.value) : Math.sign(value.value) };
      }
      if (["sin", "cos", "tan"].includes(name)) {
        if (values.length !== 1) failValue(`${name}() needs one angle`);
        const angle = requireUnit(values[0]!, "angle", name);
        const fn = name === "sin" ? Math.sin : name === "cos" ? Math.cos : Math.tan;
        return { value: fn(angle.value), unit: "number" };
      }
      if (["asin", "acos", "atan"].includes(name)) {
        if (values.length !== 1 || values[0]!.unit !== "number") failValue(`${name}() needs one number`);
        const fn = name === "asin" ? Math.asin : name === "acos" ? Math.acos : Math.atan;
        return { value: fn(values[0]!.value), unit: "angle" };
      }
      if (name === "atan2") {
        if (values.length !== 2 || values.some((value) => value.unit !== "number")) failValue("atan2() needs two numbers");
        return { value: Math.atan2(values[0]!.value, values[1]!.value), unit: "angle" };
      }
      if (["sqrt", "pow", "hypot"].includes(name)) {
        if (values.some((value) => value.unit !== "number")) failValue(`${name}() only accepts number values`);
        if (name === "sqrt" && values.length === 1) return { value: Math.sqrt(values[0]!.value), unit: "number" };
        if (name === "pow" && values.length === 2) return { value: Math.pow(values[0]!.value, values[1]!.value), unit: "number" };
        if (name === "hypot" && values.length >= 1) return { value: Math.hypot(...values.map((value) => value.value)), unit: "number" };
        failValue(`${name}() has an invalid argument count`);
      }
      if (["mod", "rem"].includes(name)) {
        if (values.length !== 2 || !sameUnit(values[0]!, values[1]!) || values[1]!.value === 0) failValue(`${name}() needs two compatible non-zero values`);
        const divisor = values[1]!.value;
        const remainder = values[0]!.value % divisor;
        const value = name === "rem" || Math.sign(values[0]!.value) === Math.sign(divisor) ? remainder : (remainder + divisor) % divisor;
        return { ...values[0]!, value };
      }
      if (name === "min") return values.reduce((a, b) => a.value <= b.value ? a : b);
      if (name === "max") return values.reduce((a, b) => a.value >= b.value ? a : b);
      return { ...values[1]!, value: Math.min(Math.max(values[1]!.value, values[0]!.value), values[2]!.value) };
    }
    const match = text.slice(cursor).match(/^(\d*\.?\d+)(px|%|em|rem|vw|vh|vmin|vmax|deg|rad|grad|turn)?/i);
    if (!match) failValue("has an invalid numeric value");
    const parsed = match as RegExpMatchArray;
    cursor += parsed[0]!.length; const number = Number(parsed[1]!); const unit = (parsed[2] ?? "number").toLowerCase();
    if (unit === "px" || unit === "number") return { value: number, unit: unit === "px" ? "px" : "number" };
    if (unit === "%") return { value: number / 100 * relative, unit: "px" };
    if (unit === "em") return { value: number * fontSize, unit: "px" };
    if (unit === "rem") return { value: number * rootFontSize, unit: "px" };
    if (unit === "vw") return { value: number / 100 * viewport.width, unit: "px" };
    if (unit === "vh") return { value: number / 100 * viewport.height, unit: "px" };
    if (unit === "vmin" || unit === "vmax") {
      const size = unit === "vmin" ? Math.min(viewport.width, viewport.height) : Math.max(viewport.width, viewport.height);
      return { value: number / 100 * size, unit: "px" };
    }
    if (unit === "deg" || unit === "rad" || unit === "grad" || unit === "turn") {
      const radians = unit === "deg" ? number * Math.PI / 180 : unit === "rad" ? number : unit === "grad" ? number * Math.PI / 200 : number * Math.PI * 2;
      return { value: radians, unit: "angle" };
    }
    return { value: number / 100 * viewport.height, unit: "px" };
  };
  const result = parseExpression(); skipWhitespace(); if (cursor !== text.length) failValue("contains unsupported syntax"); return result;
}

export function resolveVar(value: string, vars: Map<string, string>, seen: Set<string>): string {
  let result = ""; let cursor = 0;
  while (cursor < value.length) {
    const start = value.indexOf("var(", cursor);
    if (start < 0) { result += value.slice(cursor); break; }
    result += value.slice(cursor, start); let depth = 1; let end = start + 4;
    while (end < value.length && depth > 0) { if (value[end] === "(") depth += 1; else if (value[end] === ")") depth -= 1; end += 1; }
    if (depth !== 0) fail("css-variable-invalid", `Unclosed var() expression: ${value}`);
    const body = value.slice(start + 4, end - 1); const parts = splitTopLevel(body, ","); const name = parts[0]?.trim(); const fallback = parts.slice(1).join(",").trim();
    if (!name || !/^--[\w-]+$/.test(name)) fail("css-variable-invalid", `Invalid custom property reference: ${body}`);
    if (seen.has(name)) { if (fallback) result += resolveVar(fallback, vars, seen); else fail("css-variable-cycle", `Cyclic variable ${name}`); }
    else { const resolved = vars.get(name); if (resolved === undefined) { if (fallback) result += resolveVar(fallback, vars, seen); else fail("css-variable-missing", `Missing variable ${name}`); } else result += resolveVar(resolved, vars, new Set([...seen, name])); }
    cursor = end;
  }
  return result;
}

export function number(style: Style, property: string, relative: number, fontSize: number, rootFontSize: number, viewport: CssViewport): number {
  const value = style.get(property); if (value === undefined) return Number.NaN; return calcExpression(value, property, relative, fontSize, rootFontSize, viewport).value;
}

export function edges(style: Style, prefix: "margin" | "padding", relative: number, fontSize: number, rootFontSize: number, viewport: CssViewport): [number, number, number, number] {
  const shorthand = style.get(prefix); const values = shorthand ? splitTopLevel(shorthand, " ") : []; const expanded = values.length === 1 ? [values[0], values[0], values[0], values[0]] : values.length === 2 ? [values[0], values[1], values[0], values[1]] : values.length === 3 ? [values[0], values[1], values[2], values[1]] : values.length >= 4 ? values.slice(0, 4) : [undefined, undefined, undefined, undefined];
  return ["top", "right", "bottom", "left"].map((side, i) => { const value = style.get(`${prefix}-${side}`) ?? expanded[i]; return value === undefined ? 0 : calcExpression(value, `${prefix}-${side}`, relative, fontSize, rootFontSize, viewport).value; }) as [number, number, number, number];
}
