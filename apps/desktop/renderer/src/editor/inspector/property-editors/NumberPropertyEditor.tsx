import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { isMixedValue } from "@motionvideo/editor-core";
import type { MixedValue } from "@motionvideo/editor-core";

type Props = {
  label: string;
  value: number | MixedValue;
  disabled?: boolean;
  step?: number;
  onPreview: (value: number, gestureId: string) => void;
  onCommit: (value: number, gestureId?: string) => void;
};

export function NumberPropertyEditor({
  label,
  value,
  disabled,
  step = 1,
  onPreview,
  onCommit,
}: Props) {
  const mixed = isMixedValue(value);
  const [draft, setDraft] = useState(mixed ? "" : String(value));
  const scrubbing = useRef(false);
  const startX = useRef(0);
  const startValue = useRef(0);
  const gestureIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (scrubbing.current) return;
    setDraft(mixed ? "" : String(value));
  }, [value, mixed]);

  const parseDraft = useCallback(() => {
    const n = Number(draft);
    return Number.isFinite(n) ? n : null;
  }, [draft]);

  const onPointerDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (disabled || mixed) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    scrubbing.current = true;
    startX.current = e.clientX;
    startValue.current = typeof value === "number" ? value : 0;
    gestureIdRef.current = `scrub_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!scrubbing.current || !gestureIdRef.current) return;
    const delta = e.clientX - startX.current;
    const next = startValue.current + delta * step;
    setDraft(String(Math.round(next * 1000) / 1000));
    onPreview(next, gestureIdRef.current);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLSpanElement>) => {
    if (!scrubbing.current) return;
    scrubbing.current = false;
    const gestureId = gestureIdRef.current;
    gestureIdRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const n = parseDraft();
    if (n !== null) onCommit(n, gestureId ?? undefined);
  };

  return (
    <label className="prop-editor">
      <span
        className={`prop-editor__label${disabled || mixed ? "" : " prop-editor__label--scrub"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {label}
      </span>
      <input
        className="prop-editor__input"
        type="text"
        inputMode="decimal"
        disabled={disabled}
        placeholder={mixed ? "Mixed" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = parseDraft();
          if (n === null) {
            setDraft(mixed ? "" : String(value));
            return;
          }
          onCommit(n);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </label>
  );
}
