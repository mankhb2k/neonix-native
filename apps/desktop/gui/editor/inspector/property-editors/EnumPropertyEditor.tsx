import { isMixedValue } from "@motionvideo/editor-core";
import type { MixedValue } from "@motionvideo/editor-core";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string | MixedValue;
  options: readonly Option[];
  disabled?: boolean;
  onCommit: (value: string) => void;
};

export function EnumPropertyEditor({
  label,
  value,
  options,
  disabled,
  onCommit,
}: Props) {
  const mixed = isMixedValue(value);

  return (
    <label className="prop-editor">
      <span className="prop-editor__label">{label}</span>
      <select
        className="prop-editor__input"
        disabled={disabled}
        value={mixed ? "" : value}
        onChange={(e) => {
          if (e.target.value) onCommit(e.target.value);
        }}
      >
        {mixed ? <option value="">Mixed</option> : null}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
