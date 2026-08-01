import { useEffect, useState } from "react";
import { isMixedValue, type MixedValue } from "@motionvideo/editor-core";

type Props = {
  label: string;
  value: string | MixedValue;
  disabled?: boolean;
  onCommit: (value: string) => void;
};

export function StringPropertyEditor({
  label,
  value,
  disabled,
  onCommit,
}: Props) {
  const mixed = isMixedValue(value);
  const [draft, setDraft] = useState(mixed ? "" : value);

  useEffect(() => {
    setDraft(mixed ? "" : value);
  }, [value, mixed]);

  return (
    <label className="prop-editor">
      <span className="prop-editor__label">{label}</span>
      <input
        className="prop-editor__input"
        type="text"
        disabled={disabled}
        placeholder={mixed ? "Mixed" : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!draft.trim()) {
            setDraft(mixed ? "" : value);
            return;
          }
          onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}
