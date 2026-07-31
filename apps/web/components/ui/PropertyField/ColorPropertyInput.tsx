"use client";

import { Eye, EyeOff, Minus } from "lucide-react";
import { KeyframeToggle } from "../KeyframeToggle/KeyframeToggle";
import { cn } from "@/lib/utils";

export interface ColorPropertyInputProps {
  id?: string;
  label?: string;
  value: string;
  opacity?: number; // 0 to 100
  onChange?: (color: string) => void;
  onChangeOpacity?: (opacity: number) => void;
  keyframeable?: boolean;
  isKeyframed?: boolean;
  onToggleKeyframe?: () => void;
  visible?: boolean;
  onToggleVisibility?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  className?: string;
}

export function ColorPropertyInput({
  id,
  label,
  value,
  opacity = 100,
  onChange,
  onChangeOpacity,
  keyframeable = false,
  isKeyframed = false,
  onToggleKeyframe,
  visible = true,
  onToggleVisibility,
  onDelete,
  disabled = false,
  className,
}: ColorPropertyInputProps) {
  const hexValue = value.startsWith("#") ? value.slice(1) : value;

  return (
    <div className={cn("flex items-center gap-1.5 min-w-0 flex-1", className)}>
      <div className="flex flex-1 items-center gap-1.5 rounded-[4px] bg-[var(--bg-hover,#262626)] px-1.5 py-1 min-w-0">
        {/* Color Swatch */}
        <label className="relative flex size-4 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[3px] border border-white/10">
          <span
            className="absolute inset-0"
            style={{ backgroundColor: value || "#000000" }}
          />
          <input
            id={id}
            type="color"
            disabled={disabled}
            value={value.startsWith("#") ? value : `#${value}`}
            onChange={(e) => onChange?.(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        {/* Hex Input */}
        <div className="flex flex-1 items-center min-w-0">
          <span className="text-[10px] text-[var(--fg-muted)] select-none mr-0.5">#</span>
          <input
            type="text"
            disabled={disabled}
            value={hexValue}
            onChange={(e) => {
              const val = e.target.value;
              onChange?.(val.startsWith("#") ? val : `#${val}`);
            }}
            className="w-full min-w-0 bg-transparent text-ui font-mono uppercase text-[var(--fg,#FFF)] outline-none disabled:opacity-40"
          />
        </div>

        {/* Opacity % Input */}
        {onChangeOpacity !== undefined ? (
          <div className="flex w-11 shrink-0 items-center justify-end border-l border-white/10 pl-1">
            <input
              type="number"
              min={0}
              max={100}
              disabled={disabled}
              value={opacity}
              onChange={(e) => onChangeOpacity?.(Number(e.target.value))}
              className="w-6 bg-transparent text-right text-ui font-regular text-[var(--fg)] outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="text-[10px] text-[var(--fg-muted)] select-none">%</span>
          </div>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {keyframeable ? (
          <KeyframeToggle
            active={isKeyframed}
            onClick={onToggleKeyframe}
            disabled={disabled}
          />
        ) : null}

        {onToggleVisibility ? (
          <button
            type="button"
            onClick={onToggleVisibility}
            disabled={disabled}
            className="flex size-5 items-center justify-center rounded-[3px] text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-30"
          >
            {visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        ) : null}

        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="flex size-5 items-center justify-center rounded-[3px] text-[var(--fg-muted)] hover:text-red-400 disabled:opacity-30"
          >
            <Minus size={12} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
