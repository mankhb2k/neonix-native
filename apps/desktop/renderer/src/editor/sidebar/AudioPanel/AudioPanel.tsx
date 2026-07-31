import { DEFAULT_FRAME_DURATION, type TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../shared/use-library-pointer-gesture";
import type { DocumentAssetEntry } from "../../assets/document-assets";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";

type Props = {
  assets: DocumentAssetEntry[];
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

function AudioAssetButton({
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

export function AudioPanel({ assets, onExecuteTimeline }: Props) {
  const audioAssets = assets.filter((a) => a.assetType === "audio");

  const onCommit = (payload: LibraryPayload, point: LibraryCommitPoint) => {
    commitLibraryPayload(payload, point, onExecuteTimeline);
  };

  if (audioAssets.length === 0) {
    return (
      <p className="editor-sidebar__hint">
        Import audio via Media after saving the project.
      </p>
    );
  }

  return (
    <ul className="editor-sidebar__presets">
      {audioAssets.map((asset) => {
        const label = asset.uri.split("/").pop() ?? asset.id;
        const payload: LibraryPayload = {
          kind: "audio",
          id: asset.id,
          label,
          assetId: asset.id,
          uri: asset.uri,
          duration:
            typeof asset.duration === "number" && asset.duration > 0
              ? asset.duration
              : DEFAULT_FRAME_DURATION,
        };
        return (
          <li key={asset.id}>
            <AudioAssetButton payload={payload} onCommit={onCommit} />
          </li>
        );
      })}
    </ul>
  );
}
