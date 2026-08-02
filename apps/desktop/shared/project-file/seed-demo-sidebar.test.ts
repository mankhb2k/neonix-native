import { describe, expect, it } from "vitest";
import { buildBlankDesktopProject } from "./envelope";
import { validateDesktopDocumentJson } from "./validate-document";
import {
  buildDemoSidebarDocumentJson,
  seedDemoSidebarAssets,
} from "./seed-demo-sidebar";

describe("seedDemoSidebarAssets", () => {
  it("adds audio assets without timeline clips or extra lanes", () => {
    const blank = buildBlankDesktopProject({
      name: "Sidebar Demo",
      createId: (p) => `${p}_s`,
    });
    const envelope = seedDemoSidebarAssets(blank.envelope, (p) => `${p}_s`);
    const json = `${JSON.stringify(envelope, null, 2)}\n`;
    const validated = validateDesktopDocumentJson(json);

    expect(validated.project.assets.filter((a) => a.assetType === "audio")).toHaveLength(
      3,
    );
    expect(validated.clips).toHaveLength(0);
    expect(validated.lanes).toHaveLength(1);
    expect(validated.lanes[0]?.kind).toBe("visual");
    expect(validated.project.timeline.audioTracks).toHaveLength(0);
    expect(validated.project.scenes).toHaveLength(0);
  });

  it("buildDemoSidebarDocumentJson validates", () => {
    const demo = buildDemoSidebarDocumentJson({
      name: "Built",
      createId: (p) => `${p}_b`,
    });
    const validated = validateDesktopDocumentJson(demo.documentJson);
    expect(validated.project.assets.length).toBe(3);
    expect(validated.clips).toHaveLength(0);
  });
});
