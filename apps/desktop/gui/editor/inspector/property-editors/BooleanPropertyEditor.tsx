import { isMixedValue, type MixedValue } from "@motionvideo/editor-core";

type Props = {
  label: string;
  value: boolean | MixedValue;
  disabled?: boolean;
  onCommit: (value: boolean) => void;
};

export function BooleanPropertyEditor({
  label,
  value,
  disabled,
  onCommit,
}: Props) {
  const mixed = isMixedValue(value);
  return (
    <label className="prop-editor prop-editor--row">
      <span className="prop-editor__label">{label}</span>
      {mixed ? (
        <button
          type="button"
          className="btn"
          disabled={disabled}
          onClick={() => onCommit(true)}
        >
          Mixed
        </button>
      ) : (
        <input
          type="checkbox"
          checked={value}
          disabled={disabled}
          onChange={(e) => onCommit(e.target.checked)}
        />
      )}
    </label>
  );
}
