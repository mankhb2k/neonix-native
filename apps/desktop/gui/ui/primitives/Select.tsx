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
      <label className={cn("ui-select", className)}>
        {label ? <span className="ui-select__label">{label}</span> : null}
        <select ref={ref} id={selectId} className="ui-select__control" {...props}>
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
