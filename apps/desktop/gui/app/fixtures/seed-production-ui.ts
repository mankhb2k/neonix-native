import { visualLayerAtoms } from "@motionvideo/motion-protocol";
/**
 * Seeds real Home / EditingWorkspace for visual baselines (P20/B1).
 * Only loaded when VITE_ENABLE_UI_FIXTURES=1.
 */

import { DEFAULT_VISUAL_POLICY } from "@motionvideo/editor-core";
import {
  buildBlankDesktopProject,
  serializeDesktopProjectEnvelope,
  type DesktopProjectEnvelope,
} from "../../../shared/project-file/envelope";
import { seedDemoSidebarAssets } from "../../../shared/project-file/seed-demo-sidebar";
import type { UiFixtureId } from "./ui-fixture";
import type { RecentProject } from "../../../shared/ipc/contracts";

const stableId = (prefix: string) => `${prefix}_ui_fixture`;

export type ProductionUiSeed =
  | {
      kind: "home";
      recent: RecentProject[];
    }
  | {
      kind: "editor";
      projectId: string;
      projectName: string;
      documentJson: string;
      /** Force sidebar tab when EditingWorkspace mounts. */
      initialSidebarTab?: "layers" | "media";
      /** Emphasize timeline region for capture. */
      timelineFocus?: boolean;
    };

function withSceneClip(
  envelope: DesktopProjectEnvelope,
  name: string,
): DesktopProjectEnvelope {
  const laneId =
    (envelope.timelineLanes[0] as { id?: string } | undefined)?.id ??
    stableId("lane");
  const sceneId = stableId("scene");
  const clipId = stableId("clip");
  return {
    ...envelope,
    project: {
      ...envelope.project,
      timeline: {
        ...envelope.project.timeline,
        visualTracks: [
          {
            id: "main-track",
            role: "main",
            order: 0,
            clips: [
              {
                id: clipId,
                source: { kind: "scene", sceneId },
                start: 0,
                duration: 4,
              },
            ],
          },
        ],
      },
      scenes: [
        {
          id: sceneId,
          name: "Fixture Scene",
          duration: 4,
          layers: [
            {
              id: stableId("node"),
              type: "text",
              parentLayerId: null,
              zIndex: 0,
              ...visualLayerAtoms({ x: 80, y: 60, width: 240, height: 48, rotation: 0, scaleX: 1, scaleY: 1, originX: 0, originY: 0, opacity: 100, visible: true }),
              payload: {
                text: name ,
                fontSize: 28,
                color: "#000000",
                alignment: "left",
              },
            },
          ],
          clips: [],
        },
      ],
    },
    timelineLanes: [
      {
        id: laneId,
        kind: "visual",
        role: "base",
        name: "Main",
        order: -1,
        policy: { ...DEFAULT_VISUAL_POLICY },
      },
    ],
    timelineClips: [
      {
        id: clipId,
        kind: "scene",
        sceneId,
        laneId,
        startTime: 0,
        duration: 4,
        name: "Fixture Clip",
      },
    ],
  };
}

export function seedProductionUi(fixture: UiFixtureId): ProductionUiSeed {
  if (fixture === "home-empty") {
    return { kind: "home", recent: [] };
  }
  if (fixture === "home-recent") {
    return {
      kind: "home",
      recent: [
        {
          id: "recent_1",
          name: "Parity Fixture",
          path: "D:/fixtures/Parity Fixture.moticlip",
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

  const projectName =
    fixture === "timeline-empty"
      ? "Parity Fixture Timeline"
      : fixture === "sidebar-demo"
        ? "Demo Sidebar Assets"
        : fixture === "sidebar-layers"
          ? "Parity Fixture Layers"
          : "Parity Fixture";

  const built = buildBlankDesktopProject({
    name: projectName,
    createId: stableId,
  });

  let envelope = built.envelope;
  if (fixture === "sidebar-demo") {
    envelope = seedDemoSidebarAssets(envelope, stableId);
  } else if (fixture === "editor-shell" || fixture === "sidebar-layers") {
    envelope = withSceneClip(envelope, projectName);
  }

  return {
    kind: "editor",
    projectId: built.projectId,
    projectName: envelope.project.metadata.name,
    documentJson: serializeDesktopProjectEnvelope(envelope),
    initialSidebarTab: fixture === "sidebar-layers" ? "layers" : "media",
    timelineFocus: fixture === "timeline-empty",
  };
}

export function uiFixturesEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_UI_FIXTURES === "1";
}
