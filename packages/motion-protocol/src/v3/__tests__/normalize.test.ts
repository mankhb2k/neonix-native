/**
 * V3 Normalizer tests — migration layer for legacy data.
 */
import { describe, expect, it } from "vitest";
import { normalizeMotionProjectV3, needsNormalization } from "../normalize";

// ── needsNormalization ─────────────────────────────────────────────────

describe("needsNormalization", () => {
  it("returns false for a clean project", () => {
    expect(needsNormalization({})).toBe(false);
    expect(needsNormalization({ components: [] })).toBe(false);
    expect(needsNormalization({ bindings: [] })).toBe(false);
  });

  it("returns true when a component has record-style variants", () => {
    expect(
      needsNormalization({
        components: [
          {
            id: "test",
            variants: { primary: { color: "red" } },
          },
        ],
      }),
    ).toBe(true);
  });

  it("returns false when all variants are arrays", () => {
    expect(
      needsNormalization({
        components: [
          {
            id: "test",
            variants: [{ id: "primary", name: "Primary", params: {} }],
          },
        ],
      }),
    ).toBe(false);
  });

  it("returns true when a binding uses legacy nodeId/property", () => {
    expect(
      needsNormalization({
        bindings: [
          {
            id: "b1",
            target: {
              kind: "component",
              componentId: "c1",
              nodeId: "n1",
              property: "p",
            },
          },
        ],
      }),
    ).toBe(true);
  });

  it("returns false when all component bindings use targetId", () => {
    expect(
      needsNormalization({
        bindings: [
          {
            id: "b1",
            target: { kind: "component", componentId: "c1", targetId: "t1" },
          },
        ],
      }),
    ).toBe(false);
  });
});

// ── Variant normalization ──────────────────────────────────────────────

describe("normalizeMotionProjectV3 — variants", () => {
  it("converts record-style variants to array", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          variants: {
            primary: { color: "#ff6b35", size: "lg" },
            outline: { color: "#ff6b35", border: true },
          },
        },
      ],
    });

    const comp = project.components![0]!;
    const variants = comp.variants;
    expect(Array.isArray(variants)).toBe(true);
    if (!Array.isArray(variants)) throw new Error("Expected variants array");
    expect(variants).toHaveLength(2);
    expect(variants[0]).toMatchObject({
      id: "primary",
      name: "primary",
      params: { color: "#ff6b35", size: "lg" },
    });
    expect(variants[1]).toMatchObject({
      id: "outline",
      name: "outline",
      params: { color: "#ff6b35", border: true },
    });
    expect(issues.some((i) => i.message.includes("Migrated"))).toBe(true);
  });

  it("keeps array variants unchanged", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          variants: [
            { id: "primary", name: "Primary", params: { color: "red" } },
          ],
        },
      ],
    });

    expect(Array.isArray(project.components![0]!.variants)).toBe(true);
    expect(project.components![0]!.variants).toHaveLength(1);
    expect(issues).toHaveLength(0);
  });

  it("handles empty variants record", () => {
    const { project } = normalizeMotionProjectV3({
      components: [{ id: "button", variants: {} }],
    });

    expect(project.components![0]!.variants).toEqual([]);
  });
});

// ── Binding normalization ──────────────────────────────────────────────

describe("normalizeMotionProjectV3 — bindings", () => {
  it("converts legacy nodeId/property binding to targetId (matched publicTarget)", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          publicTargets: [
            {
              id: "label",
              nodeId: "text-node",
              property: "payload.content.text",
            },
          ],
        },
      ],
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: {
            kind: "component",
            componentId: "button",
            nodeId: "text-node",
            property: "payload.content.text",
          },
        },
      ],
    });

    const binding = project.bindings![0]!;
    expect(binding.target).not.toHaveProperty("nodeId");
    expect(binding.target).not.toHaveProperty("property");
    expect((binding.target as Record<string, unknown>).targetId).toBe("label");
    expect(issues.some((i) => i.message.includes("Migrated binding"))).toBe(
      true,
    );
  });

  it("does not auto-generate publicTarget when no match found by default", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          publicTargets: [],
        },
      ],
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: {
            kind: "component",
            componentId: "button",
            nodeId: "bg-node",
            property: "payload.color",
          },
        },
      ],
    });

    const comp = project.components![0]!;
    expect(comp.publicTargets).toHaveLength(0);

    const binding = project.bindings![0]!;
    expect(binding.target).toHaveProperty("nodeId");
    expect(binding.target).toHaveProperty("property");
    expect(issues.some((i) => i.severity === "warn")).toBe(true);
  });

  it("auto-generates publicTarget when compatibility option is enabled", () => {
    const { project, issues } = normalizeMotionProjectV3(
      {
        components: [
          {
            id: "button",
            publicTargets: [],
          },
        ],
        bindings: [
          {
            id: "b1",
            source: { kind: "variable", variableId: "v1" },
            target: {
              kind: "component",
              componentId: "button",
              nodeId: "bg-node",
              property: "payload.color",
            },
          },
        ],
      },
      { allowAutoPublicTargets: true },
    );

    const comp = project.components![0]!;
    expect(comp.publicTargets).toHaveLength(1);
    expect(comp.publicTargets![0]!.id).toBe("auto-bg-node-payload-color");
    expect(comp.publicTargets![0]!.nodeId).toBe("bg-node");
    expect(comp.publicTargets![0]!.property).toBe("payload.color");

    const binding = project.bindings![0]!;
    expect((binding.target as Record<string, unknown>).targetId).toBe(
      "auto-bg-node-payload-color",
    );
    expect(issues.some((i) => i.severity === "warn")).toBe(true);
  });

  it("keeps targetId bindings unchanged", () => {
    const { project, issues } = normalizeMotionProjectV3({
      components: [
        {
          id: "button",
          publicTargets: [{ id: "label", nodeId: "n1", property: "p" }],
        },
      ],
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: {
            kind: "component",
            componentId: "button",
            targetId: "label",
          },
        },
      ],
    });

    const binding = project.bindings![0]!;
    expect((binding.target as Record<string, unknown>).targetId).toBe("label");
    expect(issues).toHaveLength(0);
  });

  it("warns when migrating binding for unknown component", () => {
    const { issues } = normalizeMotionProjectV3({
      components: [],
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: {
            kind: "component",
            componentId: "missing",
            nodeId: "n1",
            property: "p",
          },
        },
      ],
    });

    expect(
      issues.some(
        (i) => i.severity === "warn" && i.message.includes("not found"),
      ),
    ).toBe(true);
  });

  it("ignores scene bindings", () => {
    const { project, issues } = normalizeMotionProjectV3({
      bindings: [
        {
          id: "b1",
          source: { kind: "variable", variableId: "v1" },
          target: { kind: "scene", sceneId: "s1", nodeId: "n1", property: "p" },
        },
      ],
    });

    const binding = project.bindings![0]!;
    expect(binding.target).toHaveProperty("nodeId");
    expect(issues).toHaveLength(0);
  });

  it("does not mutate the input", () => {
    const input = {
      components: [
        {
          id: "button",
          variants: { primary: { color: "red" } },
        },
      ],
    };
    const original = JSON.stringify(input);
    normalizeMotionProjectV3(input);
    expect(JSON.stringify(input)).toBe(original);
  });
});
