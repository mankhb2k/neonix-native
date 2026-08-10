import { describe, expect, it } from "vitest";
import {
  getTextPayloadPlain,
  normalizeTextPayloadInput,
  parseMotionProjectV2,
  TextContentSchema,
  TextPayloadSchema,
} from "./index";

describe("rich text content", () => {
  it("normalizes legacy payload.text to content.plain", () => {
    const normalized = normalizeTextPayloadInput({
      text: "Hello",
      fontSize: 42,
    });
    expect(normalized).toEqual({
      content: { kind: "plain", text: "Hello" },
      fontSize: 42,
    });
    const parsed = TextPayloadSchema.parse({ text: "Hello", fontSize: 42 });
    expect(parsed.content).toEqual({ kind: "plain", text: "Hello" });
    expect(getTextPayloadPlain(parsed)).toBe("Hello");
  });

  it("rejects duplicate run ids", () => {
    expect(() =>
      TextContentSchema.parse({
        kind: "runs",
        runs: [
          { id: "a", text: "Hi" },
          { id: "a", text: "!" },
        ],
      }),
    ).toThrow();
  });

  it("parses project with rich text runs", () => {
    const project = parseMotionProjectV2({
      format: "motion-project",
      formatVersion: 2,
      metadata: {
        id: "p1",
        name: "Rich",
        aspectRatio: "9:16",
        fps: 30,
        locale: "vi-VN",
        brand: { name: "Brand" },
      },
      dependencies: { components: [] },
      assets: [],
      variables: [],
      timeline: { sceneOrder: ["s1"], audioTracks: [] },
      scenes: [
        {
          id: "s1",
          duration: 2,
          nodes: [
            {
              id: "t1",
              type: "text",
              parentId: null,
              transform: {
                x: 100,
                y: 100,
                width: 400,
                height: 80,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                anchorX: 0,
                anchorY: 0,
                opacity: 1,
                visible: true,
                flipX: false,
                flipY: false,
              },
              payload: {
                content: {
                  kind: "runs",
                  runs: [
                    { id: "r1", text: "Hello ", style: { fill: "#fff", fontWeight: 700 } },
                    { id: "r2", text: "World", style: { fill: "#0f0" } },
                  ],
                },
                fontSize: 48,
              },
            },
          ],
          clips: [],
        },
      ],
      bindings: [],
      extensions: { constraints: [], events: [] },
    });
    const node = project.scenes[0]!.nodes[0]!;
    expect(node.type).toBe("text");
    if (node.type === "text") {
      expect(getTextPayloadPlain(node.payload)).toBe("Hello World");
    }
  });
});
