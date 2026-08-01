import { DEFAULT_FRAME_DURATION, type TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../shared/use-library-pointer-gesture";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";

const TEXT_PRESETS: LibraryPayload[] = [
  {
    id: "text-title",
    kind: "text",
    label: "Title",
    text: "Title",
    duration: DEFAULT_FRAME_DURATION,
  },
  {
    id: "text-subtitle",
    kind: "text",
    label: "Subtitle",
    text: "Subtitle",
    duration: 4,
  },
];

type Props = {
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

function TextPresetButton({
  payload,
  onCommit,
}: {
  payload: LibraryPayload;
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture(payload, onCommit);
  return (
    <button
      type="button"
      className="editor-sidebar__preset"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {payload.label}
    </button>
  );
}

export function TextPanel({ onExecuteTimeline }: Props) {
  const onCommit = (payload: LibraryPayload, point: LibraryCommitPoint) => {
    commitLibraryPayload(payload, point, onExecuteTimeline);
  };

  return (
    <ul className="editor-sidebar__presets">
      {TEXT_PRESETS.map((payload) => (
        <li key={payload.id}>
          <TextPresetButton payload={payload} onCommit={onCommit} />
        </li>
      ))}
    </ul>
  );
}
