"use client";

import type {
  ButtonHTMLAttributes,
  ChangeEvent,
  InputHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { KeyframeToggle } from "../KeyframeToggle/KeyframeToggle";
import { cn } from "@/lib/utils";

export interface PropertySectionProps {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function PropertySection({
  title,
  action,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
}: PropertySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className={cn("border-b border-[var(--line,#262626)] px-3 py-2.5", className)}>
      <div className="flex h-6 items-center justify-between">
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => collapsible && setIsOpen((prev) => !prev)}
          className={cn(
            "flex items-center gap-1.5 font-semibold text-[var(--fg,#FFF)] text-body select-none focus:outline-none",
            collapsible && "cursor-pointer hover:text-[var(--fg-muted)]"
          )}
        >
          {collapsible ? (
            <ChevronDown
              size={12}
              className={cn(
                "transition-transform duration-150 text-[var(--fg-muted)]",
                !isOpen && "-rotate-90"
              )}
            />
          ) : null}
          <span>{title}</span>
        </button>

        {action ? <div className="flex items-center gap-1">{action}</div> : null}
      </div>

      {isOpen ? <div className="mt-2 flex flex-col gap-2">{children}</div> : null}
    </section>
  );
}

export interface PropertyLabelProps {
  children: ReactNode;
  className?: string;
}

export function PropertyLabel({ children, className }: PropertyLabelProps) {
  return (
    <span
      className={cn("mb-1 block text-caption text-[var(--fg-muted)] select-none", className)}
    >
      {children}
    </span>
  );
}

export interface PropertyRowProps {
  children: ReactNode;
  className?: string;
}

export function PropertyRow({ children, className }: PropertyRowProps) {
  return <div className={cn("flex items-center gap-2 min-w-0", className)}>{children}</div>;
}

export interface PropertyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  prefix?: ReactNode;
  suffix?: string;
  stepper?: boolean;
  keyframeable?: boolean;
  isKeyframed?: boolean;
  onToggleKeyframe?: () => void;
  scrubbable?: boolean;
}

export function PropertyInput({
  id,
  label,
  prefix,
  suffix,
  stepper = false,
  keyframeable = false,
  isKeyframed = false,
  onToggleKeyframe,
  scrubbable = true,
  className,
  disabled,
  step = 1,
  min,
  max,
  value,
  defaultValue,
  onChange,
  ...props
}: PropertyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startValueRef = useRef(0);

  function adjust(direction: 1 | -1, multiplier = 1) {
    if (disabled) return;

    const stepSize = (Number(step ?? 1) || 1) * multiplier;
    const minVal = min !== undefined && min !== "" ? Number(min) : -Infinity;
    const maxVal = max !== undefined && max !== "" ? Number(max) : Infinity;
    const current = Number(
      value ?? inputRef.current?.value ?? defaultValue ?? 0
    );
    const raw = (Number.isFinite(current) ? current : 0) + direction * stepSize;
    const next = Math.min(maxVal, Math.max(minVal, Number(raw.toFixed(2))));
    const nextValue = String(next);

    if (onChange) {
      onChange({
        target: { value: nextValue },
        currentTarget: { value: nextValue },
      } as ChangeEvent<HTMLInputElement>);
      return;
    }

    if (inputRef.current) {
      inputRef.current.value = nextValue;
    }
  }

  // Mouse Scrubbing logic on prefix/label
  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (disabled || !scrubbable) return;
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startValueRef.current = Number(value ?? inputRef.current?.value ?? 0) || 0;

    const handleMouseMove = (moveEvt: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvt.clientX - startXRef.current;
      const stepSize = Number(step ?? 1) || 1;
      const multiplier = moveEvt.shiftKey ? 10 : moveEvt.altKey ? 0.1 : 1;
      const deltaValue = Math.round(deltaX / 2) * stepSize * multiplier;

      const minVal = min !== undefined && min !== "" ? Number(min) : -Infinity;
      const maxVal = max !== undefined && max !== "" ? Number(max) : Infinity;
      const next = Math.min(
        maxVal,
        Math.max(minVal, Number((startValueRef.current + deltaValue).toFixed(2)))
      );

      if (onChange) {
        onChange({
          target: { value: String(next) },
          currentTarget: { value: String(next) },
        } as ChangeEvent<HTMLInputElement>);
      } else if (inputRef.current) {
        inputRef.current.value = String(next);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <label className={cn("flex min-w-0 flex-1 flex-col", className)}>
      {label ? (
        <div className="flex items-center justify-between">
          <PropertyLabel>{label}</PropertyLabel>
          {keyframeable && !prefix ? (
            <KeyframeToggle
              active={isKeyframed}
              onClick={onToggleKeyframe}
              disabled={disabled}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 items-center rounded-[4px] bg-[var(--bg-hover,#262626)] py-1">
          {prefix ? (
            <div
              onMouseDown={handleMouseDown}
              className={cn(
                "flex shrink-0 items-center select-none pl-2 pr-1 text-[var(--fg-muted,#A3A3A3)]",
                scrubbable && !disabled && "cursor-ew-resize hover:text-[var(--fg,#FFF)]"
              )}
            >
              <span className="text-ui font-medium leading-none">{prefix}</span>
            </div>
          ) : null}

          <div className={cn("flex min-w-0 flex-1 items-center", prefix ? "px-1" : "px-2")}>
            <input
              ref={inputRef}
              id={id}
              disabled={disabled}
              step={step}
              min={min}
              max={max}
              value={value}
              defaultValue={defaultValue}
              onChange={onChange}
              className="w-full min-w-0 bg-transparent p-0 text-ui font-regular leading-none text-[var(--fg,#FFF)] outline-none disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              {...props}
            />
            {suffix ? (
              <span className="ml-0.5 text-[11px] text-[var(--fg-muted)] select-none">
                {suffix}
              </span>
            ) : null}
          </div>

          {keyframeable && prefix ? (
            <div className="pr-1">
              <KeyframeToggle
                active={isKeyframed}
                onClick={onToggleKeyframe}
                disabled={disabled}
              />
            </div>
          ) : null}
        </div>

        {stepper ? (
          <div className="flex w-4 shrink-0 flex-col overflow-hidden rounded-[4px] bg-[var(--bg-hover,#262626)]">
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="Tăng"
              className="flex h-3 items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                adjust(1);
              }}
            >
              <ChevronUp size={10} strokeWidth={2} />
            </button>
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label="Giảm"
              className="flex h-3 items-center justify-center text-[var(--fg-muted)] hover:text-[var(--fg)] disabled:opacity-40"
              onClick={(e) => {
                e.preventDefault();
                adjust(-1);
              }}
            >
              <ChevronDown size={10} strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>
    </label>
  );
}

export interface PropertySelectProps
  extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function PropertySelect({
  id,
  label,
  children,
  className,
  ...props
}: PropertySelectProps) {
  return (
    <label className={cn("flex min-w-0 flex-1 flex-col", className)}>
      {label ? <PropertyLabel>{label}</PropertyLabel> : null}
      <div className="relative flex items-center rounded-[4px] bg-[var(--bg-hover,#262626)] px-2 py-1">
        <select
          id={id}
          className="h-full w-full appearance-none bg-transparent pr-5 text-ui font-regular leading-none text-[var(--fg,#FFF)] outline-none disabled:opacity-40"
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={12}
          className="pointer-events-none absolute right-2 text-[var(--fg-muted)]"
        />
      </div>
    </label>
  );
}

export interface PropertyColorProps {
  id?: string;
  label?: string;
  value: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function PropertyColor({
  id,
  label,
  value,
  onChange,
  className,
}: PropertyColorProps) {
  return (
    <label className={cn("flex min-w-0 flex-col", className)}>
      {label ? <PropertyLabel>{label}</PropertyLabel> : null}
      <div className="flex items-center gap-2 rounded-[4px] bg-[var(--bg-hover,#262626)] px-2 py-1">
        <input
          id={id}
          type="color"
          className="size-4 cursor-pointer rounded-sm border-0 bg-transparent p-0"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
        />
        <span className="truncate text-ui font-regular leading-none uppercase text-[var(--fg)]">
          {value}
        </span>
      </div>
    </label>
  );
}

export interface PropertyIconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  children: ReactNode;
}

export function PropertyIconButton({
  label,
  active = false,
  children,
  className,
  ...props
}: PropertyIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "flex size-6 items-center justify-center rounded-[4px] transition-colors",
        active
          ? "bg-[var(--accent,#3B82F6)] text-white"
          : "text-[var(--fg-muted,#A3A3A3)] hover:bg-[var(--bg-hover,#262626)] hover:text-[var(--fg,#FFF)]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
