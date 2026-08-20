import { describe, expect, it } from "vitest";
import { createV2ShapeProject } from "./fixture";
import {
  MCPCompileProjectInputSchema,
  MCPCreateProjectInputSchema,
  MCPInspectTimelineInputSchema,
  MCPValidateProjectInputSchema,
  listCapabilities,
  inspectTimeline,
} from "../src/mcp";
import { compileProject, createProject, validateProject } from "../src/operations";

describe("MCP Protocol V2 operations", () => {
  it("creates and validates a V2 project", () => {
    const source = createV2ShapeProject("mcp-project");
    const input = MCPCreateProjectInputSchema.parse({
      id: source.id,
      composition: source.composition,
      layers: source.layers,
    });
    const created = createProject(input);
    expect(created.project.formatVersion).toBe(2);
    const validated = validateProject(MCPValidateProjectInputSchema.parse({ project: created.project }));
    expect(validated.valid).toBe(true);
    expect(validated.projectHash).toBeTruthy();
  });

  it("compiles V2 into Runtime IR V2", () => {
    const project = createV2ShapeProject("mcp-compile");
    const result = compileProject(MCPCompileProjectInputSchema.parse({ project }));
    expect(result.diagnostics).toEqual([]);
    expect(result.runtimeProject.formatVersion).toBe(2);
    expect(result.compilerVersion).toBe("protocol-v2");
  });

  it("inspects V2 timing and exposes certified capabilities", () => {
    const project = createV2ShapeProject("mcp-inspect");
    const timelineInput = MCPInspectTimelineInputSchema.parse({ project });
    const timeline = inspectTimeline(timelineInput.project, timelineInput.layerId);
    expect(timeline.totalDuration).toBe(3);
    expect(timeline.layers[0]?.id).toBe("shape");
    expect(listCapabilities("primitive.shape").total).toBeGreaterThanOrEqual(2);
  });
});
