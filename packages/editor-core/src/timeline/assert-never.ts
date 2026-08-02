/** Exhaustive switch helper — fail loudly on unexpected variants. */
export function assertNever(value: never, label = "unexpected value"): never {
  throw new Error(`${label}: ${JSON.stringify(value)}`);
}
