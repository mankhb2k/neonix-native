"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type StepperInputProps = {
  label: string;
  value: number;
  step?: number;
  integer?: boolean;
  min?: number;
  max?: number;
  suffix?: string;
  widthClass?: string;
  live?: boolean;
  mixed?: boolean;
  onChange: (value: number) => void;
  onGestureStart?: () => void;
};

/** Shared inspector numeric input with unit suffix and vertical step buttons. */
export function StepperInput({
  label,
  value,
  step = 0.01,
  integer = false,
  min,
  max,
  suffix,
  widthClass = "w-[7rem] min-w-[7rem] flex-none",
  live = false,
  mixed = false,
  onChange,
  onGestureStart,
}: StepperInputProps) {
  const [draft, setDraft] = useState(Number.isFinite(value) ? String(value) : "0");
  const valueRef = useRef(value);
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);
  valueRef.current = value;

  useEffect(() => {
    setDraft(mixed ? "" : Number.isFinite(value) ? String(value) : "0");
  }, [mixed, value]);

  const bound = (next: number) => {
    const normalized = integer ? Math.round(next) : next;
    return Math.min(max ?? normalized, Math.max(min ?? normalized, normalized));
  };

  const commit = () => {
    if (mixed && draft.trim() === "") return;
    const next = Number(draft);
    if (Number.isFinite(next)) {
      const bounded = bound(next);
      onChange(bounded);
      setDraft(String(bounded));
    } else {
      setDraft(Number.isFinite(value) ? String(value) : "0");
    }
  };

  const bump = (direction: 1 | -1, beginGesture = true) => {
    if (beginGesture) onGestureStart?.();
    const precision = step < 1 ? 6 : 0;
    const next = Number((valueRef.current + direction * step).toFixed(precision));
    const bounded = bound(next);
    valueRef.current = bounded;
    setDraft(String(bounded));
    onChange(bounded);
  };

  const stopRepeat = () => {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  };

  const startRepeat = (direction: 1 | -1) => {
    stopRepeat();
    onGestureStart?.();
    bump(direction, false);
    repeatTimeoutRef.current = window.setTimeout(() => {
      bump(direction, false);
      repeatIntervalRef.current = window.setInterval(
        () => bump(direction, false),
        70,
      );
    }, 350);
  };

  useEffect(() => stopRepeat, []);

  return (
    <span className={`flex h-7 ${widthClass} overflow-hidden rounded-md border border-[var(--border-strong)] bg-[var(--bg-site)] focus-within:border-[var(--border-focus)]`}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        className="min-w-[4rem] flex-1 bg-transparent px-2 text-[12px] text-[var(--fg-primary)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={draft}
        placeholder={mixed ? "Mixed" : undefined}
        onPointerDown={onGestureStart}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = Number(event.target.value);
          if (live && Number.isFinite(next)) onChange(bound(next));
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setDraft(Number.isFinite(value) ? String(value) : "0");
            event.currentTarget.blur();
          }
        }}
        aria-label={label}
      />
      {suffix ? <span className="shrink-0 pr-2 text-[11px] text-[var(--fg-secondary)]">{suffix}</span> : null}
      <span className="flex w-5 shrink-0 flex-col border-l border-[var(--border-strong)]">
        <button
          type="button"
          aria-label={`Increase ${label}`}
          className="flex min-h-0 flex-1 items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            startRepeat(1);
          }}
          onPointerUp={stopRepeat}
          onPointerCancel={stopRepeat}
          onBlur={stopRepeat}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
              event.preventDefault();
              startRepeat(1);
            }
          }}
          onKeyUp={(event) => {
            if (event.key === "Enter" || event.key === " ") stopRepeat();
          }}
        >
          <ChevronUp size={10} strokeWidth={2} />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          className="flex min-h-0 flex-1 items-center justify-center text-[var(--fg-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--fg-primary)]"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture?.(event.pointerId);
            startRepeat(-1);
          }}
          onPointerUp={stopRepeat}
          onPointerCancel={stopRepeat}
          onBlur={stopRepeat}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
              event.preventDefault();
              startRepeat(-1);
            }
          }}
          onKeyUp={(event) => {
            if (event.key === "Enter" || event.key === " ") stopRepeat();
          }}
        >
          <ChevronDown size={10} strokeWidth={2} />
        </button>
      </span>
    </span>
  );
}
