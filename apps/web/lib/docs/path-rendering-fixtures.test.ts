import { describe, expect, it } from "vitest";
import { compileProtocol, compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
import { PATH_RENDERING_FIXTURES } from "./path-rendering-fixtures";

describe("path rendering filter parity fixtures", () => {
  it("compiles every SVG filter fixture into a runtime effect program", () => {
    const filterFixtures = PATH_RENDERING_FIXTURES.filter((fixture) => fixture.svgFilter);
    expect(filterFixtures).toHaveLength(9);

    for (const fixture of filterFixtures) {
      const buffer = compileProtocolToPaintCommands(fixture.project);
      const beginLayer = buffer.commands.find((command) => command.op === "beginLayer");
      expect(beginLayer, fixture.id).toMatchObject({ effectProgram: { ops: expect.any(Array) } });
    }
  });

  it("compiles semantic text fixtures into runtime text nodes", () => {
    const textFixtures = PATH_RENDERING_FIXTURES.filter((fixture) => fixture.svgText);
    expect(textFixtures).toHaveLength(22);

    for (const fixture of textFixtures) {
      const runtime = compileProtocol(fixture.project);
      const textLayerId = fixture.project.layers.find((layer) => layer.type === "text")?.id;
      expect(runtime.visual.nodes.some((node) => node.id === textLayerId && node.content.kind === "text"), fixture.id).toBe(true);
      // Paint commands are intentionally empty until the asynchronous font
      // preparation step resolves glyph outlines for the renderer.
      expect(compileProtocolToPaintCommands(fixture.project).diagnostics.some((diagnostic) => diagnostic.code === "runtime_v2_text_unprepared")).toBe(true);
    }
  });
});
