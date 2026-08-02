import * as React from "react";
import { cn } from "../cn";

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "children"
> & {
  options: SelectOption[];
  label?: string;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, options, label, id, ...props }, ref) => {
    const selectId = id ?? props.name;
    return (
      <label className={cn("grid gap-1.5", className)}>
        {label ? (
          <span className="text-[12px] text-[var(--fg-muted)]">{label}</span>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--bg-app)] px-2.5 py-2 text-[var(--fg)]"
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    );
  },
);

Select.displayName = "Select";
