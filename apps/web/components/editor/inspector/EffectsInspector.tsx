"use client";

import { ChevronDown, ChevronUp, GripVertical, Plus, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StepperInput } from "./StepperInput";
import type { V2Effect } from "@motionvideo/motion-protocol/v2";

type EffectType = V2Effect["type"];

type EffectsInspectorProps = {
  effects: readonly V2Effect[];
  open: boolean;
  onToggle: () => void;
  onChange: (effects: V2Effect[]) => void;
};

const EFFECT_OPTIONS: readonly { type: EffectType; label: string }[] = [
  { type: "color-adjust", label: "Color adjust" },
  { type: "blur", label: "Blur" },
  { type: "shadow", label: "Shadow" },
  { type: "outer-glow", label: "Outer glow" },
  { type: "inner-glow", label: "Inner glow" },
  { type: "noise", label: "Noise" },
];

function effectLabel(type: EffectType) {
  return EFFECT_OPTIONS.find((option) => option.type === type)?.label ?? type;
}

function createEffect(type: EffectType, id: string): V2Effect {
  switch (type) {
    case "color-adjust":
      return { id, type, brightness: 0, contrast: 1, saturation: 1, hueRotate: 0 };
    case "blur":
      return { id, type, radius: 8 };
    case "shadow":
      return { id, type, source: "box", offset: { x: 0, y: 8 }, blur: 12, spread: 0, color: "#000000", inset: false };
    case "outer-glow":
      return { id, type, radius: 12, color: "#ffffff", opacity: 0.5 };
    case "inner-glow":
      return { id, type, radius: 12, color: "#ffffff", opacity: 0.5 };
    case "noise":
      return { id, type, scale: 4, amount: 0.1, opacity: 0.2, seed: 1337 };
    default:
      throw new Error("Unsupported effect type");
  }
}

function NumberField({
  label,
  value,
  onChange,
  step = 0.01,
  min,
  max,
  integer = false,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  integer?: boolean;
  suffix?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <StepperInput label={label} value={value} step={step} min={min} max={max} integer={integer} suffix={suffix} onChange={onChange} />
    </label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <input
        type="color"
        className="h-7 w-12 appearance-none rounded border-2 border-[var(--border-strong)] bg-transparent p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:border-0"
        value={value.slice(0, 7)}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function PercentField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <StepperInput
        label={label}
        value={Math.round(value * 100)}
        min={0}
        max={100}
        step={1}
        suffix="%"
        onChange={(next) => onChange(next / 100)}
      />
    </label>
  );
}

function EffectFields({ effect, onPatch }: { effect: V2Effect; onPatch: (patch: Partial<V2Effect>) => void }) {
  switch (effect.type) {
    case "color-adjust":
      return (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Brightness" value={effect.brightness} min={-1} max={1} onChange={(value) => onPatch({ brightness: value })} />
          <NumberField label="Contrast" value={effect.contrast} min={0} max={4} onChange={(value) => onPatch({ contrast: value })} />
          <NumberField label="Saturation" value={effect.saturation} min={0} max={4} onChange={(value) => onPatch({ saturation: value })} />
          <NumberField label="Hue rotate" value={effect.hueRotate} min={-180} max={180} step={1} suffix="°" onChange={(value) => onPatch({ hueRotate: value })} />
        </div>
      );
    case "blur":
      return <NumberField label="Radius" value={effect.radius} min={0.001} max={256} onChange={(value) => onPatch({ radius: value })} />;
    case "shadow":
      return (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="X" value={effect.offset.x} step={1} suffix="px" onChange={(value) => onPatch({ offset: { ...effect.offset, x: value } })} />
          <NumberField label="Y" value={effect.offset.y} step={1} suffix="px" onChange={(value) => onPatch({ offset: { ...effect.offset, y: value } })} />
          <NumberField label="Blur" value={effect.blur} min={0} max={256} onChange={(value) => onPatch({ blur: value })} />
          <NumberField label="Spread" value={effect.spread} step={1} suffix="px" onChange={(value) => onPatch({ spread: value })} />
          <ColorField label="Color" value={effect.color} onChange={(value) => onPatch({ color: value })} />
          <label className="flex items-center justify-between gap-2 text-[11px] text-[var(--fg-muted)]">
            <span>Inset</span>
            <input type="checkbox" checked={effect.inset} onChange={(event) => onPatch({ inset: event.target.checked })} />
          </label>
        </div>
      );
    case "outer-glow":
    case "inner-glow":
      return (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Radius" value={effect.radius} min={0.001} max={256} onChange={(value) => onPatch({ radius: value })} />
          <PercentField label="Opacity" value={effect.opacity} onChange={(value) => onPatch({ opacity: value })} />
          <ColorField label="Color" value={effect.color} onChange={(value) => onPatch({ color: value })} />
        </div>
      );
    case "noise":
      return (
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField label="Scale" value={effect.scale} min={0.001} max={256} onChange={(value) => onPatch({ scale: value })} />
          <NumberField label="Amount" value={effect.amount} min={0} max={1} onChange={(value) => onPatch({ amount: value })} />
          <PercentField label="Opacity" value={effect.opacity} onChange={(value) => onPatch({ opacity: value })} />
          <NumberField label="Seed" value={effect.seed} min={0} max={0xffffffff} step={1} integer onChange={(value) => onPatch({ seed: value })} />
        </div>
      );
    default:
      return null;
  }
}

export function EffectsInspector({ effects, open, onToggle, onChange }: EffectsInspectorProps) {
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!addMenuOpen) return undefined;
    const closeOnOutside = (event: PointerEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [addMenuOpen]);

  const addEffect = (type: EffectType) => {
    if (effects.length >= 8) return;
    const base = type;
    let suffix = 1;
    let id = `${base}-${suffix}`;
    while (effects.some((effect) => effect.id === id)) id = `${base}-${++suffix}`;
    onChange([...effects, createEffect(type, id)]);
    setCollapsed((current) => ({ ...current, [id]: false }));
    setAddMenuOpen(false);
  };

  const patchEffect = (index: number, patch: Partial<V2Effect>) => {
    onChange(effects.map((effect, effectIndex) => (effectIndex === index ? ({ ...effect, ...patch } as V2Effect) : effect)));
  };

  const removeEffect = (index: number) => onChange(effects.filter((_, effectIndex) => effectIndex !== index));

  const moveEffect = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= effects.length) return;
    const next = [...effects];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <section className="border-b border-[var(--border-subtle)] last:border-b-0">
      <button type="button" className="flex min-h-9 w-full items-center justify-between px-0 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--fg-muted)]" aria-expanded={open} onClick={onToggle}>
        <span>Effects{effects.length ? ` (${effects.length})` : ""}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open ? (
        <div className="space-y-2 px-0 pb-3">
          <div ref={addMenuRef} className="relative">
            <button type="button" className="flex h-7 w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--border-strong)] text-[11px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)] disabled:cursor-not-allowed disabled:opacity-40" disabled={effects.length >= 8} onClick={() => setAddMenuOpen((current) => !current)}>
              <Plus size={13} /> Add effect
            </button>
            {addMenuOpen ? (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                {EFFECT_OPTIONS.map((option) => (
                  <button key={option.type} type="button" className="flex min-h-7 w-full items-center rounded px-2 text-left text-[12px] text-[var(--fg-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]" onClick={() => addEffect(option.type)}>
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {effects.map((effect, index) => {
            const isCollapsed = collapsed[effect.id] ?? false;
            return (
              <article key={effect.id} className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)]">
                <div className="flex min-h-8 items-center gap-1 px-1.5">
                  <GripVertical size={13} className="shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-1 text-left text-[11px] text-[var(--fg-primary)]" aria-expanded={!isCollapsed} onClick={() => setCollapsed((current) => ({ ...current, [effect.id]: !isCollapsed }))}>
                    <Sparkles size={12} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
                    <span className="truncate">{effectLabel(effect.type)}</span>
                    <ChevronDown size={12} className={`shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                  </button>
                  <button type="button" aria-label={`Move ${effectLabel(effect.type)} up`} title="Move up" className="rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30" disabled={index === 0} onClick={() => moveEffect(index, -1)}><ChevronUp size={13} /></button>
                  <button type="button" aria-label={`Move ${effectLabel(effect.type)} down`} title="Move down" className="rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] disabled:opacity-30" disabled={index === effects.length - 1} onClick={() => moveEffect(index, 1)}><ChevronDown size={13} /></button>
                  <button type="button" aria-label={`Remove ${effectLabel(effect.type)}`} title="Remove effect" className="rounded p-1 text-[var(--fg-muted)] hover:bg-[var(--danger)]/15 hover:text-[var(--danger)]" onClick={() => removeEffect(index)}><Trash2 size={13} /></button>
                </div>
                {!isCollapsed ? <div className="space-y-2 border-t border-[var(--border-subtle)] px-2 py-2"><EffectFields effect={effect} onPatch={(patch) => patchEffect(index, patch)} /></div> : null}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
