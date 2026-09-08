import { describe, expect, it } from "vitest";
import { createLayoutEngine } from "./engine";
import { parseHtml } from "../html/parser";

describe("layout engine boundary", () => {
  it("records geometry and rejects duplicate anchor names", () => {
    const state = {
      origins: new Map(),
      flowOrigins: new Map(),
      sizes: new Map(),
      layoutBoxes: new Map(),
      layoutOverrides: new Map(),
      anchorBoxes: new Map(),
    };
    const engine = createLayoutEngine(state);
    const node = parseHtml(`<div id="box"></div>`).children[0]!;
    const box = { x: 10, y: 20, width: 100, height: 50, contentX: 10, contentY: 20, contentWidth: 100, contentHeight: 50 };

    engine.record(node, box, 10, 20);
    expect(engine.registerAnchor("hero", box)).toBe(true);
    expect(engine.registerAnchor("hero", box)).toBe(false);
    expect(engine.result().boxes.get(node)).toEqual(box);
  });
});
