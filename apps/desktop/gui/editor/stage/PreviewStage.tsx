import type { TimelineClip, TimelineLane } from "@motionvideo/editor-core";
import type { MotionProject } from "@motionvideo/motion-protocol";
import "./stage-layout.css";

type Props = {
  project: MotionProject | null;
  clips: TimelineClip[];
  lanes: TimelineLane[];
};

/** Disable the legacy V1 editor stage until desktop authoring emits Protocol V2. */
export function PreviewStage(props: Props) {
  void props;
  return (
    <div
      className="preview-stage preview-stage--disabled"
      data-testid="preview-stage"
      data-stage-backend="disabled-v1"
    >
      <p>V1 preview disabled</p>
    </div>
  );
}
