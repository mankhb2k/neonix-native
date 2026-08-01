import { useEffect, useRef, useState } from "react";
import { isMixedValue } from "@motionvideo/editor-core";
import type { MixedValue, Vector2 } from "@motionvideo/editor-core";

type Props = {
  label: string;
  value: Vector2 | MixedValue;
  disabled?: boolean;
  onCommit: (value: Vector2) => void;
};

function vectorKey(value: Vector2 | MixedValue, mixed: boolean): string {
  if (mixed) return "mixed";
  const v = value as Vector2;
  return `${v.x},${v.y}`;
}

export function VectorPropertyEditor({
  label,
  value,
  disabled,
  onCommit,
}: Props) {
  const mixed = isMixedValue(value);
  const [x, setX] = useState(mixed ? "" : String((value as Vector2).x));
  const [y, setY] = useState(mixed ? "" : String((value as Vector2).y));
  const focusedRef = useRef(false);
  const lastSyncedKey = useRef(vectorKey(value, mixed));

  useEffect(() => {
    const key = vectorKey(value, mixed);
    if (key === lastSyncedKey.current) return;
    if (focusedRef.current) return;
    lastSyncedKey.current = key;
    if (mixed) {
      setX("");
      setY("");
    } else {
      const v = value as Vector2;
      setX(String(v.x));
      setY(String(v.y));
    }
  }, [value, mixed]);

  function commit() {
    if (x.trim() === "" || y.trim() === "") return;
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    lastSyncedKey.current = `${nx},${ny}`;
    onCommit({ x: nx, y: ny });
  }

  return (
    <label className="prop-editor">
      <span className="prop-editor__label">{label}</span>
      <input
        className="prop-editor__input"
        type="text"
        inputMode="decimal"
        disabled={disabled}
        placeholder={mixed ? "X mixed" : "X"}
        value={x}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(e) => setX(e.target.value)}
        onBlur={() => {
          focusedRef.current = false;
          commit();
        }}
      />
      <input
        className="prop-editor__input"
        type="text"
        inputMode="decimal"
        disabled={disabled}
        placeholder={mixed ? "Y mixed" : "Y"}
        value={y}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(e) => setY(e.target.value)}
        onBlur={() => {
          focusedRef.current = false;
          commit();
        }}
      />
    </label>
  );
}
