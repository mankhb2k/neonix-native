import { describe, expect, it } from "vitest";
import {
  assertUhdOutputSize,
  exportOutputSize,
  resolveExportPreset,
} from "../../shared/export/presets";

describe("export presets Logic-3", () => {
  it("resolves uhd and 4k at scale 2", () => {
    expect(resolveExportPreset("uhd").scale).toBe(2);
    expect(resolveExportPreset("4k").scale).toBe(2);
    expect(resolveExportPreset("uhd").id).toBe("uhd");
    expect(resolveExportPreset("4k").id).toBe("4k");
  });

  it("computes 2160p output for 16:9 at scale 2", () => {
    const size = exportOutputSize("16:9", 2);
    expect(size).toEqual({ width: 3840, height: 2160 });
    expect(() => assertUhdOutputSize(size)).not.toThrow();
  });

  it("computes portrait 4K long-edge for 9:16", () => {
    expect(exportOutputSize("9:16", 2)).toEqual({
      width: 2160,
      height: 3840,
    });
  });
});
