/**
 * Seeds real Hub / EditingWorkspace for visual baselines (P20).
 * Only loaded when VITE_ENABLE_UI_FIXTURES=1.
 */

import { buildBlankDesktopProject } from "../../../../src/shared/project-file/envelope";
import type { UiFixtureId } from "./ui-fixture";
import type { RecentProject } from "../../../../src/shared/ipc/contracts";

const stableId = (prefix: string) => `${prefix}_ui_fixture`;

export type ProductionUiSeed =
  | {
      kind: "hub";
      recent: RecentProject[];
    }
  | {
      kind: "editor";
      projectId: string;
      projectName: string;
      documentJson: string;
    };

export function seedProductionUi(fixture: UiFixtureId): ProductionUiSeed {
  if (fixture === "hub-empty") {
    return { kind: "hub", recent: [] };
  }
  if (fixture === "hub-recent") {
    return {
      kind: "hub",
      recent: [
        {
          id: "recent_1",
          name: "Demo Reel",
          path: "D:/fixtures/Demo Reel.moticlip",
          openedAt: "2026-01-15T10:00:00.000Z",
        },
        {
          id: "recent_2",
          name: "Unicode プロジェクト",
          path: "D:/fixtures/Unicode.moticlip",
          openedAt: "2026-01-16T11:00:00.000Z",
        },
      ],
    };
  }

  const built = buildBlankDesktopProject({
    name:
      fixture === "timeline-empty"
        ? "Fixture Timeline"
        : fixture === "sidebar-layers"
          ? "Fixture Layers"
          : "Fixture Editor",
    createId: stableId,
  });
  return {
    kind: "editor",
    projectId: built.projectId,
    projectName: built.envelope.project.metadata.name,
    documentJson: built.documentJson,
  };
}

export function uiFixturesEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_UI_FIXTURES === "1";
}
