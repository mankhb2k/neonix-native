import { isMixedValue } from "@motionvideo/editor-core";
import type { MixedValue } from "@motionvideo/editor-core";

type Props = {
  label: string;
  value: string | MixedValue;
  disabled?: boolean;
  onCommit: (value: string) => void;
};

export function ColorPropertyEditor({
  label,
  value,
  disabled,
  onCommit,
}: Props) {
  const mixed = isMixedValue(value);
  const solid = mixed ? "#000000" : value.startsWith("#") ? value : "#000000";

  return (
    <label className="prop-editor">
      <span className="prop-editor__label">{label}</span>
      <input
        className="prop-editor__input prop-editor__input--color"
        type="color"
        disabled={disabled || mixed}
        value={solid}
        title={mixed ? "Mixed" : value}
        onChange={(e) => onCommit(e.target.value)}
      />
      <input
        className="prop-editor__input"
        type="text"
        disabled={disabled}
        placeholder={mixed ? "Mixed" : undefined}
        defaultValue={mixed ? "" : value}
        key={mixed ? "mixed" : value}
        onBlur={(e) => {
          const next = e.target.value.trim();
          if (next) onCommit(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}
