"use client";

import { useRef } from "react";
import { KeyframeButton } from "./InspectorSection";
import { StepperInput } from "./StepperInput";

export function NumberField({
  label,
  value,
  step = 0.01,
  integer = false,
  min,
  max,
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
  min?: number;
  max?: number;
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
        <StepperInput label={label} value={value} step={step} integer={integer} min={min} max={max} mixed={mixed} suffix={suffix} onChange={onChange} />
        {onKeyframe ? <KeyframeButton label={label} active={keyframed} disabled={keyframeDisabled} onClick={onKeyframe} /> : null}
      </span>
    </label>
  );
}

export function RangeField({
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
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[11px] text-[var(--fg-muted)]">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <StepperInput
          label={`${label} percent`}
          value={Math.round(value * 100)}
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
