/**
 * Editor layout barrel — frame + workspace entry for DesktopApp.
 * Frame lives in workspace-frame to avoid circular imports with EditingWorkspace.
 */

export {
  EditorWorkspaceFrame,
  EditorWorkspaceLayout,
} from "./workspace-frame";
export { EditingWorkspace } from "./EditingWorkspace";
export type { EditingWorkspaceProps } from "./EditingWorkspace";
