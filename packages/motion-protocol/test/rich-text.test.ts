import { describe, expect, it } from "vitest";
import {
  getTextPayloadPlain,
  normalizeTextPayloadInput,
  TextPayloadSchema,
} from "../src/v1/layers/text-content";
import { parseMotionProjectV1 } from "../src/v1";
import { visualLayerAtoms } from "../src/v1/layer-atoms";

describe("V1 text payload", () => {
  it("parses payload.text as the canonical string", () => {
    const parsed = TextPayloadSchema.parse({ text: "Hello", fontSize: 42 });
    expect(parsed.text).toBe("Hello");
    expect(getTextPayloadPlain(parsed)).toBe("Hello");
  });

  it("lifts legacy content.plain to payload.text", () => {
    const normalized = normalizeTextPayloadInput({
      content: { kind: "plain", text: "Hello" },
      fontSize: 42,
    });
    expect(normalized).toEqual({
      text: "Hello",
      fontSize: 42,
    });
  });

  it("rejects rich text runs", () => {
    expect(() =>
      TextPayloadSchema.parse({
        content: {
          kind: "runs",
          runs: [
            { id: "a", text: "Hi" },
            { id: "b", text: "!" },
          ],
        },
        fontSize: 24,
      }),
    ).toThrow();
  });

  it("parses a project with a single-style text layer", () => {
    const project = parseMotionProjectV1({
      format: "motion-project",
      formatVersion: 1,
      metadata: {
        id: "p1",
        name: "Text",
        locale: "vi-VN",
      },
      composition: { width: 1080, height: 1920, fps: 30 },
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      assets: [],
      variables: [],
      timeline: { duration: 2 },
      layers: [
        {
          id: "t1",
          type: "text",
          parentLayerId: null,
          zIndex: 0,
          timing: { start: 0, duration: 2 },
          ...visualLayerAtoms({
            x: 100,
            y: 100,
            width: 400,
            height: 80,
            originX: 0,
            originY: 0,
          }),
          payload: {
            text: "Hello world",
            fontSize: 48,
            color: "#111111",
            alignment: "left",
            wrap: "word",
            overflow: "clip",
          },
        },
      ],
    });
    const node = project.layers[0];
    expect(node?.type).toBe("text");
    if (node?.type === "text") {
      expect(getTextPayloadPlain(node.payload)).toBe("Hello world");
    }
  });
});
