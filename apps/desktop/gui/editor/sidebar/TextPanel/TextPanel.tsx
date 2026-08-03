import { DEFAULT_FRAME_DURATION, type TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../../library/hooks/use-library-pointer-gesture";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";

/** Sidebar text catalog (presets only — not timeline seed). */
export const DEMO_TEXT_PRESETS: LibraryPayload[] = [
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
  {
    id: "text-lower-third",
    kind: "text",
    label: "Lower third",
    text: "Name · Role",
    duration: 4,
  },
  {
    id: "text-caption",
    kind: "text",
    label: "Caption",
    text: "Caption line",
    duration: 3,
  },
  {
    id: "text-cta",
    kind: "text",
    label: "Call to action",
    text: "Learn more →",
    duration: 3,
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
      className="w-full cursor-default rounded-md border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 py-2.5 text-left text-[var(--fg-primary)] hover:bg-[var(--bg-hover)]"
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
    <ul className="m-0 flex list-none flex-col gap-1.5 p-2">
      {DEMO_TEXT_PRESETS.map((payload) => (
        <li key={payload.id}>
          <TextPresetButton payload={payload} onCommit={onCommit} />
        </li>
      ))}
    </ul>
  );
}
