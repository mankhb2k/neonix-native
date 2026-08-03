import type {
  EditorSelection,
  TimelineClip,
  TimelineCommand,
  TimelineLane,
} from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-schema";
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
  timelineZoomScale?: number;
  timelineFitAnchorSeconds?: number | null;
  timelineFitRevision?: number;
  selection?: EditorSelection;
  disabled?: boolean;
  canPaste?: boolean;
  zoom?: number;
  canUndo?: boolean;
  canRedo?: boolean;
  onZoomChange?: (zoom: number) => void;
  onFit?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSplit?: (time: number) => void;
  onDelete?: () => void;
  onSelect?: (selection: EditorSelection) => void;
  onExecute?: (command: TimelineCommand, label: string) => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
};

const noop = () => undefined;

/**
 * Ready-made timeline board for {@link EditorWorkspaceFrame}.
 * Pass session props from EditingWorkspace; omit for empty shell mount.
 */
export function Timeline({
  focus,
  projectId = null,
  project = null,
  clips = EMPTY_EDITOR_VIEW_PROPS.clips,
  lanes = EMPTY_EDITOR_VIEW_PROPS.lanes,
  fps = 30,
  timelineZoomScale = 1,
  timelineFitAnchorSeconds = null,
  timelineFitRevision = 0,
  selection = EMPTY_EDITOR_VIEW_PROPS.selection,
  disabled = false,
  canPaste = false,
  zoom = 50,
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
  onCopy,
  onCut,
  onPaste,
}: TimelineProps) {
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
          onCopy={onCopy}
          onCut={onCut}
          onPaste={onPaste}
        />
      </div>
    </div>
  );
}
