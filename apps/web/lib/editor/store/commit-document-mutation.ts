import {
  documentFromStoreState,
  syncProjectProtocolContract,
  type HistoryEntry,
} from "@motionvideo/editor-core";
import type { WebProjectEnvelope } from "@/lib/editor/authoring/web-project-envelope";
import type { EditorStoreGet, EditorStoreSet } from "@/lib/editor/store/types";
import type { MotionProject } from "@motionvideo/motion-protocol";

/** Push a history entry (owner updates `historyState` + canUndo/canRedo). */
export type HistoryPush = (entry: HistoryEntry) => void;

/**
 * Commit a project mutation with dirty tracking + a single undoable history
 * entry. Optional envelope (locks / userModified) is written in the same set.
 */
export function commitProjectMutation(
  set: EditorStoreSet,
  get: EditorStoreGet,
  pushEntry: HistoryPush,
  args: {
    nextProject: MotionProject;
    label: string;
    envelope?: WebProjectEnvelope | null;
  },
): void {
  const state = get();
  const before = documentFromStoreState(state);
  if (!before) return;
  const project = syncProjectProtocolContract(args.nextProject);
  set({
    project,
    dirtyRevision: state.dirtyRevision + 1,
    ...(args.envelope !== undefined ? { envelope: args.envelope } : {}),
  });
  const after = documentFromStoreState(get());
  if (!after) return;
  pushEntry({
    id: `hist_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
    label: args.label,
    before,
    after,
    beforeSelection: state.selection,
    afterSelection: get().selection,
  });
}
