"use client";

import { DesktopEditorShell } from "@/components/desktop/editor/DesktopEditorShell";
import type { MotionProject } from "@motionvideo/motion-schema";

type Props = {
  initialProject: MotionProject;
};

/**
 * Primary Editor Shell — uses the CapCut-style 4-panel floating card gap layout
 * as the single unified standard for both Desktop and Web environments.
 */
export function EditorShell({ initialProject }: Props) {
  return <DesktopEditorShell initialProject={initialProject} />;
}
