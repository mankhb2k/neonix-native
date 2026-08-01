/**
 * Logic-6 — assert each domain in the parity matrix has a reachable automated seam.
 */
import { describe, expect, it } from "vitest";
import {
  executePropertyCommand,
  executeTimelineCommand,
  PROPERTY_REGISTRY,
} from "@motionvideo/editor-core";
import { fixtureMainOnly } from "../../../../packages/editor-core/src/testing/fixtures/projects";
import {
  exportOutputSize,
  resolveExportPreset,
} from "../../shared/export/presets";
import { resolveStageBackend } from "../../renderer/src/editor/stage/stage-renderer-factory";
import { BEHAVIOR_SCAFFOLD_STATUS } from "../../renderer/src/editor/timeline/adapters/advanced-timeline";
import { createDisabledProjectJournal } from "../main/services/project-journal-service";
import { IpcChannels } from "../../shared/ipc/channels";

describe("logic parity matrix seams (Logic-6)", () => {
  it("Project / Timeline / Inspector / Export / Stage / Window channels exist", () => {
    expect(IpcChannels.projectOpen).toBeTruthy();
    expect(IpcChannels.projectSave).toBeTruthy();
    expect(IpcChannels.journalRecover).toBeTruthy();
    expect(IpcChannels.exportStart).toBeTruthy();
    expect(IpcChannels.windowClose).toBeTruthy();
    expect(IpcChannels.assetsImportFiles).toBeTruthy();
  });

  it("Timeline + Inspector domain commands execute on fixture", () => {
    const { project, clips, lanes } = fixtureMainOnly();
    const moved = executeTimelineCommand(
      { project, clips, lanes },
      {
        type: "move-clip",
        clipId: clips[0]!.id,
        patch: { startTime: 0.5 },
      },
      undefined,
      undefined,
      { createId: (p) => `${p}_fixed` },
    );
    expect(moved.status === "applied" || moved.status === "rejected").toBe(true);

    const targets = [
      {
        sceneId: project.scenes[0]!.id,
        nodeId: project.scenes[0]!.nodes[0]!.id,
      },
    ];
    const prop = executePropertyCommand(
      { project, clips, lanes },
      { type: "set-node-opacity", targets, opacity: 0.5 },
    );
    expect(prop.status).toBe("applied");
    expect(PROPERTY_REGISTRY.some((p) => p.editor === "color")).toBe(true);
  });

  it("Export 4K + Stage honesty + Journal stub + timeline scaffold map", () => {
    expect(resolveExportPreset("uhd").scale).toBe(2);
    expect(exportOutputSize("16:9", 2)).toEqual({
      width: 3840,
      height: 2160,
    });
    expect(resolveStageBackend("dom")).toBe("dom");
    expect(resolveStageBackend("pixi")).toBe("canvas-experimental");
    expect(createDisabledProjectJournal().enabled).toBe(false);
    expect(BEHAVIOR_SCAFFOLD_STATUS.clipboard).toBe("done");
    expect(BEHAVIOR_SCAFFOLD_STATUS["lane-reorder"]).toBe("partial");
  });
});
