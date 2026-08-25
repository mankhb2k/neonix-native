"use client";

import { useEditorSurface } from "@/components/editor/EditorSurfaceProvider";
import { Panel, Tabs } from "@/components/ui";
import type {
  AudioClipPatch,
  AudioTrackDocumentPatch,
  LayerPatch,
} from "@motionvideo/editor-core/document/commands";
import type { V2AudioClip, V2AudioTrack } from "@motionvideo/motion-protocol/v2";
import { buildAlignmentPatches, compensateAnchor } from "@/lib/editor/inspector/transform";
import { EffectsInspector } from "./EffectsInspector";
import { InspectorSelect } from "./InspectorSelect";
import { StepperInput } from "./StepperInput";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ChevronDown,
  Dot,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const inputClass =
  "h-7 w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] px-2 text-[12px] text-[var(--fg-primary)] outline-none focus:border-[var(--border-focus)]";

/** Languages currently shipped by the web editor for text layers. */
const SHIPPED_TEXT_LANGUAGES = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh-CN", label: "简体中文" },
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
    <section className={`border-b border-[var(--border-subtle)] last:border-b-0 ${className ?? ""}`}>
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
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  integer?: boolean;
  mixed?: boolean;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <StepperInput label={label} value={value} step={step} integer={integer} mixed={mixed} suffix={suffix} onChange={onChange} />
    </label>
  );
}

function RangeField({
  label,
  value,
  mixed = false,
  onChange,
}: {
  label: string;
  value: number;
  mixed?: boolean;
  onChange: (value: number, gestureId: number) => void;
}) {
  const gestureRef = useRef(0);
  const percentage = Math.round(value * 100);
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
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
    </label>
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
        Chọn một layer trên sidebar hoặc timeline để xem thuộc tính.
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
  return (
    <div className="min-h-full w-full" data-testid="inspector-audio-properties">
      <InspectorSection label="Media" open={open} onToggle={onToggle}>
        <ReadonlyField label="Asset" value={assetLabel} />
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Start" step={0.01} suffix="s" value={clip.timing.start} onChange={(value) => onClipPatch({ timing: { start: Math.max(0, value) } })} />
          <NumberField label="Duration" step={0.01} suffix="s" value={clip.timing.duration} onChange={(value) => onClipPatch({ timing: { duration: Math.max(0.001, value) } })} />
          <NumberField label="Trim start" step={0.01} suffix="s" value={clip.trim.start} onChange={(value) => onClipPatch({ trim: { start: Math.max(0, value) } })} />
          <NumberField label="Trim end" step={0.01} suffix="s" value={clip.trim.end ?? clip.trim.start + clip.timing.duration} onChange={(value) => onClipPatch({ trim: { end: Math.max(clip.trim.start + 0.001, value) } })} />
        </div>
        <NumberField label="Playback rate" step={0.01} value={clip.playbackRate} onChange={(value) => onClipPatch({ playbackRate: Math.max(0.001, value) })} />
        <NumberField label="Gain" step={0.1} suffix="dB" value={clip.gainDb} onChange={(value) => onClipPatch({ gainDb: value })} />
        <ToggleField label="Loop" checked={clip.loop} onChange={(checked) => onClipPatch({ loop: checked })} />
        <NumberField label="Pan" step={0.01} value={track.pan} onChange={(value) => onTrackPatch({ pan: Math.max(-1, Math.min(1, value)) })} />
        <ToggleField label="Track muted" checked={track.muted} onChange={(checked) => onTrackPatch({ muted: checked })} />
        {clip.fadeIn ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberField label="Fade in" step={0.01} suffix="s" value={clip.fadeIn.duration} onChange={(value) => onClipPatch({ fadeIn: { duration: Math.max(0.001, Math.min(clip.timing.duration, value)) } })} />
            <InspectorSelect label="Curve" value={clip.fadeIn.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => onClipPatch({ fadeIn: { curve: value as "linear" | "equal-power" } })} />
          </div>
        ) : <ActionButton label="Add fade in" onClick={() => onClipPatch({ fadeIn: { duration: 0.1, curve: "linear" } })} />}
        {clip.fadeOut ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberField label="Fade out" step={0.01} suffix="s" value={clip.fadeOut.duration} onChange={(value) => onClipPatch({ fadeOut: { duration: Math.max(0.001, Math.min(clip.timing.duration, value)) } })} />
            <InspectorSelect label="Curve" value={clip.fadeOut.curve} options={[{ value: "linear", label: "Linear" }, { value: "equal-power", label: "Equal power" }]} onChange={(value) => onClipPatch({ fadeOut: { curve: value as "linear" | "equal-power" } })} />
          </div>
        ) : <ActionButton label="Add fade out" onClick={() => onClipPatch({ fadeOut: { duration: 0.1, curve: "linear" } })} />}
      </InspectorSection>
    </div>
  );
}

/** Inspector shell for Protocol V2; common/type-specific controls remain on the existing surface. */
export function SchemaInspector() {
  const { document, selectedLayerIds, applyCommand, applyCoalescedCommand, diagnostics } = useEditorSurface();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    timing: true,
    transform: true,
    layout: true,
    alignment: true,
    anchor: false,
    appearance: true,
    compositing: true,
    text: true,
    style: true,
    media: true,
    group: true,
    effects: true,
  });
  const selected = useMemo(() => document.layers.find((layer) => layer.id === selectedLayerIds[0]), [document.layers, selectedLayerIds]);
  const selectedLayers = useMemo(
    () => selectedLayerIds.map((id) => document.layers.find((layer) => layer.id === id)).filter((layer): layer is (typeof document.layers)[number] => Boolean(layer)),
    [document, selectedLayerIds],
  );
  const isMultiLayerSelection = selectedLayers.length > 1 && selectedLayers.length === selectedLayerIds.length;
  const commonLayerNumber = (read: (layer: (typeof selectedLayers)[number]) => number) => {
    const values = selectedLayers.map(read);
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
  const fontOptions = useMemo(() => {
    const fonts = document.assets
      .filter((asset) => asset.kind === "font")
      .map((asset) => ({ value: asset.id, label: asset.family }));
    if (selected?.type === "text" && !fonts.some((option) => option.value === selected.payload.fontAssetId)) {
      fonts.unshift({ value: selected.payload.fontAssetId, label: selected.payload.fontAssetId });
    }
    return fonts;
  }, [document.assets, selected]);
  const languageOptions = useMemo(() => {
    if (selected?.type !== "text" || SHIPPED_TEXT_LANGUAGES.some((option) => option.value === selected.payload.language)) {
      return SHIPPED_TEXT_LANGUAGES;
    }
    // Keep imported/custom protocol documents editable without silently rewriting their language.
    return [{ value: selected.payload.language, label: `${selected.payload.language} (custom)` }, ...SHIPPED_TEXT_LANGUAGES];
  }, [selected]);

  const patchLayer = (patch: LayerPatch) => {
    if (selected) applyCommand({ type: "patch-layer", layerId: selected.id, patch });
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

  const commonStart = commonLayerNumber((layer) => layer.timing.start);
  const commonDuration = commonLayerNumber((layer) => layer.timing.duration);
  const commonTranslateX = commonLayerNumber((layer) => layer.transform.translate.x);
  const commonTranslateY = commonLayerNumber((layer) => layer.transform.translate.y);
  const commonWidth = commonLayerNumber((layer) => layer.frame.width);
  const commonHeight = commonLayerNumber((layer) => layer.frame.height);
  const commonScaleX = commonLayerNumber((layer) => layer.transform.scale.x);
  const commonScaleY = commonLayerNumber((layer) => layer.transform.scale.y);
  const commonRotation = commonLayerNumber((layer) => layer.transform.rotate.z);
  const commonOpacity = commonLayerNumber((layer) => layer.opacity);

  const properties = selected ? (
    <div className="flex min-h-full w-full flex-col" data-testid="inspector-properties">
      {diagnostics.length > 0 ? (
        <div role="alert" className="order-[-2] border-b border-[var(--danger)]/40 bg-[var(--danger)]/10 py-2 text-[11px] text-[var(--danger)]">
          {diagnostics[0]?.message}
        </div>
      ) : null}
      <InspectorSection label="Timing" className="order-4" open={openSections.timing ?? false} onToggle={() => toggle("timing")}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Start" value={commonStart.value} mixed={isMultiLayerSelection && commonStart.mixed} onChange={(value) => patchSelectedLayers({ timing: { start: Math.max(0, value) } })} />
          <NumberField label="Duration" value={commonDuration.value} mixed={isMultiLayerSelection && commonDuration.mixed} onChange={(value) => patchSelectedLayers({ timing: { duration: Math.max(0.001, value) } })} />
        </div>
        <ReadonlyField label="End" value={isMultiLayerSelection && (commonStart.mixed || commonDuration.mixed) ? "Mixed" : (commonStart.value + commonDuration.value).toFixed(2)} />
      </InspectorSection>

      <InspectorSection label="Position" className="order-0" open={openSections.transform ?? false} onToggle={() => toggle("transform")}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="X" step={1} integer suffix="px" value={commonTranslateX.value} mixed={isMultiLayerSelection && commonTranslateX.mixed} onChange={(value) => patchSelectedLayers({ transform: { translate: { x: value } } })} />
          <NumberField label="Y" step={1} integer suffix="px" value={commonTranslateY.value} mixed={isMultiLayerSelection && commonTranslateY.mixed} onChange={(value) => patchSelectedLayers({ transform: { translate: { y: value } } })} />
          <NumberField label="Rotation Z" step={1} integer value={commonRotation.value} mixed={isMultiLayerSelection && commonRotation.mixed} onChange={(value) => patchSelectedLayers({ transform: { rotate: { z: value } } })} />
        </div>
      </InspectorSection>

      <InspectorSection label="Layout" className="order-2" open={openSections.layout ?? false} onToggle={() => toggle("layout")}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Width" step={1} integer suffix="px" value={commonWidth.value} mixed={isMultiLayerSelection && commonWidth.mixed} onChange={(value) => patchSelectedLayers({ frame: { width: Math.max(1, value) } })} />
          <NumberField label="Height" step={1} integer suffix="px" value={commonHeight.value} mixed={isMultiLayerSelection && commonHeight.mixed} onChange={(value) => patchSelectedLayers({ frame: { height: Math.max(1, value) } })} />
          <NumberField label="Scale X" step={1} integer value={commonScaleX.value} mixed={isMultiLayerSelection && commonScaleX.mixed} onChange={(value) => patchSelectedLayers({ transform: { scale: { x: Math.max(0.001, value) } } })} />
          <NumberField label="Scale Y" step={1} integer value={commonScaleY.value} mixed={isMultiLayerSelection && commonScaleY.mixed} onChange={(value) => patchSelectedLayers({ transform: { scale: { y: Math.max(0.001, value) } } })} />
        </div>
      </InspectorSection>

      {isMultiLayerSelection ? (
        <InspectorSection label="Appearance" className="order-5" open={openSections.appearance ?? false} onToggle={() => toggle("appearance")}>
          <RangeField
            label="Opacity"
            value={commonOpacity.value}
            mixed={commonOpacity.mixed}
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
          onChange={(value, gestureId) => patchLayerCoalesced("opacity", gestureId, { opacity: Math.max(0, Math.min(1, value)) })}
        />
        {selected.type === "shape" ? (
          <NumberField label="Corner radius" step={1} integer suffix="px" value={selected.payload.cornerRadius ?? 0} onChange={(value) => patchLayer({ payload: { cornerRadius: Math.max(0, value) } })} />
        ) : null}
      </InspectorSection>

      <InspectorSection label="Compositing" className="order-7" open={openSections.compositing ?? false} onToggle={() => toggle("compositing")}>
        <InspectorSelect
          label="Blend"
          value={selected.composite?.blendMode ?? "normal"}
          options={[
            { value: "normal", label: "Normal" },
            { value: "multiply", label: "Multiply" },
            { value: "screen", label: "Screen" },
            { value: "add", label: "Add" },
          ]}
          onChange={(value) => patchLayer({ composite: { blendMode: value as "normal" | "multiply" | "screen" | "add" } })}
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
        <InspectorSection label="Text" open={openSections.text ?? false} onToggle={() => toggle("text")}>
          <TextAreaField label="Content" value={selected.payload.text} onCommit={(value) => patchLayer({ payload: { text: value } })} />
          <InspectorSelect label="Font" value={selected.payload.fontAssetId} options={fontOptions} onChange={(value) => patchLayer({ payload: { fontAssetId: value } })} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberField label="Font size" step={1} integer suffix="px" value={selected.payload.fontSize} onChange={(value) => patchLayer({ payload: { fontSize: Math.max(0.001, value) } })} />
            <NumberField label="Line height" step={1} integer suffix="px" value={selected.payload.lineHeight} onChange={(value) => patchLayer({ payload: { lineHeight: Math.max(0.001, value) } })} />
          </div>
          <NumberField label="Letter spacing" suffix="px" value={selected.payload.letterSpacing} onChange={(value) => patchLayer({ payload: { letterSpacing: value } })} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <InspectorSelect label="Align" value={selected.payload.align} options={[{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }]} onChange={(value) => patchLayer({ payload: { align: value as "left" | "center" | "right" } })} />
            <InspectorSelect label="Vertical" value={selected.payload.verticalAlign} options={[{ value: "top", label: "Top" }, { value: "middle", label: "Middle" }, { value: "bottom", label: "Bottom" }]} onChange={(value) => patchLayer({ payload: { verticalAlign: value as "top" | "middle" | "bottom" } })} />
          </div>
          <InspectorSelect label="Language" value={selected.payload.language} options={languageOptions} onChange={(value) => patchLayer({ payload: { language: value } })} />
          <ColorField label="Fill" value={selected.style.fill} onChange={(value) => patchLayer({ style: { fill: value } })} />
        </InspectorSection>
      ) : null}

      {selected.type === "shape" ? (
        <InspectorSection label="Style" open={openSections.style ?? false} onToggle={() => toggle("style")}>
          {typeof selected.style.fill === "string" ? (
            <ColorField label="Fill" value={selected.style.fill} onChange={(value) => patchLayer({ style: { fill: value } })} />
          ) : null}
          {selected.style.stroke ? <ColorField label="Stroke" value={selected.style.stroke} onChange={(value) => patchLayer({ style: { stroke: value } })} /> : null}
          {selected.style.stroke ? <NumberField label="Stroke width" step={1} integer suffix="px" value={selected.style.strokeWidth ?? 1} onChange={(value) => patchLayer({ style: { strokeWidth: Math.max(0.001, value) } })} /> : null}
          {!selected.style.stroke ? <ActionButton label="Add stroke" onClick={() => patchLayer({ style: { stroke: "#ffffff", strokeWidth: 1 } })} /> : null}
        </InspectorSection>
      ) : null}

      {selected.type === "image" ? (
        <InspectorSection label="Media" open={openSections.media ?? false} onToggle={() => toggle("media")}>
          <ReadonlyField label="Asset" value={document.assets.find((asset) => asset.id === selected.payload.assetId)?.uri ?? selected.payload.assetId} />
          <InspectorSelect label="Fit" value={selected.payload.fit ?? "contain"} options={[{ value: "contain", label: "Contain" }, { value: "cover", label: "Cover" }, { value: "fill", label: "Fill" }, { value: "none", label: "None" }]} onChange={(value) => patchLayer({ payload: { fit: value as "contain" | "cover" | "fill" | "none" } })} />
        </InspectorSection>
      ) : null}

      {selected.type === "video" ? (
        <InspectorSection label="Media" open={openSections.media ?? false} onToggle={() => toggle("media")}>
          <ReadonlyField label="Asset" value={document.assets.find((asset) => asset.id === selected.payload.assetId)?.uri ?? selected.payload.assetId} />
          <InspectorSelect label="Fit" value={selected.payload.fit ?? "contain"} options={[{ value: "contain", label: "Contain" }, { value: "cover", label: "Cover" }, { value: "fill", label: "Fill" }, { value: "none", label: "None" }]} onChange={(value) => patchLayer({ payload: { fit: value as "contain" | "cover" | "fill" | "none" } })} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <NumberField label="Trim start" step={0.01} suffix="s" value={selected.payload.trimStart ?? 0} onChange={(value) => patchLayer({ payload: { trimStart: Math.max(0, value) } })} />
            <NumberField label="Trim end" step={0.01} suffix="s" value={selected.payload.trimEnd ?? selected.timing.duration} onChange={(value) => patchLayer({ payload: { trimEnd: Math.max(0.001, value) } })} />
          </div>
          <ToggleField label="Loop" checked={selected.payload.loop ?? false} onChange={(checked) => patchLayer({ payload: { loop: checked } })} />
          <ToggleField label="Muted" checked={selected.payload.muted ?? false} onChange={(checked) => patchLayer({ payload: { muted: checked } })} />
          <InspectorSelect label="Frame policy" value={selected.payload.framePolicy ?? "floor"} options={[{ value: "floor", label: "Floor" }, { value: "round", label: "Round" }, { value: "ceil", label: "Ceil" }]} onChange={(value) => patchLayer({ payload: { framePolicy: value as "floor" | "round" | "ceil" } })} />
        </InspectorSection>
      ) : null}
      </div>

      {selected.type === "group" ? (
        <InspectorSection label="Group" className="order-9" open={openSections.group ?? false} onToggle={() => toggle("group")}>
          <ReadonlyField label="Parent" value={selected.parentLayerId ?? "Root"} />
          {selected.composite?.mask ? (
            <>
              <InspectorSelect label="Mask mode" value={selected.composite.mask.mode} options={[{ value: "clip", label: "Clip" }, { value: "alpha", label: "Alpha" }, { value: "inverse-alpha", label: "Inverse alpha" }, { value: "luma", label: "Luma" }]} onChange={(value) => patchLayer({ composite: { mask: { mode: value as "clip" | "alpha" | "inverse-alpha" | "luma" } } })} />
              <InspectorSelect label="Mask source" value={selected.composite.mask.sourceLayerId} options={document.layers.filter((layer) => layer.parentLayerId === selected.id).map((layer) => ({ value: layer.id, label: layer.id }))} onChange={(value) => patchLayer({ composite: { mask: { sourceLayerId: value } } })} />
            </>
          ) : (
            <ActionButton
              label="Add mask"
              disabled={!document.layers.some((layer) => layer.parentLayerId === selected.id)}
              onClick={() => {
                const child = document.layers.find((layer) => layer.parentLayerId === selected.id);
                if (child) patchLayer({ composite: { mask: { mode: "alpha", sourceLayerId: child.id, sourceVisibility: "mask-only" } } });
              }}
            />
          )}
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
          ]}
        />
      </Panel>
    </aside>
  );
}
