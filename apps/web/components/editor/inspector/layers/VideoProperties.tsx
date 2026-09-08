"use client";

import { InspectorSection, ActionButton, ReadonlyField } from "../controls/InspectorSection";
import { InspectorSelect } from "../controls/InspectorSelect";
import { NumberField } from "../controls/NumberField";
import { ToggleField } from "../controls/ToggleField";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

const DEFAULT_AUDIO_FADE = { duration: 0, curve: "linear" as const };
const toSeconds = (value: number) => value / 1000;
const toMilliseconds = (value: number) => value * 1000;
const clampFade = (value: number, duration: number) => Math.max(0, Math.min(duration, Number.isFinite(value) ? value : 0));

export function VideoProperties({ model, commands, open, onToggle }: { model: InspectorModel; commands: InspectorCommands; open: boolean; onToggle: () => void }) {
  const selected = model.selected?.type === "video" ? model.selected : undefined;
  if (!selected) return null;
  const source = model.document.assets.find((asset) => asset.id === selected.payload.assetId);
  const sourceDurationMs = source?.kind === "video" ? source.duration : undefined;
  const sourceDuration = sourceDurationMs === undefined ? undefined : toSeconds(sourceDurationMs);
  const trimStart = Math.min(toSeconds(selected.payload.trimStart ?? 0), Math.max(0, (sourceDuration ?? Number.POSITIVE_INFINITY) - 0.001));
  const maxTrimEnd = sourceDuration ?? Number.POSITIVE_INFINITY;
  const trimEnd = Math.min(toSeconds(selected.payload.trimEnd ?? sourceDurationMs ?? selected.timing.duration), maxTrimEnd);
  const audio = selected.payload.audio;
  const fadeIn = audio?.fadeIn ?? DEFAULT_AUDIO_FADE;
  const fadeOut = audio?.fadeOut ?? DEFAULT_AUDIO_FADE;
  const duration = toSeconds(selected.timing.duration);
  return (
    <InspectorSection label="Media" open={open} onToggle={onToggle}>
      <ReadonlyField label="Asset" value={source?.uri ?? selected.payload.assetId} />
      {sourceDuration !== undefined ? <ReadonlyField label="Source duration" value={`${sourceDuration.toFixed(2)} s`} /> : null}
      <InspectorSelect label="Fit" value={selected.payload.fit ?? "contain"} options={[{ value: "contain", label: "Contain" }, { value: "cover", label: "Cover" }, { value: "fill", label: "Fill" }, { value: "none", label: "None" }]} onChange={(value) => commands.patchLayer({ payload: { fit: value as "contain" | "cover" | "fill" | "none" } })} />
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <NumberField label="Trim start" step={0.01} suffix="s" value={trimStart} onChange={(value) => { const maxStart = Math.max(0, Math.min(maxTrimEnd, trimEnd) - 0.001); commands.patchLayer({ payload: { trimStart: toMilliseconds(Math.min(maxStart, Math.max(0, value))) } }); }} />
        <NumberField label="Trim end" step={0.01} suffix="s" value={trimEnd} onChange={(value) => { const minEnd = trimStart + 0.001; commands.patchLayer({ payload: { trimEnd: toMilliseconds(Math.min(maxTrimEnd, Math.max(minEnd, value))) } }); }} />
      </div>
      <ToggleField label="Muted" checked={!(audio?.enabled ?? false)} onChange={(checked) => commands.patchLayer({ payload: { audio: { enabled: !checked, gainDb: audio?.gainDb ?? 0, pan: audio?.pan ?? 0, fadeIn: audio?.fadeIn ?? DEFAULT_AUDIO_FADE, fadeOut: audio?.fadeOut ?? DEFAULT_AUDIO_FADE } } })} />
      {audio ? <>
        <NumberField label="Gain" step={0.1} suffix="dB" value={audio.gainDb} onChange={(value) => commands.patchLayer({ payload: { audio: { gainDb: value } } })} />
        <NumberField label="Pan" step={0.01} value={audio.pan} onChange={(value) => commands.patchLayer({ payload: { audio: { pan: Math.max(-1, Math.min(1, value)) } } })} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Fade in" step={0.01} suffix="s" value={toSeconds(fadeIn.duration)} onChange={(value) => commands.patchLayer({ payload: { audio: { fadeIn: { duration: toMilliseconds(clampFade(value, duration)), curve: fadeIn.curve } } } })} />
          <InspectorSelect label="Curve" value={fadeIn.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => commands.patchLayer({ payload: { audio: { fadeIn: { duration: fadeIn.duration, curve: value as "linear" | "equal-power" } } } })} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Fade out" step={0.01} suffix="s" value={toSeconds(fadeOut.duration)} onChange={(value) => commands.patchLayer({ payload: { audio: { fadeOut: { duration: toMilliseconds(clampFade(value, duration)), curve: fadeOut.curve } } } })} />
          <InspectorSelect label="Curve" value={fadeOut.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => commands.patchLayer({ payload: { audio: { fadeOut: { duration: fadeOut.duration, curve: value as "linear" | "equal-power" } } } })} />
        </div>
        <ActionButton label="Detach audio" onClick={commands.detachVideoAudio} />
      </> : null}
      <InspectorSelect label="Frame policy" value={selected.payload.framePolicy ?? "floor"} options={[{ value: "floor", label: "Floor" }, { value: "round", label: "Round" }, { value: "ceil", label: "Ceil" }]} onChange={(value) => commands.patchLayer({ payload: { framePolicy: value as "floor" | "round" | "ceil" } })} />
    </InspectorSection>
  );
}
