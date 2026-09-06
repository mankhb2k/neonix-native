"use client";

import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ChevronDown,
  Dot,
  Diamond,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Panel, Tabs } from "@/components/ui";
import { useEditorActions } from "@/hooks/editor/use-editor-actions";
import {
  useEditorDocument,
  useEditorSelection,
  useEditorStore,
  useEditorTextEditCommitVersion,
  useEditorTextEditSession,
} from "@/hooks/editor/use-editor-store";
import { useTransportStore } from "@/hooks/editor/use-transport-store";
import { listFonts, type FontOption } from "@/lib/api/fonts";
import {
  buildPlayheadTransformPatch,
  evaluateLayerAtPlayhead,
  isLayerKeyframedAtTime,
  layerLocalTimeAtPlayhead,
} from "@/lib/editor/animation/keyframes";
import { buildAlignmentPatches, compensateAnchor } from "@/lib/editor/inspector/transform";
import { measureEditorTextLayer } from "@/lib/editor/text/measurement";
import { buildIntrinsicTextFrameUpdate } from "@/lib/editor/text/sizing";
import { EffectsInspector } from "./EffectsInspector";
import { InspectorSelect } from "./InspectorSelect";
import { StepperInput } from "./StepperInput";
import type {
  AudioClipPatch,
  AudioTrackDocumentPatch,
  LayerPatch,
  EditorCommand,
} from "@motionvideo/editor-core";
import type {
  V2AnimatableValue,
  V2AudioClip,
  V2AudioTrack,
  V2Layer,
  V2TextLayout,
  V2TextSource,
  V2TextSpan,
  V2Track,
} from "@motionvideo/motion-protocol/v2";

const inputClass =
  "h-7 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] px-2 text-[12px] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)]";

const DEFAULT_AUDIO_FADE = { duration: 0, curve: "linear" as const };

const TEXT_SIZING_OPTIONS = [
  { value: "auto-width-height", label: "Auto width / height" },
  { value: "fixed-width-auto-height", label: "Fixed width / auto height" },
  { value: "fixed", label: "Fixed" },
] as const;

const TEXT_DIRECTION_OPTIONS = [
  { value: "ltr", label: "Left to right" },
  { value: "rtl", label: "Right to left" },
] as const;

const TEXT_WRITING_MODE_OPTIONS = [
  { value: "horizontal-tb", label: "Horizontal" },
  { value: "vertical-rl", label: "Vertical right to left" },
  { value: "vertical-lr", label: "Vertical left to right" },
] as const;

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
  { value: "start", label: "Start" },
  { value: "end", label: "End" },
  { value: "justify", label: "Justify" },
  { value: "justify-all", label: "Justify all" },
] as const;

const TEXT_WRAP_OPTIONS = [
  { value: "none", label: "None" },
  { value: "word", label: "Word" },
  { value: "character", label: "Character" },
] as const;

const TEXT_WHITE_SPACE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "nowrap", label: "No wrap" },
  { value: "pre", label: "Preserve" },
  { value: "pre-wrap", label: "Preserve + wrap" },
  { value: "pre-line", label: "Preserve lines" },
  { value: "break-spaces", label: "Break spaces" },
] as const;

const TEXT_OVERFLOW_OPTIONS = [
  { value: "clip", label: "Clip" },
  { value: "ellipsis", label: "Ellipsis" },
] as const;

const TEXT_RENDERING_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "optimizeSpeed", label: "Optimize speed" },
  { value: "geometricPrecision", label: "Geometric precision" },
] as const;

const TEXT_BASELINE_OPTIONS = [
  "auto", "use-script", "no-change", "reset-size", "ideographic", "alphabetic", "hanging", "mathematical", "central", "middle", "text-after-edge", "text-before-edge",
].map((value) => ({ value, label: value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }));

const TEXT_ALIGNMENT_BASELINE_OPTIONS = [
  "auto", "baseline", "before-edge", "text-before-edge", "middle", "central", "after-edge", "text-after-edge", "ideographic", "alphabetic", "hanging", "mathematical",
].map((value) => ({ value, label: value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }));

const TEXT_LENGTH_ADJUST_OPTIONS = [
  { value: "spacing", label: "Spacing" },
  { value: "spacingAndGlyphs", label: "Spacing and glyphs" },
] as const;

const TEXT_PATH_METHOD_OPTIONS = [
  { value: "align", label: "Align" },
  { value: "stretch", label: "Stretch" },
] as const;

const TEXT_PATH_SPACING_OPTIONS = [
  { value: "auto", label: "Auto" },
  { value: "exact", label: "Exact" },
] as const;

/** Inspector controls display seconds while Protocol V2 persists milliseconds. */
const protocolMillisecondsToSeconds = (value: number): number => value / 1000;
const secondsToProtocolMilliseconds = (value: number): number => value * 1000;

function clampFadeDuration(value: number, clipDuration: number): number {
  return Math.max(0, Math.min(clipDuration, Number.isFinite(value) ? value : 0));
}

function numericSvgLength(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "value" in value && typeof value.value === "number") return value.value;
  return fallback;
}

/** Languages currently shipped by the web editor for text layers. */
const SHIPPED_TEXT_LANGUAGES = [
  { value: "vi", label: "Vietnamese" },
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh-CN", label: "Simplified Chinese" },
] as const;

function InspectorSection({
  label,
  open,
  onToggle,
  children,
  className,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-[var(--border-subtle)] ${className ?? ""}`}>
      <button
        type="button"
        className="flex min-h-9 w-full items-center justify-between px-0 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]"
        aria-expanded={open}
        onClick={onToggle}
      >
        {label}
        <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open ? <div className="space-y-2 px-0 pb-3">{children}</div> : null}
    </section>
  );
}

function NumberField({
  label,
  value,
  step = 0.01,
  integer = false,
  mixed = false,
  suffix,
  keyframed = false,
  keyframeDisabled = false,
  onKeyframe,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  integer?: boolean;
  mixed?: boolean;
  suffix?: string;
  keyframed?: boolean;
  keyframeDisabled?: boolean;
  onKeyframe?: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <StepperInput label={label} value={value} step={step} integer={integer} mixed={mixed} suffix={suffix} onChange={onChange} />
        {onKeyframe ? <KeyframeButton label={label} active={keyframed} disabled={keyframeDisabled} onClick={onKeyframe} /> : null}
      </span>
    </label>
  );
}

type TextSpan = V2TextSpan;

function variableAxesLabel(variations: Record<string, number> | undefined): string {
  if (!variations || Object.keys(variations).length === 0) return "None";
  return Object.entries(variations).map(([axis, value]) => `${axis}=${value}`).join(", ");
}

function parseVariableAxes(value: string): Record<string, number> | undefined {
  const axes: Record<string, number> = {};
  for (const item of value.split(",")) {
    const [rawTag, rawValue] = item.split("=").map((part) => part?.trim());
    if (!rawTag && !rawValue) continue;
    if (!rawTag || rawTag.length !== 4 || rawValue === undefined || !Number.isFinite(Number(rawValue))) return undefined;
    axes[rawTag] = Number(rawValue);
  }
  return Object.keys(axes).length > 0 ? axes : undefined;
}

function RangeField({
  label,
  value,
  mixed = false,
  keyframed = false,
  keyframeDisabled = false,
  onKeyframe,
  onChange,
}: {
  label: string;
  value: number;
  mixed?: boolean;
  keyframed?: boolean;
  keyframeDisabled?: boolean;
  onKeyframe?: () => void;
  onChange: (value: number, gestureId: number) => void;
}) {
  const gestureRef = useRef(0);
  const percentage = Math.round(value * 100);
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <StepperInput
          label={`${label} percent`}
          value={percentage}
          min={0}
          max={100}
          step={1}
          suffix="%"
          mixed={mixed}
          live
          onGestureStart={() => {
            gestureRef.current += 1;
          }}
          onChange={(next) => onChange(next / 100, gestureRef.current)}
        />
        {onKeyframe ? <KeyframeButton label={label} active={keyframed} disabled={keyframeDisabled} onClick={onKeyframe} /> : null}
      </span>
    </label>
  );
}

function KeyframeButton({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const action = disabled ? "Move the playhead inside the layer duration" : active ? "Remove" : "Add";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`${action} keyframe${disabled ? "" : ` for ${label}`}`}
      title={disabled ? `${action} to add a keyframe` : `${action} keyframe at current time`}
      data-active={active}
      className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-[var(--fg-muted)] data-[active=true]:text-[var(--accent)]"
      onClick={onClick}
    >
      <Diamond size={13} fill={active ? "currentColor" : "none"} strokeWidth={1.8} />
    </button>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <span className="max-w-[7rem] truncate text-right font-mono text-[11px] text-[var(--fg-secondary)]">{value}</span>
    </div>
  );
}

function TextAreaField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => onCommit(draft.normalize("NFC"));
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[var(--fg-muted)]">{label}</span>
      <textarea
        className={`${inputClass} min-h-16 resize-y py-1.5`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-7 items-center justify-between gap-2 text-[11px] text-[var(--fg-muted)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--accent)]"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <input
        type="color"
        className="h-7 w-12 appearance-none rounded border-2 border-[var(--border-strong)] bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:border-0"
        value={value.startsWith("#") ? value.slice(0, 7) : "#ffffff"}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </label>
  );
}

function ActionButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="h-7 flex-1 rounded-md border border-[var(--border-strong)] px-2 text-[11px] text-[var(--fg-secondary)] disabled:opacity-40"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function IconActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex h-7 items-center justify-center rounded-md border border-[var(--border-strong)] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function EmptyInspector({
  width,
  height,
  fps,
  background,
}: {
  width: number;
  height: number;
  fps: number;
  background: string;
}) {
  return (
    <div className="space-y-3" data-testid="inspector-empty">
      <div className="rounded-md border border-dashed border-[var(--border-strong)] px-3 py-4 text-[12px] text-[var(--fg-muted)]">
        Select a layer in the sidebar or timeline to view its properties.
      </div>
      <InspectorSection label="Composition" open onToggle={() => undefined}>
        <ReadonlyField label="Size" value={`${width} × ${height}`} />
        <ReadonlyField label="FPS" value={`${fps}`} />
        <ReadonlyField label="Background" value={background} />
      </InspectorSection>
    </div>
  );
}

function AudioInspector({
  clip,
  track,
  assetLabel,
  open,
  onToggle,
  onClipPatch,
  onTrackPatch,
}: {
  clip: V2AudioClip;
  track: V2AudioTrack;
  assetLabel: string;
  open: boolean;
  onToggle: () => void;
  onClipPatch: (patch: AudioClipPatch) => void;
  onTrackPatch: (patch: AudioTrackDocumentPatch) => void;
}) {
  const timingStart = protocolMillisecondsToSeconds(clip.timing.start);
  const timingDuration = protocolMillisecondsToSeconds(clip.timing.duration);
  const trimStart = protocolMillisecondsToSeconds(clip.trim.start);
  const trimEnd = clip.trim.end == null
    ? trimStart + timingDuration
    : protocolMillisecondsToSeconds(clip.trim.end);
  const fadeIn = clip.fadeIn ?? DEFAULT_AUDIO_FADE;
  const fadeOut = clip.fadeOut ?? DEFAULT_AUDIO_FADE;
  return (
    <div className="min-h-full w-full" data-testid="inspector-audio-properties">
      <InspectorSection label="Media" open={open} onToggle={onToggle}>
        <ReadonlyField label="Asset" value={assetLabel} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Start" step={0.01} suffix="s" value={timingStart} onChange={(value) => onClipPatch({ timing: { start: secondsToProtocolMilliseconds(Math.max(0, value)) } })} />
          <NumberField label="Duration" step={0.01} suffix="s" value={timingDuration} onChange={(value) => onClipPatch({ timing: { duration: secondsToProtocolMilliseconds(Math.max(0.001, value)) } })} />
          <NumberField label="Trim start" step={0.01} suffix="s" value={trimStart} onChange={(value) => onClipPatch({ trim: { start: secondsToProtocolMilliseconds(Math.max(0, value)) } })} />
          <NumberField label="Trim end" step={0.01} suffix="s" value={trimEnd} onChange={(value) => onClipPatch({ trim: { end: secondsToProtocolMilliseconds(Math.max(trimStart + 0.001, value)) } })} />
        </div>
        <NumberField label="Playback rate" step={0.01} value={clip.playbackRate} onChange={(value) => onClipPatch({ playbackRate: Math.max(0.001, value) })} />
        <ToggleField label="Enabled" checked={clip.enabled} onChange={(checked) => onClipPatch({ enabled: checked })} />
        <NumberField label="Gain" step={0.1} suffix="dB" value={clip.gainDb} onChange={(value) => onClipPatch({ gainDb: value })} />
        <NumberField label="Pan" step={0.01} value={clip.pan} onChange={(value) => onClipPatch({ pan: Math.max(-1, Math.min(1, value)) })} />
        <NumberField label="Track pan" step={0.01} value={track.pan} onChange={(value) => onTrackPatch({ pan: Math.max(-1, Math.min(1, value)) })} />
        <ToggleField label="Track muted" checked={track.muted} onChange={(checked) => onTrackPatch({ muted: checked })} />
        {(() => {
          return (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <NumberField label="Fade in" step={0.01} suffix="s" value={protocolMillisecondsToSeconds(fadeIn.duration)} onChange={(value) => onClipPatch({ fadeIn: { duration: secondsToProtocolMilliseconds(clampFadeDuration(value, timingDuration)), curve: fadeIn.curve } })} />
                <InspectorSelect label="Curve" value={fadeIn.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => onClipPatch({ fadeIn: { duration: fadeIn.duration, curve: value as "linear" | "equal-power" } })} />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <NumberField label="Fade out" step={0.01} suffix="s" value={protocolMillisecondsToSeconds(fadeOut.duration)} onChange={(value) => onClipPatch({ fadeOut: { duration: secondsToProtocolMilliseconds(clampFadeDuration(value, timingDuration)), curve: fadeOut.curve } })} />
                <InspectorSelect label="Curve" value={fadeOut.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => onClipPatch({ fadeOut: { duration: fadeOut.duration, curve: value as "linear" | "equal-power" } })} />
              </div>
            </>
          );
        })()}
      </InspectorSection>
    </div>
  );
}

function TextInputField({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <input
        className={`${inputClass} max-w-[11rem]`}
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        aria-label={label}
      />
    </label>
  );
}

function formatAnimationTime(milliseconds: number): string {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function animationTrackLabel(path: string): string {
  const labels: Record<string, string> = {
    "transform.translate.x": "Position X",
    "transform.translate.y": "Position Y",
    "transform.translate.z": "Position Z",
    "transform.rotate.x": "Rotation X",
    "transform.rotate.y": "Rotation Y",
    "transform.rotate.z": "Rotation Z",
    "transform.scale.x": "Scale X",
    "transform.scale.y": "Scale Y",
    opacity: "Opacity",
    "frame.width": "Width",
    "frame.height": "Height",
  };
  return labels[path] ?? path.split(".").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" / ");
}

function animationValueLabel(value: V2Track["keyframes"][number]["value"]): string {
  if (value.type === "number") return Number(value.value.toFixed(3)).toString();
  if (value.type === "boolean") return value.value ? "On" : "Off";
  if (value.type === "string" || value.type === "enum") return value.value;
  if (value.type === "color") return `rgba(${value.value.map((channel) => Math.round(channel * 255)).join(", ")})`;
  return `[${value.value.map((part) => Number(part.toFixed(2))).join(", ")}]`;
}

function animationEasingLabel(track: V2Track, keyframeIndex: number): string {
  const easing = track.keyframes[keyframeIndex]?.easing;
  if (!easing) return keyframeIndex === track.keyframes.length - 1 ? "Hold" : "Linear";
  if (easing.type === "cubicBezier") return "Bezier";
  if (easing.type === "spring") return "Spring";
  return easing.type === "step" ? "Step" : "Linear";
}

function AnimationInspector({ selected }: { selected: V2Layer | undefined }) {
  if (!selected) {
    return (
      <div className="space-y-3" data-testid="inspector-animation-empty">
        <div className="rounded-md border border-dashed border-[var(--border-strong)] px-3 py-5 text-center text-[12px] text-[var(--fg-muted)]">
          Select a visual layer to inspect its animation tracks.
        </div>
      </div>
    );
  }

  const tracks = selected.tracks ?? [];
  const start = selected.timing.start;
  const duration = selected.timing.duration;
  const end = start + duration;

  return (
    <div className="flex min-h-full flex-col gap-3" data-testid="inspector-animation">
      <div>
        <div className="text-[12px] font-semibold text-[var(--fg-primary)]">Animation</div>
        <div className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
          {tracks.length} {tracks.length === 1 ? "track" : "tracks"} · {selected.id}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] p-2.5">
        <ReadonlyField label="Start" value={formatAnimationTime(start)} />
        <ReadonlyField label="Duration" value={formatAnimationTime(duration)} />
        <ReadonlyField label="End" value={formatAnimationTime(end)} />
      </div>

      {tracks.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--border-strong)] px-3 py-6 text-center">
          <Diamond size={16} className="mx-auto mb-2 text-[var(--fg-muted)]" />
          <div className="text-[12px] text-[var(--fg-secondary)]">No keyframes on this layer</div>
          <div className="mt-1 text-[11px] text-[var(--fg-muted)]">Animated properties will appear here as tracks.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {tracks.map((track) => (
            <div key={track.id} className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium text-[var(--fg-primary)]">{animationTrackLabel(track.path)}</div>
                  <div className="truncate font-mono text-[10px] text-[var(--fg-muted)]">{track.path}</div>
                </div>
                <span className="shrink-0 rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--fg-muted)]">
                  {track.keyframes.length} keys
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-y border-[var(--border-subtle)] py-2">
                <ReadonlyField label="Interpolation" value={track.interpolation?.type === "discrete" ? "Discrete" : "Linear"} />
                <ReadonlyField label="Range" value={`0.00s → ${formatAnimationTime(duration)}`} />
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]">Value changes</div>
                {track.keyframes.map((keyframe, index) => {
                  const next = track.keyframes[index + 1];
                  return (
                    <div key={`${track.id}-detail-${keyframe.time}`} className="flex items-center gap-2 rounded border border-[var(--border-subtle)] px-2 py-1.5 text-[10px]">
                      <Diamond size={11} className="shrink-0 text-[var(--accent)]" fill="currentColor" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 font-mono text-[var(--fg-muted)]">
                          <span>{formatAnimationTime(keyframe.time)}</span>
                          <span>→</span>
                          <span>{next ? formatAnimationTime(next.time) : "end"}</span>
                        </div>
                        <div className="truncate text-[var(--fg-secondary)]">{animationValueLabel(keyframe.value)}</div>
                      </div>
                      <span className="shrink-0 rounded bg-[var(--bg-hover)] px-1.5 py-1 text-[var(--fg-secondary)]">{animationEasingLabel(track, index)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Inspector shell for Protocol V2; common/type-specific controls remain on the existing surface. */
export function SchemaInspector() {
  const { applyCommand, applyCommands, applyCoalescedCommand } = useEditorActions();
  const document = useEditorDocument();
  const selectedLayerIds = useEditorSelection();
  const textEditSession = useEditorTextEditSession();
  const textEditCommitVersion = useEditorTextEditCommitVersion();
  const diagnostics = useEditorStore((state) => state.diagnostics);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    timing: true,
    transform: true,
    layout: true,
    alignment: true,
    anchor: false,
    appearance: true,
    compositing: true,
    text: true,
    textLayout: true,
    typography: true,
    decoration: true,
    advanced: false,
    style: true,
    media: true,
    group: true,
    effects: true,
  });
  const selected = useMemo(() => document.layers.find((layer) => layer.id === selectedLayerIds[0]), [document.layers, selectedLayerIds]);
  const currentTime = useTransportStore((state) => state.currentTime);
  const documentRef = useRef(document);
  const currentTimeRef = useRef(currentTime);
  const lastTextEditCommitVersionRef = useRef(textEditCommitVersion);
  documentRef.current = document;
  currentTimeRef.current = currentTime;
  const selectedTextFingerprint = useMemo(() => {
    if (selected?.type !== "text") return null;
    return JSON.stringify({ id: selected.id, payload: selected.payload });
  }, [selected]);
  const selectedAnimatedTextFingerprint = useMemo(() => {
    if (selected?.type !== "text") return null;
    const evaluated = evaluateLayerAtPlayhead(selected, currentTime);
    if (evaluated.type !== "text") return null;
    return JSON.stringify({ id: evaluated.id, payload: evaluated.payload, frame: evaluated.frame });
  }, [currentTime, selected]);
  useEffect(() => {
    if (textEditSession) return undefined;
    if (lastTextEditCommitVersionRef.current !== textEditCommitVersion) {
      lastTextEditCommitVersionRef.current = textEditCommitVersion;
      return undefined;
    }
    if (selected?.type !== "text") return undefined;
    const sizing = selected.payload.layout?.sizing;
    if (sizing !== "auto-width-height" && sizing !== "fixed-width-auto-height") return undefined;
    const layerId = selected.id;
    let cancelled = false;
    const playheadTime = currentTimeRef.current;
    const evaluatedSelected = evaluateLayerAtPlayhead(selected, playheadTime);
    if (evaluatedSelected.type !== "text") return undefined;
    const sampledDocument = {
      ...documentRef.current,
      layers: documentRef.current.layers.map((candidate) => candidate.id === layerId ? evaluatedSelected : candidate),
    };
    void measureEditorTextLayer(sampledDocument, layerId).then((measurement) => {
      if (cancelled || !measurement) return;
      const current = documentRef.current.layers.find((layer) => layer.id === layerId);
      if (current?.type !== "text") return;
      const evaluatedCurrent = evaluateLayerAtPlayhead(current, playheadTime);
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
        patch: buildPlayheadTransformPatch(current, playheadTime, {
          translateDelta: { x: update.translateX - evaluatedCurrent.transform.translate.x },
          frameDelta: {
            width: update.width - evaluatedCurrent.frame.width,
            height: update.height - evaluatedCurrent.frame.height,
          },
        }, { autoKey: Boolean(hasTypographyKeyframe) }),
      });
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [applyCommand, selected, selectedAnimatedTextFingerprint, selectedTextFingerprint, textEditCommitVersion, textEditSession]);
  const selectedLayers = useMemo(
    () => selectedLayerIds.map((id) => document.layers.find((layer) => layer.id === id)).filter((layer): layer is (typeof document.layers)[number] => Boolean(layer)),
    [document, selectedLayerIds],
  );
  const evaluatedSelectedLayers = useMemo(
    () => selectedLayers.map((layer) => evaluateLayerAtPlayhead(layer, currentTime)),
    [currentTime, selectedLayers],
  );
  const isMultiLayerSelection = selectedLayers.length > 1 && selectedLayers.length === selectedLayerIds.length;
  const commonLayerNumber = (read: (layer: V2Layer) => number) => {
    const values = evaluatedSelectedLayers.map(read);
    const first = values[0] ?? 0;
    return { value: first, mixed: values.some((value) => value !== first) };
  };
  const selectedAudio = useMemo(() => {
    const selectedId = selectedLayerIds[0];
    if (!selectedId?.startsWith("audio.")) return null;
    const clipId = selectedId.slice("audio.".length);
    for (const track of document.audio.tracks) {
      const clip = track.clips.find((candidate) => candidate.id === clipId);
      if (clip) return { track, clip };
    }
    return null;
  }, [document, selectedLayerIds]);
  const [fontCatalog, setFontCatalog] = useState<FontOption[]>([]);
  useEffect(() => {
    const load = () => { listFonts().then(setFontCatalog).catch(() => setFontCatalog([])); };
    load();
    window.addEventListener("neonix:dev-demo-authenticated", load);
    return () => window.removeEventListener("neonix:dev-demo-authenticated", load);
  }, []);
  const fontFamilyOptions = useMemo(() => {
    const seen = new Set<string>();
    return fontCatalog
      .filter((font) => {
        const key = `${font.source}:${font.familyName}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => (left.source === right.source ? 0 : left.source === "system" ? -1 : 1) || left.familyName.localeCompare(right.familyName))
      .map((font) => ({
        value: `${font.source}:${font.familyName}`,
        label: font.familyName,
        group: font.source === "system" ? "System" : "Custom",
      }));
  }, [fontCatalog]);
  const selectedFontOption = useMemo(() => {
    if (selected?.type !== "text") return undefined;
    const firstSpan = selected.payload.chunks[0]?.spans[0];
    const resolved = firstSpan?.resolvedFontAssetIds?.[0];
    return fontCatalog.find((font) => font.fontAssetId === resolved)
      ?? fontCatalog.find((font) => font.familyName === firstSpan?.font.families[0]);
  }, [fontCatalog, selected]);
  const selectedFontFamilyKey = selectedFontOption
    ? `${selectedFontOption.source}:${selectedFontOption.familyName}`
    : "";
  const selectedFontFaces = useMemo(
    () => fontCatalog.filter((font) => `${font.source}:${font.familyName}` === selectedFontFamilyKey),
    [fontCatalog, selectedFontFamilyKey],
  );
  const activeFontFace = useMemo(() => {
    if (selected?.type !== "text") return undefined;
    const span = selected.payload.chunks[0]?.spans[0];
    const resolved = fontCatalog.find((font) => font.fontAssetId === span?.resolvedFontAssetIds?.[0]);
    const weight = span?.font.weight ?? resolved?.weight ?? 400;
    const style = span?.font.style ?? resolved?.style ?? "normal";
    return selectedFontFaces.find((font) => font.weight === weight && font.style === style)
      ?? selectedFontFaces.find((font) => font.style === style)
      ?? selectedFontFaces[0];
  }, [fontCatalog, selected, selectedFontFaces]);
  const fontStyleOptions = useMemo(() => [...new Map(selectedFontFaces.map((font) => [font.style, font])).values()]
    .sort((left, right) => {
      const order = { normal: 0, italic: 1, oblique: 2 } as const;
      return order[left.style] - order[right.style];
    })
    .map((font) => ({ value: font.style, label: font.style[0].toUpperCase() + font.style.slice(1) })), [selectedFontFaces]);
  const fontWeightOptions = useMemo(() => {
    const faces = selectedFontFaces.filter((font) => !activeFontFace || font.style === activeFontFace.style);
    return [...new Map((faces.length > 0 ? faces : selectedFontFaces).map((font) => [String(font.weight), font])).values()]
      .sort((left, right) => left.weight - right.weight)
      .map((font) => ({ value: String(font.weight), label: String(font.weight) }));
  }, [activeFontFace, selectedFontFaces]);
  const applyFontFace = (option: FontOption | undefined) => {
    if (selected?.type !== "text") return;
    if (!option) return;
    const fontAsset = { id: option.fontAssetId, kind: "font" as const, uri: option.uri, weight: option.weight, integrity: option.integrity };
    const commands: EditorCommand[] = document.assets.some((asset) => asset.id === fontAsset.id)
      ? []
      : [{ type: "add-asset" as const, asset: fontAsset }];
    commands.push({ type: "patch-layer" as const, layerId: selected.id, patch: {
      payload: { chunks: selected.payload.chunks.map((chunk) => ({
        ...chunk,
        spans: chunk.spans.map((span) => ({ ...span, resolvedFontAssetIds: [option.fontAssetId], font: { ...span.font, families: [option.familyName, ...span.font.families.slice(1)], weight: option.weight, style: option.style } })),
      })) },
    }});
    applyCommands(commands);
  };
  const selectFontFamily = (value: string) => {
    const optionFaces = fontCatalog.filter((font) => `${font.source}:${font.familyName}` === value);
    const face = optionFaces.find((font) => font.style === activeFontFace?.style && font.weight === activeFontFace?.weight)
      ?? optionFaces.find((font) => font.style === "normal" && font.weight === 400)
      ?? optionFaces[0];
    applyFontFace(face);
  };
  const selectFontStyle = (value: string) => {
    const face = selectedFontFaces.find((font) => font.style === value && font.weight === activeFontFace?.weight)
      ?? selectedFontFaces.find((font) => font.style === value);
    applyFontFace(face);
  };
  const selectFontWeight = (value: string) => {
    const weight = Number(value);
    const face = selectedFontFaces.find((font) => font.weight === weight && font.style === activeFontFace?.style)
      ?? selectedFontFaces.find((font) => font.weight === weight);
    applyFontFace(face);
  };
  const languageOptions = useMemo(() => {
    const language = selected?.type === "text" ? (selected.payload.source?.language ?? "und") : undefined;
    if (selected?.type !== "text" || SHIPPED_TEXT_LANGUAGES.some((option) => option.value === language)) {
      return SHIPPED_TEXT_LANGUAGES;
    }
    // Keep imported/custom protocol documents editable without silently rewriting their language.
    return [{ value: language!, label: `${language} (custom)` }, ...SHIPPED_TEXT_LANGUAGES];
  }, [selected]);

  const patchLayer = (patch: LayerPatch) => {
    if (selected) applyCommand({ type: "patch-layer", layerId: selected.id, patch });
  };
  const absoluteCurrentTime = currentTime * 1000;
  const isPlayheadInsideLayer = Boolean(
    selected &&
    absoluteCurrentTime >= selected.timing.start &&
    absoluteCurrentTime <= selected.timing.start + selected.timing.duration,
  );
  const localAnimationTime = selected
    ? Math.round(layerLocalTimeAtPlayhead(selected, currentTime) * 1000) / 1000
    : 0;
  const isKeyframedAtCurrentTime = (path: string) => Boolean(
    !isMultiLayerSelection && isPlayheadInsideLayer && selected && isLayerKeyframedAtTime(selected, path, localAnimationTime),
  );
  const setKeyframeAtCurrentTime = (path: string, value: V2AnimatableValue) => {
    if (!selected || isMultiLayerSelection || !isPlayheadInsideLayer) return;
    const tracks = [...(selected.tracks ?? [])];
    const trackIndex = tracks.findIndex((track) => track.path === path);
    if (trackIndex === -1) {
      tracks.push({
        id: `track-${selected.id}-${path.replace(/\./g, "-")}`,
        path,
        keyframes: [{ time: localAnimationTime, value }],
      });
    } else {
      const track = tracks[trackIndex];
      const keyframes = [...track.keyframes];
      const keyframeIndex = keyframes.findIndex((keyframe) => Math.abs(keyframe.time - localAnimationTime) < 0.5);
      if (keyframeIndex === -1) {
        keyframes.push({ time: localAnimationTime, value, easing: { type: "linear" as const } });
        keyframes.sort((left, right) => left.time - right.time);
        tracks[trackIndex] = { ...track, keyframes };
      } else {
        if (keyframes.length === 1) {
          tracks.splice(trackIndex, 1);
        } else {
          keyframes.splice(keyframeIndex, 1);
          tracks[trackIndex] = { ...track, keyframes };
        }
      }
    }
    patchLayer({ tracks });
  };
  const patchSelectedLayers = (patch: LayerPatch) => {
    if (isMultiLayerSelection) {
      applyCommand({
        type: "patch-layers",
        patches: Object.fromEntries(selectedLayers.map((layer) => [layer.id, patch])),
      });
      return;
    }
    patchLayer(patch);
  };
  const patchAnimatedValue = (
    path: string,
    value: number,
    fallbackPatch: LayerPatch,
  ) => {
    if (!selected || isMultiLayerSelection || !isPlayheadInsideLayer || !isKeyframedAtCurrentTime(path)) {
      patchSelectedLayers(fallbackPatch);
      return;
    }
    const evaluated = evaluateLayerAtPlayhead(selected, currentTime);
    const edit = path === "transform.translate.x"
      ? { translateDelta: { x: value - evaluated.transform.translate.x } }
      : path === "transform.translate.y"
        ? { translateDelta: { y: value - evaluated.transform.translate.y } }
        : path === "transform.scale.x"
          ? { scaleMultiplier: { x: value / Math.max(0.001, evaluated.transform.scale.x) } }
          : path === "transform.scale.y"
            ? { scaleMultiplier: { y: value / Math.max(0.001, evaluated.transform.scale.y) } }
            : path === "transform.rotate.z"
              ? { rotationDelta: value - evaluated.transform.rotate.z }
              : path === "frame.width"
                ? { frameDelta: { width: value - evaluated.frame.width } }
                : path === "frame.height"
                  ? { frameDelta: { height: value - evaluated.frame.height } }
                  : { opacity: value };
    applyCommand({
      type: "patch-layer",
      layerId: selected.id,
      patch: buildPlayheadTransformPatch(selected, currentTime, edit),
    });
  };
  const patchAudioClip = (patch: AudioClipPatch) => {
    if (selectedAudio) {
      applyCommand({
        type: "patch-audio-clip",
        trackId: selectedAudio.track.id,
        clipId: selectedAudio.clip.id,
        patch,
      });
    }
  };
  const patchAudioTrack = (patch: AudioTrackDocumentPatch) => {
    if (selectedAudio) {
      applyCommand({ type: "patch-audio-track", trackId: selectedAudio.track.id, patch });
    }
  };
  const patchLayerCoalesced = (historyKey: string, gestureId: number, patch: LayerPatch) => {
    if (!selected) return;
    const command = isMultiLayerSelection
      ? { type: "patch-layers" as const, patches: Object.fromEntries(selectedLayers.map((layer) => [layer.id, patch])) }
      : { type: "patch-layer" as const, layerId: selected.id, patch };
    applyCoalescedCommand(`inspector:${selected.id}:${historyKey}:${gestureId}`, command);
  };
  const toggle = (id: string) => setOpenSections((state) => ({ ...state, [id]: !(state[id] ?? false) }));

  const alignHorizontal = (mode: "left" | "center" | "right") => {
    if (!isMultiLayerSelection) return;
    applyCommand({ type: "patch-layers", patches: buildAlignmentPatches(selectedLayers, "horizontal", mode) });
  };

  const alignVertical = (mode: "top" | "middle" | "bottom") => {
    if (!isMultiLayerSelection) return;
    applyCommand({ type: "patch-layers", patches: buildAlignmentPatches(selectedLayers, "vertical", mode) });
  };

  const setAnchor = (x: number, y: number) => {
    if (!selected) return;
    const previous = selected.transform.anchor;
    const next = { x, y, z: previous.z };
    const translate = compensateAnchor(selected.transform, next);
    patchLayer({
      transform: {
        anchor: next,
        translate,
      },
    });
  };

  const moveStack = (direction: "forward" | "backward") => {
    if (!selected) return;
    const siblings = document.layers
      .filter((layer) => layer.parentLayerId === selected.parentLayerId)
      .sort((left, right) => left.order - right.order);
    const currentIndex = siblings.findIndex((layer) => layer.id === selected.id);
    const targetIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) return;
    const orderedLayerIds = siblings.map((layer) => layer.id);
    const [moved] = orderedLayerIds.splice(currentIndex, 1);
    orderedLayerIds.splice(targetIndex, 0, moved);
    applyCommand({
      type: "reorder-layers",
      parentLayerId: selected.parentLayerId,
      orderedLayerIds,
    });
  };

  const commonStart = commonLayerNumber((layer) => protocolMillisecondsToSeconds(layer.timing.start));
  const commonDuration = commonLayerNumber((layer) => protocolMillisecondsToSeconds(layer.timing.duration));
  const commonTranslateX = commonLayerNumber((layer) => layer.transform.translate.x);
  const commonTranslateY = commonLayerNumber((layer) => layer.transform.translate.y);
  const commonWidth = commonLayerNumber((layer) => layer.frame.width);
  const commonHeight = commonLayerNumber((layer) => layer.frame.height);
  const commonScaleX = commonLayerNumber((layer) => layer.transform.scale.x);
  const commonScaleY = commonLayerNumber((layer) => layer.transform.scale.y);
  const selectedTextSizing = selected?.type === "text" ? selected.payload.layout?.sizing : undefined;
  const textWidthAuto = selectedTextSizing === "auto-width-height";
  const textHeightAuto = textWidthAuto || selectedTextSizing === "fixed-width-auto-height";
  const commonRotation = commonLayerNumber((layer) => layer.transform.rotate.z);
  const commonOpacity = commonLayerNumber((layer) => layer.opacity);
  const selectedText = selected?.type === "text" ? selected : undefined;
  const selectedTextSpan = selectedText?.payload.chunks[0]?.spans[0];
  const selectedTextLayout = selectedText?.payload.layout;
  const selectedTextFontSize = numericSvgLength(selectedTextSpan?.font.size, 16);
  const selectedTextPath = selectedText?.payload.chunks[0]?.textPath;
  const textPathOptions = useMemo(
    () => [
      { value: "none", label: "None" },
      ...document.layers
        .filter((layer): layer is Extract<V2Layer, { type: "path" }> => layer.type === "path")
        .map((layer) => ({ value: layer.id, label: layer.id })),
    ],
    [document.layers],
  );
  const patchTextSource = (patch: Partial<V2TextSource>) => {
    if (!selectedText) return;
    patchLayer({ payload: { source: { ...selectedText.payload.source, ...patch } } });
  };
  const defaultTextLayout: V2TextLayout = {
    sizing: "auto-width-height",
    lineHeight: selectedTextFontSize * 1.2,
    textAlign: "left",
    whiteSpace: "normal",
    wrap: "word",
    textOverflow: "clip",
  };
  const patchTextLayout = (patch: Partial<V2TextLayout>) => {
    if (!selectedText) return;
    patchLayer({ payload: { layout: { ...defaultTextLayout, ...selectedText.payload.layout, ...patch } } });
  };
  const patchTextSpans = (update: (span: TextSpan) => TextSpan) => {
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

  const properties = selected ? (
    <div className="flex min-h-full w-full flex-col" data-testid="inspector-properties">
      {diagnostics.length > 0 ? (
        <div role="alert" className="order-[-2] border-b border-[var(--danger)]/40 bg-[var(--danger)]/10 py-2 text-[11px] text-[var(--danger)]">
          {diagnostics[0]?.message}
        </div>
      ) : null}
      <InspectorSection label="Timing" className="order-4" open={openSections.timing ?? false} onToggle={() => toggle("timing")}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Start" value={commonStart.value} mixed={isMultiLayerSelection && commonStart.mixed} onChange={(value) => patchSelectedLayers({ timing: { start: secondsToProtocolMilliseconds(Math.max(0, value)) } })} />
          <NumberField label="Duration" value={commonDuration.value} mixed={isMultiLayerSelection && commonDuration.mixed} onChange={(value) => patchSelectedLayers({ timing: { duration: secondsToProtocolMilliseconds(Math.max(0.001, value)) } })} />
        </div>
        <ReadonlyField label="End" value={isMultiLayerSelection && (commonStart.mixed || commonDuration.mixed) ? "Mixed" : (commonStart.value + commonDuration.value).toFixed(2)} />
      </InspectorSection>

      <InspectorSection label="Position" className="order-0" open={openSections.transform ?? false} onToggle={() => toggle("transform")}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="X" step={1} integer suffix="px" value={commonTranslateX.value} mixed={isMultiLayerSelection && commonTranslateX.mixed} keyframed={isKeyframedAtCurrentTime("transform.translate.x")} keyframeDisabled={!isPlayheadInsideLayer} onKeyframe={!isMultiLayerSelection ? () => setKeyframeAtCurrentTime("transform.translate.x", { type: "number", value: commonTranslateX.value }) : undefined} onChange={(value) => patchAnimatedValue("transform.translate.x", value, { transform: { translate: { x: value } } })} />
          <NumberField label="Y" step={1} integer suffix="px" value={commonTranslateY.value} mixed={isMultiLayerSelection && commonTranslateY.mixed} keyframed={isKeyframedAtCurrentTime("transform.translate.y")} keyframeDisabled={!isPlayheadInsideLayer} onKeyframe={!isMultiLayerSelection ? () => setKeyframeAtCurrentTime("transform.translate.y", { type: "number", value: commonTranslateY.value }) : undefined} onChange={(value) => patchAnimatedValue("transform.translate.y", value, { transform: { translate: { y: value } } })} />
          <NumberField label="Rotation Z" step={1} integer value={commonRotation.value} mixed={isMultiLayerSelection && commonRotation.mixed} keyframed={isKeyframedAtCurrentTime("transform.rotate.z")} keyframeDisabled={!isPlayheadInsideLayer} onKeyframe={!isMultiLayerSelection ? () => setKeyframeAtCurrentTime("transform.rotate.z", { type: "number", value: commonRotation.value }) : undefined} onChange={(value) => patchAnimatedValue("transform.rotate.z", value, { transform: { rotate: { z: value } } })} />
        </div>
      </InspectorSection>

      <InspectorSection label="Layout" className="order-2" open={openSections.layout ?? false} onToggle={() => toggle("layout")}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          {textWidthAuto ? <ReadonlyField label="Width" value="Auto" /> : <NumberField label="Width" step={1} integer suffix="px" value={commonWidth.value} mixed={isMultiLayerSelection && commonWidth.mixed} keyframed={isKeyframedAtCurrentTime("frame.width")} keyframeDisabled={!isPlayheadInsideLayer} onKeyframe={!isMultiLayerSelection ? () => setKeyframeAtCurrentTime("frame.width", { type: "number", value: commonWidth.value }) : undefined} onChange={(value) => patchAnimatedValue("frame.width", Math.max(1, value), { frame: { width: Math.max(1, value) } })} />}
          {textHeightAuto ? <ReadonlyField label="Height" value="Auto" /> : <NumberField label="Height" step={1} integer suffix="px" value={commonHeight.value} mixed={isMultiLayerSelection && commonHeight.mixed} keyframed={isKeyframedAtCurrentTime("frame.height")} keyframeDisabled={!isPlayheadInsideLayer} onKeyframe={!isMultiLayerSelection ? () => setKeyframeAtCurrentTime("frame.height", { type: "number", value: commonHeight.value }) : undefined} onChange={(value) => patchAnimatedValue("frame.height", Math.max(1, value), { frame: { height: Math.max(1, value) } })} />}
          <NumberField label="Scale X" step={1} integer value={commonScaleX.value} mixed={isMultiLayerSelection && commonScaleX.mixed} keyframed={isKeyframedAtCurrentTime("transform.scale.x")} keyframeDisabled={!isPlayheadInsideLayer} onKeyframe={!isMultiLayerSelection ? () => setKeyframeAtCurrentTime("transform.scale.x", { type: "number", value: commonScaleX.value }) : undefined} onChange={(value) => patchAnimatedValue("transform.scale.x", Math.max(0.001, value), { transform: { scale: { x: Math.max(0.001, value) } } })} />
          <NumberField label="Scale Y" step={1} integer value={commonScaleY.value} mixed={isMultiLayerSelection && commonScaleY.mixed} keyframed={isKeyframedAtCurrentTime("transform.scale.y")} keyframeDisabled={!isPlayheadInsideLayer} onKeyframe={!isMultiLayerSelection ? () => setKeyframeAtCurrentTime("transform.scale.y", { type: "number", value: commonScaleY.value }) : undefined} onChange={(value) => patchAnimatedValue("transform.scale.y", Math.max(0.001, value), { transform: { scale: { y: Math.max(0.001, value) } } })} />
          {selectedTextSizing && selectedTextSizing !== "fixed" && (commonScaleX.value !== 1 || commonScaleY.value !== 1) ? <ActionButton label="Reset scale" onClick={() => patchLayer({ transform: { scale: { x: 1, y: 1 } } })} /> : null}
        </div>
      </InspectorSection>

      {isMultiLayerSelection ? (
        <InspectorSection label="Appearance" className="order-5" open={openSections.appearance ?? false} onToggle={() => toggle("appearance")}>
          <RangeField
            label="Opacity"
            value={commonOpacity.value}
            mixed={commonOpacity.mixed}
            keyframed={isKeyframedAtCurrentTime("opacity")}
            keyframeDisabled={!isPlayheadInsideLayer}
            onKeyframe={!isMultiLayerSelection ? () => setKeyframeAtCurrentTime("opacity", { type: "number", value: commonOpacity.value }) : undefined}
            onChange={(value, gestureId) => patchLayerCoalesced("opacity", gestureId, { opacity: Math.max(0, Math.min(1, value)) })}
          />
        </InspectorSection>
      ) : null}

      <div className={isMultiLayerSelection ? "contents" : "hidden"}>
        <div className="order-1">
          <InspectorSection label="Alignment" open={openSections.alignment ?? false} onToggle={() => toggle("alignment")}>
            <div className="grid grid-cols-3 gap-1">
              <IconActionButton label="Align left" icon={<AlignStartVertical size={14} />} onClick={() => alignHorizontal("left")} />
              <IconActionButton label="Align center" icon={<AlignCenterVertical size={14} />} onClick={() => alignHorizontal("center")} />
              <IconActionButton label="Align right" icon={<AlignEndVertical size={14} />} onClick={() => alignHorizontal("right")} />
              <IconActionButton label="Align top" icon={<AlignStartHorizontal size={14} />} onClick={() => alignVertical("top")} />
              <IconActionButton label="Align middle" icon={<AlignCenterHorizontal size={14} />} onClick={() => alignVertical("middle")} />
              <IconActionButton label="Align bottom" icon={<AlignEndHorizontal size={14} />} onClick={() => alignVertical("bottom")} />
            </div>
          </InspectorSection>
        </div>
      </div>

      <div className={isMultiLayerSelection ? "hidden" : "contents"}>

      <InspectorSection label="Anchor" className="order-3" open={openSections.anchor ?? false} onToggle={() => toggle("anchor")}>
        <div className="mx-auto grid w-fit grid-cols-3 gap-1" aria-label="Anchor presets">
          {[0, 0.5, 1].flatMap((y) => [0, 0.5, 1].map((x) => ({ x, y }))).map((preset) => (
            <button
              key={`${preset.x}-${preset.y}`}
              type="button"
              aria-label={`Anchor ${preset.x}, ${preset.y}`}
              className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border-strong)] text-[var(--fg-muted)] data-[active=true]:border-[var(--accent)] data-[active=true]:text-[var(--accent)]"
              data-active={
                selected.transform.anchor.x === selected.frame.width * preset.x &&
                selected.transform.anchor.y === selected.frame.height * preset.y
              }
              onClick={() => setAnchor(selected.frame.width * preset.x, selected.frame.height * preset.y)}
            >
              <Dot size={22} strokeWidth={4} fill="currentColor" aria-hidden="true" />
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Anchor X" step={1} integer suffix="px" value={selected.transform.anchor.x} onChange={(value) => setAnchor(value, selected.transform.anchor.y)} />
          <NumberField label="Anchor Y" step={1} integer suffix="px" value={selected.transform.anchor.y} onChange={(value) => setAnchor(selected.transform.anchor.x, value)} />
        </div>
      </InspectorSection>

      <InspectorSection label="Appearance" className="order-5" open={openSections.appearance ?? false} onToggle={() => toggle("appearance")}>
        <RangeField
          label="Opacity"
          value={commonOpacity.value}
          mixed={isMultiLayerSelection && commonOpacity.mixed}
          keyframed={isKeyframedAtCurrentTime("opacity")}
          keyframeDisabled={!isPlayheadInsideLayer}
          onKeyframe={() => setKeyframeAtCurrentTime("opacity", { type: "number", value: commonOpacity.value })}
          onChange={(value, gestureId) => patchLayerCoalesced("opacity", gestureId, { opacity: Math.max(0, Math.min(1, value)) })}
        />
        {selected.type === "shape" ? (
          <NumberField label="Corner radius" step={1} integer suffix="px" value={numericSvgLength(selected.payload.cornerRadius, 0)} onChange={(value) => patchLayer({ payload: { cornerRadius: Math.max(0, value) } })} />
        ) : null}
      </InspectorSection>

      <InspectorSection label="Compositing" className="order-7" open={openSections.compositing ?? false} onToggle={() => toggle("compositing")}>
        <InspectorSelect
          label="Blend"
          value={selected.composite?.blendMode ?? "normal"}
          options={[
            { value: "normal", label: "Normal" },
            { value: "darken", label: "Darken" },
            { value: "multiply", label: "Multiply" },
            { value: "color-burn", label: "Color burn" },
            { value: "lighten", label: "Lighten" },
            { value: "screen", label: "Screen" },
            { value: "color-dodge", label: "Color dodge" },
            { value: "overlay", label: "Overlay" },
            { value: "soft-light", label: "Soft light" },
            { value: "hard-light", label: "Hard light" },
            { value: "difference", label: "Difference" },
            { value: "exclusion", label: "Exclusion" },
            { value: "hue", label: "Hue" },
            { value: "saturation", label: "Saturation" },
            { value: "color", label: "Color" },
            { value: "luminosity", label: "Luminosity" },
          ]}
          onChange={(value) => patchLayer({ composite: { blendMode: value as NonNullable<NonNullable<(typeof selected)>["composite"]>["blendMode"] } })}
        />
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">Stack</span>
          <ActionButton label="Back" onClick={() => moveStack("backward")} disabled={selected.order === 0} />
          <ActionButton
            label="Forward"
            onClick={() => moveStack("forward")}
            disabled={!document.layers.some((layer) => layer.parentLayerId === selected.parentLayerId && layer.order > selected.order)}
          />
        </div>
      </InspectorSection>

      <div className="order-8">
        {selected.type === "text" || selected.type === "shape" || selected.type === "image" || selected.type === "video" || selected.type === "path" ? (
          <EffectsInspector
            effects={selected.effects ?? []}
            open={openSections.effects ?? false}
            onToggle={() => toggle("effects")}
            onChange={(effects) => patchLayer({ effects })}
          />
        ) : null}
      </div>

      <div className="order-6">
      {selected.type === "text" ? (
        <>
          <InspectorSection label="Content" open={openSections.text ?? false} onToggle={() => toggle("text")}>
            <TextAreaField label="Text" value={selected.payload.source.text} onCommit={(value) => patchTextSource({ text: value.normalize("NFC") })} />
            <InspectorSelect label="Language" value={selected.payload.source.language ?? "und"} options={languageOptions} onChange={(value) => patchTextSource({ language: value })} />
            <InspectorSelect label="Direction" value={selected.payload.source.direction ?? "ltr"} options={TEXT_DIRECTION_OPTIONS} onChange={(value) => patchTextSource({ direction: value as V2TextSource["direction"] })} />
            <InspectorSelect label="Writing mode" value={selected.payload.source.writingMode ?? "horizontal-tb"} options={TEXT_WRITING_MODE_OPTIONS} onChange={(value) => patchTextSource({ writingMode: value as V2TextSource["writingMode"] })} />
          </InspectorSection>

          <InspectorSection label="Layout" open={openSections.textLayout ?? false} onToggle={() => toggle("textLayout")}>
            <InspectorSelect label="Sizing" value={selectedTextLayout?.sizing ?? "auto-width-height"} options={TEXT_SIZING_OPTIONS} onChange={(value) => patchTextLayout({ sizing: value as V2TextLayout["sizing"] })} />
            <NumberField label="Line height" step={0.1} suffix="px" value={selectedTextLayout?.lineHeight ?? selectedTextFontSize * 1.2} onChange={(value) => patchTextLayout({ lineHeight: Math.max(0.001, value) })} />
            <InspectorSelect label="Alignment" value={selectedTextLayout?.textAlign ?? "left"} options={TEXT_ALIGN_OPTIONS} onChange={(value) => patchTextLayout({ textAlign: value as V2TextLayout["textAlign"] })} />
            <InspectorSelect label="Wrap" value={selectedTextLayout?.wrap ?? "word"} options={TEXT_WRAP_OPTIONS} onChange={(value) => patchTextLayout({ wrap: value as V2TextLayout["wrap"] })} />
            <InspectorSelect label="White space" value={selectedTextLayout?.whiteSpace ?? "normal"} options={TEXT_WHITE_SPACE_OPTIONS} onChange={(value) => patchTextLayout({ whiteSpace: value as V2TextLayout["whiteSpace"] })} />
            <InspectorSelect label="Overflow" value={selectedTextLayout?.textOverflow ?? "clip"} options={TEXT_OVERFLOW_OPTIONS} onChange={(value) => patchTextLayout({ textOverflow: value as V2TextLayout["textOverflow"] })} />
            <NumberField label="Max lines" step={1} integer value={selectedTextLayout?.maxLines ?? 0} onChange={(value) => patchTextLayout({ maxLines: value > 0 ? Math.round(value) : undefined })} />
          </InspectorSection>

          <InspectorSection label="Typography" open={openSections.typography ?? false} onToggle={() => toggle("typography")}>
            <InspectorSelect
              label="Font family"
              value={selectedFontFamilyKey}
              options={fontFamilyOptions}
              className="max-w-[10rem]"
              onChange={selectFontFamily}
            />
            <InspectorSelect
              label="Style"
              value={activeFontFace?.style ?? selected.payload.chunks[0]?.spans[0]?.font.style ?? "normal"}
              options={fontStyleOptions}
              onChange={selectFontStyle}
            />
            <InspectorSelect
              label="Weight"
              value={String(activeFontFace?.weight ?? selected.payload.chunks[0]?.spans[0]?.font.weight ?? 400)}
              options={fontWeightOptions}
              onChange={selectFontWeight}
            />
            <NumberField label="Font size" step={1} integer suffix="px" value={selectedTextFontSize} onChange={(value) => patchTextSpans((span) => ({ ...span, font: { ...span.font, size: Math.max(0.001, value) } }))} />
            <NumberField label="Letter spacing" step={0.1} suffix="px" value={numericSvgLength(selectedTextSpan?.letterSpacing, 0)} onChange={(value) => patchTextSpans((span) => ({ ...span, letterSpacing: value === 0 ? "normal" : value }))} />
            <NumberField label="Word spacing" step={0.1} suffix="px" value={numericSvgLength(selectedTextSpan?.wordSpacing, 0)} onChange={(value) => patchTextSpans((span) => ({ ...span, wordSpacing: value === 0 ? "normal" : value }))} />
          </InspectorSection>

          <InspectorSection label="Appearance" open={openSections.appearance ?? false} onToggle={() => toggle("appearance")}>
            <ColorField label="Fill" value={typeof selectedTextSpan?.fill === "string" ? selectedTextSpan.fill : "#ffffff"} onChange={(value) => patchTextSpans((span) => ({ ...span, fill: value }))} />
            <RangeField label="Fill opacity" value={selectedTextSpan?.fillOpacity ?? 1} onChange={(value) => patchTextSpans((span) => ({ ...span, fillOpacity: value }))} />
            {typeof selectedTextSpan?.stroke === "string" ? (
              <>
                <ColorField label="Stroke" value={selectedTextSpan.stroke} onChange={(value) => patchTextSpans((span) => ({ ...span, stroke: value }))} />
                <NumberField label="Stroke width" step={0.5} suffix="px" value={numericSvgLength(selectedTextSpan.strokeWidth, 1)} onChange={(value) => patchTextSpans((span) => ({ ...span, strokeWidth: Math.max(0.001, value) }))} />
                <RangeField label="Stroke opacity" value={selectedTextSpan.strokeOpacity ?? 1} onChange={(value) => patchTextSpans((span) => ({ ...span, strokeOpacity: value }))} />
                <ActionButton label="Remove stroke" onClick={() => patchTextSpans((span) => ({ ...span, stroke: undefined, strokeWidth: undefined, strokeOpacity: undefined }))} />
              </>
            ) : <ActionButton label="Add stroke" onClick={() => patchTextSpans((span) => ({ ...span, stroke: "#ffffff", strokeWidth: 1, strokeOpacity: 1 }))} />}
          </InspectorSection>

          <InspectorSection label="Decoration" open={openSections.decoration ?? false} onToggle={() => toggle("decoration")}>
            <ToggleField label="Underline" checked={Boolean(selectedTextSpan?.textDecoration?.underline)} onChange={(checked) => patchTextDecoration("underline", checked)} />
            <ToggleField label="Overline" checked={Boolean(selectedTextSpan?.textDecoration?.overline)} onChange={(checked) => patchTextDecoration("overline", checked)} />
            <ToggleField label="Line-through" checked={Boolean(selectedTextSpan?.textDecoration?.lineThrough)} onChange={(checked) => patchTextDecoration("lineThrough", checked)} />
          </InspectorSection>

          <InspectorSection label="Advanced" open={openSections.advanced ?? false} onToggle={() => toggle("advanced")}>
            <InspectorSelect label="Dominant baseline" value={selectedTextSpan?.dominantBaseline ?? "auto"} options={TEXT_BASELINE_OPTIONS} onChange={(value) => patchTextSpans((span) => ({ ...span, dominantBaseline: value as TextSpan["dominantBaseline"] }))} />
            <InspectorSelect label="Alignment baseline" value={selectedTextSpan?.alignmentBaseline ?? "auto"} options={TEXT_ALIGNMENT_BASELINE_OPTIONS} onChange={(value) => patchTextSpans((span) => ({ ...span, alignmentBaseline: value as TextSpan["alignmentBaseline"] }))} />
            <NumberField label="Baseline shift" step={0.5} suffix="px" value={numericSvgLength(selectedTextSpan?.baselineShift, 0)} onChange={(value) => patchTextSpans((span) => ({ ...span, baselineShift: value === 0 ? "baseline" : value }))} />
            <TextInputField
              label="Variable axes"
              value={variableAxesLabel(selectedTextSpan?.font.variations)}
              placeholder="wght=400, wdth=100"
              onCommit={(value) => {
                const variations = parseVariableAxes(value);
                if (value.trim() === "" || variations) patchTextSpans((span) => ({ ...span, font: { ...span.font, variations } }));
              }}
            />
            <ToggleField label="Text length" checked={Boolean(selectedTextSpan?.textLength)} onChange={(checked) => patchTextSpans((span) => ({ ...span, textLength: checked ? Math.max(1, numericSvgLength(span.textLength, selectedText?.frame.width ?? 1)) : undefined, lengthAdjust: checked ? (span.lengthAdjust ?? "spacing") : undefined }))} />
            {selectedTextSpan?.textLength !== undefined ? (
              <>
                <NumberField label="Length" step={1} suffix="px" value={numericSvgLength(selectedTextSpan.textLength, selected?.frame.width ?? 1)} onChange={(value) => patchTextSpans((span) => ({ ...span, textLength: Math.max(0.001, value) }))} />
                <InspectorSelect label="Length adjust" value={selectedTextSpan.lengthAdjust ?? "spacing"} options={TEXT_LENGTH_ADJUST_OPTIONS} onChange={(value) => patchTextSpans((span) => ({ ...span, lengthAdjust: value as TextSpan["lengthAdjust"] }))} />
              </>
            ) : null}
            <InspectorSelect label="Text path" value={selectedTextPath?.pathId ?? "none"} options={textPathOptions} onChange={patchTextPath} />
            {selectedTextPath ? (
              <>
                <NumberField label="Start offset" step={1} suffix="px" value={numericSvgLength(selectedTextPath.startOffset, 0)} onChange={(value) => patchLayer({ payload: { chunks: selected.payload.chunks.map((chunk) => ({ ...chunk, textPath: chunk.textPath ? { ...chunk.textPath, startOffset: value } : undefined })) } })} />
                <InspectorSelect label="Path method" value={selectedTextPath.method ?? "align"} options={TEXT_PATH_METHOD_OPTIONS} onChange={(value) => patchLayer({ payload: { chunks: selected.payload.chunks.map((chunk) => ({ ...chunk, textPath: chunk.textPath ? { ...chunk.textPath, method: value as "align" | "stretch" } : undefined })) } })} />
                <InspectorSelect label="Path spacing" value={selectedTextPath.spacing ?? "auto"} options={TEXT_PATH_SPACING_OPTIONS} onChange={(value) => patchLayer({ payload: { chunks: selected.payload.chunks.map((chunk) => ({ ...chunk, textPath: chunk.textPath ? { ...chunk.textPath, spacing: value as "auto" | "exact" } : undefined })) } })} />
              </>
            ) : null}
            <InspectorSelect label="Text rendering" value={selected.payload.source.textRendering ?? "auto"} options={TEXT_RENDERING_OPTIONS} onChange={(value) => patchTextSource({ textRendering: value as V2TextSource["textRendering"] })} />
          </InspectorSection>
        </>
      ) : null}

      {selected.type === "shape" ? (
        <InspectorSection label="Style" open={openSections.style ?? false} onToggle={() => toggle("style")}>
          {typeof selected.style.fill === "string" ? (
            <ColorField label="Fill" value={selected.style.fill} onChange={(value) => patchLayer({ style: { fill: value } })} />
          ) : null}
          {typeof selected.style.stroke === "string" ? <ColorField label="Stroke" value={selected.style.stroke} onChange={(value) => patchLayer({ style: { stroke: value } })} /> : null}
          {selected.style.stroke ? <NumberField label="Stroke width" step={1} integer suffix="px" value={numericSvgLength(selected.style.strokeWidth, 1)} onChange={(value) => patchLayer({ style: { strokeWidth: Math.max(0.001, value) } })} /> : null}
          {!selected.style.stroke ? <ActionButton label="Add stroke" onClick={() => patchLayer({ style: { stroke: "#ffffff", strokeWidth: 1 } })} /> : null}
        </InspectorSection>
      ) : null}

      {selected.type === "image" ? (
        <InspectorSection label="Media" open={openSections.media ?? false} onToggle={() => toggle("media")}>
          <ReadonlyField label="Asset" value={document.assets.find((asset) => asset.id === selected.payload.assetId)?.uri ?? selected.payload.assetId} />
          <InspectorSelect label="Alignment" value={selected.payload.preserveAspectRatio?.align ?? "xMidYMid"} options={[{ value: "none", label: "None" }, { value: "xMinYMin", label: "Top left" }, { value: "xMidYMid", label: "Center" }, { value: "xMaxYMax", label: "Bottom right" }]} onChange={(value) => patchLayer({ payload: { preserveAspectRatio: { ...selected.payload.preserveAspectRatio, align: value as "none" | "xMinYMin" | "xMidYMid" | "xMaxYMax" } } })} />
          <InspectorSelect label="Aspect mode" value={selected.payload.preserveAspectRatio?.meetOrSlice ?? "meet"} options={[{ value: "meet", label: "Meet" }, { value: "slice", label: "Slice" }]} onChange={(value) => patchLayer({ payload: { preserveAspectRatio: { ...selected.payload.preserveAspectRatio, meetOrSlice: value as "meet" | "slice" } } })} />
        </InspectorSection>
      ) : null}

      {selected.type === "video" ? (
        <InspectorSection label="Media" open={openSections.media ?? false} onToggle={() => toggle("media")}>
          {(() => {
            const source = document.assets.find((asset) => asset.id === selected.payload.assetId);
            const sourceDurationMs = source?.kind === "video" ? source.duration : undefined;
            const sourceDuration = sourceDurationMs === undefined
              ? undefined
              : protocolMillisecondsToSeconds(sourceDurationMs);
            const trimStart = Math.min(
              protocolMillisecondsToSeconds(selected.payload.trimStart ?? 0),
              Math.max(0, (sourceDuration ?? Number.POSITIVE_INFINITY) - 0.001),
            );
            const maxTrimEnd = sourceDuration ?? Number.POSITIVE_INFINITY;
            const currentTrimEnd = Math.min(
              protocolMillisecondsToSeconds(
                selected.payload.trimEnd ?? sourceDurationMs ?? selected.timing.duration,
              ),
              maxTrimEnd,
            );
            return (
              <>
                <ReadonlyField label="Asset" value={source?.uri ?? selected.payload.assetId} />
                {sourceDuration !== undefined ? (
                  <ReadonlyField label="Source duration" value={`${sourceDuration.toFixed(2)} s`} />
                ) : null}
                <InspectorSelect label="Fit" value={selected.payload.fit ?? "contain"} options={[{ value: "contain", label: "Contain" }, { value: "cover", label: "Cover" }, { value: "fill", label: "Fill" }, { value: "none", label: "None" }]} onChange={(value) => patchLayer({ payload: { fit: value as "contain" | "cover" | "fill" | "none" } })} />
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <NumberField
                    label="Trim start"
                    step={0.01}
                    suffix="s"
                    value={trimStart}
                    onChange={(value) => {
                      const maxStart = Math.max(0, Math.min(maxTrimEnd, currentTrimEnd) - 0.001);
                      patchLayer({ payload: { trimStart: secondsToProtocolMilliseconds(Math.min(maxStart, Math.max(0, value))) } });
                    }}
                  />
                  <NumberField
                    label="Trim end"
                    step={0.01}
                    suffix="s"
                    value={currentTrimEnd}
                    onChange={(value) => {
                      const minEnd = trimStart + 0.001;
                      patchLayer({ payload: { trimEnd: secondsToProtocolMilliseconds(Math.min(maxTrimEnd, Math.max(minEnd, value))) } });
                    }}
                  />
                </div>
              </>
            );
          })()}
          <ToggleField
            label="Muted"
            checked={!(selected.payload.audio?.enabled ?? false)}
            onChange={(checked) => patchLayer({
              payload: {
                audio: {
                  enabled: !checked,
                  gainDb: selected.payload.audio?.gainDb ?? 0,
                  pan: selected.payload.audio?.pan ?? 0,
                  fadeIn: selected.payload.audio?.fadeIn ?? DEFAULT_AUDIO_FADE,
                  fadeOut: selected.payload.audio?.fadeOut ?? DEFAULT_AUDIO_FADE,
                },
              },
            })}
          />
          {selected.payload.audio ? (() => {
            const audio = selected.payload.audio;
            const fadeIn = audio.fadeIn ?? DEFAULT_AUDIO_FADE;
            const fadeOut = audio.fadeOut ?? DEFAULT_AUDIO_FADE;
            return (
              <>
                <NumberField
                  label="Gain"
                  step={0.1}
                  suffix="dB"
                  value={audio.gainDb}
                  onChange={(value) => patchLayer({ payload: { audio: { gainDb: value } } })}
                />
                <NumberField label="Pan" step={0.01} value={audio.pan} onChange={(value) => patchLayer({ payload: { audio: { pan: Math.max(-1, Math.min(1, value)) } } })}
                />
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <NumberField label="Fade in" step={0.01} suffix="s" value={protocolMillisecondsToSeconds(fadeIn.duration)} onChange={(value) => patchLayer({ payload: { audio: { fadeIn: { duration: secondsToProtocolMilliseconds(clampFadeDuration(value, protocolMillisecondsToSeconds(selected.timing.duration))), curve: fadeIn.curve } } } })} />
                  <InspectorSelect label="Curve" value={fadeIn.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => patchLayer({ payload: { audio: { fadeIn: { duration: fadeIn.duration, curve: value as "linear" | "equal-power" } } } })} />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <NumberField label="Fade out" step={0.01} suffix="s" value={protocolMillisecondsToSeconds(fadeOut.duration)} onChange={(value) => patchLayer({ payload: { audio: { fadeOut: { duration: secondsToProtocolMilliseconds(clampFadeDuration(value, protocolMillisecondsToSeconds(selected.timing.duration))), curve: fadeOut.curve } } } })} />
                  <InspectorSelect label="Curve" value={fadeOut.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => patchLayer({ payload: { audio: { fadeOut: { duration: fadeOut.duration, curve: value as "linear" | "equal-power" } } } })} />
                </div>
                <ActionButton label="Detach audio" onClick={() => applyCommand({ type: "detach-video-audio", layerId: selected.id })} />
              </>
            );
          })() : null}
          <InspectorSelect label="Frame policy" value={selected.payload.framePolicy ?? "floor"} options={[{ value: "floor", label: "Floor" }, { value: "round", label: "Round" }, { value: "ceil", label: "Ceil" }]} onChange={(value) => patchLayer({ payload: { framePolicy: value as "floor" | "round" | "ceil" } })} />
        </InspectorSection>
      ) : null}
      </div>

      {selected.type === "group" ? (
        <InspectorSection label="Group" className="order-9" open={openSections.group ?? false} onToggle={() => toggle("group")}>
          <ReadonlyField label="Parent" value={selected.parentLayerId ?? "Root"} />
          {selected.clipPath ? <ReadonlyField label="clipPath" value={selected.clipPath} /> : null}
          {selected.mask ? <ReadonlyField label="mask" value={selected.mask} /> : null}
        </InspectorSection>
      ) : null}
      </div>
    </div>
  ) : selectedAudio ? (
    <AudioInspector
      clip={selectedAudio.clip}
      track={selectedAudio.track}
      assetLabel={document.assets.find((asset) => asset.id === selectedAudio.clip.assetId)?.uri ?? selectedAudio.clip.assetId}
      open={openSections.media ?? false}
      onToggle={() => toggle("media")}
      onClipPatch={patchAudioClip}
      onTrackPatch={patchAudioTrack}
    />
  ) : (
    <EmptyInspector width={document.composition.width} height={document.composition.height} fps={document.composition.fps} background={document.composition.background} />
  );

  return (
    <aside className="editor-panel overflow-hidden [grid-area:inspector]">
      <Panel bodyClassName="!p-0" className="h-full rounded-none border-0 bg-transparent shadow-none">
        <Tabs
          defaultValue="properties"
          items={[
            {
              id: "properties",
              label: "Properties",
              content: (
                <div className="h-full w-full overflow-auto p-3">{properties}</div>
              ),
            },
            {
              id: "animation",
              label: "Animation",
              content: (
                <div className="h-full w-full overflow-auto p-3">
                  <AnimationInspector selected={selected} />
                </div>
              ),
            },
          ]}
        />
      </Panel>
    </aside>
  );
}
