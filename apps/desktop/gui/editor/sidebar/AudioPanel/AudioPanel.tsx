import { DEFAULT_FRAME_DURATION, type TimelineCommand } from "@motionvideo/editor-core";
import { commitLibraryPayload } from "../../library/adapters/commit-library-payload";
import { useLibraryPointerGesture } from "../../library/hooks/use-library-pointer-gesture";
import type { DocumentAssetEntry } from "../../assets/document-assets";
import type { LibraryCommitPoint } from "../../library/adapters/commit-library-payload";
import type { LibraryPayload } from "../../library/model/library-payload";

/** Sidebar audio catalog (always visible — not timeline seed). */
export const DEMO_AUDIO_PRESETS: LibraryPayload[] = [
  {
    kind: "audio",
    id: "demo-audio-bgm",
    label: "BGM bed",
    assetId: "demo_asset_bgm",
    uri: "demo://audio/bgm-bed.mp3",
    duration: 8,
  },
  {
    kind: "audio",
    id: "demo-audio-sfx",
    label: "SFX hit",
    assetId: "demo_asset_sfx",
    uri: "demo://audio/sfx-hit.wav",
    duration: 2.5,
  },
  {
    kind: "audio",
    id: "demo-audio-vo",
    label: "Voiceover",
    assetId: "demo_asset_vo",
    uri: "demo://audio/voiceover.mp3",
    duration: 5,
  },
];

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

function assetToPayload(asset: DocumentAssetEntry): LibraryPayload {
  const fileName = asset.uri.split("/").pop() ?? asset.id;
  const label = fileName.replace(/\.[^.]+$/, "") || fileName;
  return {
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
}

export function AudioPanel({ assets, onExecuteTimeline }: Props) {
  const projectAudio = assets
    .filter((a) => a.assetType === "audio")
    .map(assetToPayload);
  const projectIds = new Set(projectAudio.map((p) => p.assetId));
  const tiles = [
    ...DEMO_AUDIO_PRESETS.filter((p) => !projectIds.has(p.assetId)),
    ...projectAudio,
  ];

  const onCommit = (payload: LibraryPayload, point: LibraryCommitPoint) => {
    commitLibraryPayload(payload, point, onExecuteTimeline);
  };

  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-2">
      {tiles.map((payload) => (
        <li key={payload.id}>
          <AudioAssetButton payload={payload} onCommit={onCommit} />
        </li>
      ))}
    </ul>
  );
}
