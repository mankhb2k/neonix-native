import { describe, expect, it } from "vitest";
import {
  assertRuntimeEffectProgram,
  validateRuntimeEffectProgram,
  type RuntimeEffectProgram,
} from "./effect-program";

function shadowLikeProgram(): RuntimeEffectProgram {
  return {
    input: "source",
    requiresOffscreen: true,
    output: "combined",
    ops: [
      { id: "mask", kind: "alpha-mask", input: "source", output: "mask" },
      { id: "blur", kind: "blur", input: "mask", output: "soft-mask", radius: 16 },
      { id: "tint", kind: "tint", input: "soft-mask", output: "shadow", color: "#000000", opacity: 0.25 },
      { id: "offset", kind: "offset", input: "shadow", output: "offset-shadow", x: 18, y: 20 },
      { id: "combine", kind: "composite", backdrop: "offset-shadow", source: "source", output: "combined", mode: "source-over" },
    ],
  };
}

describe("Runtime Effect Program validation", () => {
  it("accepts a branching shadow-shaped program", () => {
    const program = shadowLikeProgram();
    expect(validateRuntimeEffectProgram(program)).toEqual({ ok: true, diagnostics: [] });
    expect(assertRuntimeEffectProgram(program)).toBe(program);
  });

  it("rejects duplicate output surfaces", () => {
    const program = shadowLikeProgram();
    program.ops[1] = { id: "blur", kind: "blur", input: "mask", output: "mask", radius: 16 };
    expect(validateRuntimeEffectProgram(program).diagnostics.map((item) => item.code)).toContain("runtime_effect_program_duplicate_surface");
  });

  it("rejects a missing input surface", () => {
    const program = shadowLikeProgram();
    program.ops[0] = { id: "mask", kind: "alpha-mask", input: "missing", output: "mask" };
    expect(validateRuntimeEffectProgram(program).diagnostics.map((item) => item.code)).toContain("runtime_effect_program_input_unavailable");
  });

  it("rejects cycles", () => {
    const program: RuntimeEffectProgram = {
      input: "source",
      requiresOffscreen: true,
      output: "a",
      ops: [
        { id: "a", kind: "blur", input: "b", output: "a", radius: 8 },
        { id: "b", kind: "blur", input: "a", output: "b", radius: 8 },
      ],
    };
    expect(validateRuntimeEffectProgram(program).diagnostics.map((item) => item.code)).toContain("runtime_effect_program_cycle");
  });

  it("rejects an operator that does not contribute to output", () => {
    const program = shadowLikeProgram();
    program.ops.splice(4, 0, { id: "unused", kind: "blur", input: "source", output: "unused", radius: 4 });
    expect(validateRuntimeEffectProgram(program).diagnostics.map((item) => item.code)).toContain("runtime_effect_program_orphan");
  });
});
