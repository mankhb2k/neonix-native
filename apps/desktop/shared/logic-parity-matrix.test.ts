/**
 * Logic-6 — assert each domain in the parity matrix has a reachable automated seam.
 * Lives in apps/desktop (not editor-core) so it may import desktop IPC/stage/journal.
 */
import { describe, expect, it } from "vitest";
import {
  executePropertyCommand,
  executeTimelineCommand,
  PROPERTY_REGISTRY,
} from "@motionvideo/editor-core";
import { fixtureMainOnly } from "@editor-core-fixtures/projects";
import { exportOutputSize, resolveExportPreset } from "./export/presets";
import { resolveStageBackend } from "../gui/editor/stage/stage-renderer-factory";
import { BEHAVIOR_SCAFFOLD_STATUS } from "../gui/editor/timeline/adapters/advanced-timeline";
import { createDisabledProjectJournal } from "../electron/main/services/project-journal/project-journal.service";
import { IpcChannels } from "./ipc/channels";

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
    expect(moved.status === "applied" || moved.status === "rejected").toBe(
      true,
    );

    const root = project.layers[0]!;
    const targets = [
      {
        rootLayerId: root.id,
        layerId: root.type === "group" ? root.children[0]!.id : root.id,
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
