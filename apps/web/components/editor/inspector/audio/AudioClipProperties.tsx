"use client";

import { InspectorSection, ReadonlyField } from "../controls/InspectorSection";
import { InspectorSelect } from "../controls/InspectorSelect";
import { NumberField } from "../controls/NumberField";
import { ToggleField } from "../controls/ToggleField";
import type { InspectorCommands } from "../hooks/use-inspector-commands";
import type { InspectorModel } from "../hooks/use-inspector-model";

const DEFAULT_AUDIO_FADE = { duration: 0, curve: "linear" as const };
const toSeconds = (value: number) => value / 1000;
const toMilliseconds = (value: number) => value * 1000;
const clampFade = (value: number, duration: number) => Math.max(0, Math.min(duration, Number.isFinite(value) ? value : 0));

export function AudioClipProperties({ model, commands, open, onToggle }: { model: InspectorModel; commands: InspectorCommands; open: boolean; onToggle: () => void }) {
  const selected = model.selectedAudio;
  if (!selected) return null;
  const { clip, track } = selected;
  const timingStart = toSeconds(clip.timing.start);
  const timingDuration = toSeconds(clip.timing.duration);
  const trimStart = toSeconds(clip.trim.start);
  const trimEnd = clip.trim.end == null ? trimStart + timingDuration : toSeconds(clip.trim.end);
  const fadeIn = clip.fadeIn ?? DEFAULT_AUDIO_FADE;
  const fadeOut = clip.fadeOut ?? DEFAULT_AUDIO_FADE;
  return (
    <div className="min-h-full w-full" data-testid="inspector-audio-properties">
      <InspectorSection label="Media" open={open} onToggle={onToggle}>
        <ReadonlyField label="Asset" value={model.document.assets.find((asset) => asset.id === clip.assetId)?.uri ?? clip.assetId} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Start" step={0.01} suffix="s" value={timingStart} onChange={(value) => commands.patchAudioClip({ timing: { start: toMilliseconds(Math.max(0, value)) } })} />
          <NumberField label="Duration" step={0.01} suffix="s" value={timingDuration} onChange={(value) => commands.patchAudioClip({ timing: { duration: toMilliseconds(Math.max(0.001, value)) } })} />
          <NumberField label="Trim start" step={0.01} suffix="s" value={trimStart} onChange={(value) => commands.patchAudioClip({ trim: { start: toMilliseconds(Math.max(0, value)) } })} />
          <NumberField label="Trim end" step={0.01} suffix="s" value={trimEnd} onChange={(value) => commands.patchAudioClip({ trim: { end: toMilliseconds(Math.max(trimStart + 0.001, value)) } })} />
        </div>
        <NumberField label="Playback rate" step={0.01} value={clip.playbackRate} onChange={(value) => commands.patchAudioClip({ playbackRate: Math.max(0.001, value) })} />
        <ToggleField label="Enabled" checked={clip.enabled} onChange={(checked) => commands.patchAudioClip({ enabled: checked })} />
        <NumberField label="Gain" step={0.1} suffix="dB" value={clip.gainDb} onChange={(value) => commands.patchAudioClip({ gainDb: value })} />
        <NumberField label="Pan" step={0.01} value={clip.pan} onChange={(value) => commands.patchAudioClip({ pan: Math.max(-1, Math.min(1, value)) })} />
        <NumberField label="Track pan" step={0.01} value={track.pan} onChange={(value) => commands.patchAudioTrack({ pan: Math.max(-1, Math.min(1, value)) })} />
        <ToggleField label="Track muted" checked={track.muted} onChange={(checked) => commands.patchAudioTrack({ muted: checked })} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Fade in" step={0.01} suffix="s" value={toSeconds(fadeIn.duration)} onChange={(value) => commands.patchAudioClip({ fadeIn: { duration: toMilliseconds(clampFade(value, timingDuration)), curve: fadeIn.curve } })} />
          <InspectorSelect label="Curve" value={fadeIn.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => commands.patchAudioClip({ fadeIn: { duration: fadeIn.duration, curve: value as "linear" | "equal-power" } })} />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Fade out" step={0.01} suffix="s" value={toSeconds(fadeOut.duration)} onChange={(value) => commands.patchAudioClip({ fadeOut: { duration: toMilliseconds(clampFade(value, timingDuration)), curve: fadeOut.curve } })} />
          <InspectorSelect label="Curve" value={fadeOut.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => commands.patchAudioClip({ fadeOut: { duration: fadeOut.duration, curve: value as "linear" | "equal-power" } })} />
        </div>
      </InspectorSection>
    </div>
  );
}
