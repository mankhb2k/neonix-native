import { describe, expect, it } from "vitest";
import { compileProtocolToPaintCommands } from "@motionvideo/motion-compiler";
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
});
