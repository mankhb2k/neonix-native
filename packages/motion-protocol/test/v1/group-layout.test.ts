import { describe, expect, it } from "vitest";
import { parseMotionProjectV1 } from "../../src/v1";

describe("group layout", () => {
  it("parses css-like group.layout with child layoutItem policies", () => {
    const project = parseMotionProjectV1({
      format: "motion-project",
      formatVersion: 1,
      metadata: {
        id: "project-group-layout",
        name: "Group layout sample",
        locale: "en-US",
      },
      composition: {
        width: 1920,
        height: 1080,
        fps: 30,
      },
      assets: [
        {
          id: "img-1",
          kind: "image",
          source: {
            kind: "url",
            url: "https://example.com/image.png",
          },
        },
      ],
      components: [],
      layers: [
        {
          id: "stack",
          type: "group",
          parentLayerId: null,
          zIndex: 0,
          frame: { width: 800, height: 240 },
          transform: { translate: { x: 0, y: 0 } },
          timing: { start: 0, duration: 4 },
          layout: {
            mode: "row",
            gap: 24,
            align: "center",
            justify: "start",
            padding: 16,
          },
          children: [
            {
              id: "title",
              type: "text",
              parentLayerId: "stack",
              zIndex: 0,
              frame: { width: 200, height: 80 },
              transform: { translate: { x: 0, y: 0 } },
              timing: { start: 0, duration: 4 },
              layoutItem: {
                width: "hug",
                alignSelf: "stretch",
              },
              payload: {
                text: "Hello",
                fontSize: 48,
                color: "#ffffff",
              },
            },
            {
              id: "art",
              type: "image",
              parentLayerId: "stack",
              zIndex: 1,
              frame: { width: 160, height: 160 },
              transform: { translate: { x: 0, y: 0 } },
              timing: { start: 0, duration: 4 },
              layoutItem: {
                width: "fixed",
                height: "fixed",
              },
              payload: {
                assetId: "img-1",
              },
            },
          ],
        },
      ],
    });

    const stack = project.layers[0];
    expect(stack.type).toBe("group");
    if (stack.type !== "group") return;

    expect(stack.layout?.mode).toBe("row");
    const title = stack.children[0];
    expect("layoutItem" in title ? title.layoutItem?.width : undefined).toBe(
      "hug",
    );
  });
});
