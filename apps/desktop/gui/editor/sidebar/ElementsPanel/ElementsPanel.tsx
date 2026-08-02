import { DEFAULT_FRAME_DURATION, type TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../../library/hooks/use-library-pointer-gesture";
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
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture(payload, onCommit);
  return (
    <button
      type="button"
      className="w-full cursor-grab rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-[var(--fg-primary)] hover:bg-[var(--bg-hover)] active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
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
    <ul className="m-0 flex list-none flex-col gap-1.5 p-2">
      {ELEMENT_PRESETS.map((payload) => (
        <li key={payload.id}>
          <ElementPresetButton payload={payload} onCommit={onCommit} />
        </li>
      ))}
    </ul>
  );
}
