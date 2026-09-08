"use client";

import { useMemo } from "react";
import {
  useEditorDocument,
  useEditorSelection,
  useEditorStore,
  useEditorTextEditCommitVersion,
  useEditorTextEditSession,
} from "@/hooks/editor/use-editor-store";
import { useTransportStore } from "@/hooks/editor/use-transport-store";
import { evaluateStageLayersAtTime } from "@/lib/editor/stage/runtime-query";
import type { EditorStoreState } from "@/lib/editor/state/editor-store";
import type { MotionProtocolV2, V2Layer } from "@motionvideo/motion-protocol/v2";

export type InspectorNumeric = {
  value: number;
  mixed: boolean;
};

export type InspectorModel = {
  document: MotionProtocolV2;
  selectedLayerIds: string[];
  selectedLayers: V2Layer[];
  selected: V2Layer | undefined;
  selectedEvaluated: V2Layer | undefined;
  evaluatedSelectedLayers: V2Layer[];
  runtimeSnapshot: ReturnType<typeof evaluateStageLayersAtTime>;
  currentTime: number;
  isMultiLayerSelection: boolean;
  isPlayheadInsideLayer: boolean;
  localAnimationTime: number;
  diagnostics: EditorStoreState["diagnostics"];
  textEditSession: ReturnType<typeof useEditorTextEditSession>;
  textEditCommitVersion: number;
  selectedAudio: {
    track: MotionProtocolV2["audio"]["tracks"][number];
    clip: MotionProtocolV2["audio"]["tracks"][number]["clips"][number];
  } | null;
  commonLayerNumber: (read: (layer: V2Layer) => number) => InspectorNumeric;
};

export function useInspectorModel(): InspectorModel {
  const document = useEditorDocument();
  const selectedLayerIds = useEditorSelection();
  const currentTime = useTransportStore((state) => state.currentTime);
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const textEditSession = useEditorTextEditSession();
  const textEditCommitVersion = useEditorTextEditCommitVersion();

  const selectedLayers = useMemo(
    () => selectedLayerIds
      .map((id) => document.layers.find((layer) => layer.id === id))
      .filter((layer): layer is V2Layer => Boolean(layer)),
    [document.layers, selectedLayerIds],
  );
  const selected = selectedLayers[0];
  const runtimeSnapshot = useMemo(
    () => evaluateStageLayersAtTime(document, currentTime),
    [currentTime, document],
  );
  const evaluatedSelectedLayers = useMemo(
    () => selectedLayers.map((layer) => runtimeSnapshot.evaluatedLayersById.get(layer.id) ?? layer),
    [runtimeSnapshot.evaluatedLayersById, selectedLayers],
  );
  const selectedEvaluated = selected
    ? runtimeSnapshot.evaluatedLayersById.get(selected.id) ?? selected
    : undefined;
  const isMultiLayerSelection = selectedLayers.length > 1 && selectedLayers.length === selectedLayerIds.length;
  const isPlayheadInsideLayer = Boolean(
    selected &&
    currentTime * 1000 >= selected.timing.start &&
    currentTime * 1000 <= selected.timing.start + selected.timing.duration,
  );
  const localAnimationTime = selected
    ? Math.round(Math.max(0, currentTime * 1000 - selected.timing.start) * 1000) / 1000
    : 0;
  const selectedAudio = useMemo(() => {
    const selectedId = selectedLayerIds[0];
    if (!selectedId?.startsWith("audio.")) return null;
    const clipId = selectedId.slice("audio.".length);
    for (const track of document.audio.tracks) {
      const clip = track.clips.find((candidate) => candidate.id === clipId);
      if (clip) return { track, clip };
    }
    return null;
  }, [document.audio.tracks, selectedLayerIds]);
  const commonLayerNumber = (read: (layer: V2Layer) => number): InspectorNumeric => {
    const values = evaluatedSelectedLayers.map(read);
    const first = values[0] ?? 0;
    return { value: first, mixed: values.some((value) => value !== first) };
  };

  return {
    document,
    selectedLayerIds,
    selectedLayers,
    selected,
    selectedEvaluated,
    evaluatedSelectedLayers,
    runtimeSnapshot,
    currentTime,
    isMultiLayerSelection,
    isPlayheadInsideLayer,
    localAnimationTime,
    diagnostics,
    textEditSession,
    textEditCommitVersion,
    selectedAudio,
    commonLayerNumber,
  };
}
