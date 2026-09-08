"use client";

import { Dot } from "lucide-react";
import { ActionButton, InspectorSection } from "../controls/InspectorSection";
import { NumberField } from "../controls/NumberField";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

export function Transform({ model, commands, open, onToggle }: {
  model: InspectorModel;
  commands: InspectorCommands;
  open: boolean;
  onToggle: () => void;
}) {
  if (!model.selected) return null;
  const translateX = model.commonLayerNumber((layer) => layer.transform.translate.x);
  const translateY = model.commonLayerNumber((layer) => layer.transform.translate.y);
  const width = model.commonLayerNumber((layer) => layer.frame.width);
  const height = model.commonLayerNumber((layer) => layer.frame.height);
  const scaleX = model.commonLayerNumber((layer) => layer.transform.scale.x);
  const scaleY = model.commonLayerNumber((layer) => layer.transform.scale.y);
  const rotation = model.commonLayerNumber((layer) => layer.transform.rotate.z);
  const textSizing = model.selected.type === "text" ? model.selected.payload.layout?.sizing : undefined;
  const textWidthAuto = textSizing === "auto-width-height";
  const textHeightAuto = textWidthAuto || textSizing === "fixed-width-auto-height";
  const field = (path: Parameters<InspectorCommands["patchAnimatedValue"]>[0], value: number, fallback: Parameters<InspectorCommands["patchAnimatedValue"]>[2]) => commands.patchAnimatedValue(path, value, fallback);

  return (
    <InspectorSection label="Transform" className="order-0" open={open} onToggle={onToggle}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumberField label="X" step={1} integer suffix="px" value={translateX.value} mixed={model.isMultiLayerSelection && translateX.mixed} keyframed={commands.isKeyframedAtCurrentTime("transform.translate.x")} keyframeDisabled={!model.isPlayheadInsideLayer} onKeyframe={!model.isMultiLayerSelection ? () => commands.setKeyframeAtCurrentTime("transform.translate.x", { type: "number", value: translateX.value }) : undefined} onChange={(value) => field("transform.translate.x", value, { transform: { translate: { x: value } } })} />
        <NumberField label="Y" step={1} integer suffix="px" value={translateY.value} mixed={model.isMultiLayerSelection && translateY.mixed} keyframed={commands.isKeyframedAtCurrentTime("transform.translate.y")} keyframeDisabled={!model.isPlayheadInsideLayer} onKeyframe={!model.isMultiLayerSelection ? () => commands.setKeyframeAtCurrentTime("transform.translate.y", { type: "number", value: translateY.value }) : undefined} onChange={(value) => field("transform.translate.y", value, { transform: { translate: { y: value } } })} />
        <NumberField label="Rotation Z" step={1} integer value={rotation.value} mixed={model.isMultiLayerSelection && rotation.mixed} keyframed={commands.isKeyframedAtCurrentTime("transform.rotate.z")} keyframeDisabled={!model.isPlayheadInsideLayer} onKeyframe={!model.isMultiLayerSelection ? () => commands.setKeyframeAtCurrentTime("transform.rotate.z", { type: "number", value: rotation.value }) : undefined} onChange={(value) => field("transform.rotate.z", value, { transform: { rotate: { z: value } } })} />
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {textWidthAuto ? <div className="col-span-1"><span className="text-[11px] text-[var(--fg-muted)]">Width</span><div className="text-[12px] text-[var(--fg-secondary)]">Auto</div></div> : <NumberField label="Width" step={1} integer suffix="px" value={width.value} mixed={model.isMultiLayerSelection && width.mixed} keyframed={commands.isKeyframedAtCurrentTime("frame.width")} keyframeDisabled={!model.isPlayheadInsideLayer} onKeyframe={!model.isMultiLayerSelection ? () => commands.setKeyframeAtCurrentTime("frame.width", { type: "number", value: width.value }) : undefined} onChange={(value) => field("frame.width", Math.max(1, value), { frame: { width: Math.max(1, value) } })} />}
        {textHeightAuto ? <div className="col-span-1"><span className="text-[11px] text-[var(--fg-muted)]">Height</span><div className="text-[12px] text-[var(--fg-secondary)]">Auto</div></div> : <NumberField label="Height" step={1} integer suffix="px" value={height.value} mixed={model.isMultiLayerSelection && height.mixed} keyframed={commands.isKeyframedAtCurrentTime("frame.height")} keyframeDisabled={!model.isPlayheadInsideLayer} onKeyframe={!model.isMultiLayerSelection ? () => commands.setKeyframeAtCurrentTime("frame.height", { type: "number", value: height.value }) : undefined} onChange={(value) => field("frame.height", Math.max(1, value), { frame: { height: Math.max(1, value) } })} />}
        <NumberField label="Scale X" step={1} integer value={scaleX.value} mixed={model.isMultiLayerSelection && scaleX.mixed} keyframed={commands.isKeyframedAtCurrentTime("transform.scale.x")} keyframeDisabled={!model.isPlayheadInsideLayer} onKeyframe={!model.isMultiLayerSelection ? () => commands.setKeyframeAtCurrentTime("transform.scale.x", { type: "number", value: scaleX.value }) : undefined} onChange={(value) => field("transform.scale.x", Math.max(0.001, value), { transform: { scale: { x: Math.max(0.001, value) } } })} />
        <NumberField label="Scale Y" step={1} integer value={scaleY.value} mixed={model.isMultiLayerSelection && scaleY.mixed} keyframed={commands.isKeyframedAtCurrentTime("transform.scale.y")} keyframeDisabled={!model.isPlayheadInsideLayer} onKeyframe={!model.isMultiLayerSelection ? () => commands.setKeyframeAtCurrentTime("transform.scale.y", { type: "number", value: scaleY.value }) : undefined} onChange={(value) => field("transform.scale.y", Math.max(0.001, value), { transform: { scale: { y: Math.max(0.001, value) } } })} />
        {textSizing && textSizing !== "fixed" && (scaleX.value !== 1 || scaleY.value !== 1) ? <ActionButton label="Reset scale" onClick={() => commands.patchLayer({ transform: { scale: { x: 1, y: 1 } } })} /> : null}
      </div>
      <div className="mx-auto grid w-fit grid-cols-3 gap-1" aria-label="Anchor presets">
        {[0, 0.5, 1].flatMap((y) => [0, 0.5, 1].map((x) => ({ x, y }))).map((preset) => (
          <button key={`${preset.x}-${preset.y}`} type="button" aria-label={`Anchor ${preset.x}, ${preset.y}`} className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-strong)] text-[var(--fg-muted)] data-[active=true]:border-[var(--accent)] data-[active=true]:text-[var(--accent)]" data-active={model.selected!.transform.anchor.x === model.selected!.frame.width * preset.x && model.selected!.transform.anchor.y === model.selected!.frame.height * preset.y} onClick={() => commands.setAnchor(model.selected!.frame.width * preset.x, model.selected!.frame.height * preset.y)}>
            <Dot size={22} strokeWidth={4} fill="currentColor" aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumberField label="Anchor X" step={1} integer suffix="px" value={model.selected.transform.anchor.x} onChange={(value) => commands.setAnchor(value, model.selected!.transform.anchor.y)} />
        <NumberField label="Anchor Y" step={1} integer suffix="px" value={model.selected.transform.anchor.y} onChange={(value) => commands.setAnchor(model.selected!.transform.anchor.x, value)} />
      </div>
    </InspectorSection>
  );
}
