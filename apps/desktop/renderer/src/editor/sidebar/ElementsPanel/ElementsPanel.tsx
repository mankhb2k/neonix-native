import { DEFAULT_FRAME_DURATION, type TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../shared/use-library-pointer-gesture";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";

const ELEMENT_PRESETS: LibraryPayload[] = [
  {
    id: "el-rect",
    kind: "shape",
    label: "Rectangle",
    shape: "rect",
    duration: DEFAULT_FRAME_DURATION,
  },
  {
    id: "el-circle",
    kind: "shape",
    label: "Circle",
    shape: "circle",
    duration: DEFAULT_FRAME_DURATION,
  },
];

type Props = {
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

function ElementPresetButton({
  payload,
  onCommit,
}: {
  payload: LibraryPayload;
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const { onPointerDown } = useLibraryPointerGesture(payload, onCommit);
  return (
    <button
      type="button"
      className="editor-sidebar__preset"
      onPointerDown={onPointerDown}
    >
      {payload.label}
    </button>
  );
}

export function ElementsPanel({ onExecuteTimeline }: Props) {
  const onCommit = (payload: LibraryPayload, point: LibraryCommitPoint) => {
    commitLibraryPayload(payload, point, onExecuteTimeline);
  };

  return (
    <ul className="editor-sidebar__presets">
      {ELEMENT_PRESETS.map((payload) => (
        <li key={payload.id}>
          <ElementPresetButton payload={payload} onCommit={onCommit} />
        </li>
      ))}
    </ul>
  );
}
