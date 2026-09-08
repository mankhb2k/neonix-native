import { flushSync } from "react-dom";
import { stageInteractionStore } from "@/lib/store/stage-interaction-store";
import type { EditorCommand } from "@motionvideo/editor-core";

type PreviewCommand = (command: EditorCommand | null) => void;
type ApplyCommand = (command: EditorCommand) => boolean;

export function previewStageCommand(
  previewCommand: PreviewCommand,
  command: EditorCommand | null,
): void {
  previewCommand(command);
}

export function commitStageCommand(input: {
  sourceProject: unknown;
  command: EditorCommand;
  applyCommand: ApplyCommand;
}): boolean {
  stageInteractionStore.beginCommit(input.sourceProject);
  let applied = false;
  try {
    flushSync(() => {
      applied = input.applyCommand(input.command);
    });
  } catch (error) {
    stageInteractionStore.cancelCommit();
    stageInteractionStore.clear();
    throw error;
  }
  if (!applied) {
    stageInteractionStore.cancelCommit();
    stageInteractionStore.clear();
  }
  return applied;
}

export function cancelStageCommand(previewCommand: PreviewCommand): void {
  previewCommand(null);
  stageInteractionStore.cancelCommit();
  stageInteractionStore.clear();
}
