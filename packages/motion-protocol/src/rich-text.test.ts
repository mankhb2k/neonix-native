import { describe, expect, it } from "vitest";
import {
  getTextPayloadPlain,
  normalizeTextPayloadInput,
  TextContentSchema,
  TextPayloadSchema,
} from "./v3/nodes/text-content";
import { parseMotionProjectV3 } from "./v3";

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
    const project = parseMotionProjectV3({
      format: "motion-project",
      formatVersion: 3,
      metadata: {
        id: "p1",
        name: "Rich",
        locale: "vi-VN",
      },
      composition: { width: 1080, height: 1920, fps: 30 },
      dependencies: { compiler: { range: ">=1.0.0" }, components: [] },
      assets: [],
      variables: [],
      timeline: {
        visualTracks: [
          {
            id: "primary",
            order: 0,
            clips: [
              {
                id: "vclip-s1",
                source: { kind: "scene" as const, sceneId: "s1" },
                start: 0,
                duration: 2,
              },
            ],
          },
        ],
        audioTracks: [],
      },
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
                    {
                      id: "r1",
                      text: "Hello ",
                      style: { fill: "#ffffff", fontWeight: 700 },
                    },
                    { id: "r2", text: "World", style: { fill: "#00ff00" } },
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
      extensions: {},
    });
    const node = project.scenes[0]!.nodes[0]!;
    expect(node.type).toBe("text");
    if (node.type === "text") {
      expect(getTextPayloadPlain(node.payload)).toBe("Hello World");
    }
  });
});
