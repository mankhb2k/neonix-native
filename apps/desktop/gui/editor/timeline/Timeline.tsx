import { memo } from "react";
import type {
  DocumentPropertyCommand,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-schema";
import { useEditorUiSession } from "../session/editor-ui-session";
import { EMPTY_EDITOR_VIEW_PROPS } from "../workspace-props";
import { TransportBar } from "./Header/TransportBar";
import { TimelineViewport } from "./viewport/TimelineViewport";

export type TimelineProps = {
  focus?: boolean;
  projectId?: string | null;
  project?: MotionProject | null;
  clips?: TimelineClip[];
  lanes?: TimelineLane[];
  fps?: number;
  disabled?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onZoomChange?: (zoom: number) => void;
  onFit?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSplit?: (time: number) => void;
  onDelete?: () => void;
  onSelect?: (selection: import("@motionvideo/editor-core").EditorSelection) => void;
  onExecute?: (command: TimelineCommand, label: string) => void;
  onExecuteProperty?: (input: {
    command: DocumentPropertyCommand;
    label: string;
    coalesceKey?: string;
  }) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
};

const noop = () => undefined;

/**
 * Ready-made timeline board for {@link EditorWorkspaceFrame}.
 * Zoom/selection/clipboard come from editor-ui-session selectors.
 */
export const Timeline = memo(function Timeline({
  focus,
  projectId = null,
  project = null,
  clips = EMPTY_EDITOR_VIEW_PROPS.clips,
  lanes = EMPTY_EDITOR_VIEW_PROPS.lanes,
  fps = 30,
  disabled = false,
  canUndo = false,
  canRedo = false,
  onZoomChange = noop,
  onFit = noop,
  onUndo = noop,
  onRedo = noop,
  onSplit = noop,
  onDelete = noop,
  onSelect = noop,
  onExecute = noop,
  onExecuteProperty = noop,
  onCopy,
  onCut,
  onPaste,
}: TimelineProps) {
  const zoom = useEditorUiSession((s) => s.timelineZoom);
  const timelineZoomScale = useEditorUiSession((s) => s.timelineZoomScale);
  const timelineFitAnchorSeconds = useEditorUiSession(
    (s) => s.timelineFitAnchorSeconds,
  );
  const timelineFitRevision = useEditorUiSession((s) => s.timelineFitRevision);
  const selection = useEditorUiSession((s) => s.selection);
  const canPaste = useEditorUiSession((s) => s.clipboard.length > 0);

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden"
      data-testid="timeline-viewport"
      data-timeline-shell="true"
      data-timeline-focus={focus ? "true" : undefined}
    >
      <TransportBar
        clips={clips}
        selection={selection}
        fps={fps}
        zoom={zoom}
        disabled={disabled}
        canUndo={canUndo}
        canRedo={canRedo}
        onZoomChange={onZoomChange}
        onFit={onFit}
        onUndo={onUndo}
        onRedo={onRedo}
        onSplit={onSplit}
        onDelete={onDelete}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <TimelineViewport
          projectId={projectId}
          project={project}
          clips={clips}
          lanes={lanes}
          fps={fps}
          timelineZoomScale={timelineZoomScale}
          timelineFitAnchorSeconds={timelineFitAnchorSeconds}
          timelineFitRevision={timelineFitRevision}
          selection={selection}
          disabled={disabled}
          canPaste={canPaste}
          onSelect={onSelect}
          onExecute={onExecute}
          onExecuteProperty={onExecuteProperty}
          onCopy={onCopy}
          onCut={onCut}
          onPaste={onPaste}
        />
      </div>
    </div>
  );
});
