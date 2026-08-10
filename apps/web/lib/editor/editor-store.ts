"use client";

import {
  parseMotionProject,
  type MotionProject,
} from "@motionvideo/motion-protocol";
import { validateMotionProjectPresets } from "@motionvideo/motion-compiler";

export { useEditorStore } from "@/lib/editor/store/create-editor-store";
export { nodeText } from "@motionvideo/editor-core";
export type { OverlaySceneItem } from "@motionvideo/editor-core";
export type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
export type {
  EditorState,
  EditorStore,
  EditorStoreActions,
  EditorStoreState,
  SidebarTabId,
} from "@/lib/editor/store/types";

/** Kiểm tra và chuẩn hóa dự án (sanitize audio assets & validate presets) */
export function validateEditorProject(project: MotionProject): MotionProject {
  const sanitizedAssets = project.assets.map((asset) => {
    if (asset.assetType === "audio") {
      return {
        ...asset,
        mimeType: asset.mimeType ?? "audio/mpeg",
        codec: asset.codec ?? "mp3",
      };
    }
    return asset;
  });
  const sanitizedProject = { ...project, assets: sanitizedAssets };
  const parsed = parseMotionProject(sanitizedProject);
  const presets = validateMotionProjectPresets(parsed);
  if (!presets.ok)
    throw new Error(
      `Unknown presets: ${presets.unknown.map((item) => item.preset).join(", ")}`,
    );
  return parsed;
}
