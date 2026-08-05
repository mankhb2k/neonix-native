/**
 * Web editor UI seeds (patterned after desktop seed-production-ui — no desktop imports).
 */
import { createBlankProject } from "@/lib/editor/create-blank-project";
import type { EditorProjectSnapshot } from "@/lib/editor/project-storage";
import { sceneOrderToTimelineClips } from "@/lib/editor/timeline/scene-order-clips";
import { createFacebookHistoryDemoProject } from "@motionvideo/remotion-renderer";
import { parseMotionProject } from "@motionvideo/motion-schema";

export type WebUiFixtureId =
  | "blank-16x9"
  | "blank-9x16"
  | "facebook-history";

export type WebEditorSeed = {
  kind: "editor";
  projectId: string;
  projectName: string;
  snapshot: EditorProjectSnapshot;
};

function withUniqueId(
  project: ReturnType<typeof createFacebookHistoryDemoProject>,
  id: string,
  name: string,
) {
  return parseMotionProject({
    ...project,
    metadata: {
      ...project.metadata,
      id,
      name,
    },
  });
}

/** Build a loadable editor snapshot for demos / e2e (localStorage-ready). */
export function seedWebEditorUi(fixture: WebUiFixtureId): WebEditorSeed {
  if (fixture === "facebook-history") {
    const project = withUniqueId(
      createFacebookHistoryDemoProject(),
      `proj_fb_seed_${Date.now().toString(36)}`,
      "Facebook History — Demo",
    );
    const { lanes, clips } = sceneOrderToTimelineClips(project);
    return {
      kind: "editor",
      projectId: project.metadata.id,
      projectName: project.metadata.name,
      snapshot: {
        project,
        timelineClips: clips,
        timelineLanes: lanes,
        overlayScenes: [],
      },
    };
  }

  const aspectRatio = fixture === "blank-9x16" ? "9:16" : "16:9";
  const name =
    fixture === "blank-9x16" ? "TikTok Shorts 9:16" : "YouTube Motion 16:9";
  const project = createBlankProject({ name, aspectRatio });
  return {
    kind: "editor",
    projectId: project.metadata.id,
    projectName: project.metadata.name,
    snapshot: {
      project,
      timelineClips: [],
      timelineLanes: [],
      overlayScenes: [],
    },
  };
}
