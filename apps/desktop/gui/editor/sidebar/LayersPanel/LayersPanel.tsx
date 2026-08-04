import { useState } from "react";
import { Eye, EyeOff, Lock, Unlock, Layers, Box, ArrowLeft, Type, Square, Image as ImageIcon, Music, Film } from "lucide-react";
import {
  selectionClips,
  type EditorSelection,
  type TimelineClip,
  type TimelineCommand,
  type TimelineLane,
} from "@motionvideo/editor-core";
import { useEditorUiSession } from "../../session/editor-ui-session";

type Props = {
  lanes: TimelineLane[];
  clips: TimelineClip[];
  selection: EditorSelection;
  onSelect: (selection: EditorSelection) => void;
  onExecuteTimeline: (command: TimelineCommand, label: string) => void;
};

function clipIcon(clip: TimelineClip) {
  if (clip.kind === "audio") return <Music size={14} className="text-cyan-400" />;
  if (clip.name?.toLowerCase().includes("text") || clip.name?.toLowerCase().includes("văn bản")) {
    return <Type size={14} className="text-blue-400" />;
  }
  if (clip.name?.toLowerCase().includes(" hình") || clip.name?.toLowerCase().includes("shape")) {
    return <Square size={14} className="text-emerald-400" />;
  }
  if (clip.name?.toLowerCase().includes("sticker") || clip.name?.toLowerCase().includes("ảnh")) {
    return <ImageIcon size={14} className="text-purple-400" />;
  }
  return <Film size={14} className="text-cyan-400" />;
}

export function LayersPanel({
  lanes,
  clips,
  selection,
  onSelect,
  onExecuteTimeline,
}: Props) {
  const timelineMode = useEditorUiSession((s) => s.timelineMode);
  const activeContainerClipId = useEditorUiSession((s) => s.activeContainerClipId);
  const enterLayerMode = useEditorUiSession((s) => s.enterLayerMode);
  const exitLayerMode = useEditorUiSession((s) => s.exitLayerMode);

  // Selected clip ID from active selection or active container
  const selectedClipId =
    activeContainerClipId ??
    (selection.kind === "clips" && selection.ids.length > 0 ? selection.ids[0] : null);

  const activeClip = clips.find((c) => c.id === selectedClipId);
  const [hiddenLayerIds, setHiddenLayerIds] = useState<Record<string, boolean>>({});
  const [lockedLayerIds, setLockedLayerIds] = useState<Record<string, boolean>>({});

  const toggleHideLayer = (layerId: string) => {
    setHiddenLayerIds((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  const toggleLockLayer = (layerId: string) => {
    setLockedLayerIds((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  // If a clip is selected/active, display ONLY that clip's inner layers!
  if (activeClip) {
    const isContainer = true;
    const clipName = activeClip.name || activeClip.id;

    // Simulated/Real inner layers array for the container clip
    const innerLayers = [
      { id: `${activeClip.id}-base`, name: clipName, type: activeClip.kind, isBase: true },
    ];

    return (
      <aside className="flex h-full flex-col p-3 gap-3 bg-[var(--bg-panel)]">
        {/* Header: Focused Clip Container */}
        <div className="flex flex-col gap-2 rounded-lg border border-cyan-500/20 bg-cyan-950/20 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Box size={16} className="text-cyan-400 shrink-0" />
              <span className="text-[12px] font-bold text-zinc-100 truncate">
                {clipName}
              </span>
            </div>
            <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
              Container
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800">
            <span>{innerLayers.length} Layer</span>
            {timelineMode === "layer" ? (
              <button
                type="button"
                onClick={exitLayerMode}
                className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
              >
                <ArrowLeft size={11} /> Exit Layer Mode
              </button>
            ) : (
              <button
                type="button"
                onClick={() => enterLayerMode(activeClip.id)}
                className="text-[11px] text-cyan-400 hover:underline font-medium"
              >
                Vào Layer Mode ↵
              </button>
            )}
          </div>
        </div>

        {/* Inner Layers List */}
        <div className="flex flex-col gap-1.5 min-h-0 flex-1 overflow-y-auto">
          <span className="text-[11px] font-semibold text-zinc-400 px-1">
            CÁC LAYER NỘI BỘ
          </span>

          {innerLayers.map((layer) => {
            const isHidden = hiddenLayerIds[layer.id];
            const isLocked = lockedLayerIds[layer.id];

            return (
              <div
                key={layer.id}
                className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-[#18181b] p-2 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {clipIcon(activeClip)}
                  <span className="text-[12px] font-medium text-zinc-200 truncate">
                    {layer.name}
                  </span>
                  {layer.isBase ? (
                    <span className="text-[9px] text-zinc-500 bg-zinc-800 px-1 rounded">
                      Gốc
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-1 shrink-0 text-zinc-400">
                  <button
                    type="button"
                    onClick={() => toggleHideLayer(layer.id)}
                    className="p-1 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                    title={isHidden ? "Hiện layer" : "Ẩn layer"}
                  >
                    {isHidden ? <EyeOff size={13} className="text-red-400" /> : <Eye size={13} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleLockLayer(layer.id)}
                    className="p-1 rounded hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                    title={isLocked ? "Mở khóa" : "Khóa layer"}
                  >
                    {isLocked ? <Lock size={13} className="text-amber-400" /> : <Unlock size={13} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Switch Clip List Selector */}
        <div className="border-t border-zinc-800 pt-2 flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 uppercase px-1">Đổi Clip khác:</span>
          <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
            {clips.map((clip) => (
              <button
                key={clip.id}
                type="button"
                onClick={() => onSelect(selectionClips([clip.id]))}
                className={`text-[11px] px-2 py-1 rounded truncate max-w-[120px] transition-colors ${
                  clip.id === activeClip.id
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {clip.name || clip.id}
              </button>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // If NO clip is selected: Render clean list of clips in the project
  return (
    <aside className="flex h-full flex-col p-3 gap-3 bg-[var(--bg-panel)]">
      <div className="flex items-center justify-between">
        <h2 className="text-[12px] font-semibold text-zinc-200 flex items-center gap-1.5">
          <Layers size={14} className="text-cyan-400" />
          <span>Danh sách Clips ({clips.length})</span>
        </h2>
      </div>

      {clips.length === 0 ? (
        <p className="text-[11px] text-zinc-500 p-1">Chưa có clip nào trong dự án.</p>
      ) : (
        <div className="flex flex-col gap-1.5 overflow-y-auto flex-1">
          {clips.map((clip) => (
            <button
              key={clip.id}
              type="button"
              onClick={() => onSelect(selectionClips([clip.id]))}
              onDoubleClick={() => enterLayerMode(clip.id)}
              className="flex items-center justify-between gap-2 rounded-md border border-zinc-800 bg-[#18181b] p-2 text-left hover:border-cyan-500/50 hover:bg-zinc-800 transition-colors group"
            >
              <div className="flex items-center gap-2 min-w-0">
                {clipIcon(clip)}
                <span className="text-[12px] font-medium text-zinc-200 truncate group-hover:text-cyan-300">
                  {clip.name || clip.id}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">
                {clip.duration.toFixed(1)}s
              </span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
