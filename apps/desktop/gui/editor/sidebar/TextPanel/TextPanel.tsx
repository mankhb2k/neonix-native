import { DEFAULT_FRAME_DURATION, type TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../../library/hooks/use-library-pointer-gesture";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";
import { PresetTile } from "../../../ui";

const ABC_TEXT_PAYLOAD: LibraryPayload = {
  id: "text-abc",
  kind: "text",
  label: "Văn bản ABC",
  text: "ABC",
  duration: DEFAULT_FRAME_DURATION,
};

type Props = {
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

function AbcTextPresetItem({
  onCommit,
}: {
  onCommit: (payload: LibraryPayload, point: LibraryCommitPoint) => void;
}) {
  const { onPointerDown, onKeyDown } = useLibraryPointerGesture(
    ABC_TEXT_PAYLOAD,
    onCommit
  );

  return (
    <PresetTile
      title={ABC_TEXT_PAYLOAD.label}
      paddingClassName="p-1"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      <span className="text-[18px] font-extrabold text-white tracking-wider drop-shadow-sm select-none">
        ABC
      </span>
    </PresetTile>
  );
}

export function TextPanel({ onExecuteTimeline }: Props) {
  const onCommit = (payload: LibraryPayload, point: LibraryCommitPoint) => {
    commitLibraryPayload(payload, point, onExecuteTimeline);
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <h4 className="text-[12px] font-semibold text-[var(--fg-primary)]">
        Mẫu văn bản
      </h4>
      <div className="flex flex-wrap gap-2">
        <AbcTextPresetItem onCommit={onCommit} />
      </div>
    </div>
  );
}
