"use client";

import { useEffect, useRef } from "react";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import { measureEditorTextLayer } from "@/lib/editor/text/measurement";
import { buildIntrinsicTextFrameUpdate } from "@/lib/editor/text/sizing";
import {
  applyTextDraftToLayer,
  type AudioClipPatch,
  type AudioTrackDocumentPatch,
  type EditorCommand,
  type LayerPatch,
} from "@motionvideo/editor-core";
import {
  buildAlignmentPatches,
  buildPlayheadPropertyPatch,
  buildPlayheadTransformPatch,
  compensateAnchor,
  isLayerKeyframedAtTime,
  layerLocalTimeAtPlayhead,
  toggleNumericKeyframePatch,
  type PlayheadPropertyPath,
} from "@motionvideo/editor-core/interactions/stage";
import type { InspectorModel } from "./use-inspector-model";
import type { FontOption } from "@/lib/api/fonts";
import type {
  V2AnimatableValue,
  V2TextLayout,
  V2TextSource,
  V2TextSpan,
} from "@motionvideo/motion-protocol/v2";

export function numericSvgLength(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "value" in value && typeof value.value === "number") return value.value;
  return fallback;
}

export function useInspectorCommands(model: InspectorModel) {
  const { applyCommand, applyCommands, applyCoalescedCommand } = useEditorActions();
  const selectedText = model.selected?.type === "text" ? model.selected : undefined;
  const selectedTextSpan = selectedText?.payload.chunks[0]?.spans[0];
  const selectedTextFontSize = numericSvgLength(selectedTextSpan?.font.size, 16);
  const documentRef = useRef(model.document);
  const currentTimeRef = useRef(model.currentTime);
  documentRef.current = model.document;
  currentTimeRef.current = model.currentTime;

  const patchLayer = (patch: LayerPatch) => {
    if (model.selected) {
      applyCommand({ type: "patch-layer", layerId: model.selected.id, patch });
    }
  };

  const isKeyframedAtCurrentTime = (path: string) => Boolean(
    !model.isMultiLayerSelection &&
    model.isPlayheadInsideLayer &&
    model.selected &&
    isLayerKeyframedAtTime(model.selected, path, model.localAnimationTime),
  );

  const setKeyframeAtCurrentTime = (path: PlayheadPropertyPath, value: V2AnimatableValue) => {
    if (!model.selected || model.isMultiLayerSelection || !model.isPlayheadInsideLayer) return;
    patchLayer(toggleNumericKeyframePatch(
      model.selected,
      path,
      model.currentTime,
      value.type === "number" ? value.value : 0,
    ));
  };

  const patchSelectedLayers = (patch: LayerPatch) => {
    if (model.isMultiLayerSelection) {
      applyCommand({
        type: "patch-layers",
        patches: Object.fromEntries(model.selectedLayers.map((layer) => [layer.id, patch])),
      });
      return;
    }
    patchLayer(patch);
  };

  const patchAnimatedValue = (
    path: PlayheadPropertyPath,
    value: number,
    fallbackPatch: LayerPatch,
  ) => {
    if (!model.selected || model.isMultiLayerSelection || !model.isPlayheadInsideLayer || !isKeyframedAtCurrentTime(path)) {
      patchSelectedLayers(fallbackPatch);
      return;
    }
    applyCommand({
      type: "patch-layer",
      layerId: model.selected.id,
      patch: buildPlayheadPropertyPatch(
        model.selected,
        model.selectedEvaluated ?? model.selected,
        model.currentTime,
        path,
        value,
      ),
    });
  };

  const patchLayerCoalesced = (historyKey: string, gestureId: number, patch: LayerPatch) => {
    if (!model.selected) return;
    const command = model.isMultiLayerSelection
      ? { type: "patch-layers" as const, patches: Object.fromEntries(model.selectedLayers.map((layer) => [layer.id, patch])) }
      : { type: "patch-layer" as const, layerId: model.selected.id, patch };
    applyCoalescedCommand(`inspector:${model.selected.id}:${historyKey}:${gestureId}`, command);
  };

  const patchAudioClip = (patch: AudioClipPatch) => {
    if (!model.selectedAudio) return;
    applyCommand({
      type: "patch-audio-clip",
      trackId: model.selectedAudio.track.id,
      clipId: model.selectedAudio.clip.id,
      patch,
    });
  };

  const patchAudioTrack = (patch: AudioTrackDocumentPatch) => {
    if (!model.selectedAudio) return;
    applyCommand({ type: "patch-audio-track", trackId: model.selectedAudio.track.id, patch });
  };

  const detachVideoAudio = () => {
    if (model.selected?.type !== "video") return;
    applyCommand({ type: "detach-video-audio", layerId: model.selected.id });
  };

  const alignHorizontal = (mode: "left" | "center" | "right") => {
    if (!model.isMultiLayerSelection) return;
    applyCommand({ type: "patch-layers", patches: buildAlignmentPatches(model.selectedLayers, "horizontal", mode) });
  };

  const alignVertical = (mode: "top" | "middle" | "bottom") => {
    if (!model.isMultiLayerSelection) return;
    applyCommand({ type: "patch-layers", patches: buildAlignmentPatches(model.selectedLayers, "vertical", mode) });
  };

  const setAnchor = (x: number, y: number) => {
    if (!model.selected) return;
    const next = { x, y, z: model.selected.transform.anchor.z };
    patchLayer({ transform: { anchor: next, translate: compensateAnchor(model.selected.transform, next) } });
  };

  const moveStack = (direction: "forward" | "backward") => {
    if (!model.selected) return;
    const siblings = model.document.layers
      .filter((layer) => layer.parentLayerId === model.selected?.parentLayerId)
      .sort((left, right) => left.order - right.order);
    const currentIndex = siblings.findIndex((layer) => layer.id === model.selected?.id);
    const targetIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
    const orderedLayerIds = siblings.map((layer) => layer.id);
    const [moved] = orderedLayerIds.splice(currentIndex, 1);
    if (!moved) return;
    orderedLayerIds.splice(targetIndex, 0, moved);
    applyCommand({ type: "reorder-layers", parentLayerId: model.selected.parentLayerId, orderedLayerIds });
  };

  const patchTextSource = (patch: Partial<V2TextSource>) => {
    if (!selectedText) return;
    const nextSource = { ...selectedText.payload.source, ...patch };
    if (patch.text !== undefined) {
      patchLayer({ payload: applyTextDraftToLayer(selectedText, nextSource.text).payload });
      return;
    }
    patchLayer({ payload: { source: nextSource } });
  };

  const patchTextLayout = (patch: Partial<V2TextLayout>) => {
    if (!selectedText) return;
    const defaultTextLayout: V2TextLayout = {
      sizing: "auto-width-height",
      lineHeight: selectedTextFontSize * 1.2,
      textAlign: "left",
      whiteSpace: "normal",
      wrap: "word",
      textOverflow: "clip",
    };
    patchLayer({ payload: { layout: { ...defaultTextLayout, ...selectedText.payload.layout, ...patch } } });
  };

  const patchTextSpans = (update: (span: V2TextSpan) => V2TextSpan) => {
    if (!selectedText) return;
    patchLayer({
      payload: {
        chunks: selectedText.payload.chunks.map((chunk) => ({
          ...chunk,
          spans: chunk.spans.map(update),
        })),
      },
    });
  };

  const patchTextDecoration = (decoration: "underline" | "overline" | "lineThrough", enabled: boolean) => {
    patchTextSpans((span) => {
      const current = span.textDecoration ?? {};
      if (!enabled) {
        const { [decoration]: _removed, ...rest } = current;
        return { ...span, textDecoration: Object.keys(rest).length > 0 ? rest : undefined };
      }
      return {
        ...span,
        textDecoration: {
          ...current,
          [decoration]: current[decoration] ?? { fill: typeof span.fill === "string" ? span.fill : "#ffffff" },
        },
      };
    });
  };

  const patchTextPath = (pathId: string) => {
    if (!selectedText) return;
    patchLayer({
      payload: {
        chunks: selectedText.payload.chunks.map((chunk) => {
          if (pathId === "none") {
            const { textPath: _removed, ...rest } = chunk;
            return rest;
          }
          return { ...chunk, textPath: { ...(chunk.textPath ?? {}), pathId } };
        }),
      },
    });
  };

  const applyFontFace = (option: FontOption | undefined) => {
    if (!selectedText || !option) return;
    const fontAsset = {
      id: option.fontAssetId,
      kind: "font" as const,
      uri: option.uri,
      weight: option.weight,
      integrity: option.integrity,
    };
    const commands: EditorCommand[] = model.document.assets.some((asset) => asset.id === fontAsset.id)
      ? []
      : [{ type: "add-asset" as const, asset: fontAsset }];
    commands.push({
      type: "patch-layer",
      layerId: selectedText.id,
      patch: {
        payload: {
          chunks: selectedText.payload.chunks.map((chunk) => ({
            ...chunk,
            spans: chunk.spans.map((span) => ({
              ...span,
              resolvedFontAssetIds: [option.fontAssetId],
              font: {
                ...span.font,
                families: [option.familyName, ...span.font.families.slice(1)],
                weight: option.weight,
                style: option.style,
              },
            })),
          })),
        },
      },
    });
    applyCommands(commands);
  };

  useEffect(() => {
    if (model.textEditSession || model.selected?.type !== "text") return undefined;
    const sizing = model.selected.payload.layout?.sizing;
    if (sizing !== "auto-width-height" && sizing !== "fixed-width-auto-height") return undefined;
    const layerId = model.selected.id;
    const playheadTime = currentTimeRef.current;
    const evaluatedSelected = model.selectedEvaluated;
    if (!evaluatedSelected || evaluatedSelected.type !== "text") return undefined;
    let cancelled = false;
    const sampledDocument = {
      ...documentRef.current,
      layers: documentRef.current.layers.map((candidate) => candidate.id === layerId ? evaluatedSelected : candidate),
    };
    void measureEditorTextLayer(sampledDocument, layerId).then((measurement) => {
      if (cancelled || !measurement) return;
      const current = documentRef.current.layers.find((layer) => layer.id === layerId);
      if (current?.type !== "text") return;
      const evaluatedCurrent = model.runtimeSnapshot.evaluatedLayersById.get(layerId) ?? current;
      if (evaluatedCurrent.type !== "text") return;
      const update = buildIntrinsicTextFrameUpdate(evaluatedCurrent, measurement);
      const frameChanged = Math.abs(evaluatedCurrent.frame.width - update.width) > 0.01 || Math.abs(evaluatedCurrent.frame.height - update.height) > 0.01;
      const translateChanged = Math.abs(update.translateX - evaluatedCurrent.transform.translate.x) > 0.01;
      if (!frameChanged && !translateChanged) return;
      const hasTypographyKeyframe = evaluatedCurrent.payload.chunks.some((chunk) =>
        chunk.spans.some((span) => isLayerKeyframedAtTime(
          current,
          `payload.chunks.spans.${span.id}.font.size`,
          layerLocalTimeAtPlayhead(current, playheadTime),
        )),
      );
      applyCommand({
        type: "patch-layer",
        layerId,
        patch: buildPlayheadTransformPatch(current, evaluatedCurrent, playheadTime, {
          translateDelta: { x: update.translateX - evaluatedCurrent.transform.translate.x },
          frameDelta: {
            width: update.width - evaluatedCurrent.frame.width,
            height: update.height - evaluatedCurrent.frame.height,
          },
        }, { autoKey: Boolean(hasTypographyKeyframe) }),
      });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [applyCommand, model.currentTime, model.document, model.runtimeSnapshot, model.selected, model.selectedEvaluated, model.textEditCommitVersion, model.textEditSession]);

  return {
    patchLayer,
    patchSelectedLayers,
    patchAnimatedValue,
    patchLayerCoalesced,
    isKeyframedAtCurrentTime,
    setKeyframeAtCurrentTime,
    patchAudioClip,
    patchAudioTrack,
    detachVideoAudio,
    alignHorizontal,
    alignVertical,
    setAnchor,
    moveStack,
    patchTextSource,
    patchTextLayout,
    patchTextSpans,
    patchTextDecoration,
    patchTextPath,
    applyFontFace,
  };
}

export type InspectorCommands = ReturnType<typeof useInspectorCommands>;
