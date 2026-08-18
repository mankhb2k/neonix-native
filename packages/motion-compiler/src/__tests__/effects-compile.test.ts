import { describe, expect, it } from "vitest";
import { compileMotionProjectV1 } from "../index";
import { createNeonEffectsPreviewProject } from "../../../motion-runtime/src/testing/effects-preview-project";

describe("compile inner-glow + noise", () => {
  it("compiles a layers-only neon card with declared effect capabilities", () => {
    const result = compileMotionProjectV1(createNeonEffectsPreviewProject());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const card = result.project.layers.find((layer) => layer.id === "hud-card");
    const effectTypes =
      card && "effects" in card
        ? card.effects?.map((effect) => effect.type)
        : undefined;
    expect(effectTypes).toEqual(["glow", "inner-glow", "noise"]);
    expect(
      result.diagnostics.some((d) => d.code === "CAP_UNDECLARED_CAPABILITY"),
    ).toBe(false);
  });

  it("warns CAP_UNDECLARED_CAPABILITY but still compiles when required is empty", () => {
    const project = createNeonEffectsPreviewProject();
    project.capabilities = { required: [] };
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const undeclared = result.diagnostics.filter(
      (d) => d.code === "CAP_UNDECLARED_CAPABILITY",
    );
    expect(undeclared.map((d) => d.details?.capabilityId)).toEqual(
      expect.arrayContaining([
        "primitive.shape",
        "effect.glow",
        "effect.inner-glow",
        "effect.noise",
      ]),
    );
  });

  it("fails runtime validation on empty metadata.name", () => {
    const project = createNeonEffectsPreviewProject();
    project.metadata.name = "";
    const result = compileMotionProjectV1(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.diagnostics.some((d) => d.code === "RUNTIME_VALIDATION_ERROR"),
    ).toBe(true);
  });
});
