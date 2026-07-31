"use client";

import { DesktopEditorShell } from "@/components/desktop/editor/DesktopEditorShell";
import type { EditorProjectSnapshot } from "@/lib/editor/project-storage";

type Props = {
  initialSnapshot: EditorProjectSnapshot;
};

/**
 * Primary Editor Shell — uses the CapCut-style 4-panel floating card gap layout
 * as the single unified standard for both Desktop and Web environments.
 */
export function EditorShell({ initialSnapshot }: Props) {
  return <DesktopEditorShell initialSnapshot={initialSnapshot} />;
}
